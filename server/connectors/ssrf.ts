import { normalizeWooCommerceStoreUrl } from "@/core/connectors/woocommerce";

const DNS_TIMEOUT_MS = 5_000;

type DnsAnswer = { type?: number; data?: string };
type DnsJson = { Status?: number; Answer?: DnsAnswer[] };

export function isForbiddenNetworkAddress(input: string): boolean {
  const value = input.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!value) return true;
  if (value.includes(".")) return forbiddenIpv4(value);
  if (value.includes(":")) return forbiddenIpv6(value);
  return true;
}

function forbiddenIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return true;
  const n = parts.map(Number);
  if (n.some((part) => part < 0 || part > 255)) return true;
  const [a, b, c] = n;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function forbiddenIpv6(value: string): boolean {
  const normalized = value.replace(/%.+$/, "");
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const tail = normalized.slice("::ffff:".length);
    return tail.includes(".") ? forbiddenIpv4(tail) : true;
  }
  const first = normalized.split(":")[0] || "0";
  const firstValue = Number.parseInt(first, 16);
  if (!Number.isFinite(firstValue)) return true;
  if ((firstValue & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((firstValue & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstValue & 0xff00) === 0xff00) return true; // multicast
  if (normalized.startsWith("2001:db8:")) return true; // documentation
  return false;
}

export async function assertWooCommercePublicDestination(storeUrl: string): Promise<void> {
  const normalized = normalizeWooCommerceStoreUrl(storeUrl);
  if (!normalized) throw new Error("WooCommerce store URL must be a public HTTPS URL.");
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isForbiddenNetworkAddress(hostname)) throw new Error("WooCommerce store resolved to a private or reserved network address.");
    return;
  }

  const addresses = new Set<string>();
  for (const type of ["A", "AAAA"] as const) {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.searchParams.set("name", hostname);
    url.searchParams.set("type", type);
    const response = await fetch(url, {
      headers: { accept: "application/dns-json" },
      redirect: "manual",
      signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("WooCommerce store DNS could not be validated safely.");
    const payload = await response.json() as DnsJson;
    if (payload.Status !== undefined && payload.Status !== 0 && payload.Status !== 3) throw new Error("WooCommerce store DNS could not be validated safely.");
    for (const answer of payload.Answer ?? []) {
      if ((answer.type === 1 || answer.type === 28) && typeof answer.data === "string") addresses.add(answer.data);
    }
  }
  if (!addresses.size) throw new Error("WooCommerce store hostname did not resolve to a public address.");
  for (const address of addresses) {
    if (isForbiddenNetworkAddress(address)) throw new Error("WooCommerce store resolved to a private or reserved network address.");
  }
}
