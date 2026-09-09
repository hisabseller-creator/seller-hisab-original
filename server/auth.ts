import { getD1, runtimeEnv } from "./runtime";
import { randomId, randomToken, sha256 } from "./crypto";
import { maybePruneExpiredSessions } from "./retention";

const COOKIE_NAME = "smg_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; email: string | null; phone: string | null; createdAt: string };

export async function createSession(userId: string, expectedPasswordHash?: string): Promise<{ token: string; cookie: string }> {
  const token = randomToken(32);
  const secret = runtimeEnv().SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Session signing is not configured. Configure SESSION_SECRET with at least 32 characters.");
  const tokenHash = await sha256(`${token}:${secret}`);
  const now = new Date().toISOString();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await maybePruneExpiredSessions();
  const inserted=await getD1().prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) SELECT ?1,?2,?3,?4,?5 FROM users WHERE id=?2 AND deleted_at IS NULL AND (?6 IS NULL OR password_hash=?6)",
  ).bind(randomId("ses"), userId, tokenHash, expiresAt, now, expectedPasswordHash??null).run();
  if(inserted.meta.changes!==1)throw Error("Credentials changed. Sign in again.");
  return {
    token,
    cookie: `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`,
  };
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request.headers.get("cookie") ?? "", COOKIE_NAME);
  const secret = runtimeEnv().SESSION_SECRET;
  if (!token || !secret) return null;
  const tokenHash = await sha256(`${token}:${secret}`);
  const user = await getD1().prepare(
    `SELECT u.id,
            CASE WHEN u.email LIKE '%@auth.smg.invalid' THEN NULL ELSE u.email END AS email,
            u.phone,
            u.created_at AS createdAt
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.deleted_at IS NULL`,
  ).bind(tokenHash, Date.now()).first<SessionUser>();
  return user ?? null;
}

export async function revokeSession(request: Request): Promise<void> {
  const token = readCookie(request.headers.get("cookie") ?? "", COOKIE_NAME);
  const secret = runtimeEnv().SESSION_SECRET;
  if (!token || !secret) return;
  const tokenHash = await sha256(`${token}:${secret}`);
  await getD1().prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await getD1().prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId).run();
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(header: string, name: string) {
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}
