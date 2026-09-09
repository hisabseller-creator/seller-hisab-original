import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";
import { getCashSummary, importBankTransactions, saveCashPreferences, type NormalizedBankTransactionInput } from "@/server/cash";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    await requirePaidCapability(user, "cash");
    return Response.json({ summary: await getCashSummary(user) });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Cash summary could not be loaded." }, { status: 500 });
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
    await requirePaidCapability(user, "cash");
    await requireWorkspaceCapability(user, "data_write");
    if (body.action === "import") {
      const result = await importBankTransactions({
        user,
        fileName: String(body.fileName ?? ""),
        sourceFingerprint: String(body.sourceFingerprint ?? ""),
        coverageStart: typeof body.coverageStart === "string" ? body.coverageStart : undefined,
        coverageEnd: typeof body.coverageEnd === "string" ? body.coverageEnd : undefined,
        transactions: Array.isArray(body.transactions) ? body.transactions as NormalizedBankTransactionInput[] : [],
      });
      return Response.json(result);
    }
    if (body.action === "preferences") {
      const currentBalancePaise = body.currentBalancePaise === null || body.currentBalancePaise === undefined ? undefined : Number(body.currentBalancePaise);
      const weeklyFixedOutflowPaise = body.weeklyFixedOutflowPaise === null || body.weeklyFixedOutflowPaise === undefined ? undefined : Number(body.weeklyFixedOutflowPaise);
      return Response.json({ summary: await saveCashPreferences({ user, currentBalancePaise, weeklyFixedOutflowPaise }) });
    }
    return Response.json({ error: "Unknown cash action." }, { status: 400 });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Cash operation failed." }, { status: 400 });
  }
}
