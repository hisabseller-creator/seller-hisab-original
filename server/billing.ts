import { randomId } from "./crypto";
import { issueEntitlement } from "./entitlements";
import { getPricing } from "./pricing";
import { configuredPlanId, fetchRazorpayOrder, fetchRazorpayPayment, fetchRazorpaySubscription, planForProviderId, type RazorpayOrder, type RazorpayPayment, type RazorpaySubscription } from "./razorpay";
import { getD1 } from "./runtime";
import { syncTrialClaimFromProvider } from "./trials";

export type PaymentFulfilment = {
  paymentId: string;
  analysisId: string;
  userId: string | null;
  providerPaymentId: string;
  entitlementToken?: string;
};

export async function fulfilVerifiedOneTimePayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  expectedAnalysisId?: string;
  expectedUserId?: string;
  providerEventId?: string;
}): Promise<PaymentFulfilment> {
  const db = getD1();
  const payment = await db.prepare(`
    SELECT id, analysis_id AS analysisId, user_id AS userId, product, amount_paise AS amountPaise, currency, status
    FROM payments
    WHERE provider_order_id = ?1 AND provider = 'razorpay'
    LIMIT 1
  `).bind(input.providerOrderId).first<{
    id: string; analysisId: string; userId: string | null; product: string; amountPaise: number; currency: string; status: string;
  }>();
  if (!payment || payment.product !== "action_report") throw new BillingProcessingError("payment_not_found", false);
  if (input.expectedAnalysisId && input.expectedAnalysisId !== payment.analysisId) throw new BillingProcessingError("analysis_mismatch", false);
  if (input.expectedUserId && payment.userId && input.expectedUserId !== payment.userId) throw new BillingProcessingError("payment_owner_mismatch", false);
  if (!payment.userId) {
    // Broad paid launch intentionally does not support anonymous checkout. This
    // guarantees webhook-only fulfilment remains recoverable from the account.
    throw new BillingProcessingError("payment_has_no_account_owner", false);
  }

  const [provider, providerOrder] = await Promise.all([
    fetchRazorpayPayment(input.providerPaymentId),
    fetchRazorpayOrder(input.providerOrderId),
  ]);
  assertCapturedPayment(provider, {
    providerOrderId: input.providerOrderId,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
  });
  assertPaidOrder(providerOrder, {
    providerOrderId: input.providerOrderId,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
  });

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE payments
    SET provider_payment_id = ?1,
        provider_status = ?2,
        provider_verified_at = ?3,
        status = 'paid',
        updated_at = ?3
    WHERE id = ?4
  `).bind(provider.id, provider.status, now, payment.id).run();

  const entitlementToken = await issueEntitlement(payment.analysisId, payment.id, payment.userId);
  await writeBillingAudit({
    userId: payment.userId,
    paymentId: payment.id,
    providerEventId: input.providerEventId,
    eventType: "payment.fulfilled",
    state: "completed",
    detail: { providerStatus: provider.status, amountPaise: provider.amount, currency: provider.currency },
  });
  return { paymentId: payment.id, analysisId: payment.analysisId, userId: payment.userId, providerPaymentId: provider.id, entitlementToken };
}

export async function reconcileSubscriptionFromProvider(input: {
  providerSubscriptionId: string;
  providerEventId?: string;
  expectedUserId?: string;
  releasePaymentReview?: boolean;
}): Promise<{ localId: string; plan: "starter" | "pro"; status: string; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean }> {
  const db = getD1();
  const local = await db.prepare(`
    SELECT id, user_id AS userId, plan, provider_plan_id AS providerPlanId,
           status, current_period_end AS currentPeriodEnd,
           cancel_at_period_end AS cancelAtPeriodEnd
    FROM subscriptions WHERE provider_subscription_id = ?1 AND provider = 'razorpay' LIMIT 1
  `).bind(input.providerSubscriptionId).first<{
    id: string;
    userId: string;
    plan: string;
    providerPlanId: string | null;
    status: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: number;
  }>();
  if (!local) throw new BillingProcessingError("subscription_not_found", false);
  if (input.expectedUserId && local.userId !== input.expectedUserId) throw new BillingProcessingError("subscription_owner_mismatch", false);

  const provider = await fetchRazorpaySubscription(input.providerSubscriptionId);
  const configuredPlan = planForProviderId(provider.plan_id);
  if (!configuredPlan || configuredPlan !== local.plan) throw new BillingProcessingError("subscription_plan_mismatch", false);
  const expectedProviderPlanId = configuredPlanId(configuredPlan);
  if (!expectedProviderPlanId || provider.plan_id !== expectedProviderPlanId) throw new BillingProcessingError("subscription_plan_unconfigured", false);

  const status = normalizeSubscriptionStatus(provider.status);
  const now = new Date().toISOString();
  const currentPeriodEnd = provider.current_end ? provider.current_end * 1000 : null;
  const endedAt = provider.ended_at ? provider.ended_at * 1000 : null;
  const cancelAtPeriodEnd = Boolean(provider.has_scheduled_changes && provider.change_scheduled_at);
  /*
   * payment_review is a durable dispute hold.
   * Routine subscription webhooks/status verification must not turn it back
   * into active merely because the Razorpay subscription itself is active.
   * Only a verified dispute-win path can explicitly release the hold.
   *
   * Terminal provider states are still allowed through so cancelled/completed
   * subscriptions are represented accurately.
   */
  const terminalProviderState =
    status === "cancelled" ||
    status === "completed" ||
    status === "expired";
  if (
    local.status === "payment_review" &&
    !input.releasePaymentReview &&
    !terminalProviderState
  ) {
    await db.prepare(`
      UPDATE subscriptions
      SET provider_verified_at = ?2,
          reconciliation_checked_at = ?2
      WHERE id = ?1
    `).bind(local.id, now).run();
    return {
      localId: local.id,
      plan: configuredPlan,
      status: "payment_review",
      currentPeriodEnd: local.currentPeriodEnd,
      cancelAtPeriodEnd: local.cancelAtPeriodEnd === 1,
    };
  }
  await db.prepare(`
    UPDATE subscriptions
    SET status = ?1,
        provider_plan_id = ?2,
        current_period_end = ?3,
        ended_at = ?4,
        cancel_at_period_end = ?5,
        provider_verified_at = ?6,
        reconciliation_checked_at = ?6,
        updated_at = ?6
    WHERE id = ?7
  `).bind(status, provider.plan_id, currentPeriodEnd, endedAt, cancelAtPeriodEnd ? 1 : 0, now, local.id).run();
  await syncTrialClaimFromProvider({
    localSubscriptionId: local.id,
    providerSubscriptionId: input.providerSubscriptionId,
    provider,
  });
  await writeBillingAudit({
    userId: local.userId,
    subscriptionId: local.id,
    providerEventId: input.providerEventId,
    eventType: "subscription.reconciled",
    state: "completed",
    detail: { plan: configuredPlan, status, currentPeriodEnd, cancelAtPeriodEnd },
  });
  return { localId: local.id, plan: configuredPlan, status, currentPeriodEnd, cancelAtPeriodEnd };
}

export function assertCapturedPayment(payment: RazorpayPayment, expected: { providerOrderId: string; amountPaise: number; currency: string }) {
  if (payment.order_id !== expected.providerOrderId) throw new BillingProcessingError("provider_order_mismatch", false);
  if (!Number.isSafeInteger(payment.amount) || payment.amount !== expected.amountPaise) throw new BillingProcessingError("provider_amount_mismatch", false);
  if (payment.currency?.toUpperCase() !== expected.currency.toUpperCase()) throw new BillingProcessingError("provider_currency_mismatch", false);
  if (payment.status !== "captured" || payment.captured === false) throw new BillingProcessingError("payment_not_captured", true);
  if (expected.amountPaise !== getPricing().actionReportPaise) throw new BillingProcessingError("server_price_mismatch", false);
}

export function assertPaidOrder(order: RazorpayOrder, expected: { providerOrderId: string; amountPaise: number; currency: string }) {
  if (order.id !== expected.providerOrderId) throw new BillingProcessingError("provider_order_identity_mismatch", false);
  if (!Number.isSafeInteger(order.amount) || order.amount !== expected.amountPaise) throw new BillingProcessingError("provider_order_amount_mismatch", false);
  if (order.currency?.toUpperCase() !== expected.currency.toUpperCase()) throw new BillingProcessingError("provider_order_currency_mismatch", false);
  if (order.status !== "paid") throw new BillingProcessingError("provider_order_not_paid", true);
  if (!Number.isSafeInteger(order.amount_paid) || order.amount_paid < expected.amountPaise || order.amount_due !== 0) {
    throw new BillingProcessingError("provider_order_not_fully_paid", true);
  }
}

export function normalizeSubscriptionStatus(status: string): string {
  const allowed = new Set(["created", "authenticated", "active", "pending", "halted", "paused", "cancelled", "completed", "expired"]);
  return allowed.has(status) ? status : "pending";
}

export class BillingProcessingError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) {
    super(code);
  }
}

export async function writeBillingAudit(input: {
  userId?: string | null;
  paymentId?: string;
  subscriptionId?: string;
  providerEventId?: string;
  eventType: string;
  state: string;
  detail?: Record<string, unknown>;
}) {
  await getD1().prepare(`
    INSERT INTO billing_audit_events
      (id, user_id, payment_id, subscription_id, provider_event_id, event_type, state, detail_json, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
  `).bind(
    randomId("bae"), input.userId ?? null, input.paymentId ?? null, input.subscriptionId ?? null,
    input.providerEventId ?? null, input.eventType, input.state,
    input.detail ? JSON.stringify(input.detail) : null, new Date().toISOString(),
  ).run();
}

export function providerSubscriptionPeriodEnd(provider: RazorpaySubscription): number | null {
  return provider.current_end ? provider.current_end * 1000 : null;
}
