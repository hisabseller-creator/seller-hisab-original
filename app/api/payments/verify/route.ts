import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { fulfilVerifiedOneTimePayment } from "@/server/billing";
import { constantTimeEqual, hmacSha256 } from "@/server/crypto";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { runtimeEnv } from "@/server/runtime";

export const dynamic = "force-dynamic";
const inputSchema = z.object({
  analysisId: z.string().regex(/^ana_[a-z0-9_]{6,80}$/),
  orderId: z.string().min(8).max(120),
  razorpayPaymentId: z.string().min(8).max(120),
  razorpaySignature: z.string().length(64),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in is required before making a real payment so access can always be recovered." }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json());
    await enforceIpRateLimit(request, "payment-verify-ip", 40, 15 * 60);
    await enforceRateLimit(request, "payment-verify", user.id, 12, 15 * 60);
    const secret = runtimeEnv().RAZORPAY_KEY_SECRET;
    if (!secret) return Response.json({ error: "Razorpay verification is not configured." }, { status: 503 });
    const expected = await hmacSha256(secret, `${input.orderId}|${input.razorpayPaymentId}`);
    if (!constantTimeEqual(expected, input.razorpaySignature)) return Response.json({ error: "Payment signature verification failed." }, { status: 400 });
    const fulfilled = await fulfilVerifiedOneTimePayment({
      providerOrderId: input.orderId,
      providerPaymentId: input.razorpayPaymentId,
      expectedAnalysisId: input.analysisId,
      expectedUserId: user.id,
    });
    if (!fulfilled.entitlementToken) return Response.json({ error: "Paid access could not be issued." }, { status: 503 });
    return Response.json({ status: "paid", entitlementToken: fulfilled.entitlementToken });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid verification request." }, { status: 400 });
    return Response.json({ error: "Payment verification could not be completed. Your payment will also be reconciled by webhook; do not pay again." }, { status: 503 });
  }
}
