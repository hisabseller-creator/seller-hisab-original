import { parseFinancialDate } from "../dates";
import { parseMoneyToPaise } from "../money";
import { PARSER_VERSION, type NormalizedEvent, type ParserIssue } from "../types";

export type OfficialMapperResult = {
  events: NormalizedEvent[];
  issues: ParserIssue[];
};

type MapperContext = {
  sourceFingerprint: string;
  channelAccountId?: string;
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

function positiveInt(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 10_000 ? parsed : fallback;
}

function iso(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function money(value: unknown): { amountPaise?: number; currency?: string } {
  if (value === undefined || value === null) return {};
  const obj = object(value);
  if (!obj) return { amountPaise: parseMoneyToPaise(value) };
  const raw = obj.amount ?? obj.value ?? obj.Amount ?? obj.Value;
  return {
    amountPaise: parseMoneyToPaise(raw),
    currency: text(obj.currencyCode ?? obj.currency ?? obj.CurrencyCode ?? obj.Currency) || undefined,
  };
}

function amazonItemSubtotal(item: Record<string, unknown>): { amountPaise?: number; currency?: string } {
  const proceeds = object(item.proceeds);
  for (const entry of array(proceeds?.breakdowns)) {
    const breakdown = object(entry);
    if (!breakdown) continue;
    const type = text(breakdown.type).toUpperCase();
    if (type !== "ITEM") continue;
    return money(breakdown.subtotal);
  }
  return {};
}

export function mapAmazonOrdersApi2026(payload: unknown, context: MapperContext): OfficialMapperResult {
  const root = object(payload) ?? {};
  const orders = array(root.orders ?? object(root.payload)?.orders);
  const events: NormalizedEvent[] = [];
  const issues: ParserIssue[] = [];
  let sourceRow = 1;

  for (const rawOrder of orders) {
    const order = object(rawOrder);
    if (!order) continue;
    const orderId = text(order.orderId ?? order.amazonOrderId);
    const createdTime = iso(order.createdTime ?? order.purchaseDate);
    const rawStatus = text(order.orderStatus ?? order.status) || "amazon order";
    const items = array(order.orderItems ?? order.items);

    for (const rawItem of items) {
      sourceRow += 1;
      const item = object(rawItem);
      if (!item) continue;
      const product = object(item.product) ?? {};
      const orderItemId = text(item.orderItemId ?? item.OrderItemId);
      const sku = text(product.sellerSku ?? item.sellerSku ?? item.SellerSKU);
      if (!orderId || !orderItemId || !sku) {
        issues.push({
          code: "missing_identifier",
          severity: "critical",
          message: "Amazon Orders API item is missing orderId, orderItemId or sellerSku and was not normalized.",
        });
        continue;
      }
      const subtotal = amazonItemSubtotal(item);
      events.push({
        eventId: `${context.sourceFingerprint}:amazon:${orderItemId}`,
        kind: "order",
        channelId: "amazon-in",
        channelAccountId: context.channelAccountId,
        currency: subtotal.currency,
        subOrderId: orderItemId,
        orderId,
        sku,
        rawStatus,
        outcome: /cancel/i.test(rawStatus) ? "cancelled" : "pending",
        quantity: positiveInt(item.quantityOrdered ?? item.quantity),
        salePaise: subtotal.amountPaise,
        settlementPaise: undefined,
        eventDate: createdTime,
        source: {
          fileName: "Amazon SP-API",
          channelId: "amazon-in",
          channelAccountId: context.channelAccountId,
          sheetName: "Orders API v2026-01-01",
          rowNumber: sourceRow,
          parserVersion: PARSER_VERSION,
          sourceFingerprint: context.sourceFingerprint,
        },
      });
    }
  }
  return { events, issues };
}

export function mapFlipkartShipmentsV3(payload: unknown, context: MapperContext): OfficialMapperResult {
  const root = object(payload) ?? {};
  const shipments = array(root.shipments ?? object(root.response)?.shipments);
  const events: NormalizedEvent[] = [];
  const issues: ParserIssue[] = [];
  let sourceRow = 1;

  for (const rawShipment of shipments) {
    const shipment = object(rawShipment);
    if (!shipment) continue;
    const shipmentStatus = text(shipment.status ?? shipment.state) || "flipkart shipment";
    const fallbackDate = iso(shipment.updatedAt ?? shipment.orderDate);

    for (const rawItem of array(shipment.orderItems)) {
      sourceRow += 1;
      const item = object(rawItem);
      if (!item) continue;
      const orderId = text(item.orderId);
      const orderItemId = text(item.orderItemId);
      const sku = text(item.sku);
      if (!orderId || !orderItemId || !sku) {
        issues.push({
          code: "missing_identifier",
          severity: "critical",
          message: "Flipkart shipment item is missing orderId, orderItemId or sku and was not normalized.",
        });
        continue;
      }
      const priceComponents = object(item.priceComponents) ?? {};
      const totalPrice = parseMoneyToPaise(priceComponents.totalPrice);
      const sellingPrice = parseMoneyToPaise(priceComponents.sellingPrice);
      const quantity = positiveInt(item.quantity);
      const salePaise = totalPrice ?? (sellingPrice === undefined ? undefined : sellingPrice * quantity);
      const rawStatus = text(item.status ?? item.state) || shipmentStatus;

      events.push({
        eventId: `${context.sourceFingerprint}:flipkart:${orderItemId}`,
        kind: "order",
        channelId: "flipkart",
        channelAccountId: context.channelAccountId,
        currency: "INR",
        subOrderId: orderItemId,
        orderId,
        sku,
        rawStatus,
        outcome: /cancel/i.test(rawStatus) ? "cancelled" : "pending",
        quantity,
        salePaise,
        settlementPaise: undefined,
        eventDate: iso(item.orderDate) ?? fallbackDate,
        source: {
          fileName: "Flipkart Seller API",
          channelId: "flipkart",
          channelAccountId: context.channelAccountId,
          sheetName: "Order Management API v3",
          rowNumber: sourceRow,
          parserVersion: PARSER_VERSION,
          sourceFingerprint: context.sourceFingerprint,
        },
      });
    }
  }
  return { events, issues };
}
