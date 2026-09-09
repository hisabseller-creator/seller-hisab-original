import { parseFinancialDate } from "../dates";
import { parseMoneyToPaise } from "../money";
import { PARSER_VERSION, type NormalizedEvent, type ParserIssue } from "../types";
import type { ConnectorId } from "./registry";

export type ApiConnectorId = Extract<ConnectorId, "amazon-in-v1" | "flipkart-v1" | "shopify-v1" | "woocommerce-v1">;
export type OAuthApiConnectorId = Exclude<ApiConnectorId, "woocommerce-v1">;

export type OAuthProviderConfig = {
  connectorId: OAuthApiConnectorId;
  redirectUri: string;
  state: string;
  clientId: string;
  shop?: string;
  scopes?: string[];
  amazonApplicationId?: string;
  amazonDraft?: boolean;
};

export type ApiLedgerRecord = {
  key: string;
  orderLineUid?: string;
  semantic: string;
  amountPaise: number;
  currency: string;
  occurredAt?: string;
  sourceReference: Record<string, unknown>;
};

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function iso(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function moneyBag(value: unknown): { amountPaise?: number; currency?: string } {
  const bag = object(value);
  const money = object(bag?.shopMoney ?? bag?.presentmentMoney ?? value);
  if (!money) return {};
  return {
    amountPaise: parseMoneyToPaise(money.amount),
    currency: text(money.currencyCode) || undefined,
  };
}

export function normalizeShopifyShop(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

export function defaultShopifyScopes(value?: string): string[] {
  const source = value?.trim() || "read_orders";
  return [...new Set(source.split(",").map((scope) => scope.trim()).filter(Boolean))];
}

export function canonicalShopifyHmacMessage(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function buildOfficialAuthorizationUrl(config: OAuthProviderConfig): string {
  if (config.connectorId === "shopify-v1") {
    const shop = normalizeShopifyShop(config.shop ?? "");
    if (!shop) throw new Error("A valid .myshopify.com store is required.");
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("scope", (config.scopes ?? []).join(","));
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", config.state);
    return url.toString();
  }

  if (config.connectorId === "amazon-in-v1") {
    if (!config.amazonApplicationId) throw new Error("Amazon SP-API application ID is required.");
    const url = new URL("https://sellercentral.amazon.in/apps/authorize/consent");
    url.searchParams.set("application_id", config.amazonApplicationId);
    url.searchParams.set("state", config.state);
    if (config.amazonDraft) url.searchParams.set("version", "beta");
    return url.toString();
  }

  const url = new URL("https://api.flipkart.net/oauth-service/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "Seller_Api");
  url.searchParams.set("state", config.state);
  return url.toString();
}

/**
 * Normalizes only business/financial fields from Shopify Admin GraphQL.
 * Customer names, emails, phones and addresses are intentionally not requested
 * by the F6 query and therefore cannot enter SellerHisab's canonical sync layer.
 */
export function mapShopifyOrdersGraphql(
  payload: unknown,
  context: { sourceFingerprint: string; channelAccountId?: string },
): { events: NormalizedEvent[]; issues: ParserIssue[] } {
  const root = object(payload) ?? {};
  const data = object(root.data) ?? root;
  const ordersConnection = object(data.orders) ?? {};
  const orders = array(ordersConnection.nodes);
  const events: NormalizedEvent[] = [];
  const issues: ParserIssue[] = [];
  let row = 1;

  for (const rawOrder of orders) {
    const order = object(rawOrder);
    if (!order) continue;
    const orderId = text(order.id);
    const orderName = text(order.name) || orderId;
    const financial = text(order.displayFinancialStatus);
    const fulfillment = text(order.displayFulfillmentStatus);
    const cancelledAt = iso(order.cancelledAt);
    const createdAt = iso(order.createdAt);
    const lineItemConnection = object(order.lineItems) ?? {};
    if (object(lineItemConnection.pageInfo)?.hasNextPage === true) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: "Shopify order has more line items than the bounded sync query returned; that order was not normalized to avoid partial finance.",
      });
      continue;
    }
    const lineItems = array(lineItemConnection.nodes);

    for (const rawLine of lineItems) {
      row += 1;
      const line = object(rawLine);
      if (!line) continue;
      const lineId = text(line.id);
      const sku = text(line.sku);
      const quantity = Number(line.quantity ?? 0);
      const discountedUnit = moneyBag(line.discountedUnitPriceAfterAllDiscountsSet ?? line.discountedUnitPriceSet);
      if (!orderId || !lineId || !sku) {
        issues.push({
          code: "missing_identifier",
          severity: "critical",
          message: "Shopify Admin API line item is missing order, line-item or SKU identity and was not normalized.",
        });
        continue;
      }
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000 || discountedUnit.amountPaise === undefined) {
        issues.push({
          code: "invalid_value",
          severity: "critical",
          message: "Shopify Admin API line item has an invalid quantity or price and was not normalized.",
        });
        continue;
      }
      const rawStatus = [financial, fulfillment, cancelledAt ? "CANCELLED" : ""].filter(Boolean).join(" / ") || "shopify order";
      const outcome = cancelledAt
        ? "cancelled"
        : /fulfilled/i.test(fulfillment) && /paid|partially_refunded|refunded/i.test(financial)
          ? "delivered"
          : "pending";
      events.push({
        eventId: `${context.sourceFingerprint}:shopify:${lineId}`,
        kind: "order",
        channelId: "shopify",
        channelAccountId: context.channelAccountId,
        currency: discountedUnit.currency,
        subOrderId: lineId,
        orderId: orderName,
        sku,
        rawStatus,
        outcome,
        quantity,
        salePaise: discountedUnit.amountPaise * quantity,
        settlementPaise: undefined,
        eventDate: createdAt,
        source: {
          fileName: "Shopify Admin GraphQL",
          channelId: "shopify",
          channelAccountId: context.channelAccountId,
          sheetName: "Orders API 2026-07",
          rowNumber: row,
          parserVersion: PARSER_VERSION,
          sourceFingerprint: context.sourceFingerprint,
        },
      });
    }
  }

  return { events, issues };
}

export function orderEventsToLedgerRecords(events: NormalizedEvent[]): ApiLedgerRecord[] {
  return events.flatMap((event) => {
    if (event.salePaise === undefined) return [];
    return [{
      key: `${event.eventId}:sale`,
      orderLineUid: event.subOrderId,
      semantic: "api-observation:order-sale",
      amountPaise: event.salePaise,
      currency: event.currency || "INR",
      occurredAt: event.eventDate,
      sourceReference: {
        channelId: event.channelId,
        channelAccountId: event.channelAccountId,
        orderId: event.orderId,
        sku: event.sku,
        outcome: event.outcome,
        rawStatus: event.rawStatus,
        observationOnly: true,
        source: event.source,
      },
    }];
  });
}
