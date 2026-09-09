import { parseFinancialDate } from "../dates";
import { normalizeHeader } from "../parsers/aliases";
import { parseMoneyToPaise } from "../money";
import {
  PARSER_VERSION,
  type NormalizedEvent,
  type ParsedReport,
  type ParserIssue,
} from "../types";
import type { SettlementEvidence } from "../settlements/evidence";
import type { SettlementBatchEvidence } from "../settlements/reconciliation";
import type { TabularConnectorMatch } from "./file-adapters";

export type MarketplaceTabularSource = {
  fileName: string;
  sheetName: string;
  fingerprint: string;
  rows: unknown[][];
};


function classifyOutcome(value: string): "delivered" | "return" | "rto" | "cancelled" | "exchange" | "pending" | "unknown" {
  const text = value.trim().toLowerCase();
  if (!text) return "unknown";
  if (/\brto\b|return to origin/.test(text)) return "rto";
  if (/customer return|returned|return delivered|return complete|refund/.test(text)) return "return";
  if (/exchange/.test(text)) return "exchange";
  if (/cancel/.test(text)) return "cancelled";
  if (/delivered|payment released|settled|paid/.test(text)) return "delivered";
  if (/pending|shipped|dispatch|in transit|processing|ready to ship|approved|packed/.test(text)) return "pending";
  return "unknown";
}
type HeaderMap = Record<string, number | undefined>;

function headers(source: MarketplaceTabularSource, detection: TabularConnectorMatch): unknown[] {
  return source.rows[detection.headerRowIndex] ?? [];
}

function indexOfAny(row: unknown[], aliases: string[]): number | undefined {
  const normalized = row.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeHeader(alias));
    if (index >= 0) return index;
  }
  return undefined;
}

function makeMap(row: unknown[], spec: Record<string, string[]>): HeaderMap {
  return Object.fromEntries(
    Object.entries(spec).map(([key, aliases]) => [key, indexOfAny(row, aliases)]),
  );
}

function read(row: unknown[], map: HeaderMap, key: string): string {
  const index = map[key];
  return index === undefined ? "" : String(row[index] ?? "").trim();
}

function money(row: unknown[], map: HeaderMap, key: string): number | undefined {
  const value = read(row, map, key);
  return value ? parseMoneyToPaise(value) : undefined;
}

function iso(value: string): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy" });
}

function positiveInt(value: string, fallback = 1): number | undefined {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 10_000 ? parsed : undefined;
}

function sourceRef(
  source: MarketplaceTabularSource,
  channelId: "amazon-in" | "flipkart" | "shopify",
  rowNumber: number,
) {
  return {
    fileName: source.fileName,
    channelId,
    sheetName: source.sheetName,
    rowNumber,
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
  } as const;
}

function baseReport(
  source: MarketplaceTabularSource,
  detection: TabularConnectorMatch,
  reportType: ParsedReport["reportType"],
): Omit<ParsedReport, "events" | "adCosts" | "issues" | "ignoredColumns"> {
  return {
    reportType,
    supportState: "supported",
    schemaFingerprint: detection.schemaFingerprint,
    detectionConfidenceBps: detection.confidenceBps,
    detectionReasons: detection.reasons,
    channelId: detection.channelId,
    connectorId: detection.connectorId,
    adapterId: detection.adapterId,
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
  };
}

