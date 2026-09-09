import { getSessionUser } from "@/server/auth";
import { getD1 } from "@/server/runtime";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try { await requirePaidCapability(user, "alerts"); } catch (error) { if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 }); throw error; }
  const result = await getD1().prepare(
    "SELECT id, type, message, status, created_at AS createdAt FROM alerts WHERE user_id = ?1 AND status = 'open' ORDER BY created_at DESC LIMIT 100",
  ).bind(user.id).all<{ id: string; type: string; message: string; status: string; createdAt: string }>();
  return Response.json({ alerts: result.results });
}
