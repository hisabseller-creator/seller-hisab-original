import { parseFinancialDate } from "../../dates";
import { normalizeHeader } from "../../parsers/aliases";
import { parseMoneyToPaise } from "../../money";
import {
  PARSER_VERSION,
  type NormalizedEvent,
  type ParsedReport,
  type ParserIssue,
} from "../../types";
import type { TabularConnectorMatch } from "../file-adapters";

export type ShopifyTabularSource = {
  fileName: string;
  sheetName: string;
  fingerprint: string;
  rows: unknown[][];
};

const HEADER_NAMES = {
  name: "name",
  id: "id",
  currency: "currency",
  financialStatus: "financial status",
  fulfillmentStatus: "fulfillment status",
  createdAt: "created at",
  canceledAt: "canceled at",
  lineSku: "lineitem sku",
  lineQuantity: "lineitem quantity",
  linePrice: "lineitem price",
  lineDiscount: "lineitem discount",
} as const;

type HeaderKey = keyof typeof HEADER_NAMES;

function headerMap(headers: unknown[]): Partial<Record<HeaderKey, number>> {
  const normalized = headers.map(normalizeHeader);
  const output: Partial<Record<HeaderKey, number>> = {};
  for (const [key, name] of Object.entries(HEADER_NAMES) as Array<[HeaderKey, string]>) {
    const index = normalized.indexOf(normalizeHeader(name));
    if (index >= 0) output[key] = index;
  }
  return output;
}

function read(row: unknown[], map: Partial<Record<HeaderKey, number>>, key: HeaderKey): string {
  const index = map[key];
  return index === undefined ? "" : String(row[index] ?? "").trim();
}

function normalizeDate(value: string): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy" });
}

export function parseShopifyOrderExport(
  source: ShopifyTabularSource,
  detection: TabularConnectorMatch,
): ParsedReport {
  const headers = source.rows[detection.headerRowIndex] ?? [];
  const map = headerMap(headers);
  const issues: ParserIssue[] = [];
  const events: NormalizedEvent[] = [];

  if (map.name === undefined || map.lineSku === undefined || map.lineQuantity === undefined || map.linePrice === undefined) {
    return {
      reportType: "diagnostic",
      supportState: "recognized-not-live",
      schemaFingerprint: detection.schemaFingerprint,
      detectionConfidenceBps: detection.confidenceBps,
      detectionReasons: detection.reasons,
      channelId: "shopify",
      connectorId: detection.connectorId,
      adapterId: detection.adapterId,
      parserVersion: PARSER_VERSION,
      sourceFingerprint: source.fingerprint,
      events: [],
      adCosts: [],
      issues: [{
        code: "connector_not_ready",
        severity: "critical",
        message: "Shopify file detected, but it is not the documented Orders CSV shape SellerHisab can normalize safely yet.",
        source: { fileName: source.fileName, channelId: "shopify", sheetName: source.sheetName },
      }],
      ignoredColumns: headers.map(normalizeHeader).filter(Boolean),
    };
  }

  let currentName = "";
  let currentId = "";
  let currentCurrency = "";
  let currentFinancial = "";
  let currentFulfillment = "";
  let currentCreatedAt = "";
  let currentCanceledAt = "";

  for (let index = detection.headerRowIndex + 1; index < source.rows.length; index += 1) {
    const row = source.rows[index] ?? [];
    if (row.every((value) => value === "" || value === null || value === undefined)) continue;

    currentName = read(row, map, "name") || currentName;
    currentId = read(row, map, "id") || currentId;
    currentCurrency = read(row, map, "currency") || currentCurrency;
    currentFinancial = read(row, map, "financialStatus") || currentFinancial;
    currentFulfillment = read(row, map, "fulfillmentStatus") || currentFulfillment;
    currentCreatedAt = read(row, map, "createdAt") || currentCreatedAt;
    currentCanceledAt = read(row, map, "canceledAt") || currentCanceledAt;

    const sku = read(row, map, "lineSku");
    if (!sku) continue;

    const quantityRaw = read(row, map, "lineQuantity") || "1";
    const quantity = Number(quantityRaw);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Shopify row ${index + 1} has an invalid line-item quantity and was not used.`,
        source: { fileName: source.fileName, channelId: "shopify", sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }

    const unitPricePaise = parseMoneyToPaise(read(row, map, "linePrice"));
    const lineDiscountPaise = parseMoneyToPaise(read(row, map, "lineDiscount")) ?? 0;
    if (unitPricePaise === undefined || unitPricePaise < 0 || lineDiscountPaise < 0) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Shopify row ${index + 1} has an unreadable line-item price/discount and was not used.`,
        source: { fileName: source.fileName, channelId: "shopify", sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }

    const orderKey = currentName || currentId;
    if (!orderKey) {
      issues.push({
        code: "missing_identifier",
        severity: "critical",
        message: `Shopify row ${index + 1} is missing order identity and was not used.`,
        source: { fileName: source.fileName, channelId: "shopify", sheetName: source.sheetName, rowNumber: index + 1 },
      });
      continue;
    }

    const salePaise = Math.max(0, unitPricePaise * quantity - lineDiscountPaise);
    const rawStatus = [currentFinancial, currentFulfillment, currentCanceledAt ? "cancelled" : ""]
      .filter(Boolean)
      .join(" / ") || "shopify order";
    const outcome = currentCanceledAt
      ? "cancelled"
      : /fulfilled/i.test(currentFulfillment) && /paid|partially_refunded|refunded/i.test(currentFinancial)
        ? "delivered"
        : "pending";
    const eventDate = normalizeDate(currentCreatedAt);
    if (currentCreatedAt && !eventDate) {
      issues.push({
        code: "invalid_date",
        severity: "warning",
        message: `Shopify row ${index + 1} has an unreadable Created at value.`,
        source: { fileName: source.fileName, channelId: "shopify", sheetName: source.sheetName, rowNumber: index + 1 },
      });
    }

    events.push({
      eventId: `${source.fingerprint}:${source.sheetName}:${index + 1}`,
      kind: "order",
      channelId: "shopify",
      currency: currentCurrency || undefined,
      subOrderId: `${orderKey}:line:${index + 1}`,
      orderId: currentName || currentId,
      sku,
      rawStatus,
      outcome,
      quantity,
      salePaise,
      settlementPaise: undefined,
      eventDate,
      source: {
        fileName: source.fileName,
        channelId: "shopify",
        sheetName: source.sheetName,
        rowNumber: index + 1,
        parserVersion: PARSER_VERSION,
        sourceFingerprint: source.fingerprint,
      },
    });
  }

  if (!events.length) {
    issues.push({
      code: "unknown_format",
      severity: "critical",
      message: "Shopify Orders CSV was recognized, but no safe line-item rows were found.",
      source: { fileName: source.fileName, channelId: "shopify", sheetName: source.sheetName },
    });
  }

  const usedIndices = new Set(Object.values(map).filter((value): value is number => value !== undefined));
  const ignoredColumns = headers
    .map((header, index) => ({ header: normalizeHeader(header), index }))
    .filter(({ header, index }) => header && !usedIndices.has(index))
    .map(({ header }) => header);

  return {
    reportType: "orders",
    supportState: "supported",
    schemaFingerprint: detection.schemaFingerprint,
    detectionConfidenceBps: detection.confidenceBps,
    detectionReasons: detection.reasons,
    channelId: "shopify",
    connectorId: detection.connectorId,
    adapterId: "shopify-orders-csv-v1",
    parserVersion: PARSER_VERSION,
    sourceFingerprint: source.fingerprint,
    events,
    adCosts: [],
    issues,
    ignoredColumns,
  };
}
