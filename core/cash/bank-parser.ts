import { parseFinancialDate } from "../dates";
import Papa from "papaparse";
import { parseMoneyToPaise } from "../money";
import type { MoneyPaise } from "../types";

export type BankParserIssue = { severity: "warning" | "critical"; message: string };
export type NormalizedBankTransaction = {
  rowKey: string;
  bookedAt: string;
  amountPaise: MoneyPaise;
  direction: "credit" | "debit";
  currency: string;
  reference?: string;
  description?: string;
  closingBalancePaise?: MoneyPaise;
  sourceRow: number;
};
export type BankStatementParseResult = {
  fileName: string;
  sourceFingerprint: string;
  coverageStart?: string;
  coverageEnd?: string;
  transactions: NormalizedBankTransaction[];
  issues: BankParserIssue[];
};

export type BrowserBankFileInput = { name: string; buffer: ArrayBuffer };
const MAX_BANK_FILE_BYTES = 20 * 1024 * 1024;

type ColumnMap = {
  date?: number;
  description?: number;
  reference?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  type?: number;
  balance?: number;
};

const aliases: Record<keyof ColumnMap, string[]> = {
  date: ["date", "transaction date", "txn date", "value date", "posted date", "posting date", "booked date"],
  description: ["narration", "description", "particulars", "transaction details", "transaction detail", "remarks", "details"],
  reference: ["reference", "reference no", "reference number", "ref no", "ref number", "transaction id", "txn id", "utr", "utr no", "cheque no"],
  debit: ["debit", "debit amount", "withdrawal", "withdrawals", "withdrawal amount", "dr amount"],
  credit: ["credit", "credit amount", "deposit", "deposits", "deposit amount", "cr amount"],
  amount: ["amount", "transaction amount", "txn amount"],
  type: ["type", "dr cr", "dr/cr", "transaction type", "debit credit", "debit/credit"],
  balance: ["balance", "closing balance", "available balance", "running balance"],
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
      if (aliases[key].includes(header)) output[key] = index;
    }
  });
  return output;
}

function headerScore(map: ColumnMap): number {
  let score = map.date !== undefined ? 3 : 0;
  if (map.debit !== undefined || map.credit !== undefined) score += 4;
  if (map.amount !== undefined) score += 2;
  if (map.type !== undefined) score += 2;
  if (map.description !== undefined) score += 1;
  if (map.reference !== undefined) score += 1;
  return score;
}

function findHeader(rows: unknown[][]): { index: number; map: ColumnMap } | null {
  let best: { index: number; map: ColumnMap; score: number } | null = null;
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const map = mapColumns(rows[index] ?? []);
    const score = headerScore(map);
    if (!best || score > best.score) best = { index, map, score };
  }
  if (!best || best.score < 7 || best.map.date === undefined) return null;
  const hasSeparate = best.map.debit !== undefined || best.map.credit !== undefined;
  const hasSigned = best.map.amount !== undefined && best.map.type !== undefined;
  if (!hasSeparate && !hasSigned) return null;
  return { index: best.index, map: best.map };
}

function cell(row: unknown[], index: number | undefined): string {
  if (index === undefined) return "";
  return String(row[index] ?? "").trim();
}

function parseDate(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy" });
}

