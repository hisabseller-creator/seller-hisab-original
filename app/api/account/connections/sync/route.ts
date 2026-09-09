import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";
import { getOwnedApiConnection } from "@/server/connectors/store";
import { enqueueConnectorSyncJob } from "@/server/connectors/jobs";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  connectorId: z.enum(["amazon-in-v1", "flipkart-v1", "shopify-v1", "woocommerce-v1"]),
  days: z.number().int().min(1).max(3650).default(30),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin sync blocked." }, { status: 403 });

  try {
    await requirePaidCapability(user, "connectors");
    await requireWorkspaceCapability(user, "data_write");
    await enforceRateLimit(request, "connector-sync", user.id, 12, 60 * 60);
    const input = inputSchema.parse(await request.json());
    const connection = await getOwnedApiConnection(user.id, input.connectorId);
    if (!connection || connection.status === "disabled") {
      return Response.json({ error: "Connect this marketplace before syncing." }, { status: 409 });
    }
    const jobId = await enqueueConnectorSyncJob({ tenantId: connection.tenantId, connectionId: connection.id, requestedByUserId: user.id, days: input.days });
    return Response.json({ status: "queued", jobId, statusUrl: `/api/account/connections/jobs?id=${encodeURIComponent(jobId)}` }, { status: 202, headers: { "retry-after": "5" } });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Use a supported connector and a 1-3650 day sync/backfill window." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Marketplace sync failed.";
    return Response.json({ error: message.slice(0, 260) }, { status: 503 });
  }
}
