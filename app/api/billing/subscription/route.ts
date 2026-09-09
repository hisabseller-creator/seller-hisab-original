import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { reconcileSubscriptionFromProvider } from "@/server/billing";
import { hmacSha256, randomId } from "@/server/crypto";
import { getPricing } from "@/server/pricing";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { cancelRazorpaySubscription, validateConfiguredRazorpayPlan } from "@/server/razorpay";
import { getD1, runtimeEnv } from "@/server/runtime";
import { createTrialClaim, getTrialClaimForProviderSubscription, getTrialClaimForUser, getTrialOffer } from "@/server/trials";

export const dynamic = "force-dynamic";
const schema = z.object({
  plan: z.enum(["starter", "pro"]),
  trialEmail: z.string().trim().email().max(254).optional(),
});

type CheckoutCustomer = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

type OpenSubscription = {
  id: string;
  subscriptionId: string;
  provider: string;
  plan: "starter" | "pro";
  status: string;
  cancelAtPeriodEnd: number;
};

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Account sign-in is required for a monthly plan." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });

  try {
    const { plan, trialEmail } = schema.parse(await request.json());
    await enforceIpRateLimit(request, "subscription-create-ip", 18, 30 * 60);
    await enforceRateLimit(request, "subscription-create", user.id, 6, 30 * 60);

    const env = runtimeEnv();
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.SESSION_SECRET) {
      return Response.json({ error: "Monthly billing is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const { providerPlanId } = await validateConfiguredRazorpayPlan(plan);
    const db = getD1();
    const customer = await db.prepare(`
      SELECT name,
             CASE WHEN email LIKE '%@auth.smg.invalid' THEN NULL ELSE email END AS email,
             phone
      FROM users
      WHERE id = ?1
      LIMIT 1
    `).bind(user.id).first<CheckoutCustomer>();
    if (!customer) return Response.json({ error: "Account profile could not be loaded." }, { status: 409 });

    // Provider state is authoritative. Reconcile the latest open local row first.
    // A checkout that is still only "created" is an abandoned/dismissed Razorpay
    // checkout, not paid access. Reuse it for the same plan, or close it
    // automatically when the seller chooses the other plan so checkout never
    // gets trapped behind a manual Continue/Cancel step.
    let existing = await loadOpenSubscription(user.id);
    if (existing) {
      if (existing.provider !== "razorpay") {
        return Response.json({ error: "Existing billing state requires support review.", code: "billing_review_required" }, { status: 409 });
      }
      try {
        await reconcileSubscriptionFromProvider({ providerSubscriptionId: existing.subscriptionId, expectedUserId: user.id });
        existing = await loadOpenSubscription(user.id);
      } catch (error) {
        console.error(JSON.stringify({ event: "billing.subscription_existing_reconcile.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
        return Response.json({
          error: "We couldn't refresh your billing status right now. Please try again in a moment.",
          code: "billing_state_unavailable",
        }, { status: 503 });
      }
    }

    if (existing) {
      if (existing.status === "payment_review") {
        return Response.json({
          error: "This billing state needs review before another recurring plan can start.",
          code: "billing_review_required",
          existingPlan: existing.plan,
          existingStatus: existing.status,
        }, { status: 409 });
      }

      const existingTrial = await getTrialClaimForProviderSubscription(existing.subscriptionId);
      const resumableTrial = existingTrial &&
        ["checkout_pending", "active"].includes(existingTrial.status) &&
        existingTrial.trialEndsAt > Date.now()
        ? { days: existingTrial.trialDays, endsAt: existingTrial.trialEndsAt }
        : null;

      if (existing.status === "authenticated" && existingTrial?.status === "active" && resumableTrial) {
        return Response.json({
          error: `Your ${resumableTrial.days}-day free trial is already active.`,
          code: "subscription_already_open",
          existingPlan: existing.plan,
          existingStatus: existing.status,
          canCancel: true,
        }, { status: 409 });
      }

      if (["active", "paused", "halted"].includes(existing.status)) {
        return Response.json({
          error: existing.cancelAtPeriodEnd
            ? "This plan is already scheduled to cancel at period end."
            : existing.status === "active"
              ? "This plan is already active."
              : `This ${existing.plan} subscription is ${existing.status}. Manage the active billing state before starting another recurring plan.`,
          code: "subscription_already_open",
          existingPlan: existing.plan,
          existingStatus: existing.status,
          canCancel: true,
        }, { status: 409 });
      }

      if (existing.plan === plan) {
        // Same abandoned/pending checkout: open Razorpay directly with the
        // existing provider subscription instead of asking the seller to
        // "continue" it in a separate UI.
        return subscriptionResponse({
          subscriptionId: existing.subscriptionId,
          plan,
          env,
          customer: {
            ...customer,
            email: customer.email ?? existingTrial?.checkoutEmail ?? null,
          },
          trial: resumableTrial,
        });
      }

      if (existing.status === "created") {
        // Different plan selected after dismissing checkout. Close the old
        // never-activated Razorpay subscription automatically and continue
        // creating checkout for the newly selected plan.
        try {
          await cancelRazorpaySubscription(existing.subscriptionId, false);
          const now = new Date().toISOString();
          await db.prepare(`
            UPDATE subscriptions
            SET status = 'cancelled',
                ended_at = ?1,
                updated_at = ?2
            WHERE id = ?3
              AND user_id = ?4
              AND status = 'created'
          `).bind(Date.now(), now, existing.id, user.id).run();
          existing = await loadOpenSubscription(user.id);
        } catch (error) {
          console.error(JSON.stringify({ event: "billing.subscription_abandoned_replace.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
          return Response.json({
            error: "Your previous checkout is still closing. Tap the plan again in a moment.",
            code: "billing_state_unavailable",
          }, { status: 503 });
        }

        if (existing) {
          return Response.json({
            error: "Your previous billing state is still updating. Tap the plan again in a moment.",
            code: "billing_state_unavailable",
          }, { status: 503 });
        }
      } else {
        // authenticated/pending can represent an accepted mandate or an
        // in-flight charge. Do not create a second recurring subscription.
        return Response.json({
          error: "A recurring payment is already being processed for your account.",
          code: "subscription_already_open",
          existingPlan: existing.plan,
          existingStatus: existing.status,
          canCancel: true,
        }, { status: 409 });
      }
    }

    const offer = await getTrialOffer(plan);
    const previousTrial = await getTrialClaimForUser(user.id);
    const reusablePendingTrial = Boolean(
      previousTrial &&
      previousTrial.status === "checkout_pending" &&
      !previousTrial.trialStartedAt &&
      !previousTrial.convertedAt,
    );
    const trialEligible = offer.enabled && (!previousTrial || reusablePendingTrial);
    const checkoutEmail = customer.email
      ?? trialEmail?.trim().toLowerCase()
      ?? (reusablePendingTrial ? previousTrial?.checkoutEmail ?? null : null);

    if (trialEligible && !customer.phone) {
      return Response.json({ error: "A verified mobile number is required to activate the free trial and AutoPay mandate." }, { status: 400 });
    }
    if (trialEligible && !checkoutEmail) {
      return Response.json({ error: "Enter an email address to activate the free trial and AutoPay mandate.", requiresTrialEmail: true }, { status: 400 });
    }

    const trialEndsAt = trialEligible ? Date.now() + offer.days * 24 * 60 * 60 * 1000 : null;
    const requestBody: Record<string, unknown> = {
      plan_id: providerPlanId,
      total_count: 120,
      quantity: 1,
      customer_notify: true,
      notes: {
        plan,
        user_ref: await hmacSha256(env.SESSION_SECRET, user.id),
        ...(trialEligible ? { trial_days: String(offer.days) } : {}),
      },
    };
    if (trialEndsAt) requestBody.start_at = Math.floor(trialEndsAt / 1000);

    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      redirect: "manual",
    });
    const payload = await response.json() as {
      id?: string;
      plan_id?: string;
      start_at?: number;
      error?: { code?: string; reason?: string };
    };
    if (!response.ok || !payload.id || payload.plan_id !== providerPlanId) {
      throw new Error("provider_subscription_create_failed");
    }

    const now = new Date().toISOString();
    const localId = randomId("sub");
    await db.prepare(`
      INSERT INTO subscriptions (id, user_id, provider_subscription_id, provider, provider_plan_id, plan, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, 'razorpay', ?4, ?5, 'created', ?6, ?6)
    `).bind(localId, user.id, payload.id, providerPlanId, plan, now).run();

    if (trialEligible && trialEndsAt && checkoutEmail && customer.phone) {
      try {
        if (previousTrial && reusablePendingTrial) {
          const now = new Date().toISOString();
          await db.prepare(`
            UPDATE billing_trial_claims
            SET subscription_id = ?1,
                provider_subscription_id = ?2,
                plan = ?3,
                trial_days = ?4,
                trial_started_at = NULL,
                trial_ends_at = ?5,
                status = 'checkout_pending',
                auto_pay_status = 'pending',
                checkout_email = ?6,
                checkout_phone = ?7,
                provider_last_status = 'created',
                first_charge_payment_id = NULL,
                converted_at = NULL,
                failed_at = NULL,
                cancelled_at = NULL,
                updated_at = ?8
            WHERE id = ?9
              AND user_id = ?10
              AND status = 'checkout_pending'
              AND trial_started_at IS NULL
          `).bind(
            localId,
            payload.id,
            plan,
            offer.days,
            trialEndsAt,
            checkoutEmail,
            customer.phone,
            now,
            previousTrial.id,
            user.id,
          ).run();
          const rebound = await db.prepare(`
            SELECT provider_subscription_id AS providerSubscriptionId
            FROM billing_trial_claims
            WHERE id = ?1 AND user_id = ?2
            LIMIT 1
          `).bind(previousTrial.id, user.id).first<{ providerSubscriptionId: string }>();
          if (rebound?.providerSubscriptionId !== payload.id) throw new Error("trial_checkout_rebind_failed");
        } else {
          await createTrialClaim({
            userId: user.id,
            subscriptionId: localId,
            providerSubscriptionId: payload.id,
            plan,
            trialDays: offer.days,
            trialEndsAt,
            checkoutEmail,
            checkoutPhone: customer.phone,
          });
        }
      } catch (error) {
        // The provider subscription already exists. Attempt immediate cleanup;
        // only mark the local row terminal if Razorpay confirms cancellation.
        let providerCancelled = false;
        try {
          await cancelRazorpaySubscription(payload.id, false);
          providerCancelled = true;
        } catch (cleanupError) {
          console.error(JSON.stringify({ event: "billing.subscription_trial_cleanup.error", errorType: cleanupError instanceof Error ? cleanupError.name : "UnknownError" }));
        }
        if (providerCancelled) {
          await db.prepare("UPDATE subscriptions SET status = 'cancelled', ended_at = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(Date.now(), new Date().toISOString(), localId).run().catch(() => undefined);
        }
        throw error;
      }
    }

    return subscriptionResponse({
      subscriptionId: payload.id,
      plan,
      env,
      customer: { ...customer, email: checkoutEmail },
      trial: trialEligible && trialEndsAt ? { days: offer.days, endsAt: trialEndsAt } : null,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid plan or email." }, { status: 400 });
    console.error(JSON.stringify({ event: "billing.subscription_create.error", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Subscription could not start right now. Please retry in a moment." }, { status: 503 });
  }
}

async function loadOpenSubscription(userId: string): Promise<OpenSubscription | null> {
  return await getD1().prepare(`
    SELECT id,
           provider_subscription_id AS subscriptionId,
           provider,
           plan,
           status,
           cancel_at_period_end AS cancelAtPeriodEnd
    FROM subscriptions
    WHERE user_id = ?1
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
  `).bind(userId).first<OpenSubscription>() ?? null;
}

function subscriptionResponse(input: {
  subscriptionId: string;
  plan: "starter" | "pro";
  env: ReturnType<typeof runtimeEnv>;
  customer: CheckoutCustomer;
  trial: { days: number; endsAt: number } | null;
}) {
  const pricing = getPricing();
  const amount = input.plan === "starter" ? pricing.starterMonthlyPaise : pricing.proMonthlyPaise;
  return Response.json({
    mode: "razorpay",
    subscriptionId: input.subscriptionId,
    plan: input.plan,
    amount,
    currency: "INR",
    keyId: input.env.RAZORPAY_KEY_ID,
    customer: {
      name: input.customer.name ?? undefined,
      email: input.customer.email ?? undefined,
      contact: input.customer.phone ?? undefined,
    },
    trial: input.trial,
    checkoutImage: "https://sellerhisab.com/sellerhisab-favicon-512.png",
  });
}
