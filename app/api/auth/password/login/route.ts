import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { normalizeIndiaMobile } from "@/core/auth/phone";
import { isAdminUser } from "@/server/admin";
import { createSession } from "@/server/auth";
import { hashPassword, passwordNeedsRehash, passwordResetRequired, verifyPassword } from "@/server/password";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getD1 } from "@/server/runtime";
import { recordAuthAuditEvent } from "@/server/auth-audit";
import { clearPasswordFailures, getLoginLockState, recordPasswordFailure } from "@/server/admin-security";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

type DbUser = { id: string; email: string; phone: string | null; passwordHash: string | null; createdAt: string };

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    await enforceIpRateLimit(request, "auth-password-login-ip", 60, 15 * 60);
    const identifier = input.identifier.trim();
    const digits = identifier.replace(/\D/g, "");
    const byPhone = !identifier.includes("@") && (digits.length === 10 || digits.length === 12);
    const phone = byPhone ? normalizeIndiaMobile(identifier) : null;
    const email = byPhone ? null : z.string().email().parse(identifier).toLowerCase();
    const throttleKey = phone ?? email!;
    await enforceRateLimit(request, "auth-password-login", throttleKey, 10, 15 * 60);

    const user = phone
      ? await getD1().prepare("SELECT id, email, phone, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE phone = ?1 AND deleted_at IS NULL").bind(phone).first<DbUser>()
      : await getD1().prepare("SELECT id, email, phone, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE email = ?1 AND deleted_at IS NULL").bind(email).first<DbUser>();

    if (user) {
      const lock = await getLoginLockState(user.id);
      if (lock.locked) {
        // Keep the public response indistinguishable from other invalid credentials.
        return Response.json({ error: "Mobile/email or password is incorrect." }, { status: 401, headers: { "cache-control": "no-store" } });
      }
    }

    if (user && passwordResetRequired(user.passwordHash)) {
      return Response.json({
        error: "This password needs a one-time security reset before sign-in. Use ‘Forgot your password?’ and verify the mobile number linked to this account.",
        code: "password_reset_required",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }

    if (!user || !await verifyPassword(input.password, user.passwordHash)) {
      if (user) await recordPasswordFailure(user.id);
      return Response.json({ error: "Mobile/email or password is incorrect." }, { status: 401 });
    }

    await clearPasswordFailures(user.id);
    if (passwordNeedsRehash(user.passwordHash)) {
      // Compare-and-swap: a concurrent reset must never be overwritten by rehash.
      const upgraded = await hashPassword(input.password);
      const result = await getD1().prepare("UPDATE users SET password_hash = ?1 WHERE id = ?2 AND password_hash = ?3 AND deleted_at IS NULL")
        .bind(upgraded, user.id, user.passwordHash).run();
      if (result.meta.changes !== 1) return Response.json({ error: "Credentials changed. Please sign in again." }, { status: 401 });
      user.passwordHash = upgraded;
    }
    const session = await createSession(user.id, user.passwordHash!);
    await recordAuthAuditEvent(user.id, "auth.login_success", phone ? "password_phone" : "password_email");
    const publicEmail = user.email.endsWith("@auth.smg.invalid") ? null : user.email;
    return Response.json(
      { user: { id: user.id, email: publicEmail, phone: user.phone, createdAt: user.createdAt, isAdmin: isAdminUser(publicEmail, user.phone) } },
      { headers: { "set-cookie": session.cookie, "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid mobile number or email." }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    if (/valid 10-digit/i.test(message)) return Response.json({ error: "Enter a valid mobile number or email." }, { status: 400 });
    console.error(JSON.stringify({ event: "auth.password_login.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Password sign-in is temporarily unavailable. Please retry, or use OTP password reset if the problem continues." }, { status: 503 });
  }
}
