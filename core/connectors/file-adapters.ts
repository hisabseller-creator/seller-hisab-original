import type { SalesChannelId } from "../channels/catalog";
import { mapHeaders, normalizeHeader } from "../parsers/aliases";
import type { ParsedReport } from "../types";
import type { ConnectorId } from "./registry";

export type ReportTypeHint = ParsedReport["reportType"];

export type TabularDetectionInput = {
  fileName: string;
  rows: unknown[][];
};

export type TabularConnectorMatch = {
  connectorId: ConnectorId;
  channelId: SalesChannelId;
  adapterId: string;
  live: boolean;
  confidenceBps: number;
  reasons: string[];
  headerRowIndex: number;
  schemaFingerprint: string;
  reportTypeHint: ReportTypeHint;
};

export type TabularConnectorAdapter = {
  connectorId: ConnectorId;
  channelId: SalesChannelId;
  adapterId: string;
  live: boolean;
  detect: (input: TabularDetectionInput) => TabularConnectorMatch | undefined;
};

type HeaderCandidate = {
  index: number;
  normalized: string[];
  set: Set<string>;
  mappedCount: number;
  reportTypeHint: ReportTypeHint;
  schemaFingerprint: string;
};

function reportTypeHint(headers: unknown[]): ReportTypeHint {
  const { mapping } = mapHeaders(headers);
  if (mapping.adSpend !== undefined) return "ads";
  if (mapping.settlementAmount !== undefined) return "payments";
  if (mapping.saleAmount !== undefined) return "orders";
  return "diagnostic";
}

export function buildSchemaFingerprint(headers: unknown[]): string {
  const normalized = headers.map(normalizeHeader).filter(Boolean);
  const source = normalized.join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `schema_${(hash >>> 0).toString(16).padStart(8, "0")}_${normalized.length}`;
}

function candidates(rows: unknown[][]): HeaderCandidate[] {
  const output: HeaderCandidate[] = [];
  const limit = Math.min(rows.length, 30);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] ?? [];
    const normalized = row.map(normalizeHeader).filter(Boolean);
    if (normalized.length < 2) continue;
    const { mapping } = mapHeaders(row);
    output.push({
      index,
      normalized,
      set: new Set(normalized),
      mappedCount: Object.keys(mapping).length,
      reportTypeHint: reportTypeHint(row),
      schemaFingerprint: buildSchemaFingerprint(row),
    });
  }
  return output;
}

function has(candidate: HeaderCandidate, ...values: string[]): boolean {
  return values.some((value) => candidate.set.has(normalizeHeader(value)));
}

function filenameHas(fileName: string, ...values: string[]): boolean {
  const normalized = normalizeHeader(fileName);
  return values.some((value) => normalized.includes(normalizeHeader(value)));
}

function bestMatch(
  input: TabularDetectionInput,
  score: (candidate: HeaderCandidate) => { score: number; reasons: string[] } | undefined,
  config: Omit<TabularConnectorMatch, "confidenceBps" | "reasons" | "headerRowIndex" | "schemaFingerprint" | "reportTypeHint">,
): TabularConnectorMatch | undefined {
  let winner: { candidate: HeaderCandidate; score: number; reasons: string[] } | undefined;
  for (const candidate of candidates(input.rows)) {
    const result = score(candidate);
    if (!result || result.score <= 0) continue;
    if (!winner || result.score > winner.score || (result.score === winner.score && candidate.mappedCount > winner.candidate.mappedCount)) {
      winner = { candidate, ...result };
    }
  }
  if (!winner) return undefined;
  return {
    ...config,
    confidenceBps: Math.min(10_000, Math.max(0, winner.score)),
    reasons: winner.reasons,
    headerRowIndex: winner.candidate.index,
    schemaFingerprint: winner.candidate.schemaFingerprint,
    reportTypeHint: winner.candidate.reportTypeHint,
  };
}

