import { z } from "zod";
import { getSessionUser } from "@/server/auth";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { hasAdminStepUp } from "@/server/admin-step-up";
import { getD1 } from "@/server/runtime";
import { verifyPassword } from "@/server/password";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import {
  confirmAdminMfaEnrollment,
  getAdminMfaStatus,
  startAdminMfaEnrollment,
  verifyAdminSecondFactor,
} from "@/server/admin-security";

export const dynamic = "force-dynamic";

async function adminFor(request: Request) {
  const user = await getSessionUser(request);
  if (!user || !isAdminUser(user.email, user.phone)) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await adminFor(request);
  if (!user) return Response.json({ error: "Admin sign-in required." }, { status: 401 });
  const status = await getAdminMfaStatus(user.id);
  return Response.json({ ...status, unlocked: await hasAdminStepUp(request, user) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const user = await adminFor(request);
  if (!user) return Response.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    await enforceRateLimit(request, "admin-mfa", user.id, 8, 15 * 60);
    const input = z.discriminatedUnion("action", [
      z.object({ action: z.literal("setup"), currentPassword: z.string().min(1).max(128) }),
      z.object({ action: z.literal("confirm"), code: z.string().trim().min(6).max(16) }),
      z.object({ action: z.literal("rotate"), currentPassword: z.string().min(1).max(128), code: z.string().trim().min(6).max(32) }),
    ]).parse(await request.json());

    if (input.action === "confirm") {
      const recoveryCodes = await confirmAdminMfaEnrollment(user.id, input.code);
      return Response.json({ ok: true, recoveryCodes }, { headers: { "cache-control": "no-store" } });
    }

    const row = await getD1().prepare("SELECT password_hash AS passwordHash FROM users WHERE id=?1 AND deleted_at IS NULL")
      .bind(user.id).first<{ passwordHash: string | null }>();
    if (!row?.passwordHash || !await verifyPassword(input.currentPassword, row.passwordHash)) {
      return Response.json({ error: "Admin verification failed." }, { status: 401 });
    }

    const status = await getAdminMfaStatus(user.id);
    if (input.action === "setup") {
      if (status.enabled) return Response.json({ error: "MFA is already enabled. Use rotation to replace the authenticator." }, { status: 409 });
      const enrollment = await startAdminMfaEnrollment(user.id, user.email ?? user.phone ?? "Admin");
      return Response.json({ ok: true, ...enrollment }, { headers: { "cache-control": "no-store" } });
    }

    if (!status.enabled) return Response.json({ error: "MFA is not enabled yet." }, { status: 409 });
    if (!await verifyAdminSecondFactor(user.id, input.code)) {
      return Response.json({ error: "Admin verification failed." }, { status: 401 });
    }
    const enrollment = await startAdminMfaEnrollment(user.id, user.email ?? user.phone ?? "Admin", true);
    return Response.json({ ok: true, ...enrollment }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid MFA request." }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    if (/MFA|Authenticator|enrollment/i.test(message)) return Response.json({ error: message }, { status: 400 });
    console.error(JSON.stringify({ event: "admin.mfa.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "MFA operation could not be completed right now." }, { status: 503 });
  }
}
