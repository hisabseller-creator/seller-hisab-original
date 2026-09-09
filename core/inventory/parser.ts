import { parseFinancialDate } from "../dates";
import Papa from "papaparse";
import { parseMoneyToPaise } from "../money";
import type { MoneyPaise } from "../types";

export type InventoryParserIssue = { severity: "warning" | "critical"; message: string };

export type NormalizedInventoryRow = {
  rowKey: string;
  snapshotDate: string;
  sku: string;
  masterSku?: string;
  productName?: string;
  availableUnits: number;
  inboundUnits?: number;
  unitsSold30d?: number;
  leadTimeDays?: number;
  unitCostPaise?: MoneyPaise;
  contributionMarginBps?: number;
  location?: string;
  sourceRow: number;
};

export type InventoryParseResult = {
  fileName: string;
  sourceFingerprint: string;
  coverageStart?: string;
  coverageEnd?: string;
  rows: NormalizedInventoryRow[];
  issues: InventoryParserIssue[];
};

export type BrowserInventoryFileInput = { name: string; buffer: ArrayBuffer };

const MAX_INVENTORY_FILE_BYTES = 20 * 1024 * 1024;
const MAX_NORMALIZED_ROWS = 20_000;

type ColumnMap = {
  date?: number;
  sku?: number;
  masterSku?: number;
  productName?: number;
  availableUnits?: number;
  inboundUnits?: number;
  unitsSold30d?: number;
  leadTimeDays?: number;
  unitCost?: number;
  contributionMargin?: number;
  location?: number;
};

const aliases: Record<keyof ColumnMap, string[]> = {
  date: ["date", "snapshot date", "inventory date", "as of date", "report date"],
  sku: ["sku", "seller sku", "seller_sku", "channel sku", "merchant sku"],
  masterSku: ["master sku", "master_sku", "sellerhisab sku", "product master sku"],
  productName: ["product", "product name", "title", "item name", "listing title"],
  availableUnits: ["available", "available units", "available stock", "sellable stock", "quantity available", "qty available"],
  inboundUnits: ["inbound", "inbound units", "incoming", "incoming units", "in transit", "in-transit"],
  unitsSold30d: ["units sold 30d", "units sold 30 days", "sold 30d", "30d units sold", "last 30d sold", "units sold last 30 days"],
  leadTimeDays: ["lead time days", "lead time", "supplier lead time", "replenishment lead time days"],
  unitCost: ["unit cost", "product cost", "landed unit cost", "landed cost", "cost per unit"],
  contributionMargin: ["contribution margin %", "contribution margin", "margin %", "margin percent", "margin pct"],
  location: ["location", "warehouse", "fulfilment location", "fulfillment location", "facility"],
};

function normalizedHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
}

function mapColumns(row: unknown[]): ColumnMap {
  const output: ColumnMap = {};
  row.forEach((value, index) => {
    const header = normalizedHeader(value);
    if (!header) return;
    for (const key of Object.keys(aliases) as Array<keyof ColumnMap>) {
      if (output[key] !== undefined) continue;
      if (aliases[key].some((candidate) => normalizedHeader(candidate) === header)) output[key] = index;
    }
  });
  return output;
}

function headerScore(map: ColumnMap): number {
  let score = map.date !== undefined ? 4 : 0;
  if (map.sku !== undefined) score += 5;
  if (map.availableUnits !== undefined) score += 5;
  if (map.unitsSold30d !== undefined) score += 2;
  if (map.leadTimeDays !== undefined) score += 1;
  if (map.productName !== undefined) score += 1;
  return score;
}

function findHeader(rows: unknown[][]): { index: number; map: ColumnMap } | null {
  let best: { index: number; map: ColumnMap; score: number } | null = null;
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const map = mapColumns(rows[index] ?? []);
    const score = headerScore(map);
    if (!best || score > best.score) best = { index, map, score };
  }
  if (!best || best.score < 14 || best.map.date === undefined || best.map.sku === undefined || best.map.availableUnits === undefined) return null;
  return { index: best.index, map: best.map };
}

function cell(row: unknown[], index: number | undefined): string {
  return index === undefined ? "" : String(row[index] ?? "").trim();
}

function cleanText(value: string, max: number): string | undefined {
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function parseDate(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy" });
}

function parseNonNegativeInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(?:\.0+)?$/.test(normalized)) return undefined;
  const number = Math.round(Number(normalized));
  return Number.isSafeInteger(number) && number >= 0 && number <= 1_000_000_000 ? number : undefined;
}

function parsePercentBps(value: string): number | undefined {
  const cleaned = value.trim().replace(/%$/, "").replace(/,/g, "");
  if (!cleaned || !/^\d+(?:\.\d{1,4})?$/.test(cleaned)) return undefined;
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number < 0 || number > 100) return undefined;
  return Math.round(number * 100);
}

