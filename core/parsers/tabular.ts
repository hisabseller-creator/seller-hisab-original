import { channelLabel, type SalesChannelId } from "../channels/catalog";
import { detectTabularConnector, type TabularConnectorMatch } from "../connectors/file-adapters";
import { parseShopifyOrderExport } from "../connectors/shopify/order-export";
import {
  parseAmazonOrderReport,
  parseAmazonSettlementV2,
  parseFlipkartOrdersReport,
  parseFlipkartSettlementReport,
  parseShopifyPaymentsCsv,
} from "../connectors/marketplace-file-reports";
import { parseFinancialDate } from "../dates";
import { parseMoneyToPaise } from "../money";
import {
  PARSER_VERSION,
  type AdCostRecord,
  type NormalizedEvent,
  type OrderOutcome,
  type ParsedReport,
  type ParserIssue,
} from "../types";
import { mapHeaders, type CanonicalField } from "./aliases";

export type TabularSource = {
  fileName: string;
  sheetName: string;
  fingerprint: string;
  rows: unknown[][];
};

const FINAL_STATUS_MAP: Array<[RegExp, OrderOutcome]> = [
  [/\brto\b|return to origin/, "rto"],
  [/customer return|returned|return delivered|return complete/, "return"],
  [/exchange/, "exchange"],
  [/cancel/, "cancelled"],
  [/delivered|payment released|settled|paid/, "delivered"],
  [/pending|shipped|dispatch|in transit|processing|ready to ship/, "pending"],
];

export function classifyOutcome(value: unknown): OrderOutcome {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  return FINAL_STATUS_MAP.find(([pattern]) => pattern.test(text))?.[1] ?? "unknown";
}

export function findHeaderRow(rows: unknown[][]): number {
  const detected = detectTabularConnector({ fileName: "", rows });
  if (detected) return detected.headerRowIndex;

  const limit = Math.min(rows.length, 30);
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < limit; index += 1) {
    const { mapping } = mapHeaders(rows[index] ?? []);
    const score = Object.keys(mapping).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore >= 3 ? bestIndex : -1;
}

export function detectSalesChannel(headers: unknown[], fileName = ""): SalesChannelId | undefined {
  return detectTabularConnector({ fileName, rows: [headers] })?.channelId;
}

export function parseTabularSource(source: TabularSource): ParsedReport {
  const detection = detectTabularConnector({ fileName: source.fileName, rows: source.rows });
  if (!detection) {
    return unknownReport(source, "No validated marketplace connector fingerprint matched this sheet.");
  }
  if (!detection.live) {
    return connectorNotReadyReport(source, detection);
  }
  if (detection.adapterId === "amazon-orders-flat-file-v1") return parseAmazonOrderReport(source, detection);
  if (detection.adapterId === "amazon-settlement-flat-file-v2") return parseAmazonSettlementV2(source, detection);
  if (detection.adapterId === "flipkart-orders-file-v1") return parseFlipkartOrdersReport(source, detection);
  if (detection.adapterId === "flipkart-settlement-file-v1") return parseFlipkartSettlementReport(source, detection);
  if (detection.adapterId === "shopify-payments-csv-v1") return parseShopifyPaymentsCsv(source, detection);
  if (detection.channelId === "shopify" && detection.adapterId === "shopify-orders-csv-v1") {
    return parseShopifyOrderExport(source, detection);
  }
  return parseSupportedTabularSource(source, detection);
}

