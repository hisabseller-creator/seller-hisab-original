import { randomId } from "@/server/crypto";
import { BillingProcessingError, fulfilVerifiedOneTimePayment, reconcileSubscriptionFromProvider, writeBillingAudit } from "@/server/billing";
import { classifyRazorpayDisputeEvent } from "@/server/billing-policy";
import { getD1 } from "@/server/runtime";
import { markTrialSubscriptionCharged } from "@/server/trials";

export type RazorpayPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } };
    refund?: { entity?: { payment_id?: string } };
    dispute?: { entity?: { payment_id?: string } };
    subscription?: { entity?: { id?: string } };
  };
};

export async function processEvent(eventId: string, eventType: string, payload: RazorpayPayload) {
  const payment = payload.payload?.payment?.entity;
  if ((eventType === "payment.captured" || eventType === "order.paid") && payment?.id && payment.order_id) {
    const local = await getD1().prepare("SELECT id FROM payments WHERE provider_order_id = ?1 AND provider = 'razorpay' LIMIT 1").bind(payment.order_id).first<{ id: string }>();
    if (local) {
      await fulfilVerifiedOneTimePayment({ providerOrderId: payment.order_id, providerPaymentId: payment.id, providerEventId: eventId });
    } else {
      const recurring = await getD1().prepare('SELECT 1 FROM subscription_payment_events WHERE provider_payment_id=?1').bind(payment.id).first();
      if (!recurring) throw new BillingProcessingError('capture_payment_not_mapped', true);
    }
    return;
  }

  // Authorization is not fulfilment. Razorpay documents that an authorized
  // payment can later become captured; the captured/order.paid event is the gate.
  if (eventType === "payment.authorized") {
    await writeBillingAudit({ providerEventId: eventId, eventType, state: "completed", detail: { note: "Authorization observed; access waits for captured provider state." } });
    return;
  }

  if (eventType === "payment.failed" && payment?.order_id) {
    await getD1().prepare(`UPDATE payments SET provider_payment_id = ?1, provider_status = 'failed', status = 'failed', updated_at = ?2 WHERE provider_order_id = ?3 AND status IN ('created','failed')`)
      .bind(payment.id ?? null, new Date().toISOString(), payment.order_id).run();
    return;
  }

  if (eventType === "refund.processed") {
    const refundedPaymentId = payload.payload?.refund?.entity?.payment_id ?? payment?.id;
    if (refundedPaymentId) await revokeForProviderPayment(refundedPaymentId, eventType, eventId);
    return;
  }

  const disputeAction = classifyRazorpayDisputeEvent(eventType);
  if (disputeAction !== "ignore") {
    const disputedPaymentId = payload.payload?.dispute?.entity?.payment_id ?? payment?.id;
    if (disputedPaymentId) {
      if (disputeAction === "restore") {
        await restoreAfterWonDispute(disputedPaymentId, eventType, eventId);
      } else {
        await holdForProviderPaymentDispute(disputedPaymentId, eventType, eventId);
      }
    }
    return;
  }

  const subscriptionId = payload.payload?.subscription?.entity?.id;
  if (subscriptionId && eventType.startsWith("subscription.")) {
    const result = await reconcileSubscriptionFromProvider({ providerSubscriptionId: subscriptionId, providerEventId: eventId });
    if (payment?.id) {
      await getD1().prepare(`
        INSERT INTO subscription_payment_events (id, subscription_id, provider_payment_id, event_type, amount_paise, currency, status, occurred_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(provider_payment_id) DO UPDATE SET event_type = excluded.event_type, amount_paise = excluded.amount_paise, currency = excluded.currency, status = excluded.status, occurred_at = excluded.occurred_at
      `).bind(randomId("spe"), result.localId, payment.id, eventType, payment.amount ?? null, payment.currency ?? null, payment.status ?? "unknown", new Date().toISOString()).run();
    }
    if (eventType === "subscription.charged") {
      await markTrialSubscriptionCharged({ providerSubscriptionId: subscriptionId, providerPaymentId: payment?.id ?? null });
    }
    return;
  }
}