const meeshoAdapter: TabularConnectorAdapter = {
  connectorId: "meesho-file-v1",
  channelId: "meesho",
  adapterId: "meesho-tabular-v1",
  live: true,
  detect(input) {
    const fileHint = filenameHas(input.fileName, "meesho");
    return bestMatch(
      input,
      (candidate) => {
        const supplierSku = has(candidate, "supplier sku", "supplier_sku");
        const subOrder = has(candidate, "sub order number", "sub order no", "suborder number", "suborder no", "sub order id");
        const adSpend = has(candidate, "ad spend", "ads spend", "amount spent", "campaign spend", "total ad spend", "total spend");
        const adSales = has(candidate, "attributed sales", "attributable sales", "sales from ads", "ad sales", "conversion value", "revenue from ads");
        const moneyShape = candidate.reportTypeHint === "payments" || candidate.reportTypeHint === "orders";

        if (supplierSku && subOrder && moneyShape) {
          return { score: fileHint ? 10_000 : 9_850, reasons: ["Meesho-style Sub Order + Supplier SKU fingerprint", ...(fileHint ? ["filename mentions Meesho"] : [])] };
        }
        if (supplierSku && adSpend && (adSales || candidate.mappedCount >= 2)) {
          return { score: fileHint ? 9_900 : 9_300, reasons: ["Meesho-style Supplier SKU ads fingerprint", ...(fileHint ? ["filename mentions Meesho"] : [])] };
        }
        if (fileHint && candidate.mappedCount >= 3) {
          return { score: 9_000, reasons: ["filename mentions Meesho", "recognized SellerHisab financial columns"] };
        }
        return undefined;
      },
      { connectorId: "meesho-file-v1", channelId: "meesho", adapterId: "meesho-tabular-v1", live: true },
    );
  },
};

const amazonAdapter: TabularConnectorAdapter = {
  connectorId: "amazon-in-v1",
  channelId: "amazon-in",
  adapterId: "amazon-in-file-v1",
  live: true,
  detect(input) {
    const settlement = bestMatch(
      input,
      (candidate) => {
        const settlementId = has(candidate, "settlement-id", "settlement id");
        const transactionType = has(candidate, "transaction-type", "transaction type");
        const orderId = has(candidate, "order-id", "order id");
        const amount = has(candidate, "amount");
        const amountType = has(candidate, "amount-type", "amount type");
        if (settlementId && transactionType && orderId && amount && amountType) {
          return { score: 10_000, reasons: ["Amazon Settlement Flat File V2 fingerprint"] };
        }
        return undefined;
      },
      { connectorId: "amazon-in-v1", channelId: "amazon-in", adapterId: "amazon-settlement-flat-file-v2", live: true },
    );
    if (settlement) return settlement;

    const orders = bestMatch(
      input,
      (candidate) => {
        const amazonOrder = has(candidate, "amazon order id", "amazon-order-id");
        const sku = has(candidate, "sku", "seller sku");
        const quantity = has(candidate, "quantity purchased", "quantity-purchased", "quantity", "qty");
        const itemPrice = has(candidate, "item price", "item-price");
        if (amazonOrder && sku && quantity && itemPrice) {
          return { score: 9_980, reasons: ["Amazon Orders report fingerprint"] };
        }
        return undefined;
      },
      { connectorId: "amazon-in-v1", channelId: "amazon-in", adapterId: "amazon-orders-flat-file-v1", live: true },
    );
    if (orders) return orders;

    const fileHint = filenameHas(input.fileName, "amazon");
    return bestMatch(
      input,
      (candidate) => {
        const amazonOrder = has(candidate, "amazon order id", "amazon-order-id");
        const asin = has(candidate, "asin");
        if (amazonOrder || (asin && has(candidate, "seller sku", "sku"))) {
          return { score: 9_100, reasons: ["Amazon report recognized, but this exact schema is not enabled"] };
        }
        if (fileHint && candidate.normalized.length >= 3) return { score: 8_700, reasons: ["filename mentions Amazon"] };
        return undefined;
      },
      { connectorId: "amazon-in-v1", channelId: "amazon-in", adapterId: "amazon-in-recognizer-v1", live: false },
    );
  },
};