function parseSupportedTabularSource(source: TabularSource, detection: TabularConnectorMatch): ParsedReport {
  const issues: ParserIssue[] = [];
  const headerRowIndex = detection.headerRowIndex;
  const headers = source.rows[headerRowIndex] ?? [];
  const { mapping, ignored } = mapHeaders(headers);
  const channelId = detection.channelId;

  if (mapping.adSpend !== undefined) {
    return parseAdSource(source, headerRowIndex, mapping, ignored, detection);
  }

  const hasPaymentAmount = mapping.settlementAmount !== undefined;
  const hasOrderAmount = mapping.saleAmount !== undefined;
  const reportType = hasPaymentAmount ? "payments" : hasOrderAmount ? "orders" : undefined;

  if (mapping.subOrderId === undefined) {
    return unknownReport(source, "A stable Sub-Order Number column is required.", "missing_identifier", detection);
  }
  if (!reportType) {
    return unknownReport(
      source,
      "A uniquely recognized settlement or sale amount column is required.",
      "missing_monetary_column",
      detection,
    );
  }
  if (mapping.sku === undefined) {
    return unknownReport(source, "A uniquely recognized SKU column is required.", "unknown_format", detection);
  }

  const events: NormalizedEvent[] = [];
  const seen = new Set<string>();
  for (let index = headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;

    const subOrderId = cell(row, mapping, "subOrderId");
    const sku = cell(row, mapping, "sku");
    if (!subOrderId || !sku) {
      issues.push({
        code: "missing_identifier",
        severity: "critical",
        message: `Row ${index + 1} is missing a Sub-Order Number or SKU and was not used.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }

    const statusValue = cell(row, mapping, "status");
    const returnReason = cell(row, mapping, "returnReason");
    const rawStatus = [statusValue, returnReason ? `reason: ${returnReason}` : ""].filter(Boolean).join(" / ");
    const outcome = classifyOutcome(statusValue);
    if (outcome === "unknown") {
      issues.push({
        code: "unrecognized_status",
        severity: "warning",
        message: `Status “${statusValue || "blank"}” on row ${index + 1} is not recognized.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
    }

    const salePaise = moneyCell(row, mapping, "saleAmount");
    const settlementPaise = moneyCell(row, mapping, "settlementAmount");
    const deductionPaise = moneyCell(row, mapping, "deductionAmount");
    const quantityRaw = cell(row, mapping, "quantity");
    const quantity = quantityRaw ? Number(quantityRaw) : 1;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Row ${index + 1} has an invalid quantity.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }

    if (reportType === "payments" && settlementPaise === undefined) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Row ${index + 1} has an unreadable settlement amount and was not used.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }
    if (reportType === "orders" && salePaise === undefined) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Row ${index + 1} has an unreadable sale amount and was not used.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }
    if ((salePaise ?? 0) < 0) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Row ${index + 1} has an impossible negative sale amount and was not used.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }

    const rawEventDate = cell(row, mapping, "eventDate");
    const eventDate = normalizeDate(rawEventDate);
    if (rawEventDate && !eventDate) {
      issues.push({
        code: "invalid_date",
        severity: "warning",
        message: `Row ${index + 1} has an invalid date. The row is retained, but period matching may be less reliable.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
    }

    const eventKey = [
      channelId,
      reportType,
      subOrderId,
      sku,
      rawStatus,
      salePaise ?? "",
      settlementPaise ?? "",
      eventDate ?? "",
    ].join("|");
    if (seen.has(eventKey)) {
      issues.push({
        code: "duplicate_event",
        severity: "warning",
        message: `A duplicate financial event on row ${index + 1} was ignored.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }
    seen.add(eventKey);

    events.push({
      eventId: `${source.fingerprint}:${source.sheetName}:${index + 1}`,
      kind: reportType === "payments" ? "payment" : "order",
      channelId,
      currency: "INR",
      subOrderId,
      orderId: cell(row, mapping, "orderId") || undefined,
      sku,
      rawStatus,
      outcome,
      quantity,
      salePaise,
      settlementPaise,
      deductionPaise,
      eventDate,
      source: {
        fileName: source.fileName,
        channelId,
        sheetName: source.sheetName,
        rowNumber: index + 1,
        parserVersion: PARSER_VERSION,
        sourceFingerprint: source.fingerprint,
      },
    });
  }

  if (!events.length) {
    return unknownReport(source, "The recognized sheet did not contain any safe financial rows.", "unknown_format", detection);
  }

  return {
    reportType,
    supportState: "supported",
    schemaFingerprint: detection.schemaFingerprint,
    detectionConfidenceBps: detection.confidenceBps,
    detectionReasons: detection.reasons,
    channelId,
    connectorId: detection.connectorId,
    adapterId: `${detection.adapterId}-${reportType}`,
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
    events,
    adCosts: [],
    issues,
    ignoredColumns: ignored,
  };
}