function cleanText(value: string, max: number): string | undefined {
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function directionFromType(value: string): "credit" | "debit" | undefined {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (["cr", "credit", "deposit"].includes(normalized)) return "credit";
  if (["dr", "debit", "withdrawal"].includes(normalized)) return "debit";
  return undefined;
}

function parseRows(fileName: string, sheetName: string, rows: unknown[][], issues: BankParserIssue[]): NormalizedBankTransaction[] {
  const detected = findHeader(rows);
  if (!detected) {
    issues.push({ severity: "critical", message: `${sheetName}: SellerHisab could not safely identify Date plus Debit/Credit columns. This sheet was not imported.` });
    return [];
  }
  const output: NormalizedBankTransaction[] = [];
  for (let rowIndex = detected.index + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    if (row.every((value) => String(value ?? "").trim() === "")) continue;
    const bookedAt = parseDate(row[detected.map.date ?? -1]);
    if (!bookedAt) continue;

    const debit = parseMoneyToPaise(cell(row, detected.map.debit));
    const credit = parseMoneyToPaise(cell(row, detected.map.credit));
    let direction: "credit" | "debit" | undefined;
    let amount: MoneyPaise | undefined;

    if ((credit ?? 0) !== 0 && (debit ?? 0) !== 0) {
      issues.push({ severity: "warning", message: `${sheetName} row ${rowIndex + 1}: both debit and credit are populated, so the row was skipped.` });
      continue;
    }
    if ((credit ?? 0) !== 0) {
      direction = "credit";
      amount = Math.abs(credit ?? 0) as MoneyPaise;
    } else if ((debit ?? 0) !== 0) {
      direction = "debit";
      amount = Math.abs(debit ?? 0) as MoneyPaise;
    } else if (detected.map.amount !== undefined) {
      const signed = parseMoneyToPaise(cell(row, detected.map.amount));
      const typed = directionFromType(cell(row, detected.map.type));
      if (signed !== undefined && typed) {
        direction = typed;
        amount = Math.abs(signed) as MoneyPaise;
      }
    }
    if (!direction || amount === undefined || amount === 0) continue;

    const reference = cleanText(cell(row, detected.map.reference), 100);
    const description = cleanText(cell(row, detected.map.description), 180);
    const closingBalance = parseMoneyToPaise(cell(row, detected.map.balance));
    output.push({
      rowKey: `${sheetName}:${rowIndex + 1}:${bookedAt}:${direction}:${amount}:${reference ?? ""}`,
      bookedAt,
      amountPaise: amount,
      direction,
      currency: "INR",
      reference,
      description,
      closingBalancePaise: closingBalance,
      sourceRow: rowIndex + 1,
    });
  }
  if (!output.length) issues.push({ severity: "critical", message: `${fileName} / ${sheetName}: no usable bank transactions were found.` });
  return output;
}

export async function parseBankStatementFile(file: BrowserBankFileInput): Promise<BankStatementParseResult> {
  const issues: BankParserIssue[] = [];
  if (file.buffer.byteLength > MAX_BANK_FILE_BYTES) {
    return { fileName: file.name, sourceFingerprint: "", transactions: [], issues: [{ severity: "critical", message: "Bank file is larger than the 20 MB F7 safety limit." }] };
  }
  const fingerprint = await sha256(file.buffer);
  const lower = file.name.toLowerCase();
  let transactions: NormalizedBankTransaction[] = [];
  if (lower.endsWith(".csv")) {
    const parsed = Papa.parse<unknown[]>(new TextDecoder("utf-8", { fatal: false }).decode(file.buffer), { skipEmptyLines: "greedy", delimiter: "" });
    if (parsed.errors.length) issues.push({ severity: "warning", message: "CSV parser reported formatting warnings; unsupported rows were skipped." });
    transactions = parseRows(file.name, "CSV", parsed.data, issues);
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX=await import("xlsx");
    const workbook = XLSX.read(file.buffer, { type: "array", cellDates: true, dense: true });
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "", blankrows: false });
      const sheetIssues: BankParserIssue[] = [];
      const parsed = parseRows(file.name, sheetName, rows, sheetIssues);
      if (parsed.length) transactions.push(...parsed);
      else if (sheetIssues.some((item) => item.severity === "critical")) continue;
      issues.push(...sheetIssues.filter((item) => item.severity !== "critical"));
    }
    if (!transactions.length && !issues.some((item) => item.severity === "critical")) issues.push({ severity: "critical", message: "No supported transaction sheet was found in this workbook." });
  } else {
    issues.push({ severity: "critical", message: "F7 bank import supports CSV, XLSX and XLS only." });
  }

  const dates = transactions.map((item) => item.bookedAt).sort();
  return {
    fileName: file.name,
    sourceFingerprint: fingerprint,
    coverageStart: dates[0],
    coverageEnd: dates.at(-1),
    transactions,
    issues,
  };
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
