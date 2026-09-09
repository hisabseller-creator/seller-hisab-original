import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";
import { getInventorySummary, importInventoryPositions, saveInventoryPreferences, type NormalizedInventoryInput } from "@/server/inventory";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    await requirePaidCapability(user, "inventory");
    return Response.json({ summary: await getInventorySummary(user) });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Inventory summary could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await requirePaidCapability(user, "inventory");
    await requireWorkspaceCapability(user, "data_write");
    await enforceRateLimit(request, "account-inventory", user.id, 30, 60 * 60);
    if (body.action === "import") {
      const result = await importInventoryPositions({
        user,
        channelId: String(body.channelId ?? ""),
        fileName: String(body.fileName ?? ""),
        sourceFingerprint: String(body.sourceFingerprint ?? ""),
        coverageStart: typeof body.coverageStart === "string" ? body.coverageStart : undefined,
        coverageEnd: typeof body.coverageEnd === "string" ? body.coverageEnd : undefined,
        rows: Array.isArray(body.rows) ? body.rows as NormalizedInventoryInput[] : [],
      });
      return Response.json(result);
    }
    if (body.action === "preferences") {
      return Response.json({ summary: await saveInventoryPreferences({
        user,
        preferences: {
          defaultLeadTimeDays: body.defaultLeadTimeDays === undefined ? undefined : Number(body.defaultLeadTimeDays),
          safetyDays: body.safetyDays === undefined ? undefined : Number(body.safetyDays),
          targetCoverDays: body.targetCoverDays === undefined ? undefined : Number(body.targetCoverDays),
          overstockDays: body.overstockDays === undefined ? undefined : Number(body.overstockDays),
        },
      }) });
    }
    return Response.json({ error: "Unsupported inventory action." }, { status: 400 });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "Inventory update failed." }, { status: 400 });
  }
}