export function parseAmazonOrderReport(
  source: MarketplaceTabularSource,
  detection: TabularConnectorMatch,
): ParsedReport {
  const header = headers(source, detection);
  const map = makeMap(header, {
    orderId: ["amazon-order-id", "amazon order id"],
    sku: ["sku", "seller sku"],
    quantity: ["quantity-purchased", "quantity purchased", "quantity"],
    itemPrice: ["item-price", "item price"],
    itemPromotion: ["item-promotion-discount", "item promotion discount"],
    status: ["order-status", "order status", "item-status", "item status"],
    purchaseDate: ["purchase-date", "purchase date"],
    currency: ["currency"],
  });
  const events: NormalizedEvent[] = [];
  const issues: ParserIssue[] = [];

  for (let index = detection.headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;
    const orderId = read(row, map, "orderId");
    const sku = read(row, map, "sku");
    if (!orderId || !sku) {
      issues.push({
        code: "missing_identifier",
        severity: "critical",
        message: `Amazon order row ${index + 1} is missing amazon-order-id or SKU and was not used.`,
        source: sourceRef(source, "amazon-in", index + 1),
      });
      continue;
    }
    const quantity = positiveInt(read(row, map, "quantity"));
    if (!quantity) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Amazon order row ${index + 1} has an invalid quantity and was not used.`,
        source: sourceRef(source, "amazon-in", index + 1),
      });
      continue;
    }
    const itemPricePaise = money(row, map, "itemPrice");
    const promotionPaise = money(row, map, "itemPromotion") ?? 0;
    if (itemPricePaise === undefined || itemPricePaise < 0 || promotionPaise < 0) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Amazon order row ${index + 1} has an unreadable item price or promotion amount and was not used.`,
        source: sourceRef(source, "amazon-in", index + 1),
      });
      continue;
    }
    const rawStatus = read(row, map, "status") || "amazon order";
    const outcome = /cancel/i.test(rawStatus) ? "cancelled" : "pending";
    const rawDate = read(row, map, "purchaseDate");
    const eventDate = iso(rawDate);
    if (rawDate && !eventDate) {
      issues.push({
        code: "invalid_date",
        severity: "warning",
        message: `Amazon order row ${index + 1} has an unreadable purchase date.`,
        source: sourceRef(source, "amazon-in", index + 1),
      });
    }
    events.push({
      eventId: `${source.fingerprint}:amazon-order:${orderId}:${sku}:${index + 1}`,
      kind: "order",
      channelId: "amazon-in",
      currency: read(row, map, "currency") || "INR",
      subOrderId: `${orderId}:${sku}`,
      orderId,
      sku,
      rawStatus,
      outcome,
      quantity,
      salePaise: Math.max(0, itemPricePaise - promotionPaise),
      settlementPaise: undefined,
      eventDate,
      source: sourceRef(source, "amazon-in", index + 1),
    });
  }

  return {
    ...baseReport(source, detection, "orders"),
    events,
    adCosts: [],
    issues: events.length ? issues : [...issues, {
      code: "unknown_format",
      severity: "critical",
      message: "Amazon Orders report was recognized, but no safe order rows were found.",
      source: sourceRef(source, "amazon-in", detection.headerRowIndex + 1),
    }],
    ignoredColumns: header.map(normalizeHeader).filter(Boolean),
  };
}

