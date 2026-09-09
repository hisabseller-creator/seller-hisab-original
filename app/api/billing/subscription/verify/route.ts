import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { reconcileSubscriptionFromProvider } from "@/server/billing";
import { constantTimeEqual, hmacSha256 } from "@/server/crypto";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { runtimeEnv } from "@/server/runtime";
import { getTrialClaimForProviderSubscription } from "@/server/trials";

export const dynamic = "force-dynamic";
const schema = z.object({
  subscriptionId: z.string().min(8).max(120),
  razorpaySubscriptionId: z.string().min(8).max(120),
  razorpayPaymentId: z.string().min(8).max(120),
  razorpaySignature: z.string().length(64),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    await enforceIpRateLimit(request, "subscription-verify-ip", 40, 15 * 60);
    await enforceRateLimit(request, "subscription-verify", user.id, 12, 15 * 60);
    const input = schema.parse(await request.json());
    const secret = runtimeEnv().RAZORPAY_KEY_SECRET;
    if (!secret) return Response.json({ error: "Razorpay verification is not configured." }, { status: 503 });
    if (input.razorpaySubscriptionId !== input.subscriptionId) {
      return Response.json({ error: "Subscription identity verification failed." }, { status: 400 });
    }
    const expected = await hmacSha256(secret, `${input.razorpayPaymentId}|${input.subscriptionId}`);
    if (!constantTimeEqual(expected, input.razorpaySignature)) return Response.json({ error: "Subscription signature verification failed." }, { status: 400 });

    const reconciled = await reconcileSubscriptionFromProvider({ providerSubscriptionId: input.subscriptionId, expectedUserId: user.id });
    const trial = await getTrialClaimForProviderSubscription(input.subscriptionId);
    if (trial?.status === "active" && trial.trialEndsAt > Date.now()) {
      return Response.json({
        status: "trial",
        plan: reconciled.plan,
        trialActive: true,
        trialDays: trial.trialDays,
        trialEndsAt: trial.trialEndsAt,
        currentPeriodEnd: reconciled.currentPeriodEnd,
      });
    }
    if (reconciled.status !== "active") {
      return Response.json({ status: reconciled.status, plan: reconciled.plan, currentPeriodEnd: reconciled.currentPeriodEnd, pendingProviderActivation: true });
    }
    return Response.json({ status: "active", plan: reconciled.plan, currentPeriodEnd: reconciled.currentPeriodEnd });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid subscription proof." }, { status: 400 });
    return Response.json({ error: "Subscription proof was accepted by the browser, but provider state could not yet be confirmed. Do not pay again; webhook reconciliation will continue." }, { status: 503 });
  }
}
