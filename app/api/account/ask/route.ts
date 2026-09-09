import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { WorkspacePermissionError } from "@/server/workspace-access";
import { askSellerHisab, getAskSellerHisabDashboard, setBenchmarkParticipation } from "@/server/ask-sellerhisab";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ask"), question: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("benchmark_participation"), contributeEnabled: z.boolean() }),
]);

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    await requirePaidCapability(user, "ask");
    await enforceRateLimit(request, "account-ask-read", user.id, 120, 60 * 60);
    return Response.json({ dashboard: await getAskSellerHisabDashboard(user) });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "Ask SellerHisab could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin Ask SellerHisab request blocked." }, { status: 403 });
  try {
    await requirePaidCapability(user, "ask");
    await enforceRateLimit(request, "account-ask-write", user.id, 60, 60 * 60);
    const input = postSchema.parse(await request.json());
    if (input.action === "ask") return Response.json({ answer: await askSellerHisab({ user, question: input.question }) });
    return Response.json({ benchmark: await setBenchmarkParticipation({ user, contributeEnabled: input.contributeEnabled }) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Ask SellerHisab request is invalid." }, { status: 400 });
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "Ask SellerHisab request failed." }, { status: 400 });
  }
}
