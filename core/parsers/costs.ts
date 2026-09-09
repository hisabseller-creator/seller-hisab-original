import Papa from "papaparse";
import { parseMoneyToPaise } from "../money";
import type { CostRecord } from "../types";
import { normalizeHeader } from "./aliases";

const aliases = {
  sku: new Set(["sku", "supplier sku", "seller sku", "product sku"].map(normalizeHeader)),
  product: new Set(["product cost", "cost", "purchase cost", "unit cost", "cogs"].map(normalizeHeader)),
  packaging: new Set(["packaging cost", "packing cost", "packaging"].map(normalizeHeader)),
  variable: new Set(["variable cost", "other variable cost", "other cost"].map(normalizeHeader)),
};

export async function parseCostFile(file: File): Promise<CostRecord[]> {
  const rows = file.name.toLowerCase().endsWith(".csv")
    ? Papa.parse<unknown[]>(await file.text(), { skipEmptyLines: "greedy" }).data
    : await workbookRows(await file.arrayBuffer());
  return parseCostRows(rows);
}

export function parseCostPaste(text: string): CostRecord[] {
  if (!text.trim()) return [];
  const parsed = Papa.parse<unknown[]>(text, { skipEmptyLines: "greedy", delimiter: "" });
  const rows = parsed.data;
  const first = rows[0]?.map(normalizeHeader) ?? [];
  const hasHeader = first.some((value) => aliases.sku.has(value)) && first.some((value) => aliases.product.has(value));
  if (!hasHeader) rows.unshift(["SKU", "Product Cost", "Packaging Cost", "Variable Cost"]);
  return parseCostRows(rows);
}

async function workbookRows(buffer: ArrayBuffer): Promise<unknown[][]> {
  const XLSX=await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", dense: true });
  const first = workbook.Sheets[workbook.SheetNames[0]];
  if (!first) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(first, { header: 1, raw: false, defval: "", blankrows: false });
}

function parseCostRows(rows: unknown[][]): CostRecord[] {
  if (!rows.length) throw new Error("Cost sheet is empty.");
  const headerIndex = rows.slice(0, 15).findIndex((row) => row.map(normalizeHeader).some((value) => aliases.sku.has(value)));
  if (headerIndex < 0) throw new Error("Cost sheet needs a clearly labeled SKU column.");
  const headers = rows[headerIndex].map(normalizeHeader);
  const skuIndex = uniqueIndex(headers, aliases.sku, "SKU");
  const productIndex = uniqueIndex(headers, aliases.product, "Product Cost");
  const packagingIndex = optionalUniqueIndex(headers, aliases.packaging, "Packaging Cost");
  const variableIndex = optionalUniqueIndex(headers, aliases.variable, "Variable Cost");
  const output: CostRecord[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const sku = String(row[skuIndex] ?? "").trim();
    if (!sku) continue;
    if (seen.has(sku)) throw new Error(`Cost sheet has duplicate SKU: ${sku}`);
    const productCostPaise = parseMoneyToPaise(row[productIndex]);
    const packagingCostPaise = packagingIndex === undefined ? undefined : parseMoneyToPaise(row[packagingIndex]);
    const variableCostPaise = variableIndex === undefined ? undefined : parseMoneyToPaise(row[variableIndex]);
    if (productCostPaise === undefined || productCostPaise < 0) throw new Error(`Invalid product cost for SKU ${sku}.`);
    if ((packagingCostPaise ?? 0) < 0 || (variableCostPaise ?? 0) < 0) throw new Error(`Negative cost is not allowed for SKU ${sku}.`);
    seen.add(sku);
    output.push({ sku, productCostPaise, packagingCostPaise, variableCostPaise });
  }
  if (!output.length) throw new Error("No valid SKU costs were found.");
  return output;
}

function uniqueIndex(headers: string[], set: Set<string>, label: string) {
  const matches = headers.map((header, index) => set.has(header) ? index : -1).filter((index) => index >= 0);
  if (matches.length !== 1) throw new Error(`${label} column must be present exactly once.`);
  return matches[0];
}

function optionalUniqueIndex(headers: string[], set: Set<string>, label: string) {
  const matches = headers.map((header, index) => set.has(header) ? index : -1).filter((index) => index >= 0);
  if (matches.length > 1) throw new Error(`${label} column is ambiguous.`);
  return matches[0];
}
