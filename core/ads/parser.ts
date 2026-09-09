import { parseFinancialDate } from "../dates";
import Papa from "papaparse";
import { parseMoneyToPaise } from "../money";
import type { MoneyPaise } from "../types";

export type AdsParserIssue = { severity: "warning" | "critical"; message: string };

export type NormalizedAdPerformanceRow = {
  rowKey: string;
  reportDate: string;
  campaignName: string;
  campaignId?: string;
  adGroupName?: string;
  sku?: string;
  spendPaise: MoneyPaise;
  attributedSalesPaise?: MoneyPaise;
  attributedOrders?: number;
  clicks?: number;
  impressions?: number;
  currency: string;
  sourceRow: number;
};

export type AdsPerformanceParseResult = {
  fileName: string;
  sourceFingerprint: string;
  coverageStart?: string;
  coverageEnd?: string;
  rows: NormalizedAdPerformanceRow[];
  issues: AdsParserIssue[];
};

export type BrowserAdsFileInput = { name: string; buffer: ArrayBuffer };

const MAX_ADS_FILE_BYTES = 20 * 1024 * 1024;
const MAX_NORMALIZED_ROWS = 10_000;

type ColumnMap = {
  date?: number;
  campaignName?: number;
  campaignId?: number;
  adGroupName?: number;
  sku?: number;
  spend?: number;
  attributedSales?: number;
  attributedOrders?: number;
  clicks?: number;
  impressions?: number;
};

const aliases: Record<keyof ColumnMap, string[]> = {
  date: ["date", "day", "report date", "start date", "reporting date"],
  campaignName: ["campaign", "campaign name", "campaign_name"],
  campaignId: ["campaign id", "campaign_id", "campaign identifier"],
  adGroupName: ["ad group", "ad group name", "adgroup", "adgroup name", "ad set", "ad set name"],
  sku: ["sku", "seller sku", "seller_sku", "product sku", "advertised sku", "asin", "fsn"],
  spend: ["spend", "ad spend", "ads spend", "amount spent", "campaign spend", "cost", "total spend"],
  attributedSales: ["attributed sales", "attributable sales", "sales from ads", "ad sales", "revenue from ads", "conversion value", "sales"],
  attributedOrders: ["attributed orders", "orders", "purchases", "conversions", "orders from ads"],
  clicks: ["clicks", "link clicks"],
  impressions: ["impressions", "views"],
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
  let score = map.date !== undefined ? 3 : 0;
  if (map.campaignName !== undefined) score += 4;
  if (map.spend !== undefined) score += 5;
  if (map.attributedSales !== undefined) score += 2;
  if (map.sku !== undefined) score += 1;
  if (map.campaignId !== undefined) score += 1;
  return score;
}

function findHeader(rows: unknown[][]): { index: number; map: ColumnMap } | null {
  let best: { index: number; map: ColumnMap; score: number } | null = null;
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const map = mapColumns(rows[index] ?? []);
    const score = headerScore(map);
    if (!best || score > best.score) best = { index, map, score };
  }
  if (!best || best.score < 12 || best.map.date === undefined || best.map.campaignName === undefined || best.map.spend === undefined) return null;
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

function parseCount(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(?:\.0+)?$/.test(normalized)) return undefined;
  const number = Math.round(Number(normalized));
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function parseRows(fileName: string, sheetName: string, rows: unknown[][], issues: AdsParserIssue[]): NormalizedAdPerformanceRow[] {
  const detected = findHeader(rows);
  if (!detected) {
    issues.push({ severity: "critical", message: `${sheetName}: SellerHisab could not safely identify Date + Campaign + Spend columns. This sheet was not imported.` });
    return [];
  }
  const output: NormalizedAdPerformanceRow[] = [];
  for (let rowIndex = detected.index + 1; rowIndex < rows.length; rowIndex += 1) {
    if (output.length >= MAX_NORMALIZED_ROWS) {
      issues.push({ severity: "warning", message: `${fileName}: only the first ${MAX_NORMALIZED_ROWS.toLocaleString("en-IN")} normalized ad rows were retained for this import.` });
      break;
    }
    const row = rows[rowIndex] ?? [];
    if (row.every((value) => String(value ?? "").trim() === "")) continue;
    const reportDate = parseDate(row[detected.map.date ?? -1]);
    const campaignName = cleanText(cell(row, detected.map.campaignName), 160);
    const spend = parseMoneyToPaise(cell(row, detected.map.spend));
    if (!reportDate || !campaignName || spend === undefined || spend < 0) continue;

    const salesText = cell(row, detected.map.attributedSales);
    const sales = salesText ? parseMoneyToPaise(salesText) : undefined;
    if (sales !== undefined && sales < 0) {
      issues.push({ severity: "warning", message: `${sheetName} row ${rowIndex + 1}: negative attributed sales were skipped.` });
      continue;
    }

    const campaignId = cleanText(cell(row, detected.map.campaignId), 120);
    const adGroupName = cleanText(cell(row, detected.map.adGroupName), 160);
    const sku = cleanText(cell(row, detected.map.sku), 120);
    const attributedOrders = parseCount(cell(row, detected.map.attributedOrders));
    const clicks = parseCount(cell(row, detected.map.clicks));
    const impressions = parseCount(cell(row, detected.map.impressions));
    const rowKey = `${sheetName}:${rowIndex + 1}:${reportDate}:${campaignId ?? campaignName}:${sku ?? ""}:${spend}:${sales ?? ""}`;

    output.push({
      rowKey,
      reportDate,
      campaignName,
      campaignId,
      adGroupName,
      sku,
      spendPaise: spend as MoneyPaise,
      attributedSalesPaise: sales === undefined ? undefined : sales as MoneyPaise,
      attributedOrders,
      clicks,
      impressions,
      currency: "INR",
      sourceRow: rowIndex + 1,
    });
  }
  if (!output.length) issues.push({ severity: "critical", message: `${fileName} / ${sheetName}: no usable ad-performance rows were found.` });
  else if (output.some((item) => item.attributedSalesPaise === undefined)) issues.push({ severity: "warning", message: `${sheetName}: some rows do not contain attributed sales. SellerHisab will show spend but will not invent ACoS/ROAS for incomplete rows.` });
  return output;
}

export async function parseAdsPerformanceFile(file: BrowserAdsFileInput): Promise<AdsPerformanceParseResult> {
  const issues: AdsParserIssue[] = [];
  if (file.buffer.byteLength > MAX_ADS_FILE_BYTES) {
    return { fileName: file.name, sourceFingerprint: "", rows: [], issues: [{ severity: "critical", message: "Ad report is larger than the 20 MB F8 safety limit." }] };
  }
  const sourceFingerprint = await sha256(file.buffer);
  const lower = file.name.toLowerCase();
  let rows: NormalizedAdPerformanceRow[] = [];

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
      const sheetIssues: AdsParserIssue[] = [];
      const normalized = parseRows(file.name, sheetName, sheetRows, sheetIssues);
      if (normalized.length) {
        rows.push(...normalized.slice(0, MAX_NORMALIZED_ROWS - rows.length));
        issues.push(...sheetIssues.filter((item) => item.severity !== "critical"));
      }
    }
    if (!rows.length) issues.push({ severity: "critical", message: "No supported ad-performance sheet was found in this workbook." });
  } else {
    issues.push({ severity: "critical", message: "F8 ad import supports CSV, XLSX and XLS only." });
  }

  const dates = rows.map((item) => item.reportDate).sort();
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
