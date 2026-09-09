import { fulfilVerifiedOneTimePayment, reconcileSubscriptionFromProvider, writeBillingAudit } from "./billing";
import { fetchRazorpayPayment } from "./razorpay";
import { getD1 } from "./runtime";

export type BillingOperationalReport = {
  paidWithoutEntitlement: Array<{ paymentId: string; providerOrderId: string; providerPaymentId: string | null; userId: string | null; analysisId: string; createdAt: string }>;
  entitlementWithoutPaidPayment: Array<{ entitlementId: string; paymentId: string | null; userId: string | null; analysisId: string; paymentStatus: string | null }>;
  retryableWebhookEvents: Array<{ providerEventId: string; eventType: string; attemptCount: number; lastErrorCode: string | null; lastErrorAt: string | null }>;
  terminalWebhookEvents: Array<{ providerEventId: string; eventType: string; attemptCount: number; lastErrorCode: string | null; lastErrorAt: string | null }>;
  staleSubscriptions: Array<{ id: string; userId: string; providerSubscriptionId: string; plan: string; status: string; providerVerifiedAt: string | null; updatedAt: string }>;
};

export async function billingOperationalReport(): Promise<BillingOperationalReport> {
  const db = getD1();
  const staleBefore = new Date(Date.now() - 26 * 60 * 60_000).toISOString();
  const [missingEntitlement, orphanEntitlement, retryable, terminal, staleSubscriptions] = await Promise.all([
    db.prepare(`
      SELECT p.id AS paymentId, p.provider_order_id AS providerOrderId, p.provider_payment_id AS providerPaymentId,
             p.user_id AS userId, p.analysis_id AS analysisId, p.created_at AS createdAt
      FROM payments p
      LEFT JOIN entitlements e ON e.payment_id = p.id AND e.product = 'action_report' AND e.status = 'active'
      WHERE p.status = 'paid' AND p.product = 'action_report' AND e.id IS NULL
      ORDER BY p.created_at DESC LIMIT 200
    `).all<BillingOperationalReport["paidWithoutEntitlement"][number]>(),
    db.prepare(`
      SELECT e.id AS entitlementId, e.payment_id AS paymentId, e.user_id AS userId, e.analysis_id AS analysisId, p.status AS paymentStatus
      FROM entitlements e
      LEFT JOIN payments p ON p.id = e.payment_id
      WHERE e.status = 'active' AND e.product = 'action_report' AND (p.id IS NULL OR p.status <> 'paid')
      ORDER BY e.issued_at DESC LIMIT 200
    `).all<BillingOperationalReport["entitlementWithoutPaidPayment"][number]>(),
    db.prepare(`SELECT provider_event_id AS providerEventId, event_type AS eventType, attempt_count AS attemptCount, last_error_code AS lastErrorCode, last_error_at AS lastErrorAt FROM webhook_events WHERE state = 'retryable_failed' ORDER BY received_at DESC LIMIT 200`).all<BillingOperationalReport["retryableWebhookEvents"][number]>(),
    db.prepare(`SELECT provider_event_id AS providerEventId, event_type AS eventType, attempt_count AS attemptCount, last_error_code AS lastErrorCode, last_error_at AS lastErrorAt FROM webhook_events WHERE state = 'terminal_failed' ORDER BY received_at DESC LIMIT 200`).all<BillingOperationalReport["terminalWebhookEvents"][number]>(),
    db.prepare(`
      SELECT id, user_id AS userId, provider_subscription_id AS providerSubscriptionId, plan, status,
             provider_verified_at AS providerVerifiedAt, updated_at AS updatedAt
      FROM subscriptions
      WHERE provider = 'razorpay' AND status NOT IN ('cancelled','completed','expired')
        AND (provider_verified_at IS NULL OR provider_verified_at < ?1)
      ORDER BY updated_at ASC LIMIT 200
    `).bind(staleBefore).all<BillingOperationalReport["staleSubscriptions"][number]>(),
  ]);
  return {
    paidWithoutEntitlement: missingEntitlement.results ?? [],
    entitlementWithoutPaidPayment: orphanEntitlement.results ?? [],
    retryableWebhookEvents: retryable.results ?? [],
    terminalWebhookEvents: terminal.results ?? [],
    staleSubscriptions: staleSubscriptions.results ?? [],
  };
}

