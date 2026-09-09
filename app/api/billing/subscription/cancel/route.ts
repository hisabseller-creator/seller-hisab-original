import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { reconcileSubscriptionFromProvider, writeBillingAudit } from "@/server/billing";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { cancelRazorpaySubscription } from "@/server/razorpay";
import { getD1 } from "@/server/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    await enforceIpRateLimit(request, "subscription-cancel-ip", 20, 60 * 60);
    await enforceRateLimit(request, "subscription-cancel", user.id, 8, 60 * 60);

    const subscription = await getD1().prepare(`
      SELECT id,
             provider_subscription_id AS providerSubscriptionId,
             status,
             plan,
             current_period_end AS currentPeriodEnd
      FROM subscriptions
      WHERE user_id = ?1
        AND provider = 'razorpay'
        AND plan IN ('starter','pro')
        AND status NOT IN ('cancelled','completed','expired')
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'authenticated' THEN 1
          WHEN 'created' THEN 2
          WHEN 'pending' THEN 3
          WHEN 'paused' THEN 4
          WHEN 'halted' THEN 5
          WHEN 'payment_review' THEN 6
          ELSE 7
        END,
        updated_at DESC
      LIMIT 1
    `).bind(user.id).first<{ id: string; providerSubscriptionId: string; status: string; plan: string; currentPeriodEnd: number | null }>();

    if (!subscription) return Response.json({ error: "No open subscription was found." }, { status: 404 });

    // Only a provider-confirmed active paid period should be scheduled for
    // cycle-end cancellation. Incomplete/paused/halted setup is cancelled now
    // so it cannot continue blocking a different plan.
    const atCycleEnd = subscription.status === "active" && Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd > Date.now());
    await cancelRazorpaySubscription(subscription.providerSubscriptionId, atCycleEnd);
    const reconciled = await reconcileSubscriptionFromProvider({ providerSubscriptionId: subscription.providerSubscriptionId, expectedUserId: user.id });
    await writeBillingAudit({
      userId: user.id,
      subscriptionId: subscription.id,
      eventType: "subscription.cancel.requested",
      state: "completed",
      detail: { atCycleEnd, previousStatus: subscription.status },
    });
    return Response.json({
      status: reconciled.status,
      plan: reconciled.plan,
      cancelAtPeriodEnd: atCycleEnd || reconciled.cancelAtPeriodEnd,
      currentPeriodEnd: reconciled.currentPeriodEnd,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    console.error(JSON.stringify({ event: "billing.subscription_cancel.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "We couldn't cancel this billing setup right now. Please try again." }, { status: 503 });
  }
}
