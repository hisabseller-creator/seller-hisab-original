import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { createLogicalOrder } from "@/server/payment-intents";
import { hmacSha256 } from "@/server/crypto";
import { restoreEntitlement } from "@/server/entitlements";
import { getPricing } from "@/server/pricing";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getD1, runtimeEnv } from "@/server/runtime";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  analysisId: z.string().regex(/^ana_[a-z0-9_]{6,80}$/),
  product: z.literal("action_report"),
});

type CheckoutCustomer = { name: string | null; email: string | null; phone: string | null };

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const input = inputSchema.parse(await request.json());
    await enforceIpRateLimit(request, "payment-order-ip", 24, 15 * 60);
    await enforceRateLimit(request, "payment-order", input.analysisId, 8, 15 * 60);

    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sign in is required before making a real payment so paid access can always be recovered." }, { status: 401 });
    const env = runtimeEnv();
    const amount = getPricing().actionReportPaise;
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.ENTITLEMENT_SECRET) {
      throw new Error("Real payments are temporarily unavailable because Razorpay is not fully configured.");
    }

    const db = getD1();
    const customer = await db.prepare(`
      SELECT name,
             CASE WHEN email LIKE '%@auth.smg.invalid' THEN NULL ELSE email END AS email,
             phone
      FROM users WHERE id = ?1 LIMIT 1
    `).bind(user.id).first<CheckoutCustomer>();

    const existing = await db.prepare(
      `SELECT id,
              provider_order_id AS providerOrderId,
              provider,
              status,
              user_id AS userId
       FROM payments
       WHERE analysis_id = ?1 AND product = 'action_report' AND status IN ('created','pending','paid')
       ORDER BY created_at DESC
       LIMIT 1`,
    ).bind(input.analysisId).first<{ id: string; providerOrderId: string; provider: string; status: string; userId: string | null }>();

    if (existing?.status === "paid") {
      if (existing.userId !== user.id) {
        return Response.json(
          { error: "This report is already paid. Restore it from the original device or the account it was linked to." },
          { status: 409 },
        );
      }
      const entitlementToken = await restoreEntitlement(input.analysisId, user.id);
      if (!entitlementToken) return Response.json({ error: "Paid access could not be restored." }, { status: 409 });
      return Response.json({ mode: "restored", entitlementToken });
    }

    if (existing?.userId && existing.userId !== user.id) {
      return Response.json({ error: "This payment attempt belongs to another account." }, { status: 409 });
    }

    if (existing && existing.provider === "razorpay") {
      if (!existing.userId) {
        await db.prepare("UPDATE payments SET user_id = ?1 WHERE id = ?2 AND user_id IS NULL").bind(user.id, existing.id).run();
      }
      return orderResponse(existing.providerOrderId, amount, env, customer);
    }

    const intent = await createLogicalOrder({analysisId:input.analysisId,userId:user.id,amount,analysisRef:await hmacSha256(env.ENTITLEMENT_SECRET,input.analysisId)});
    if (!intent.orderId) return Response.json({mode:'pending',state:intent.state,intentId:intent.intentId,message:'Payment setup is being checked. Do not start another purchase. If this persists, contact support with this reference.'},{status:202,headers:{'retry-after':'30'}});
    return orderResponse(intent.orderId,intent.amount,env,customer);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid payment request." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Payment order could not be created." }, { status: 503 });
  }
}

function orderResponse(orderId: string, amount: number, env: ReturnType<typeof runtimeEnv>, customer: CheckoutCustomer | null) {
  return Response.json({
    mode: "razorpay",
    orderId,
    amount,
    currency: "INR",
    keyId: env.RAZORPAY_KEY_ID,
    checkoutImage: "https://sellerhisab.com/sellerhisab-favicon-512.png",
    customer: customer ? {
      name: customer.name ?? undefined,
      email: customer.email ?? undefined,
      contact: customer.phone ?? undefined,
    } : undefined,
  });
}