function parseAdSource(
  source: TabularSource,
  headerRowIndex: number,
  mapping: Partial<Record<CanonicalField, number>>,
  ignored: string[],
  detection: TabularConnectorMatch,
): ParsedReport {
  const issues: ParserIssue[] = [];
  const adCosts: AdCostRecord[] = [];
  const channelId = detection.channelId;

  for (let index = headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;
    const spendPaise = moneyCell(row, mapping, "adSpend");
    const attributableSalesPaise = moneyCell(row, mapping, "adSales");
    if (spendPaise === undefined || spendPaise < 0 || (attributableSalesPaise ?? 0) < 0) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Ads row ${index + 1} has an unreadable or negative spend/sales amount and was not used.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }
    const sku = cell(row, mapping, "sku") || undefined;
    if (!sku) {
      issues.push({
        code: "ad_allocation_estimated",
        severity: "warning",
        message: `Ads row ${index + 1} has no SKU, so spend will be allocated by observed sales share.`,
        source: { fileName: source.fileName, channelId, sheetName: source.sheetName, rowNumber: index + 1 },
      });
    }
    adCosts.push({
      sku,
      spendPaise,
      attributableSalesPaise,
      allocation: sku ? "sku" : "sales-share",
      source: {
        fileName: source.fileName,
        channelId,
        sheetName: source.sheetName,
        rowNumber: index + 1,
        parserVersion: PARSER_VERSION,
        sourceFingerprint: source.fingerprint,
      },
    });
  }

  if (!adCosts.length) {
    return unknownReport(source, "The recognized Ads sheet did not contain any safe spend rows.", "unknown_format", detection);
  }

  return {
    reportType: "ads",
    supportState: "supported",
    schemaFingerprint: detection.schemaFingerprint,
    detectionConfidenceBps: detection.confidenceBps,
    detectionReasons: detection.reasons,
    channelId,
    connectorId: detection.connectorId,
    adapterId: `${detection.adapterId}-ads`,
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
    events: [],
    adCosts,
    issues,
    ignoredColumns: ignored,
  };
}

function cell(
  row: unknown[],
  mapping: Partial<Record<CanonicalField, number>>,
  field: CanonicalField,
): string {
  const index = mapping[field];
  if (index === undefined) return "";
  return String(row[index] ?? "").trim();
}

function moneyCell(
  row: unknown[],
  mapping: Partial<Record<CanonicalField, number>>,
  field: CanonicalField,
) {
  const index = mapping[field];
  return index === undefined ? undefined : parseMoneyToPaise(row[index]);
}

function normalizeDate(value: string): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy" });
}

function connectorNotReadyReport(source: TabularSource, detection: TabularConnectorMatch): ParsedReport {
  const label = channelLabel(detection.channelId);
  const typeText = detection.reportTypeHint === "diagnostic" ? "report" : `${detection.reportTypeHint} report`;
  return {
    reportType: detection.reportTypeHint,
    supportState: "recognized-not-live",
    schemaFingerprint: detection.schemaFingerprint,
    detectionConfidenceBps: detection.confidenceBps,
    detectionReasons: detection.reasons,
    channelId: detection.channelId,
    connectorId: detection.connectorId,
    adapterId: detection.adapterId,
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
    events: [],
    adCosts: [],
    issues: [
      {
        code: "connector_not_ready",
        severity: "critical",
        message: `${label} ${typeText} detected, but this connector is not enabled for financial calculation yet. SellerHisab stopped instead of guessing the columns.`,
        source: { fileName: source.fileName, channelId: detection.channelId, sheetName: source.sheetName },
      },
    ],
    ignoredColumns: [],
  };
}

function unknownReport(
  source: TabularSource,
  detail: string,
  code: ParserIssue["code"] = "unknown_format",
  detection?: TabularConnectorMatch,
): ParsedReport {
  return {
    reportType: detection?.reportTypeHint ?? "diagnostic",
    supportState: detection ? "supported" : "unrecognized",
    schemaFingerprint: detection?.schemaFingerprint,
    detectionConfidenceBps: detection?.confidenceBps,
    detectionReasons: detection?.reasons,
    channelId: detection?.channelId,
    connectorId: detection?.connectorId,
    adapterId: detection?.adapterId ?? "unrecognized",
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
    events: [],
    adCosts: [],
    issues: [
      {
        code,
        severity: "critical",
        message: `New report format detected. We cannot safely calculate profit from this file yet. ${detail}`,
        source: { fileName: source.fileName, channelId: detection?.channelId, sheetName: source.sheetName },
      },
    ],
    ignoredColumns: [],
  };
}
