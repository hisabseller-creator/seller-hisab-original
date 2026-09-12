import { z } from "zod";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { createSession, getSessionUser } from "@/server/auth";
import { hashPassword, passwordResetRequired, publicPasswordValidationMessage, validateAdminPassword, verifyPassword } from "@/server/password";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getD1 } from "@/server/runtime";
import { assertAdminPasswordChangeAllowed, replaceAdminCredential } from "@/server/admin-security";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

type PasswordRow = { passwordHash: string | null };

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }

  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sign in again before changing the password." }, { status: 401 });
    if (!isAdminUser(user.email, user.phone)) return Response.json({ error: "Admin access is required." }, { status: 403 });

    await enforceIpRateLimit(request, "admin-password-change-ip", 20, 60 * 60);
    await enforceRateLimit(request, "admin-password-change", user.id, 8, 60 * 60);

    const input = schema.parse(await request.json());
    validateAdminPassword(input.newPassword);

    const row = await getD1()
      .prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?1")
      .bind(user.id)
      .first<PasswordRow>();

    if (row && passwordResetRequired(row.passwordHash)) {
      return Response.json({
        error: "This admin password needs a one-time OTP reset before password-protected admin actions can continue.",
        code: "password_reset_required",
      }, { status: 409 });
    }

    if (!row || !await verifyPassword(input.currentPassword, row.passwordHash)) {
      return Response.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    await assertAdminPasswordChangeAllowed(user.id, input.newPassword, row.passwordHash);
    const newHash = await hashPassword(input.newPassword);
    await replaceAdminCredential(user.id, row.passwordHash, newHash);
    const session = await createSession(user.id, newHash);

    return Response.json(
      { ok: true },
      { headers: { "set-cookie": session.cookie, "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        {
          status: 429,
          headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) },
        },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Enter both the current and new password." }, { status: 400 });
    const passwordMessage = publicPasswordValidationMessage(error);
    if (passwordMessage) return Response.json({ error: passwordMessage }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    if (/last 10 passwords|24 hours|reuse the current password/i.test(message)) return Response.json({ error: message }, { status: 400 });
    console.error(JSON.stringify({ event: "admin.password_change.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Password could not be changed right now. Please retry." }, { status: 503 });
  }
}