export async function reconcileRecentBillingWithProvider(input: { limit?: number } = {}): Promise<{ checkedPayments: number; fixedEntitlements: number; heldEntitlements: number; checkedSubscriptions: number; errors: number }> {
  const db = getD1();
  const limit = Math.max(1, Math.min(100, input.limit ?? 40));
  const payments = await db.prepare(`
    SELECT id, provider_order_id AS providerOrderId, provider_payment_id AS providerPaymentId, user_id AS userId,
           analysis_id AS analysisId, amount_paise AS amountPaise, currency, status
    FROM payments
    WHERE provider = 'razorpay' AND provider_payment_id IS NOT NULL AND status NOT IN ('disputed','refunded')
    ORDER BY COALESCE(reconciliation_checked_at,'') ASC, id ASC LIMIT ?1
  `).bind(limit).all<{ id: string; providerOrderId: string; providerPaymentId: string; userId: string | null; analysisId: string; amountPaise: number; currency: string; status: string }>();
  let fixedEntitlements = 0;
  let heldEntitlements = 0;
  let errors = 0;

  for (const local of payments.results ?? []) {
    await db.prepare("UPDATE payments SET reconciliation_checked_at=?2 WHERE id=?1").bind(local.id,new Date().toISOString()).run();
    try {
      /*
       * A dispute/refund is an explicit financial hold.
       * A normal "payment is captured" reconciliation must never silently
       * reactivate access after that hold.
       *
       * payment.dispute.won has its own provider-verified restore path.
       */
      if (local.status === "disputed" || local.status === "refunded") {
        continue;
      }
      const provider = await fetchRazorpayPayment(local.providerPaymentId);
      if (provider.order_id !== local.providerOrderId || provider.amount !== local.amountPaise || provider.currency?.toUpperCase() !== local.currency.toUpperCase()) {
        await db.prepare("UPDATE payments SET status = 'payment_review', provider_status = ?2, provider_verified_at = ?3, updated_at = ?3 WHERE id = ?1").bind(local.id, provider.status, new Date().toISOString()).run();
        await db.prepare("UPDATE entitlements SET status = 'revoked' WHERE payment_id = ?1 AND status = 'active'").bind(local.id).run();
        heldEntitlements += 1;
        await writeBillingAudit({ userId: local.userId, paymentId: local.id, eventType: "payment.reconcile_mismatch", state: "terminal_failed", detail: { providerStatus: provider.status } });
        continue;
      }
      if (provider.status === "captured" && provider.captured !== false) {
        if (local.userId) {
          const before = await db.prepare("SELECT id FROM entitlements WHERE payment_id = ?1 AND status = 'active' LIMIT 1").bind(local.id).first();
          await fulfilVerifiedOneTimePayment({ providerOrderId: local.providerOrderId, providerPaymentId: local.providerPaymentId, expectedUserId: local.userId });
          if (!before) fixedEntitlements += 1;
        } else {
          await db.prepare("UPDATE payments SET status = 'paid', provider_status = 'captured', provider_verified_at = ?2, updated_at = ?2 WHERE id = ?1").bind(local.id, new Date().toISOString()).run();
          await writeBillingAudit({ paymentId: local.id, eventType: "payment.reconcile_guest_requires_support", state: "retryable_failed", detail: { reason: "legacy payment has no durable account owner" } });
        }
      } else if (provider.status === "refunded" || Number(provider.amount_refunded ?? 0) >= local.amountPaise) {
        const now = new Date().toISOString();
        await db.batch([
          db.prepare("UPDATE payments SET status = 'refunded', provider_status = ?2, provider_verified_at = ?3, updated_at = ?3 WHERE id = ?1").bind(local.id, provider.status, now),
          db.prepare("UPDATE entitlements SET status = 'revoked' WHERE payment_id = ?1 AND status = 'active'").bind(local.id),
        ]);
        heldEntitlements += 1;
      } else if (local.status === "paid") {
        const now = new Date().toISOString();
        await db.batch([
          db.prepare("UPDATE payments SET status = 'payment_review', provider_status = ?2, provider_verified_at = ?3, updated_at = ?3 WHERE id = ?1").bind(local.id, provider.status, now),
          db.prepare("UPDATE entitlements SET status = 'revoked' WHERE payment_id = ?1 AND status = 'active'").bind(local.id),
        ]);
        heldEntitlements += 1;
      }
    } catch {
      errors += 1;
    }
  }

  const subscriptions = await db.prepare(`
    SELECT provider_subscription_id AS providerSubscriptionId
    FROM subscriptions WHERE provider = 'razorpay' AND status NOT IN ('cancelled','completed','expired')
    ORDER BY COALESCE(reconciliation_checked_at,'') ASC, id ASC LIMIT ?1
  `).bind(limit).all<{ providerSubscriptionId: string }>();
  for (const row of subscriptions.results ?? []) {
    await db.prepare("UPDATE subscriptions SET reconciliation_checked_at=?2 WHERE provider_subscription_id=?1").bind(row.providerSubscriptionId,new Date().toISOString()).run();
    try { await reconcileSubscriptionFromProvider({ providerSubscriptionId: row.providerSubscriptionId }); }
    catch { errors += 1; }
  }
  console.log(JSON.stringify({event:'billing.reconciliation',checkedPayments:(payments.results??[]).length,checkedSubscriptions:(subscriptions.results??[]).length,errors,fixedEntitlements,heldEntitlements}));
  return { checkedPayments: (payments.results ?? []).length, fixedEntitlements, heldEntitlements, checkedSubscriptions: (subscriptions.results ?? []).length, errors };
}

