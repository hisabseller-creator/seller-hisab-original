import {replaceCredential} from '@/server/credential-reset';
import { z } from "zod";
import { normalizeIndiaMobile } from "@/core/auth/phone";
import { createSession } from "@/server/auth";
import { isAdminUser, isAdminEmail, isAdminPhone, requestHasSameOrigin } from "@/server/admin";
import { randomId } from "@/server/crypto";
import { verifyMsg91WidgetAccessToken } from "@/server/msg91-widget";
import { hashPassword, publicPasswordValidationMessage, validatePasswordForIdentity } from "@/server/password";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getD1 } from "@/server/runtime";
import { recordAuthAuditEvent } from "@/server/auth-audit";
import { assertAdminPasswordChangeAllowed, replaceAdminCredential } from "@/server/admin-security";

export const dynamic = "force-dynamic";

const schema = z.object({
  accessToken: z.string().min(20).max(5000),
  phone: z.string().min(10).max(24),
  mode: z.enum(["register", "reset_password"]),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  acceptedTerms: z.boolean().optional(),
});

type DbUser = {
  id: string;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  name: string | null;
  city: string | null;
  termsAcceptedAt: string | null;
  createdAt: string;
};

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    await enforceIpRateLimit(request, "auth-widget-complete-ip", 30, 15 * 60);
    const phone = normalizeIndiaMobile(input.phone);
    await enforceRateLimit(request, "auth-widget-complete", phone, 10, 15 * 60);

    if (input.mode === "register" && (!input.name || !input.city || input.acceptedTerms !== true)) {
      return Response.json({ error: "Complete the required registration fields and accept the Terms & Conditions." }, { status: 400 });
    }

    await verifyMsg91WidgetAccessToken(input.accessToken, phone);

    const now = new Date().toISOString();
    let user = await getD1().prepare(
      "SELECT id, email, phone, password_hash AS passwordHash, name, city, terms_accepted_at AS termsAcceptedAt, created_at AS createdAt FROM users WHERE phone = ?1 AND deleted_at IS NULL",
    ).bind(phone).first<DbUser>();

    const adminIdentity = isAdminUser(user?.email ?? input.email, user?.phone ?? phone);
    // Resolve both allowlists BEFORE every credential creation/recovery path.
    validatePasswordForIdentity(input.password, adminIdentity);
    let createdNewUser = false;
    if (input.mode === "register") {
      if (!user) {
        if(isAdminEmail(input.email)&&!isAdminPhone(phone))return Response.json({error:"Admin email registration requires an approved admin mobile number."},{status:403});
        const registrationEmail = input.email?.trim().toLowerCase();
        if (registrationEmail) {
          const emailOwner = await getD1().prepare("SELECT id FROM users WHERE email = ?1").bind(registrationEmail).first<{ id: string }>();
          if (emailOwner) {
            return Response.json({ error: "An account already exists for this email. Please login instead." }, { status: 409 });
          }
        }

        const email = registrationEmail ?? `phone-${phone}@auth.smg.invalid`;
        user = {
          id: randomId("usr"),
          email,
          phone,
          passwordHash: await hashPassword(input.password),
          name: input.name!.trim(),
          city: input.city!.trim(),
          termsAcceptedAt: now,
          createdAt: now,
        };

        await getD1().prepare(
          "INSERT INTO users (id, email, phone, password_hash, name, city, terms_accepted_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        ).bind(user.id, user.email, user.phone, user.passwordHash, user.name, user.city, user.termsAcceptedAt, user.createdAt).run();
        createdNewUser = true;
      } else {
        const previousHash=user.passwordHash;
        if (adminIdentity) await assertAdminPasswordChangeAllowed(user.id, input.password, previousHash);
        user.passwordHash = await hashPassword(input.password);
        if (adminIdentity) await replaceAdminCredential(user.id, previousHash, user.passwordHash);
        else await replaceCredential(user.id,previousHash,user.passwordHash);
      }
    } else {
      if (!user) return Response.json({ error: "No account exists for this mobile number." }, { status: 404 });
      const previousHash=user.passwordHash;
      if (adminIdentity) await assertAdminPasswordChangeAllowed(user.id, input.password, previousHash);
      user.passwordHash = await hashPassword(input.password);
      if (adminIdentity) await replaceAdminCredential(user.id, previousHash, user.passwordHash);
      else await replaceCredential(user.id,previousHash,user.passwordHash);
    }

    try {
      const session = await createSession(user.id,user.passwordHash!);
      await recordAuthAuditEvent(
        user.id,
        input.mode === "register" ? (createdNewUser ? "auth.register_success" : "auth.password_reset_success") : "auth.password_reset_success",
        "msg91_otp",
      );
      const publicUser = toPublicUser(user);
      return Response.json(
        {
          user: { ...publicUser, isAdmin: isAdminUser(publicUser.email, publicUser.phone) },
          accountState: input.mode === "register" ? (createdNewUser ? "created" : "existing") : "password-reset",
        },
        { headers: { "set-cookie": session.cookie } },
      );
    } catch (error) {
      if (createdNewUser) {
        await getD1().prepare("DELETE FROM users WHERE id = ?1 AND password_hash=?2 AND NOT EXISTS(SELECT 1 FROM sessions WHERE user_id=?1)").bind(user.id,user.passwordHash).run().catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid registration verification request." }, { status: 400 });
    const passwordMessage = publicPasswordValidationMessage(error);
    if (passwordMessage) return Response.json({ error: passwordMessage }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    if (/last 10 passwords|24 hours|reuse the current password/i.test(message)) return Response.json({ error: message }, { status: 400 });
    if (/valid 10-digit|did not match|invalid|expired/i.test(message)) {
      return Response.json({ error: "The verification request is invalid or expired. Please request a new OTP." }, { status: 400 });
    }
    console.error(JSON.stringify({ event: "auth.mobile_complete.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Account verification could not be completed right now. Please retry." }, { status: 503 });
  }
}

function toPublicUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email.endsWith("@auth.smg.invalid") ? null : user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}
