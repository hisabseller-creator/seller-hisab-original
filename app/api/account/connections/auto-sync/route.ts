import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { updateConnectionLiveSync } from "@/server/connectors/live-platform";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  connectorId: z.enum(["amazon-in-v1", "flipkart-v1", "shopify-v1", "woocommerce-v1"]),
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(15).max(1440).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin live-sync request blocked." }, { status: 403 });

  try {
    await requireWorkspaceCapability(user, "connector_manage");
    await enforceRateLimit(request, "connector-auto-sync", user.id, 20, 60 * 60);
    const input = inputSchema.parse(await request.json());
    // Turning automatic sync off must always remain possible. Turning it on
    // consumes the Pro connected-data capability.
    if (input.enabled) await requirePaidCapability(user, "connectors");
    const state = await updateConnectionLiveSync({
      userId: user.id,
      connectorId: input.connectorId,
      enabled: input.enabled,
      intervalMinutes: input.intervalMinutes,
    });
    return Response.json({ ...state, syncRequiresPlan: "pro" as const });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Choose a supported connector and a 15-1440 minute interval." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Live sync setting could not be updated." }, { status: 503 });
  }
}
