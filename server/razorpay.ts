import { providerFetch } from "./provider-http";
import { getPricing } from "./pricing";
import { runtimeEnv } from "./runtime";

export type RazorpayPayment = {
  id: string;
  order_id?: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed" | string;
  captured?: boolean;
  amount_refunded?: number;
  refund_status?: string | null;
};


export type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string | null;
  status: "created" | "attempted" | "paid" | string;
};

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  start_at?: number | null;
  charge_at?: number | null;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  paid_count?: number;
  remaining_count?: number;
  has_scheduled_changes?: boolean;
  change_scheduled_at?: number | null;
};

export type RazorpayPlan = {
  id: string;
  period: string;
  interval: number;
  item?: { amount?: number; unit_amount?: number; currency?: string; active?: boolean };
};

type RazorpayErrorBody = { error?: { code?: string; description?: string; reason?: string } };

export class RazorpayApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super("Payment provider request failed. Please try again or contact support with the request time.");
  }
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayJson<RazorpayPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  return razorpayJson<RazorpayOrder>(`/v1/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export async function fetchRazorpaySubscription(subscriptionId: string): Promise<RazorpaySubscription> {
  return razorpayJson<RazorpaySubscription>(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
}

export async function fetchRazorpayPlan(planId: string): Promise<RazorpayPlan> {
  return razorpayJson<RazorpayPlan>(`/v1/plans/${encodeURIComponent(planId)}`, { method: "GET" });
}

export async function cancelRazorpaySubscription(subscriptionId: string, atCycleEnd: boolean): Promise<RazorpaySubscription> {
  return razorpayJson<RazorpaySubscription>(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd }),
  });
}

export async function validateConfiguredRazorpayPlan(plan: "starter" | "pro"): Promise<{ providerPlanId: string; amountPaise: number }> {
  const env = runtimeEnv();
  const providerPlanId = plan === "starter" ? env.RAZORPAY_STARTER_PLAN_ID : env.RAZORPAY_PRO_PLAN_ID;
  if (!providerPlanId) throw new Error(`Razorpay ${plan} plan is not configured.`);
  const expectedAmount = plan === "starter" ? getPricing().starterMonthlyPaise : getPricing().proMonthlyPaise;
  const providerPlan = await fetchRazorpayPlan(providerPlanId);
  const providerAmount = providerPlan.item?.amount ?? providerPlan.item?.unit_amount;
  const providerCurrency = providerPlan.item?.currency?.toUpperCase();
  if (providerPlan.id !== providerPlanId || providerPlan.period !== "monthly" || providerPlan.interval !== 1) {
    throw new Error(`Razorpay ${plan} plan configuration does not match SellerHisab monthly billing.`);
  }
  if (providerAmount !== expectedAmount || providerCurrency !== "INR") {
    throw new Error(`Razorpay ${plan} plan amount/currency does not match SellerHisab pricing.`);
  }
  if (providerPlan.item?.active === false) throw new Error(`Razorpay ${plan} plan is inactive.`);
  return { providerPlanId, amountPaise: expectedAmount };
}

export function configuredPlanId(plan: "starter" | "pro"): string | undefined {
  const env = runtimeEnv();
  return plan === "starter" ? env.RAZORPAY_STARTER_PLAN_ID : env.RAZORPAY_PRO_PLAN_ID;
}

export function planForProviderId(planId: string | undefined): "starter" | "pro" | undefined {
  if (!planId) return undefined;
  const env = runtimeEnv();
  if (env.RAZORPAY_STARTER_PLAN_ID && planId === env.RAZORPAY_STARTER_PLAN_ID) return "starter";
  if (env.RAZORPAY_PRO_PLAN_ID && planId === env.RAZORPAY_PRO_PLAN_ID) return "pro";
  return undefined;
}

export async function razorpayJson<T>(path: string, init: RequestInit): Promise<T> {
  const env = runtimeEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay API credentials are not configured.");
  const authorization = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const response = await providerFetch(`https://api.razorpay.com${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${authorization}`,
      accept: "application/json",
      ...(init.headers ?? {}),
    },
    redirect: "manual",
  });
  const payload = await response.json().catch(() => ({})) as T & RazorpayErrorBody;
  if (!response.ok) {
    const code = payload.error?.code ?? payload.error?.reason ?? `http_${response.status}`;
    throw new RazorpayApiError(response.status, String(code).slice(0, 80));
  }
  return payload as T;
}
