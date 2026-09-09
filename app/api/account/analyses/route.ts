import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { getD1 } from "@/server/runtime";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { pruneUserHistory } from "@/server/retention";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";

export const dynamic = "force-dynamic";

const summarySchema = z.object({
  id: z.string().regex(/^ana_[a-z0-9_]{6,80}$/),
  label: z.string().trim().min(1).max(80).default("Saved analysis"),
  createdAt: z.string().datetime(),
  parserVersion: z.string().max(60),
  engineVersion: z.string().max(60),
  summary: z.object({
    confirmedContributionPaise: z.number().int().safe(),
    provisionalContributionPaise: z.number().int().safe(),
    stillAtRiskPaise: z.number().int().safe(),
    lossMakingSkus: z.number().int().min(0).max(100_000),
    needsReviewCount: z.number().int().min(0).max(1_000_000),
    qualityScore: z.number().int().min(0).max(100),
    qualityStatus: z.string().max(40),
    skuCount: z.number().int().min(0).max(100_000),
    orderCount: z.number().int().min(0).max(1_000_000),
    missingCostCount: z.number().int().min(0).max(1_000_000),
    returnRtoCount: z.number().int().min(0).max(1_000_000).default(0),
    observedReturnRtoLossPaise: z.number().int().safe().min(0).default(0),
    openReturnExposurePaise: z.number().int().safe().min(0).default(0),
    potentialRecoveryPaise: z.number().int().safe().min(0).default(0),
  }),
});

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    await requirePaidCapability(user, "history");
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    return Response.json({ error: "Plan access could not be verified." }, { status: 503 });
  }
  const result = await getD1().prepare(
    "SELECT id, label, summary_json AS summaryJson, parser_version AS parserVersion, engine_version AS engineVersion, created_at AS createdAt FROM analyses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 100",
  ).bind(user.id).all<{ id: string; label: string; summaryJson: string; parserVersion: string; engineVersion: string; createdAt: string }>();
  return Response.json({ analyses: result.results.map((item: { id: string; label: string; summaryJson: string; parserVersion: string; engineVersion: string; createdAt: string }) => ({ ...item, summary: JSON.parse(item.summaryJson), summaryJson: undefined })) });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    await requirePaidCapability(user, "saved_analysis");
    await requireWorkspaceCapability(user, "data_write");
    await enforceRateLimit(request, "account-analysis-save", user.id, 30, 60 * 60);
    const input = summarySchema.parse(await request.json());
    const previous = await getD1().prepare(
      "SELECT summary_json AS summaryJson FROM analyses WHERE user_id = ?1 AND id != ?2 ORDER BY created_at DESC LIMIT 1",
    ).bind(user.id, input.id).first<{ summaryJson: string }>();
    const saved = await getD1().prepare(
      `INSERT INTO analyses (id, user_id, label, summary_json, parser_version, engine_version, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(id) DO UPDATE
       SET label = excluded.label, summary_json = excluded.summary_json
       WHERE analyses.user_id = excluded.user_id`,
    ).bind(input.id, user.id, input.label, JSON.stringify(input.summary), input.parserVersion, input.engineVersion, input.createdAt).run();
    if ((saved.meta.changes ?? 0) === 0) {
      return Response.json({ error: "This analysis ID belongs to another account." }, { status: 409 });
    }
    await createAlerts(user.id, input.id, input.createdAt, input.summary, previous?.summaryJson);
    await pruneUserHistory(user.id);
    return Response.json({ saved: true });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Only a safe derived summary can be saved." }, { status: 400 });
    return Response.json({ error: "Analysis summary could not be saved." }, { status: 503 });
  }
}

async function createAlerts(
  userId: string,
  analysisId: string,
  createdAt: string,
  summary: z.infer<typeof summarySchema>["summary"],
  previousJson?: string,
) {
  const db = getD1();
  const add = (suffix: string, type: string, message: string) => db.prepare(
    "INSERT OR IGNORE INTO alerts (id, user_id, type, message, status, created_at) VALUES (?1, ?2, ?3, ?4, 'open', ?5)",
  ).bind(`alt_${analysisId}_${suffix}`, userId, type, message, createdAt).run();
  const jobs: Promise<unknown>[] = [];
  if (summary.missingCostCount > 0) jobs.push(add("cost", "missing_cost", `${summary.missingCostCount} order(s) still have missing required cost data.`));
  if (summary.needsReviewCount > 0) jobs.push(add("settlement", "settlement_gap", `${summary.needsReviewCount} order/payment outcome(s) need review.`));
  if (summary.openReturnExposurePaise > 0) jobs.push(add("returns", "return_exposure", `₹${(summary.openReturnExposurePaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} remains exposed in open return/RTO flows.`));
  if (summary.potentialRecoveryPaise > 0) jobs.push(add("recovery", "potential_recovery", `SellerHisab identified up to ₹${(summary.potentialRecoveryPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} of payout recovery opportunity for review.`));
  if (previousJson) {
    try {
      const previous = JSON.parse(previousJson) as { confirmedContributionPaise?: number };
      const decline = (previous.confirmedContributionPaise ?? summary.confirmedContributionPaise) - summary.confirmedContributionPaise;
      if (decline > 0) jobs.push(add("decline", "contribution_decline", `Confirmed contribution declined by ₹${(decline / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} versus the previous saved analysis.`));
    } catch { /* Ignore an older malformed summary; never block the current save. */ }
  }
  await Promise.all(jobs);
}
