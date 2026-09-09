import { z } from "zod";
import { getSessionUser } from "@/server/auth";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getD1 } from "@/server/runtime";
import { passwordResetRequired, verifyPassword } from "@/server/password";
import { issueAdminStepUp } from "@/server/admin-step-up";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return new Response(null, { status: 403 });
  const user = await getSessionUser(request);
  if (!user) return new Response(null, { status: 401 });
  if (!isAdminUser(user.email, user.phone)) return new Response(null, { status: 403 });

  try {
    await enforceRateLimit(request, "admin-step-up", user.id, 5, 900);
    const input = z.object({ password: z.string().min(1).max(128) }).parse(await request.json());
    const row = await getD1().prepare("SELECT password_hash AS passwordHash FROM users WHERE id=?1 AND deleted_at IS NULL")
      .bind(user.id).first<{ passwordHash: string }>();

    if (row && passwordResetRequired(row.passwordHash)) {
      return Response.json({
        error: "This admin password needs a one-time OTP reset before password-protected admin actions can continue.",
        code: "password_reset_required",
      }, { status: 409 });
    }

    if (!row || !await verifyPassword(input.password, row.passwordHash)) {
      return Response.json({ error: "Password is incorrect." }, { status: 401 });
    }
    return Response.json(
      { ok: true },
      { headers: { "set-cookie": await issueAdminStepUp(request, user.id, row.passwordHash), "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: "Too many reconfirmation attempts. Please wait and retry." }, { status: 429 });
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Enter your password." }, { status: 400 });
    console.error(JSON.stringify({ event: "admin.step_up.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Reconfirmation could not be completed right now." }, { status: 503 });
  }
}
