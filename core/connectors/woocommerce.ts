import { parseFinancialDate } from "../dates";
import { parseMoneyToPaise } from "../money";
import { PARSER_VERSION, type NormalizedEvent, type ParserIssue } from "../types";

export type WooCommerceCredentialInput = {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
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

function iso(value: unknown, assumeUtc = false): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: assumeUtc });
}

function isUnsafeIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const nums = parts.map(Number);
  if (nums.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = nums;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

export function normalizeWooCommerceStoreUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 240) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
  if (url.port && url.port !== "443") return null;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname.includes(":")) return null; // F11 intentionally rejects literal IPv6 targets.
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".test") || hostname.endsWith(".invalid") || hostname.endsWith(".example")) return null;
  if (isUnsafeIpv4(hostname)) return null;
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}`;
}

export function validWooCommerceConsumerKey(value: string): boolean {
  return /^ck_[A-Za-z0-9]{20,128}$/.test(value.trim());
}

export function validWooCommerceConsumerSecret(value: string): boolean {
  return /^cs_[A-Za-z0-9]{20,128}$/.test(value.trim());
}

export function buildWooCommerceApiUrl(storeUrl: string, path: string, params?: URLSearchParams): string {
  const normalized = normalizeWooCommerceStoreUrl(storeUrl);
  if (!normalized) throw new Error("WooCommerce store URL must be a public HTTPS URL.");
  if (!/^\/[A-Za-z0-9/_-]+$/.test(path)) throw new Error("WooCommerce API path is not allowed.");
  const url = new URL(`${normalized}/wp-json/wc/v3${path}`);
  params?.forEach((value, key) => url.searchParams.append(key, value));
  return url.toString();
}

function outcomeForStatus(status: string): NormalizedEvent["outcome"] {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "delivered";
  if (normalized === "refunded") return "return";
  if (normalized === "cancelled" || normalized === "failed" || normalized === "trash") return "cancelled";
  if (["pending", "processing", "on-hold", "checkout-draft"].includes(normalized)) return "pending";
  return "unknown";
}

/**
 * Maps only commerce fields from WooCommerce orders. Billing/shipping/customer
 * objects are deliberately ignored so customer PII cannot enter the canonical
 * SellerHisab API-sync ledger through this mapper.
 */
export function mapWooCommerceOrders(
  payload: unknown,
  context: { sourceFingerprint: string; channelAccountId?: string },
): { events: NormalizedEvent[]; issues: ParserIssue[] } {
  const events: NormalizedEvent[] = [];
  const issues: ParserIssue[] = [];
  let row = 1;

  for (const rawOrder of array(payload)) {
    const order = object(rawOrder);
    if (!order) continue;
    const orderId = text(order.id);
    const orderNumber = text(order.number) || orderId;
    const status = text(order.status) || "unknown";
    const currency = text(order.currency) || undefined;
    const eventDate = iso(order.date_created_gmt, true) ?? iso(order.date_created);
    for (const rawLine of array(order.line_items)) {
      row += 1;
      const line = object(rawLine);
      if (!line) continue;
      const lineId = text(line.id);
      const sku = text(line.sku);
      const quantity = Number(line.quantity ?? 0);
      const salePaise = parseMoneyToPaise(line.total);
      if (!orderId || !lineId || !sku) {
        issues.push({ code: "missing_identifier", severity: "critical", message: "WooCommerce order line is missing order, line-item or SKU identity and was not normalized." });
        continue;
      }
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000 || salePaise === undefined) {
        issues.push({ code: "invalid_value", severity: "critical", message: "WooCommerce order line has an invalid quantity or line total and was not normalized." });
        continue;
      }
      events.push({
        eventId: `${context.sourceFingerprint}:woocommerce:${orderId}:${lineId}`,
        kind: "order",
        channelId: "woocommerce",
        channelAccountId: context.channelAccountId,
        currency,
        subOrderId: `${orderId}:${lineId}`,
        orderId: orderNumber,
        sku,
        rawStatus: status,
        outcome: outcomeForStatus(status),
        quantity,
        salePaise,
        settlementPaise: undefined,
        eventDate,
        source: {
          fileName: "WooCommerce REST API",
          channelId: "woocommerce",
          channelAccountId: context.channelAccountId,
          sheetName: "Orders wc/v3",
          rowNumber: row,
          parserVersion: PARSER_VERSION,
          sourceFingerprint: context.sourceFingerprint,
        },
      });
    }
  }
  return { events, issues };
}
