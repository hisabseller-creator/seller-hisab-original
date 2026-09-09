import { z } from "zod";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { getD1 } from "@/server/runtime";
import { getTrialOffers, normalizeTrialDays } from "@/server/trials";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  starter: z.object({ enabled: z.boolean(), days: z.number().int().min(1).max(30) }),
  pro: z.object({ enabled: z.boolean(), days: z.number().int().min(1).max(30) }),
});

type TrialAdminRow = {
  id: string;
  userId: string;
  name: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  checkoutEmail: string | null;
  checkoutPhone: string | null;
  plan: string;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: number;
  status: string;
  autoPayStatus: string;
  providerLastStatus: string | null;
  firstChargePaymentId: string | null;
  convertedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  subscriptionStatus: string | null;
};

async function requireAdmin(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Admin sign-in required." }, { status: 401 }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { response: Response.json({ error: "Admin access denied." }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const db = getD1();
  const [settings, trialsResult] = await Promise.all([
    getTrialOffers(),
    db.prepare(`
      SELECT tc.id,
             tc.user_id AS userId,
             u.name,
             u.city,
             CASE WHEN u.email LIKE '%@auth.smg.invalid' THEN NULL ELSE u.email END AS email,
             u.phone,
             tc.checkout_email AS checkoutEmail,
             tc.checkout_phone AS checkoutPhone,
             tc.plan,
             tc.trial_days AS trialDays,
             tc.trial_started_at AS trialStartedAt,
             tc.trial_ends_at AS trialEndsAt,
             tc.status,
             tc.auto_pay_status AS autoPayStatus,
             tc.provider_last_status AS providerLastStatus,
             tc.first_charge_payment_id AS firstChargePaymentId,
             tc.converted_at AS convertedAt,
             tc.failed_at AS failedAt,
             tc.cancelled_at AS cancelledAt,
             tc.created_at AS createdAt,
             tc.updated_at AS updatedAt,
             s.status AS subscriptionStatus
      FROM billing_trial_claims tc
      LEFT JOIN users u ON u.id = tc.user_id
      LEFT JOIN subscriptions s ON s.id = tc.subscription_id
      ORDER BY tc.created_at DESC
      LIMIT 1000
    `).all<TrialAdminRow>(),
  ]);

  const now = Date.now();
  const trials = (trialsResult.results ?? []).map((row) => {
    const displayEmail = row.email ?? row.checkoutEmail;
    const displayPhone = row.phone ?? row.checkoutPhone;
    const active = row.status === "active" && row.trialEndsAt > now;
    const converted = Boolean(row.convertedAt || row.autoPayStatus === "paid" || row.status === "converted");
    const paymentRetrying = !converted && !active && (
      row.status === "payment_retry" ||
      row.autoPayStatus === "retrying" ||
      (row.providerLastStatus === "pending" && row.trialEndsAt <= now)
    );
    const paymentFailed = !converted && !paymentRetrying && (
      row.status === "payment_failed" ||
      row.autoPayStatus === "failed" ||
      (row.providerLastStatus === "halted" && row.trialEndsAt <= now)
    );
    const endedUnpaid = !active && !converted && !paymentRetrying && !paymentFailed && row.trialEndsAt <= now && !row.cancelledAt;
    return {
      ...row,
      email: displayEmail,
      phone: displayPhone,
      active,
      converted,
      paymentRetrying,
      paymentFailed,
      endedUnpaid,
    };
  });

  return Response.json({
    settings,
    trials,
    stats: {
      totalStarted: trials.filter((row) => row.status !== "checkout_pending").length,
      active: trials.filter((row) => row.active).length,
      converted: trials.filter((row) => row.converted).length,
      paymentRetrying: trials.filter((row) => row.paymentRetrying).length,
      paymentFailed: trials.filter((row) => row.paymentFailed).length,
      endedUnpaid: trials.filter((row) => row.endedUnpaid).length,
      cancelled: trials.filter((row) => Boolean(row.cancelledAt) || row.status === "cancelled").length,
    },
    rules: {
      oneTrialPerAccount: true,
      autoPayRequired: true,
      minDays: 1,
      maxDays: 30,
    },
    privacy: "Admin billing view returns account identity and billing/trial metadata only. Passwords, OTPs, card data, Razorpay secrets and session tokens are never returned.",
  }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });

  try {
    const input = settingsSchema.parse(await request.json());
    const now = new Date().toISOString();
    const db = getD1();
    await db.batch([
      db.prepare(`
        INSERT INTO billing_trial_settings (plan, enabled, trial_days, updated_at, updated_by_user_id)
        VALUES ('starter', ?1, ?2, ?3, ?4)
        ON CONFLICT(plan) DO UPDATE SET
          enabled = excluded.enabled,
          trial_days = excluded.trial_days,
          updated_at = excluded.updated_at,
          updated_by_user_id = excluded.updated_by_user_id
      `).bind(input.starter.enabled ? 1 : 0, normalizeTrialDays(input.starter.days), now, auth.user.id),
      db.prepare(`
        INSERT INTO billing_trial_settings (plan, enabled, trial_days, updated_at, updated_by_user_id)
        VALUES ('pro', ?1, ?2, ?3, ?4)
        ON CONFLICT(plan) DO UPDATE SET
          enabled = excluded.enabled,
          trial_days = excluded.trial_days,
          updated_at = excluded.updated_at,
          updated_by_user_id = excluded.updated_by_user_id
      `).bind(input.pro.enabled ? 1 : 0, normalizeTrialDays(input.pro.days), now, auth.user.id),
    ]);

    return Response.json({ ok: true, settings: await getTrialOffers(), updatedAt: now }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Trial settings must use 1–30 whole days." }, { status: 400 });
    return Response.json({ error: "Trial settings could not be saved." }, { status: 503 });
  }
}
