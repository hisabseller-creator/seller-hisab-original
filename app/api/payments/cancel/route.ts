import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { getD1 } from "@/server/runtime";

export const dynamic = "force-dynamic";

const schema = z.object({
  analysisId: z.string().regex(/^ana_[a-z0-9_]{6,80}$/),
  orderId: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    await enforceIpRateLimit(request, "payment-cancel-ip", 30, 15 * 60);
    await enforceRateLimit(request, "payment-cancel", input.analysisId, 12, 15 * 60);

    const payment = await getD1().prepare(
      "SELECT id, user_id AS userId FROM payments WHERE provider_order_id = ?1 AND analysis_id = ?2",
    ).bind(input.orderId, input.analysisId).first<{ id: string; userId: string | null }>();
    if (!payment) return Response.json({ error: "Payment order was not found." }, { status: 404 });

    const user = await getSessionUser(request);
    if (payment.userId && payment.userId !== user?.id) {
      return Response.json({ error: "This payment belongs to another account." }, { status: 403 });
    }

    await getD1().prepare(
      "UPDATE payments SET status = 'cancelled', updated_at = ?1 WHERE id = ?2 AND status IN ('created','pending')",
    ).bind(new Date().toISOString(), payment.id).run();
    return Response.json({ status: "cancelled" });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid cancellation request." }, { status: 400 });
    return Response.json({ error: "Payment cancellation failed." }, { status: 503 });
  }
}
