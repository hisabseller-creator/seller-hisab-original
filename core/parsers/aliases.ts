export type CanonicalField =
  | "subOrderId"
  | "orderId"
  | "sku"
  | "status"
  | "quantity"
  | "saleAmount"
  | "settlementAmount"
  | "deductionAmount"
  | "eventDate"
  | "adSpend"
  | "adSales"
  | "returnReason";

export const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  subOrderId: [
    "sub order number",
    "sub order no",
    "suborder number",
    "suborder no",
    "sub order id",
    "suborder id",
    "sub_order_number",
    "sub_order_num",
  ],
  orderId: ["order id", "order number", "order no", "order_id"],
  sku: ["supplier sku", "sku", "sku id", "seller sku", "product sku"],
  status: ["order status", "status", "final status", "payment status", "shipment status"],
  quantity: ["quantity", "qty", "item quantity"],
  saleAmount: [
    "selling price",
    "sale amount",
    "order value",
    "product price",
    "listing price",
    "customer paid amount",
    "total sale amount",
  ],
  settlementAmount: [
    "net settlement amount",
    "settlement amount",
    "total settlement amount",
    "final settlement amount",
    "payable amount",
    "total settlement",
    "bank transfer amount",
    "amount paid",
  ],
  deductionAmount: [
    "total deductions",
    "deduction amount",
    "marketplace deductions",
    "return shipping fee",
    "shipping charge",
    "shipping charges",
    "penalty",
  ],
  eventDate: [
    "settlement date",
    "payment date",
    "order date",
    "event date",
    "dispatch date",
    "created date",
  ],
  adSpend: [
    "ad spend",
    "ads spend",
    "amount spent",
    "campaign spend",
    "total ad spend",
    "total spend",
  ],
  adSales: [
    "attributed sales",
    "attributable sales",
    "sales from ads",
    "ad sales",
    "conversion value",
    "revenue from ads",
  ],
  returnReason: [
    "return reason",
    "reason for return",
    "return reason detail",
    "return reason details",
    "rto reason",
    "reason for rto",
    "customer return reason",
    "return comments",
    "return comment",
    "return remarks",
  ],
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u00a0\n\r\t]+/g, " ")
    .replace(/[_/\\().:-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizedAliases = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
    field,
    new Set(aliases.map(normalizeHeader)),
  ]),
) as Record<CanonicalField, Set<string>>;

export function mapHeaders(headers: unknown[]): {
  mapping: Partial<Record<CanonicalField, number>>;
  normalized: string[];
  ignored: string[];
} {
  const normalized = headers.map(normalizeHeader);
  const mapping: Partial<Record<CanonicalField, number>> = {};

  for (const field of Object.keys(normalizedAliases) as CanonicalField[]) {
    const matches = normalized
      .map((header, index) => (normalizedAliases[field].has(header) ? index : -1))
      .filter((index) => index >= 0);
    if (matches.length === 1) mapping[field] = matches[0];
  }

  const used = new Set(Object.values(mapping));
  const ignored = normalized.filter((_, index) => !used.has(index));
  return { mapping, normalized, ignored };
}
