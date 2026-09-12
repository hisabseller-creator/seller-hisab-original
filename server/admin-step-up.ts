import { getD1, runtimeEnv } from "./runtime";
import { sha256, signToken, verifyToken } from "./crypto";
import type { SessionUser } from "./auth";
import { getAdminMfaStatus, getSecurityVersion } from "./admin-security";

const MAX_AGE = 15 * 60 * 1000;
const COOKIE_NAME = "smg_admin_stepup";

type StepUpProof = {
  uid: string;
  session: string;
  credential: string;
  securityVersion: number;
  purpose: "admin-mfa-step-up";
  exp: number;
};

function cookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? "";
}

export async function hasAdminStepUp(request: Request, user: SessionUser): Promise<boolean> {
  const secret = runtimeEnv().SESSION_SECRET;
  if (!secret) return false;
  const token = cookie(request, "smg_session");
  if (!token) return false;
  const tokenHash = await sha256(`${token}:${secret}`);
  const session = await getD1().prepare(
    "SELECT id FROM sessions WHERE token_hash=?1 AND user_id=?2 AND expires_at>?3",
  ).bind(tokenHash, user.id, Date.now()).first<{ id: string }>();
  if (!session) return false;

  const status = await getAdminMfaStatus(user.id);
  if (!status.enabled || status.passwordExpired) return false;

  const proof = await verifyToken<StepUpProof>(cookie(request, COOKIE_NAME), secret);
  if (!proof || proof.purpose !== "admin-mfa-step-up" || !proof.exp || proof.exp > Date.now() + MAX_AGE) return false;
  if (proof.uid !== user.id || proof.session !== tokenHash) return false;

  const row = await getD1().prepare("SELECT password_hash AS passwordHash FROM users WHERE id=?1 AND deleted_at IS NULL")
    .bind(user.id).first<{ passwordHash: string | null }>();
  if (!row?.passwordHash || proof.credential !== await sha256(row.passwordHash)) return false;
  return proof.securityVersion === await getSecurityVersion(user.id);
}

export async function issueAdminStepUp(request: Request, userId: string, passwordHash: string): Promise<string> {
  const secret = runtimeEnv().SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Session security is not configured.");
  const sessionToken = cookie(request, "smg_session");
  if (!sessionToken) throw new Error("Admin session is unavailable.");
  const proof = await signToken({
    uid: userId,
    session: await sha256(`${sessionToken}:${secret}`),
    credential: await sha256(passwordHash),
    securityVersion: await getSecurityVersion(userId),
    purpose: "admin-mfa-step-up",
    exp: Date.now() + MAX_AGE,
  }, secret);
  return `${COOKIE_NAME}=${proof}; Path=/; Max-Age=${Math.floor(MAX_AGE / 1000)}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminStepUpCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
