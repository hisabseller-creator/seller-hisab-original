"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubscriptionResponse = {
  mode: "razorpay";
  subscriptionId: string;
  plan: "starter" | "pro";
  amount: number;
  currency: string;
  keyId?: string;
  checkoutImage?: string;
  customer?: { name?: string; email?: string; contact?: string };
  trial?: { days: number; endsAt: number } | null;
  requiresTrialEmail?: boolean;
  error?: string;
  code?: string;
  existingPlan?: "starter" | "pro";
  existingStatus?: string;
  canCancel?: boolean;
};

export function PlanSubscribeButton({
  plan,
  trialDays = 0,
  userEmail,
  userPhone,
  onActive,
  buttonLabel,
  compact = false,
}: {
  plan: "starter" | "pro";
  trialDays?: number;
  userEmail?: string | null;
  userPhone?: string | null;
  onActive?: () => void;
  buttonLabel?: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [trialEmail, setTrialEmail] = useState(userEmail ?? "");
  const needsTrialEmail = trialDays > 0 && !userEmail;
  const missingTrialPhone = trialDays > 0 && !userPhone;

  async function start() {
    if (needsTrialEmail && !/^\S+@\S+\.\S+$/.test(trialEmail.trim())) {
      toast.error("Enter a valid email address for the free trial and AutoPay mandate.");
      return;
    }
    if (missingTrialPhone) {
      toast.error("A verified mobile number is required for the free trial.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, ...(trialEmail.trim() ? { trialEmail: trialEmail.trim() } : {}) }),
      });
      const subscription = await response.json() as SubscriptionResponse;
      if (!response.ok) {
        if (["subscription_conflict", "subscription_already_open", "billing_review_required"].includes(subscription.code ?? "")) {
          onActive?.();
        }
        throw new Error(subscription.error ?? "Checkout could not start.");
      }
      await loadCheckout();
      if (!window.Razorpay) throw new Error("Secure checkout could not load.");

      const prefill = Object.fromEntries(Object.entries(subscription.customer ?? {}).filter(([, value]) => Boolean(value)));
      const checkout = new window.Razorpay({
        key: subscription.keyId,
        subscription_id: subscription.subscriptionId,
        name: "SellerHisab",
        image: subscription.checkoutImage ?? "https://sellerhisab.com/sellerhisab-favicon-512.png",
        description: subscription.trial
          ? `${plan === "starter" ? "Starter" : "Pro"} • ${subscription.trial.days}-day free trial, then monthly AutoPay`
          : `${plan === "starter" ? "Starter" : "Pro"} monthly plan`,
        prefill,
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (payment: Record<string, string>) => {
          try {
            await verify(subscription, {
              razorpaySubscriptionId: payment.razorpay_subscription_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            });
          } catch (error) {
            setLoading(false);
            toast.error(error instanceof Error ? error.message : "Subscription verification failed.");
          }
        },
      });
      checkout.open();
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Checkout could not start.");
    }
  }

  async function verify(subscription: SubscriptionResponse, proof: Record<string, unknown>) {
    const response = await fetch("/api/billing/subscription/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId: subscription.subscriptionId, ...proof }),
    });
    const result = await response.json() as { status?: string; trialActive?: boolean; trialDays?: number; trialEndsAt?: number; pendingProviderActivation?: boolean; error?: string };
    if (!response.ok) throw new Error(result.error ?? "We couldn't confirm your payment yet.");
    setLoading(false);
    if (result.trialActive && result.trialEndsAt) {
      toast.success(`${plan === "starter" ? "Starter" : "Pro"} free trial active until ${new Date(result.trialEndsAt).toLocaleDateString("en-IN")}. AutoPay starts after the trial unless you cancel.`);
    } else if (result.status === "active") {
      toast.success(`${plan === "starter" ? "Starter" : "Pro"} plan active.`);
    } else {
      toast.info("Checkout received. We'll activate your plan as soon as the payment is confirmed.");
    }
    onActive?.();
  }

  return (
    <div className={compact ? "" : "mt-5"}>
      {needsTrialEmail && <Input type="email" inputMode="email" autoComplete="email" className="mb-2 h-11" value={trialEmail} onChange={(event) => setTrialEmail(event.target.value)} placeholder="Email for trial & AutoPay" />}
      {missingTrialPhone && <p className="mb-2 text-xs font-semibold leading-5 text-amber-700">A verified mobile number is required before this free trial can be activated.</p>}
      {!compact && trialDays > 0 && <p className="mb-2 text-[11px] leading-4 text-slate-500">{trialDays}-day free trial. AutoPay approval is required now; the monthly charge starts after the trial unless you cancel first.</p>}
      <Button className="min-h-11 h-auto w-full whitespace-normal bg-blue-600 px-3 py-2.5 text-center font-bold leading-5 hover:bg-blue-700" onClick={start} disabled={loading || missingTrialPhone}>
        {loading && <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />}
        {buttonLabel ?? (trialDays > 0 ? `Start ${trialDays}-day free trial` : `Start ${plan === "starter" ? "Starter" : "Pro"}`)}
      </Button>
    </div>
  );
}

async function loadCheckout() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Checkout failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Checkout failed to load."));
    document.head.appendChild(script);
  });
}
