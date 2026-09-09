import { randomId } from "./crypto";
import { getD1 } from "./runtime";
import type { RazorpaySubscription } from "./razorpay";
import { normalizeTrialDays, trialIsActive } from "./trial-policy";
export { normalizeTrialDays } from "./trial-policy";

export type TrialPlan = "starter" | "pro";

export type TrialOffer = {
  enabled: boolean;
  days: number;
};

export type TrialOffers = Record<TrialPlan, TrialOffer>;

export type TrialClaim = {
  id: string;
  userId: string;
  subscriptionId: string;
  providerSubscriptionId: string;
  plan: TrialPlan;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: number;
  status: string;
  autoPayStatus: string;
  checkoutEmail: string | null;
  checkoutPhone: string | null;
  providerLastStatus: string | null;
  firstChargePaymentId: string | null;
  convertedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getTrialOffers(): Promise<TrialOffers> {
  const rows = await getD1().prepare(`
    SELECT plan, enabled, trial_days AS trialDays
    FROM billing_trial_settings
    WHERE plan IN ('starter','pro')
  `).all<{ plan: string; enabled: number; trialDays: number }>();

  const offers: TrialOffers = {
    starter: { enabled: false, days: 3 },
    pro: { enabled: false, days: 3 },
  };

  for (const row of rows.results ?? []) {
    if (row.plan !== "starter" && row.plan !== "pro") continue;
    offers[row.plan] = {
      enabled: row.enabled === 1,
      days: normalizeTrialDays(row.trialDays),
    };
  }

  return offers;
}

export async function getTrialOffer(plan: TrialPlan): Promise<TrialOffer> {
  return (await getTrialOffers())[plan];
}

export async function getTrialClaimForUser(userId: string): Promise<TrialClaim | null> {
  return await getD1().prepare(`
    SELECT id,
           user_id AS userId,
           subscription_id AS subscriptionId,
           provider_subscription_id AS providerSubscriptionId,
           plan,
           trial_days AS trialDays,
           trial_started_at AS trialStartedAt,
           trial_ends_at AS trialEndsAt,
           status,
           auto_pay_status AS autoPayStatus,
           checkout_email AS checkoutEmail,
           checkout_phone AS checkoutPhone,
           provider_last_status AS providerLastStatus,
           first_charge_payment_id AS firstChargePaymentId,
           converted_at AS convertedAt,
           failed_at AS failedAt,
           cancelled_at AS cancelledAt,
           created_at AS createdAt,
           updated_at AS updatedAt
    FROM billing_trial_claims
    WHERE user_id = ?1
    LIMIT 1
  `).bind(userId).first<TrialClaim>();
}

export async function getTrialClaimForProviderSubscription(providerSubscriptionId: string): Promise<TrialClaim | null> {
  return await getD1().prepare(`
    SELECT id,
           user_id AS userId,
           subscription_id AS subscriptionId,
           provider_subscription_id AS providerSubscriptionId,
           plan,
           trial_days AS trialDays,
           trial_started_at AS trialStartedAt,
           trial_ends_at AS trialEndsAt,
           status,
           auto_pay_status AS autoPayStatus,
           checkout_email AS checkoutEmail,
           checkout_phone AS checkoutPhone,
           provider_last_status AS providerLastStatus,
           first_charge_payment_id AS firstChargePaymentId,
           converted_at AS convertedAt,
           failed_at AS failedAt,
           cancelled_at AS cancelledAt,
           created_at AS createdAt,
           updated_at AS updatedAt
    FROM billing_trial_claims
    WHERE provider_subscription_id = ?1
    LIMIT 1
  `).bind(providerSubscriptionId).first<TrialClaim>();
}

export async function createTrialClaim(input: {
  userId: string;
  subscriptionId: string;
  providerSubscriptionId: string;
  plan: TrialPlan;
  trialDays: number;
  trialEndsAt: number;
  checkoutEmail: string;
  checkoutPhone: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO billing_trial_claims (
      id, user_id, subscription_id, provider_subscription_id, plan, trial_days,
      trial_started_at, trial_ends_at, status, auto_pay_status,
      checkout_email, checkout_phone, provider_last_status,
      first_charge_payment_id, converted_at, failed_at, cancelled_at,
      created_at, updated_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6,
      NULL, ?7, 'checkout_pending', 'pending',
      ?8, ?9, 'created',
      NULL, NULL, NULL, NULL,
      ?10, ?10
    )
  `).bind(
    randomId("trial"),
    input.userId,
    input.subscriptionId,
    input.providerSubscriptionId,
    input.plan,
    normalizeTrialDays(input.trialDays),
    input.trialEndsAt,
    input.checkoutEmail,
    input.checkoutPhone,
    now,
  ).run();
}

export async function activeTrialPlan(userId: string): Promise<TrialPlan | undefined> {
  const row = await getD1().prepare(`
    SELECT tc.plan
    FROM billing_trial_claims tc
    JOIN subscriptions s ON s.id = tc.subscription_id
    WHERE tc.user_id = ?1
      AND tc.plan IN ('starter','pro')
      AND tc.status = 'active'
      AND tc.trial_ends_at > ?2
      AND s.provider = 'razorpay'
      AND s.provider_verified_at IS NOT NULL
      AND s.status IN ('authenticated','active')
    ORDER BY CASE tc.plan WHEN 'pro' THEN 2 ELSE 1 END DESC, tc.updated_at DESC
    LIMIT 1
  `).bind(userId, Date.now()).first<{ plan: string }>();
  return row?.plan === "pro" ? "pro" : row?.plan === "starter" ? "starter" : undefined;
}

export async function syncTrialClaimFromProvider(input: {
  localSubscriptionId: string;
  providerSubscriptionId: string;
  provider: RazorpaySubscription;
}): Promise<void> {
  const claim = await getTrialClaimForProviderSubscription(input.providerSubscriptionId);
  if (!claim || claim.subscriptionId !== input.localSubscriptionId) return;

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const providerStatus = String(input.provider.status || "pending");
  const paidCount = Number(input.provider.paid_count ?? 0);
  const terminal = providerStatus === "cancelled" || providerStatus === "completed" || providerStatus === "expired";

  let status = claim.status;
  let autoPayStatus = claim.autoPayStatus;
  let trialStartedAt = claim.trialStartedAt;
  let convertedAt = claim.convertedAt;
  let failedAt = claim.failedAt;
  let cancelledAt = claim.cancelledAt;

  if (providerStatus === "cancelled") {
    status = "cancelled";
    cancelledAt = cancelledAt ?? now;
  } else if (providerStatus === "completed" || providerStatus === "expired") {
    status = convertedAt ? "converted" : "completed";
  } else if (providerStatus === "paused") {
    status = "paused";
  } else if (providerStatus === "pending" && nowMs >= claim.trialEndsAt) {
    status = "payment_retry";
    autoPayStatus = "retrying";
  } else if (providerStatus === "halted" && nowMs >= claim.trialEndsAt) {
    status = "payment_failed";
    autoPayStatus = "failed";
    failedAt = failedAt ?? now;
  } else if (paidCount > 0 && nowMs >= claim.trialEndsAt) {
    status = "converted";
    autoPayStatus = "paid";
    convertedAt = convertedAt ?? now;
  } else if (!terminal && nowMs < claim.trialEndsAt && (providerStatus === "authenticated" || providerStatus === "active")) {
    status = "active";
    trialStartedAt = trialStartedAt ?? now;
  } else if (nowMs >= claim.trialEndsAt && status === "active") {
    status = "awaiting_charge";
  }

  await getD1().prepare(`
    UPDATE billing_trial_claims
    SET status = ?1,
        auto_pay_status = ?2,
        trial_started_at = ?3,
        provider_last_status = ?4,
        converted_at = ?5,
        failed_at = ?6,
        cancelled_at = ?7,
        updated_at = ?8
    WHERE id = ?9
  `).bind(
    status,
    autoPayStatus,
    trialStartedAt,
    providerStatus,
    convertedAt,
    failedAt,
    cancelledAt,
    now,
    claim.id,
  ).run();
}

export async function markTrialSubscriptionCharged(input: {
  providerSubscriptionId: string;
  providerPaymentId?: string | null;
}): Promise<void> {
  const claim = await getTrialClaimForProviderSubscription(input.providerSubscriptionId);
  if (!claim) return;
  const now = new Date().toISOString();
  await getD1().prepare(`
    UPDATE billing_trial_claims
    SET status = 'converted',
        auto_pay_status = 'paid',
        first_charge_payment_id = COALESCE(first_charge_payment_id, ?1),
        converted_at = COALESCE(converted_at, ?2),
        failed_at = NULL,
        updated_at = ?2
    WHERE id = ?3
  `).bind(input.providerPaymentId ?? null, now, claim.id).run();
}

export async function getTrialStatusForUser(userId: string): Promise<null | {
  plan: TrialPlan;
  status: string;
  autoPayStatus: string;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: number;
  active: boolean;
  convertedAt: string | null;
  failedAt: string | null;
}> {
  const claim = await getTrialClaimForUser(userId);
  if (!claim) return null;
  return {
    plan: claim.plan,
    status: claim.status,
    autoPayStatus: claim.autoPayStatus,
    trialDays: claim.trialDays,
    trialStartedAt: claim.trialStartedAt,
    trialEndsAt: claim.trialEndsAt,
    active: trialIsActive(claim.status, claim.trialEndsAt),
    convertedAt: claim.convertedAt,
    failedAt: claim.failedAt,
  };
}
