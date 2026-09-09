"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { displayRupees, usePricing } from "../use-pricing";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type OrderResponse = {
  mode: "razorpay" | "restored" | "pending";
  message?: string;
  intentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  checkoutImage?: string;
  customer?: { name?: string; email?: string; contact?: string };
  entitlementToken?: string;
};

export function UnlockReport({ analysisId, onUnlocked }: { analysisId: string; onUnlocked: (token: string) => void }) {
  const [loading, setLoading] = useState(false);
  const pricing = usePricing();
  const actionPrice = displayRupees(pricing.actionReportPaise);

  async function beginUnlock() {
    setLoading(true);
    try {
      const response = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId, product: "action_report" }),
      });
      const order = (await response.json()) as OrderResponse & { error?: string };
      if (response.status === 401) {
        const returnTo = `/analyze?resume=${encodeURIComponent(analysisId)}`;
        window.location.assign(`/app?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (!response.ok) throw new Error(order.error ?? "Payment order could not be created.");
      if (order.mode === "pending") { setLoading(false); toast.info(`${order.message} Reference: ${order.intentId}`); return; }
      if (order.mode === "restored" && order.entitlementToken) {
        localStorage.setItem(`smg-entitlement:${analysisId}`, order.entitlementToken);
        onUnlocked(order.entitlementToken);
        setLoading(false);
        toast.success("Paid Action Report restored.");
        return;
      }
      if (!order.orderId || order.amount === undefined || !order.currency) throw new Error("Payment order response is incomplete.");
      const orderId = order.orderId;
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Secure checkout could not load.");
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "SellerHisab",
        image: order.checkoutImage ?? "https://sellerhisab.com/sellerhisab-favicon-512.png",
        description: "Action Report unlock",
        prefill: Object.fromEntries(Object.entries(order.customer ?? {}).filter(([, value]) => Boolean(value))),
        order_id: orderId,
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => { cancelOrder(analysisId, orderId).catch(() => undefined); setLoading(false); } },
        handler: async (payment: Record<string, string>) => {
          await verify({
            analysisId,
            orderId,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
          });
        },
      });
      checkout.open();
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Payment could not start.");
    }
  }

  async function verify(payload: Record<string, unknown>) {
    const response = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { entitlementToken?: string; error?: string };
    if (!response.ok || !result.entitlementToken) throw new Error(result.error ?? "Payment verification failed.");
    localStorage.setItem(`smg-entitlement:${analysisId}`, result.entitlementToken);
    onUnlocked(result.entitlementToken);
    setLoading(false);
    toast.success("Full Action Report unlocked on this device.");
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white"><LockKeyhole className="size-5" /></span>
        <div className="flex-1">
          <h3 className="text-base font-extrabold text-slate-950">Unlock all actions and simulators</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{actionPrice} one-time. Includes the full SKU board, break-even math, price/return/ad simulators and local Excel/PDF exports.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-600" />Account-linked recovery</span>
            <span className="inline-flex items-center gap-1.5"><CreditCard className="size-4 text-blue-600" />Secure server verification</span>
          </div>
          <Button onClick={beginUnlock} disabled={loading} className="mt-5 bg-blue-600 font-bold hover:bg-blue-700">
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Unlock Action Report — {actionPrice}
          </Button>
        </div>
      </div>
    </div>
  );
}

async function cancelOrder(analysisId: string, orderId: string) {
  await fetch("/api/payments/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ analysisId, orderId }),
  });
}

async function loadRazorpay(): Promise<void> {
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