const flipkartAdapter: TabularConnectorAdapter = {
  connectorId: "flipkart-v1",
  channelId: "flipkart",
  adapterId: "flipkart-file-v1",
  live: true,
  detect(input) {
    const fileHint = filenameHas(input.fileName, "flipkart");
    const settlement = bestMatch(
      input,
      (candidate) => {
        const orderItem = has(candidate, "order item id", "orderitem id", "order_item_id");
        const orderId = has(candidate, "order id", "order_id");
        const sku = has(candidate, "seller sku", "sku", "sku id", "seller sku id");
        const money = has(
          candidate,
          "net settlement amount",
          "settlement amount",
          "settled amount",
          "final settlement amount",
          "net payable",
          "net payment",
          "payment amount",
          "settlement value",
          "total settlement",
          "total settlement amount",
          "net settled amount",
          "net amount payable",
        );
        const settlementStatus = has(candidate, "settlement status", "payment status", "payout status");
        if (money && orderItem && sku) {
          return { score: 9_990, reasons: ["Flipkart settlement/P&L Order Item fingerprint"] };
        }
        if (money && orderId && (fileHint || settlementStatus)) {
          return { score: 9_960, reasons: [
            "Flipkart order-linked settlement fingerprint",
            ...(fileHint ? ["filename mentions Flipkart"] : []),
          ] };
        }
        return undefined;
      },
      { connectorId: "flipkart-v1", channelId: "flipkart", adapterId: "flipkart-settlement-file-v1", live: true },
    );
    if (settlement) return settlement;

    const orders = bestMatch(
      input,
      (candidate) => {
        const orderItem = has(candidate, "order item id", "orderitem id", "order_item_id");
        const sku = has(candidate, "seller sku", "sku", "sku id", "seller sku id");
        const price = has(candidate, "selling price", "selling price per item", "sale amount", "order item value", "total price", "item price", "total order item value");
        const status = has(candidate, "order state", "order status", "status", "shipment status");
        if (orderItem && sku && price && status) {
          return { score: 9_970, reasons: ["Flipkart Orders report fingerprint"] };
        }
        return undefined;
      },
      { connectorId: "flipkart-v1", channelId: "flipkart", adapterId: "flipkart-orders-file-v1", live: true },
    );
    if (orders) return orders;

    return bestMatch(
      input,
      (candidate) => {
        const fsn = has(candidate, "fsn");
        const orderItem = has(candidate, "order item id", "order item", "orderitem id");
        const listing = has(candidate, "listing id", "listingid");
        if (fsn && orderItem) return { score: 9_100, reasons: ["Flipkart report recognized, but this exact schema is not enabled"] };
        if (fsn && listing) return { score: 9_000, reasons: ["Flipkart listing report recognized"] };
        if (fileHint && candidate.normalized.length >= 3) return { score: 8_700, reasons: ["filename mentions Flipkart"] };
        return undefined;
      },
      { connectorId: "flipkart-v1", channelId: "flipkart", adapterId: "flipkart-recognizer-v1", live: false },
    );
  },
};

const shopifyAdapter: TabularConnectorAdapter = {
  connectorId: "shopify-v1",
  channelId: "shopify",
  adapterId: "shopify-file-v1",
  live: true,
  detect(input) {
    const payments = bestMatch(
      input,
      (candidate) => {
        const transactionDate = has(candidate, "transaction date");
        const type = has(candidate, "type");
        const order = has(candidate, "order");
        const payoutStatus = has(candidate, "payout status");
        const amount = has(candidate, "amount");
        const fee = has(candidate, "fee");
        const net = has(candidate, "net");
        if (transactionDate && type && order && payoutStatus && amount && fee && net) {
          return { score: 10_000, reasons: ["Documented Shopify Payments balance-transactions CSV fingerprint"] };
        }
        return undefined;
      },
      { connectorId: "shopify-v1", channelId: "shopify", adapterId: "shopify-payments-csv-v1", live: true },
    );
    if (payments) return payments;

    const liveOrderExport = bestMatch(
      input,
      (candidate) => {
        const lineItemSku = has(candidate, "lineitem sku", "line item sku");
        const lineItemQuantity = has(candidate, "lineitem quantity", "line item quantity");
        const lineItemPrice = has(candidate, "lineitem price", "line item price");
        const financialStatus = has(candidate, "financial status");
        const name = has(candidate, "name");
        if (name && lineItemSku && lineItemQuantity && lineItemPrice && financialStatus) {
          return { score: 9_950, reasons: ["Documented Shopify Orders CSV fingerprint"] };
        }
        return undefined;
      },
      { connectorId: "shopify-v1", channelId: "shopify", adapterId: "shopify-orders-csv-v1", live: true },
    );
    if (liveOrderExport) return liveOrderExport;

    const fileHint = filenameHas(input.fileName, "shopify");
    return bestMatch(
      input,
      (candidate) => {
        const financialStatus = has(candidate, "financial status");
        const fulfillmentStatus = has(candidate, "fulfillment status");
        if (financialStatus && fulfillmentStatus && has(candidate, "name")) {
          return { score: 9_300, reasons: ["Shopify order/report fingerprint"] };
        }
        if (fileHint && candidate.normalized.length >= 3) return { score: 8_700, reasons: ["filename mentions Shopify"] };
        return undefined;
      },
      { connectorId: "shopify-v1", channelId: "shopify", adapterId: "shopify-recognizer-v1", live: false },
    );
  },
};

export const TABULAR_CONNECTOR_ADAPTERS: readonly TabularConnectorAdapter[] = [
  meeshoAdapter,
  amazonAdapter,
  flipkartAdapter,
  shopifyAdapter,
];

export function detectTabularConnector(input: TabularDetectionInput): TabularConnectorMatch | undefined {
  const matches = TABULAR_CONNECTOR_ADAPTERS.map((adapter) => adapter.detect(input)).filter(
    (match): match is TabularConnectorMatch => Boolean(match),
  );
  return matches.sort((a, b) => b.confidenceBps - a.confidenceBps || Number(b.live) - Number(a.live))[0];
}