export function parseAmazonSettlementV2(
  source: MarketplaceTabularSource,
  detection: TabularConnectorMatch,
): ParsedReport {
  const header = headers(source, detection);
  const map = makeMap(header, {
    settlementId: ["settlement-id", "settlement id"],
    settlementStart: ["settlement-start-date", "settlement start date"],
    settlementEnd: ["settlement-end-date", "settlement end date"],
    depositDate: ["deposit-date", "deposit date"],
    totalAmount: ["total-amount", "total amount"],
    currency: ["currency"],
    transactionType: ["transaction-type", "transaction type"],
    orderId: ["order-id", "order id", "amazon-order-id", "amazon order id"],
    sku: ["sku", "seller sku"],
    amountType: ["amount-type", "amount type"],
    amountDescription: ["amount-description", "amount description"],
    amount: ["amount"],
    postedDate: ["posted-date-time", "posted date time", "posted-date", "posted date"],
  });

  const issues: ParserIssue[] = [];
  const events: NormalizedEvent[] = [];
  const grouped = new Map<string, {
    orderId: string;
    amountPaise: number;
    currency: string;
    occurredAt?: string;
    batchId?: string;
    firstRow: number;
  }>();
  let batchId = "";
  let batchCurrency = "INR";
  let batchTotal: number | undefined;
  let batchIssuedAt: string | undefined;
  let batchExpectedBankBy: string | undefined;

  for (let index = detection.headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;
    batchId = read(row, map, "settlementId") || batchId;
    batchCurrency = read(row, map, "currency") || batchCurrency;
    batchTotal = money(row, map, "totalAmount") ?? batchTotal;
    batchIssuedAt = iso(read(row, map, "settlementEnd")) ?? batchIssuedAt;
    batchExpectedBankBy = iso(read(row, map, "depositDate")) ?? batchExpectedBankBy;

    const orderId = read(row, map, "orderId");
    const amountPaise = money(row, map, "amount");
    const transactionType = read(row, map, "transactionType") || "Amazon settlement";
    const sku = read(row, map, "sku");
    const occurredAt = iso(read(row, map, "postedDate")) ?? batchIssuedAt;
    if (orderId && amountPaise !== undefined) {
      const key = orderId;
      const prior = grouped.get(key);
      grouped.set(key, {
        orderId,
        amountPaise: (prior?.amountPaise ?? 0) + amountPaise,
        currency: read(row, map, "currency") || prior?.currency || batchCurrency,
        occurredAt: occurredAt ?? prior?.occurredAt,
        batchId: batchId || prior?.batchId,
        firstRow: prior?.firstRow ?? index + 1,
      });
    }

    if (orderId && sku && /refund/i.test(transactionType)) {
      events.push({
        eventId: `${source.fingerprint}:amazon-refund:${orderId}:${sku}:${index + 1}`,
        kind: "adjustment",
        channelId: "amazon-in",
        currency: read(row, map, "currency") || batchCurrency,
        subOrderId: `${orderId}:${sku}`,
        orderId,
        sku,
        rawStatus: [transactionType, read(row, map, "amountType"), read(row, map, "amountDescription")].filter(Boolean).join(" / "),
        outcome: "return",
        quantity: 1,
        eventDate: occurredAt,
        source: sourceRef(source, "amazon-in", index + 1),
      });
    }
  }

  const settlementEvidence: SettlementEvidence[] = [...grouped.values()].map((group) => ({
    id: `${source.fingerprint}:amazon-settlement:${group.orderId}:${group.batchId || "batch"}`,
    channelId: "amazon-in",
    orderId: group.orderId,
    batchId: group.batchId,
    amountPaise: group.amountPaise,
    currency: group.currency || "INR",
    occurredAt: group.occurredAt,
    finality: "released",
    cashStage: "payout",
    semantic: "amazon-flat-file-v2-order-net",
    source: sourceRef(source, "amazon-in", group.firstRow),
  }));

  const settlementBatches: SettlementBatchEvidence[] = batchId && batchTotal !== undefined ? [{
    id: `${source.fingerprint}:amazon-batch:${batchId}`,
    channelId: "amazon-in",
    externalBatchId: batchId,
    expectedAmountPaise: batchTotal,
    currency: batchCurrency || "INR",
    status: "paid",
    issuedAt: batchIssuedAt,
    expectedBankBy: batchExpectedBankBy,
    referenceKeys: [batchId],
    source: sourceRef(source, "amazon-in", detection.headerRowIndex + 2),
  }] : [];

  if (!settlementEvidence.length) {
    issues.push({
      code: "unknown_format",
      severity: "critical",
      message: "Amazon Settlement Flat File V2 was recognized, but no order-linked settlement rows were found.",
      source: sourceRef(source, "amazon-in", detection.headerRowIndex + 1),
    });
  }

  return {
    ...baseReport(source, detection, "payments"),
    events,
    settlementEvidence,
    settlementBatches,
    adCosts: [],
    issues,
    ignoredColumns: header.map(normalizeHeader).filter(Boolean),
  };
}

