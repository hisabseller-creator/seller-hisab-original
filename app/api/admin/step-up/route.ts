import { z } from "zod";
import { getSessionUser } from "@/server/auth";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getD1 } from "@/server/runtime";
import { passwordResetRequired, verifyPassword } from "@/server/password";
import { issueAdminStepUp } from "@/server/admin-step-up";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getAdminMfaStatus, verifyAdminSecondFactor } from "@/server/admin-security";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return new Response(null, { status: 403 });
  const user = await getSessionUser(request);
  if (!user) return new Response(null, { status: 401 });
  if (!isAdminUser(user.email, user.phone)) return new Response(null, { status: 403 });

  try {
    await enforceRateLimit(request, "admin-step-up", user.id, 5, 900);
    const input = z.object({
      password: z.string().min(1).max(128),
      code: z.string().trim().min(6).max(32),
    }).parse(await request.json());
    const row = await getD1().prepare("SELECT password_hash AS passwordHash FROM users WHERE id=?1 AND deleted_at IS NULL")
      .bind(user.id).first<{ passwordHash: string | null }>();

    if (row && passwordResetRequired(row.passwordHash)) {
      return Response.json({
        error: "This admin password needs a one-time OTP reset before password-protected admin actions can continue.",
        code: "password_reset_required",
      }, { status: 409 });
    }

    const mfa = await getAdminMfaStatus(user.id);
    if (!mfa.enabled) {
      return Response.json({ error: "Set up authenticator MFA before using admin tools.", code: "mfa_setup_required" }, { status: 409 });
    }
    if (mfa.passwordExpired) {
      return Response.json({ error: "Admin password has reached its 365-day maximum age. Change it before continuing.", code: "password_change_required" }, { status: 409 });
    }

    if (!row?.passwordHash || !await verifyPassword(input.password, row.passwordHash)) {
      return Response.json({ error: "Admin verification failed." }, { status: 401 });
    }
    if (!await verifyAdminSecondFactor(user.id, input.code)) {
      return Response.json({ error: "Admin verification failed." }, { status: 401 });
    }

    return Response.json(
      { ok: true },
      { headers: { "set-cookie": await issueAdminStepUp(request, user.id, row.passwordHash), "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: "Too many admin verification attempts. Please wait and retry." }, { status: 429 });
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Enter your password and authenticator or recovery code." }, { status: 400 });
    console.error(JSON.stringify({ event: "admin.step_up.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Admin verification could not be completed right now." }, { status: 503 });
  }
}