function parseRows(fileName: string, sheetName: string, rows: unknown[][], issues: InventoryParserIssue[]): NormalizedInventoryRow[] {
  const detected = findHeader(rows);
  if (!detected) {
    issues.push({ severity: "critical", message: `${sheetName}: SellerHisab could not safely identify Snapshot Date + SKU + Available columns. This sheet was not imported.` });
    return [];
  }

  const output: NormalizedInventoryRow[] = [];
  let skippedRows = 0;
  for (let rowIndex = detected.index + 1; rowIndex < rows.length; rowIndex += 1) {
    if (output.length >= MAX_NORMALIZED_ROWS) {
      issues.push({ severity: "warning", message: `${fileName}: only the first ${MAX_NORMALIZED_ROWS.toLocaleString("en-IN")} normalized inventory rows were retained.` });
      break;
    }
    const row = rows[rowIndex] ?? [];
    if (row.every((value) => String(value ?? "").trim() === "")) continue;
    const snapshotDate = parseDate(row[detected.map.date ?? -1]);
    const sku = cleanText(cell(row, detected.map.sku), 120);
    const availableUnits = parseNonNegativeInteger(cell(row, detected.map.availableUnits));
    if (!snapshotDate || !sku || availableUnits === undefined) {
      skippedRows += 1;
      continue;
    }

    const inboundUnits = parseNonNegativeInteger(cell(row, detected.map.inboundUnits));
    const unitsSold30d = parseNonNegativeInteger(cell(row, detected.map.unitsSold30d));
    const leadTimeDays = parseNonNegativeInteger(cell(row, detected.map.leadTimeDays));
    const unitCostText = cell(row, detected.map.unitCost);
    const unitCostPaise = unitCostText ? parseMoneyToPaise(unitCostText) : undefined;
    const contributionMarginText = cell(row, detected.map.contributionMargin);
    const contributionMarginBps = contributionMarginText ? parsePercentBps(contributionMarginText) : undefined;
    const masterSku = cleanText(cell(row, detected.map.masterSku), 120);
    const productName = cleanText(cell(row, detected.map.productName), 180);
    const location = cleanText(cell(row, detected.map.location), 120);
    const rowKey = `${sheetName}:${rowIndex + 1}:${snapshotDate}:${sku}:${availableUnits}:${inboundUnits ?? ""}:${unitsSold30d ?? ""}`;

    output.push({
      rowKey,
      snapshotDate,
      sku,
      masterSku,
      productName,
      availableUnits,
      inboundUnits,
      unitsSold30d,
      leadTimeDays,
      unitCostPaise: unitCostPaise !== undefined && unitCostPaise >= 0 ? unitCostPaise : undefined,
      contributionMarginBps,
      location,
      sourceRow: rowIndex + 1,
    });
  }

  if (skippedRows > 0) issues.push({ severity: "warning", message: `${sheetName}: ${skippedRows} row(s) were skipped because Snapshot Date, SKU or Available was invalid.` });
  if (!output.length) issues.push({ severity: "critical", message: `${fileName} / ${sheetName}: no usable inventory rows were found.` });
  else {
    if (output.some((item) => item.unitsSold30d === undefined)) issues.push({ severity: "warning", message: `${sheetName}: some rows do not include Units Sold 30d. SellerHisab will show stock but will not invent velocity, days-cover or reorder quantity for those rows.` });
    if (output.some((item) => item.leadTimeDays === undefined)) issues.push({ severity: "warning", message: `${sheetName}: some rows do not include Lead Time Days. The saved default lead time will be used and clearly marked as an assumption.` });
    if (output.some((item) => item.unitCostPaise === undefined)) issues.push({ severity: "warning", message: `${sheetName}: some rows do not include Unit Cost. Inventory value and reorder investment will remain incomplete for those rows.` });
  }
  return output;
}

export async function parseInventoryFile(file: BrowserInventoryFileInput): Promise<InventoryParseResult> {
  const issues: InventoryParserIssue[] = [];
  if (file.buffer.byteLength > MAX_INVENTORY_FILE_BYTES) {
    return { fileName: file.name, sourceFingerprint: "", rows: [], issues: [{ severity: "critical", message: "Inventory report is larger than the 20 MB F9 safety limit." }] };
  }
  const sourceFingerprint = await sha256(file.buffer);
  const lower = file.name.toLowerCase();
  let rows: NormalizedInventoryRow[] = [];

  if (lower.endsWith(".csv")) {
    const parsed = Papa.parse<unknown[]>(new TextDecoder("utf-8", { fatal: false }).decode(file.buffer), { skipEmptyLines: "greedy", delimiter: "" });
    if (parsed.errors.length) issues.push({ severity: "warning", message: "CSV parser reported formatting warnings; unsupported rows were skipped." });
    rows = parseRows(file.name, "CSV", parsed.data, issues);
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX=await import("xlsx");
    const workbook = XLSX.read(file.buffer, { type: "array", cellDates: true, dense: true });
    for (const sheetName of workbook.SheetNames) {
      if (rows.length >= MAX_NORMALIZED_ROWS) break;
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "", blankrows: false });
      const sheetIssues: InventoryParserIssue[] = [];
      const normalized = parseRows(file.name, sheetName, sheetRows, sheetIssues);
      if (normalized.length) {
        rows.push(...normalized.slice(0, MAX_NORMALIZED_ROWS - rows.length));
        issues.push(...sheetIssues.filter((item) => item.severity !== "critical"));
      }
    }
    if (!rows.length) issues.push({ severity: "critical", message: "No supported inventory sheet was found in this workbook." });
  } else {
    issues.push({ severity: "critical", message: "F9 inventory import supports CSV, XLSX and XLS only." });
  }

  const dates = rows.map((item) => item.snapshotDate).sort();
  return {
    fileName: file.name,
    sourceFingerprint,
    coverageStart: dates[0],
    coverageEnd: dates.at(-1),
    rows,
    issues,
  };
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