/**
 * Lightweight subscription-only reconciliation for the five-minute cron.
 * It keeps stale created/authenticated/pending/paused/halted states from
 * blocking a seller for up to a day, without re-running the heavier payment
 * reconciliation loop every five minutes.
 */
export async function reconcileOpenSubscriptionsWithProvider(input: { limit?: number; staleMs?: number } = {}): Promise<{ checked: number; errors: number }> {
  const db = getD1();
  const limit = Math.max(1, Math.min(25, input.limit ?? 8));
  const staleMs = Math.max(60_000, input.staleMs ?? 2 * 60_000);
  const staleBefore = new Date(Date.now() - staleMs).toISOString();
  const subscriptions = await db.prepare(`
    SELECT provider_subscription_id AS providerSubscriptionId
    FROM subscriptions
    WHERE provider = 'razorpay'
      AND status NOT IN ('cancelled','completed','expired')
      AND (reconciliation_checked_at IS NULL OR reconciliation_checked_at < ?1)
    ORDER BY COALESCE(reconciliation_checked_at,''), updated_at ASC, id ASC
    LIMIT ?2
  `).bind(staleBefore, limit).all<{ providerSubscriptionId: string }>();

  let errors = 0;
  let checked = 0;
  for (const row of subscriptions.results ?? []) {
    const checkedAt = new Date().toISOString();
    // Lease the row before the provider call so overlapping cron invocations do
    // not hammer the same subscription. Only the invocation that wins the
    // conditional update is allowed to call Razorpay.
    const lease = await db.prepare(`
      UPDATE subscriptions
      SET reconciliation_checked_at = ?2
      WHERE provider_subscription_id = ?1
        AND (reconciliation_checked_at IS NULL OR reconciliation_checked_at < ?3)
    `).bind(row.providerSubscriptionId, checkedAt, staleBefore).run();
    if ((lease.meta.changes ?? 0) !== 1) continue;

    checked += 1;
    try {
      await reconcileSubscriptionFromProvider({ providerSubscriptionId: row.providerSubscriptionId });
    } catch {
      errors += 1;
    }
  }

  console.log(JSON.stringify({ event: "billing.subscription_reconciliation", checked, errors }));
  return { checked, errors };
}
