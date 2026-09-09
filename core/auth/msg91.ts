const TOKEN_KEYS = ["access-token", "access_token", "accessToken", "token", "jwt", "message"] as const;

export function extractMsg91AccessToken(value: unknown): string | undefined {
  if (typeof value === "string") return looksLikeAccessToken(value) ? value : undefined;
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  for (const key of TOKEN_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string" && looksLikeAccessToken(candidate)) return candidate;
  }

  for (const nested of Object.values(record)) {
    const token = extractMsg91AccessToken(nested);
    if (token) return token;
  }
  return undefined;
}

export function looksLikeAccessToken(value: string): boolean {
  const token = value.trim();
  if (token.length <= 20) return false;
  return token.split(".").length === 3 || (token.length > 40 && !/\s/.test(token));
}