async function holdForProviderPaymentDispute(providerPaymentId: string, eventType: string, eventId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const oneTime = await db.prepare(
    "SELECT id, user_id AS userId FROM payments WHERE provider_payment_id = ?1 LIMIT 1"
  ).bind(providerPaymentId).first<{ id: string; userId: string | null }>();
  if (oneTime) {
    await db.batch([
      db.prepare(
        "UPDATE payments SET status = 'disputed', updated_at = ?2 WHERE id = ?1"
      ).bind(oneTime.id, now),
      db.prepare(
        "UPDATE entitlements SET status = 'revoked' WHERE payment_id = ?1"
      ).bind(oneTime.id),
    ]);
    await writeBillingAudit({
      userId: oneTime.userId,
      paymentId: oneTime.id,
      providerEventId: eventId,
      eventType,
      state: "completed",
      detail: { accessHeldForDispute: true },
    });
    return;
  }
  const recurring = await db.prepare(
    "SELECT spe.subscription_id AS subscriptionId FROM subscription_payment_events spe WHERE spe.provider_payment_id = ?1 LIMIT 1"
  ).bind(providerPaymentId).first<{ subscriptionId: string }>();
  if (recurring) {
    await db.prepare(
      "UPDATE subscriptions SET status = 'payment_review', updated_at = ?1 WHERE id = ?2"
    ).bind(now, recurring.subscriptionId).run();
    await writeBillingAudit({
      subscriptionId: recurring.subscriptionId,
      providerEventId: eventId,
      eventType,
      state: "completed",
      detail: { accessHeldForDispute: true },
    });
    return;
  }
  await writeBillingAudit({
    providerEventId: eventId,
    eventType,
    state: "terminal_failed",
    detail: { errorCode: "dispute_payment_not_mapped" },
  });
  throw new BillingProcessingError('dispute_payment_not_mapped', true);
}
async function restoreAfterWonDispute(providerPaymentId: string, eventType: string, eventId: string) {
  const db = getD1();
  const oneTime = await db.prepare(
    "SELECT provider_order_id AS providerOrderId, user_id AS userId FROM payments WHERE provider_payment_id = ?1 AND provider = 'razorpay' LIMIT 1"
  ).bind(providerPaymentId).first<{ providerOrderId: string; userId: string | null }>();
  if (oneTime) {
    if (!oneTime.userId) {
      await writeBillingAudit({
        providerEventId: eventId,
        eventType,
        state: "terminal_failed",
        detail: { errorCode: "dispute_win_payment_has_no_owner" },
      });
      return;
    }
    /*
     * Do NOT blindly restore access from the webhook event.
     * fulfilVerifiedOneTimePayment fetches Razorpay payment + order again
     * and verifies captured status, order identity, amount and currency.
     */
    await fulfilVerifiedOneTimePayment({
      providerOrderId: oneTime.providerOrderId,
      providerPaymentId,
      expectedUserId: oneTime.userId,
      providerEventId: eventId,
    });
    return;
  }
  const recurring = await db.prepare(
    "SELECT spe.subscription_id AS subscriptionId, s.provider_subscription_id AS providerSubscriptionId FROM subscription_payment_events spe JOIN subscriptions s ON s.id = spe.subscription_id WHERE spe.provider_payment_id = ?1 LIMIT 1"
  ).bind(providerPaymentId).first<{
    subscriptionId: string;
    providerSubscriptionId: string;
  }>();
  if (recurring) {
    await reconcileSubscriptionFromProvider({
      providerSubscriptionId: recurring.providerSubscriptionId,
      providerEventId: eventId,
      releasePaymentReview: true,
    });
    return;
  }
  await writeBillingAudit({
    providerEventId: eventId,
    eventType,
    state: "terminal_failed",
    detail: { errorCode: "dispute_win_payment_not_mapped" },
  });
  throw new BillingProcessingError('dispute_win_payment_not_mapped', true);
}
async function revokeForProviderPayment(providerPaymentId: string, eventType: string, eventId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const oneTime = await db.prepare("SELECT id, user_id AS userId FROM payments WHERE provider_payment_id = ?1 LIMIT 1").bind(providerPaymentId).first<{ id: string; userId: string | null }>();
  if (oneTime) {
    await db.batch([
      db.prepare("UPDATE payments SET status = ?1, provider_status = ?1, updated_at = ?2 WHERE id = ?3").bind(eventType === "refund.processed" ? "refunded" : "disputed", now, oneTime.id),
      db.prepare("UPDATE entitlements SET status = 'revoked' WHERE payment_id = ?1").bind(oneTime.id),
    ]);
    await writeBillingAudit({ userId: oneTime.userId, paymentId: oneTime.id, providerEventId: eventId, eventType, state: "completed" });
    return;
  }
  const recurring = await db.prepare(`SELECT spe.subscription_id AS subscriptionId FROM subscription_payment_events spe WHERE spe.provider_payment_id = ?1 LIMIT 1`).bind(providerPaymentId).first<{ subscriptionId: string }>();
  if (recurring) {
    await db.prepare("UPDATE subscriptions SET status = 'payment_review', updated_at = ?1 WHERE id = ?2").bind(now, recurring.subscriptionId).run();
    await writeBillingAudit({ subscriptionId: recurring.subscriptionId, providerEventId: eventId, eventType, state: "completed", detail: { accessHeldForReview: true } });
  } else throw new BillingProcessingError("refund_payment_not_mapped", true);
}

