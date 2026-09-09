import { getD1 } from "./runtime";
import { sha256 } from "./crypto";

export async function enforceRateLimit(request: Request, scope: string, identifier: string, limit: number, windowSeconds: number) {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = await sha256(`${scope}:${identifier.toLowerCase()}:${identifier === "all" ? ip : "account"}:${bucket}`);
  const resetAt = (bucket + 1) * windowSeconds * 1000;
  const db = getD1();

  // One SQLite statement owns the increment. The old SELECT -> UPSERT sequence
  // allowed parallel requests to observe the same count before either updated it.
  const row = await db.prepare(`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (?1, 1, ?2)
    ON CONFLICT(key) DO UPDATE SET
      count = rate_limits.count + 1,
      reset_at = excluded.reset_at
    RETURNING count
  `).bind(key, resetAt).first<{ count: number }>();
  const count = Number(row?.count ?? limit + 1);
  if (count > limit) throw new RateLimitError(resetAt);
}

export class RateLimitError extends Error {
  constructor(public readonly resetAt: number) {
    super("Too many attempts. Please wait and try again.");
  }
}

/**
 * Add a fixed-identifier bucket when an endpoint must also resist attackers who
 * rotate emails, phone numbers or client-generated analysis IDs from one IP.
 */
export function enforceIpRateLimit(request: Request, scope: string, limit: number, windowSeconds: number) {
  return enforceRateLimit(request, scope, "all", limit, windowSeconds);
}
