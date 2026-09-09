import { getSessionUser } from "@/server/auth";
import { reconcileSubscriptionFromProvider } from "@/server/billing";
import { activePaidPlan } from "@/server/plan-access";
import { getD1 } from "@/server/runtime";
import { getTrialStatusForUser } from "@/server/trials";

export const dynamic = "force-dynamic";

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["cancelled", "completed", "expired"]);
const STATUS_REFRESH_MS = 2 * 60_000;

type SubscriptionRow = {
  id: string;
  providerSubscriptionId: string;
  provider: string;
  plan: string;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: number;
  providerVerifiedAt: string | null;
  reconciliationCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers: { "cache-control": "no-store" } });

  const db = getD1();
  let subscription = await loadCanonicalSubscription(user.id);

  // Billing is provider-authoritative. A page visit may refresh a stale open
  // subscription so created/pending state does not contradict the plan-access
  // calculation for hours. Fail closed: if Razorpay is temporarily unavailable,
  // keep the last known local state and never guess paid access.
  if (subscription && subscription.provider === "razorpay" && !TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status) && subscriptionNeedsRefresh(subscription)) {
    try {
      await reconcileSubscriptionFromProvider({ providerSubscriptionId: subscription.providerSubscriptionId, expectedUserId: user.id });
      subscription = await loadCanonicalSubscription(user.id);
    } catch (error) {
      console.error(JSON.stringify({ event: "billing.status_reconcile.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    }
  }

  const entitlement = await db.prepare("SELECT id FROM entitlements WHERE user_id = ?1 AND status = 'active' LIMIT 1")
    .bind(user.id).first<{ id: string }>();

  const [plan, trial, recurringPayments, recurringCount, latestActionReport] = await Promise.all([
    activePaidPlan(user.id),
    getTrialStatusForUser(user.id),
    subscription
      ? db.prepare(`
          SELECT provider_payment_id AS providerPaymentId,
                 event_type AS eventType,
                 amount_paise AS amountPaise,
                 currency,
                 status,
                 occurred_at AS occurredAt
          FROM subscription_payment_events
          WHERE subscription_id = ?1
          ORDER BY occurred_at DESC
          LIMIT 8
        `).bind(subscription.id).all<{
          providerPaymentId: string;
          eventType: string;
          amountPaise: number | null;
          currency: string | null;
          status: string;
          occurredAt: string;
        }>()
      : Promise.resolve({ results: [] as Array<{
          providerPaymentId: string;
          eventType: string;
          amountPaise: number | null;
          currency: string | null;
          status: string;
          occurredAt: string;
        }> }),
    subscription
      ? db.prepare("SELECT COUNT(*) AS count FROM subscription_payment_events WHERE subscription_id = ?1")
          .bind(subscription.id).first<{ count: number }>()
      : Promise.resolve<{ count: number }>({ count: 0 }),
    db.prepare(`
      SELECT amount_paise AS amountPaise,
             currency,
             status,
             provider_status AS providerStatus,
             provider_verified_at AS providerVerifiedAt,
             created_at AS createdAt,
             updated_at AS updatedAt
      FROM payments
      WHERE user_id = ?1 AND product = 'action_report'
      ORDER BY updated_at DESC
      LIMIT 1
    `).bind(user.id).first<{
      amountPaise: number;
      currency: string;
      status: string;
      providerStatus: string | null;
      providerVerifiedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>(),
  ]);

  const subscriptionOpen = Boolean(subscription && !TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status));
  const paidOrTrialActive = Boolean(plan);

  return Response.json({
    subscription: subscription ? {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd === 1,
      providerVerifiedAt: subscription.providerVerifiedAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      open: subscriptionOpen,
      needsAttention: subscriptionOpen && !paidOrTrialActive,
    } : null,
    trial,
    activePlan: plan ?? "free",
    hasPaidAccess: Boolean(plan || entitlement),
    billingActivity: {
      recurringPayments: recurringPayments.results ?? [],
      recurringPaymentCount: Number(recurringCount?.count ?? 0),
      latestActionReport: latestActionReport ?? null,
    },
  }, { headers: { "cache-control": "no-store" } });
}

async function loadCanonicalSubscription(userId: string): Promise<SubscriptionRow | null> {
  return await getD1().prepare(`
    SELECT id,
           provider_subscription_id AS providerSubscriptionId,
           provider,
           plan,
           status,
           current_period_end AS currentPeriodEnd,
           cancel_at_period_end AS cancelAtPeriodEnd,
           provider_verified_at AS providerVerifiedAt,
           reconciliation_checked_at AS reconciliationCheckedAt,
           created_at AS createdAt,
           updated_at AS updatedAt
    FROM subscriptions
    WHERE user_id = ?1
      AND plan IN ('starter','pro')
    ORDER BY
      CASE
        WHEN status = 'active'
          AND provider_verified_at IS NOT NULL
          AND (current_period_end IS NULL OR current_period_end > ?2) THEN 0
        WHEN status NOT IN ('cancelled','completed','expired') THEN 1
        ELSE 2
      END,
      updated_at DESC
    LIMIT 1
  `).bind(userId, Date.now()).first<SubscriptionRow>() ?? null;
}

function subscriptionNeedsRefresh(subscription: SubscriptionRow): boolean {
  if (!subscription.reconciliationCheckedAt) return true;
  const checkedAt = Date.parse(subscription.reconciliationCheckedAt);
  return !Number.isFinite(checkedAt) || checkedAt < Date.now() - STATUS_REFRESH_MS;
}
