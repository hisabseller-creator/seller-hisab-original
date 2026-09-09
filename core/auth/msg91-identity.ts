import { normalizeIndiaMobile } from "./phone";

const PHONE_KEY = /phone|mobile|number|identifier|contact|recipient|identity|msisdn|^to$|^sub$/i;
const MAX_NESTED_JSON_LENGTH = 10_000;

/**
 * Extract mobile identities only from trusted MSG91 server-verification payloads
 * (plus the already server-verified access-token payload).
 *
 * This intentionally does NOT accept a phone sent separately by the browser as
 * proof of identity. The caller still has to compare the returned set with the
 * phone requested by SellerHisab and fail closed when no match exists.
 */
export function collectMsg91VerifiedPhones(payload: unknown, accessToken?: string): Set<string> {
  const phones = new Set<string>();
  const seen = new WeakSet<object>();
  collectFromTrustedValue(payload, phones, "", seen);

  if (accessToken) {
    const jwtPayload = decodeJwtPayload(accessToken);
    if (jwtPayload) collectFromTrustedValue(jwtPayload, phones, "", seen);
  }

  return phones;
}

function collectFromTrustedValue(value: unknown, output: Set<string>, keyHint: string, seen: WeakSet<object>) {
  if (typeof value === "string") {
    collectFromString(value, output, keyHint, seen);
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    addPhoneCandidate(String(Math.trunc(value)), output, PHONE_KEY.test(keyHint));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectFromTrustedValue(item, output, keyHint, seen);
    return;
  }

  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    collectFromTrustedValue(nested, output, key, seen);
  }
}

function collectFromString(value: string, output: Set<string>, keyHint: string, seen: WeakSet<object>) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) return;

  // Preferred path: an explicit identity/mobile field from MSG91.
  if (PHONE_KEY.test(keyHint)) {
    addPhoneCandidate(trimmed, output, true);
  } else {
    // Some MSG91 response shapes put a single identifier directly under a
    // generic data/result/message field. Only accept it when the entire scalar
    // itself looks like an Indian mobile number; never fish a number out of a
    // human-readable message under a generic key.
    addPhoneCandidate(trimmed, output, false);
  }

  // Provider wrappers occasionally serialize a nested JSON object into a
  // string. Parse only obvious, bounded JSON containers and inspect that trusted
  // provider value recursively.
  if (trimmed.length <= MAX_NESTED_JSON_LENGTH && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    try {
      const nested = JSON.parse(trimmed) as unknown;
      collectFromTrustedValue(nested, output, keyHint, seen);
    } catch {
      // Not JSON; nothing else to do.
    }
  }
}

function addPhoneCandidate(value: string, output: Set<string>, allowEmbedded: boolean) {
  const candidates = allowEmbedded
    ? value.match(/(?:\+?91[\s().-]*)?[6-9](?:[\s().-]*\d){9}/g) ?? []
    : [value];

  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (!(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) continue;
    try {
      output.add(normalizeIndiaMobile(digits));
    } catch {
      // Ignore non-mobile provider fields.
    }
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