export function parseFlipkartOrdersReport(
  source: MarketplaceTabularSource,
  detection: TabularConnectorMatch,
): ParsedReport {
  const header = headers(source, detection);
  const map = makeMap(header, {
    orderItemId: ["order item id", "orderitem id", "order_item_id"],
    orderId: ["order id", "order_id"],
    sku: ["seller sku", "sku", "sku id", "seller sku id"],
    quantity: ["quantity", "qty", "item quantity"],
    status: ["order state", "order status", "status", "shipment status"],
    returnReason: ["return reason", "reason for return", "rto reason", "return comments", "return remarks"],
    totalSellingPrice: ["sale amount", "order item value", "total price", "total order item value"],
    unitSellingPrice: ["selling price", "selling price per item", "item price"],
    orderDate: ["order date", "ordered on", "order created date", "created date"],
  });
  const events: NormalizedEvent[] = [];
  const issues: ParserIssue[] = [];

  for (let index = detection.headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;
    const orderItemId = read(row, map, "orderItemId");
    const sku = read(row, map, "sku");
    if (!orderItemId || !sku) {
      issues.push({
        code: "missing_identifier",
        severity: "critical",
        message: `Flipkart order row ${index + 1} is missing Order Item ID or SKU and was not used.`,
        source: sourceRef(source, "flipkart", index + 1),
      });
      continue;
    }
    const quantity = positiveInt(read(row, map, "quantity"));
    const totalSellingPricePaise = money(row, map, "totalSellingPrice");
    const unitSellingPricePaise = money(row, map, "unitSellingPrice");
    const salePaise = totalSellingPricePaise ?? (unitSellingPricePaise !== undefined && quantity ? unitSellingPricePaise * quantity : undefined);
    if (!quantity || salePaise === undefined || salePaise < 0) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Flipkart order row ${index + 1} has an invalid quantity or selling price and was not used.`,
        source: sourceRef(source, "flipkart", index + 1),
      });
      continue;
    }
    const statusValue = read(row, map, "status") || "flipkart order";
    const returnReason = read(row, map, "returnReason");
    const rawStatus = [statusValue, returnReason ? `reason: ${returnReason}` : ""].filter(Boolean).join(" / ");
    const outcome = classifyOutcome(statusValue);
    const rawDate = read(row, map, "orderDate");
    const eventDate = iso(rawDate);
    events.push({
      eventId: `${source.fingerprint}:flipkart-order:${orderItemId}`,
      kind: "order",
      channelId: "flipkart",
      currency: "INR",
      subOrderId: orderItemId,
      orderId: read(row, map, "orderId") || undefined,
      sku,
      rawStatus,
      outcome,
      quantity,
      salePaise,
      settlementPaise: undefined,
      eventDate,
      source: sourceRef(source, "flipkart", index + 1),
    });
  }

  return {
    ...baseReport(source, detection, "orders"),
    events,
    adCosts: [],
    issues: events.length ? issues : [...issues, {
      code: "unknown_format",
      severity: "critical",
      message: "Flipkart Orders report was recognized, but no safe order rows were found.",
      source: sourceRef(source, "flipkart", detection.headerRowIndex + 1),
    }],
    ignoredColumns: header.map(normalizeHeader).filter(Boolean),
  };
}

export function parseFlipkartSettlementReport(
  source: MarketplaceTabularSource,
  detection: TabularConnectorMatch,
): ParsedReport {
  const header = headers(source, detection);
  const map = makeMap(header, {
    orderItemId: ["order item id", "orderitem id", "order_item_id"],
    orderId: ["order id", "order_id"],
    sku: ["seller sku", "sku", "sku id", "seller sku id"],
    settlement: [
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
    ],
    status: ["settlement status", "payment status", "status", "order status", "event type", "transaction type"],
    returnReason: ["return reason", "reason for return", "rto reason", "return comments", "return remarks"],
    settlementDate: ["settlement date", "payment date", "settled date", "event date"],
    quantity: ["quantity", "qty", "item quantity"],
  });
  const events: NormalizedEvent[] = [];
  const evidence: SettlementEvidence[] = [];
  const issues: ParserIssue[] = [];

  for (let index = detection.headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;
    const orderItemId = read(row, map, "orderItemId");
    const orderId = read(row, map, "orderId");
    const sku = read(row, map, "sku");
    const settlementPaise = money(row, map, "settlement");
    if (settlementPaise === undefined) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Flipkart settlement row ${index + 1} has an unreadable settlement amount and was not used.`,
        source: sourceRef(source, "flipkart", index + 1),
      });
      continue;
    }
    const statusValue = read(row, map, "status") || "flipkart settlement";
    const returnReason = read(row, map, "returnReason");
    const rawStatus = [statusValue, returnReason ? `reason: ${returnReason}` : ""].filter(Boolean).join(" / ");
    const eventDate = iso(read(row, map, "settlementDate"));
    const quantity = positiveInt(read(row, map, "quantity")) ?? 1;

    if (orderItemId && sku) {
      events.push({
        eventId: `${source.fingerprint}:flipkart-settlement:${orderItemId}:${index + 1}`,
        kind: "payment",
        channelId: "flipkart",
        currency: "INR",
        subOrderId: orderItemId,
        orderId: orderId || undefined,
        sku,
        rawStatus,
        outcome: classifyOutcome(statusValue),
        quantity,
        settlementPaise,
        eventDate,
        source: sourceRef(source, "flipkart", index + 1),
      });
      continue;
    }

    if (orderId) {
      evidence.push({
        id: `${source.fingerprint}:flipkart-order-settlement:${orderId}:${index + 1}`,
        channelId: "flipkart",
        orderId,
        amountPaise: settlementPaise,
        currency: "INR",
        occurredAt: eventDate,
        finality: /settled|paid|completed|released/i.test(rawStatus) ? "released" : "provisional",
        cashStage: "payout",
        semantic: `flipkart-file:${rawStatus}`,
        source: sourceRef(source, "flipkart", index + 1),
      });
      continue;
    }

    issues.push({
      code: "missing_identifier",
      severity: "critical",
      message: `Flipkart settlement row ${index + 1} has no Order Item ID + SKU or Order ID, so it could not be linked safely.`,
      source: sourceRef(source, "flipkart", index + 1),
    });
  }

  if (!events.length && !evidence.length) {
    issues.push({
      code: "unknown_format",
      severity: "critical",
      message: "Flipkart settlement report was recognized, but no safely linkable financial rows were found.",
      source: sourceRef(source, "flipkart", detection.headerRowIndex + 1),
    });
  }

  return {
    ...baseReport(source, detection, "payments"),
    events,
    settlementEvidence: evidence,
    adCosts: [],
    issues,
    ignoredColumns: header.map(normalizeHeader).filter(Boolean),
  };
}

