import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { getD1 } from "@/server/runtime";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";

export const dynamic = "force-dynamic";

const costSchema = z.object({
  sku: z.string().trim().min(1).max(160),
  productCostPaise: z.number().int().safe().min(0),
  packagingCostPaise: z.number().int().safe().min(0).optional(),
  variableCostPaise: z.number().int().safe().min(0).optional(),
  updatedAt: z.string().datetime(),
});

const batchSchema = z.object({
  costs: z.array(costSchema).max(1000),
});

type SavedCostRow = {
  sku: string;
  productCostPaise: number;
  packagingCostPaise: number | null;
  variableCostPaise: number | null;
  updatedAt: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    await requirePaidCapability(user, "saved_costs");
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    return Response.json({ error: "Plan access could not be verified." }, { status: 503 });
  }

  const result = await getD1().prepare(
    `SELECT sku,
            product_cost_paise AS productCostPaise,
            packaging_cost_paise AS packagingCostPaise,
            variable_cost_paise AS variableCostPaise,
            updated_at AS updatedAt
     FROM saved_costs
     WHERE user_id = ?1 AND profile_id IS NULL
     ORDER BY updated_at DESC
     LIMIT 5000`,
  ).bind(user.id).all<SavedCostRow>();

  return Response.json({
    costs: result.results.map((row) => ({
      sku: row.sku,
      productCostPaise: row.productCostPaise,
      packagingCostPaise: row.packagingCostPaise ?? undefined,
      variableCostPaise: row.variableCostPaise ?? undefined,
      updatedAt: row.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });

  try {
    await requirePaidCapability(user, "saved_costs");
    await requireWorkspaceCapability(user, "data_write");
    await enforceRateLimit(request, "account-cost-sync", user.id, 30, 60 * 60);
    const input = batchSchema.parse(await request.json());
    const db = getD1();
    const statements = await Promise.all(input.costs.map(async (cost) => {
      const id = await stableCostId(user.id, cost.sku);
      return db.prepare(
        `INSERT INTO saved_costs (
           id, user_id, profile_id, sku, product_cost_paise, packaging_cost_paise, variable_cost_paise, updated_at
         ) VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           sku = excluded.sku,
           product_cost_paise = excluded.product_cost_paise,
           packaging_cost_paise = excluded.packaging_cost_paise,
           variable_cost_paise = excluded.variable_cost_paise,
           updated_at = excluded.updated_at
         WHERE saved_costs.user_id = excluded.user_id AND excluded.updated_at >= saved_costs.updated_at`,
      ).bind(
        id,
        user.id,
        cost.sku,
        cost.productCostPaise,
        cost.packagingCostPaise ?? null,
        cost.variableCostPaise ?? null,
        cost.updatedAt,
      );
    }));

    if (statements.length) await db.batch(statements);
    return Response.json({ saved: statements.length });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Only valid SKU cost records can be saved." }, { status: 400 });
    return Response.json({ error: "Saved costs could not be synced." }, { status: 503 });
  }
}

async function stableCostId(userId: string, sku: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}\u0000${sku}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `cost_${hex.slice(0, 48)}`;
}
