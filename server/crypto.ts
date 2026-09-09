const encoder = new TextEncoder();

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export function randomToken(bytes = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(values);
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomToken(12)}`;
}

export async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256(secret, body);
  return `${body}.${signature}`;
}

export async function verifyToken<T>(token: string, secret: string): Promise<T | null> {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expected = await hmacSha256(secret, body);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as T & { exp?: number };
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Encrypt connector credentials with AES-GCM using a server-only secret.
 * The configured secret is hashed to a 256-bit key so operators can rotate a
 * high-entropy text secret without storing raw key bytes in source control.
 */
export async function encryptJson<T>(value: T, secret: string): Promise<{ ciphertext: string; iv: string }> {
  if (secret.length < 32) throw new Error("Connector token encryption key must be at least 32 characters.");
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { ciphertext: base64url(new Uint8Array(encrypted)), iv: base64url(iv) };
}

export async function decryptJson<T>(ciphertext: string, iv: string, secret: string): Promise<T> {
  if (secret.length < 32) throw new Error("Connector token encryption key must be at least 32 characters.");
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64urlDecode(iv) },
    key,
    base64urlDecode(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