export function parseShopifyPaymentsCsv(
  source: MarketplaceTabularSource,
  detection: TabularConnectorMatch,
): ParsedReport {
  const header = headers(source, detection);
  const map = makeMap(header, {
    transactionDate: ["transaction date"],
    type: ["type"],
    order: ["order"],
    payoutStatus: ["payout status"],
    payoutDate: ["payout date"],
    amount: ["amount"],
    fee: ["fee"],
    net: ["net"],
    currency: ["currency"],
  });
  const evidence: SettlementEvidence[] = [];
  const issues: ParserIssue[] = [];

  for (let index = detection.headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;
    const order = read(row, map, "order");
    if (!order) continue;
    const netPaise = money(row, map, "net");
    if (netPaise === undefined) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Shopify Payments row ${index + 1} has an unreadable Net amount and was not used.`,
        source: sourceRef(source, "shopify", index + 1),
      });
      continue;
    }
    const payoutStatus = read(row, map, "payoutStatus") || "unknown";
    const transactionType = read(row, map, "type") || "transaction";
    evidence.push({
      id: `${source.fingerprint}:shopify-payment:${order}:${index + 1}`,
      channelId: "shopify",
      orderId: order,
      amountPaise: netPaise,
      currency: read(row, map, "currency") || undefined,
      occurredAt: iso(read(row, map, "payoutDate")) ?? iso(read(row, map, "transactionDate")),
      finality: /paid|completed|deposited/i.test(payoutStatus) ? "released" : "provisional",
      cashStage: "marketplace-financial",
      semantic: `shopify-payments:${transactionType}:${payoutStatus}`,
      source: sourceRef(source, "shopify", index + 1),
    });
  }

  if (!evidence.length) {
    issues.push({
      code: "unknown_format",
      severity: "critical",
      message: "Shopify Payments CSV was recognized, but no order-linked financial rows were found.",
      source: sourceRef(source, "shopify", detection.headerRowIndex + 1),
    });
  }

  return {
    ...baseReport(source, detection, "payments"),
    events: [],
    settlementEvidence: evidence,
    adCosts: [],
    issues,
    ignoredColumns: header.map(normalizeHeader).filter(Boolean),
  };
}
