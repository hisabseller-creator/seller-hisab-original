import type { SessionUser } from "./auth";
import { getD1 } from "./runtime";
import { activeTrialPlan } from "./trials";

export type PaidPlan = "starter" | "pro";
export type PaidCapability =
  | "saved_analysis"
  | "saved_costs"
  | "history"
  | "alerts"
  | "profiles_multiple"
  | "advanced_finance"
  | "cash"
  | "ads"
  | "inventory"
  | "connectors"
  | "workspace"
  | "ask"
  | "benchmarks";

const PLAN_RANK: Record<PaidPlan, number> = { starter: 1, pro: 2 };
const MIN_PLAN: Record<PaidCapability, PaidPlan> = {
  saved_analysis: "starter",
  saved_costs: "starter",
  history: "starter",
  alerts: "starter",
  profiles_multiple: "pro",
  advanced_finance: "pro",
  cash: "pro",
  ads: "pro",
  inventory: "pro",
  connectors: "pro",
  workspace: "pro",
  ask: "pro",
  benchmarks: "pro",
};

const WORKSPACE_SCOPED = new Set<PaidCapability>([
  "advanced_finance", "cash", "ads", "inventory", "connectors", "workspace", "ask", "benchmarks",
]);

export class PlanAccessError extends Error {
  status = 402;
  constructor(public readonly requiredPlan: PaidPlan, message?: string) {
    super(message ?? `This feature requires an active ${requiredPlan === "pro" ? "Pro" : "Starter"} plan.`);
  }
}

export async function activePaidPlan(userId: string): Promise<PaidPlan | undefined> {
  return activePlanForUser(userId);
}

export async function activeWorkspacePaidPlan(userId: string): Promise<PaidPlan | undefined> {
  const row = await getD1().prepare(`
    SELECT t.owner_user_id AS ownerUserId
    FROM tenants t
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    LEFT JOIN workspace_preferences wp ON wp.user_id = ?1 AND wp.active_tenant_id = t.id
    WHERE t.owner_user_id = ?1 OR tm.user_id = ?1
    ORDER BY CASE WHEN wp.active_tenant_id IS NOT NULL THEN 0 ELSE 1 END, t.created_at ASC
    LIMIT 1
  `).bind(userId).first<{ ownerUserId: string }>();
  return row?.ownerUserId ? activePlanForUser(row.ownerUserId) : undefined;
}

async function activePlanForUser(userId: string): Promise<PaidPlan | undefined> {
  const row = await getD1().prepare(`
    SELECT plan
    FROM subscriptions
    WHERE user_id = ?1
      AND plan IN ('starter','pro')
      AND status = 'active'
      AND provider_verified_at IS NOT NULL
      AND (current_period_end IS NULL OR current_period_end > ?2)
    ORDER BY CASE plan WHEN 'pro' THEN 2 ELSE 1 END DESC, updated_at DESC
    LIMIT 1
  `).bind(userId, Date.now()).first<{ plan: string }>();
  if (row?.plan === "pro") return "pro";
  if (row?.plan === "starter") return "starter";
  return await activeTrialPlan(userId);
}

export async function hasPaidCapability(userId: string, capability: PaidCapability): Promise<boolean> {
  const plan = WORKSPACE_SCOPED.has(capability) ? await activeWorkspacePaidPlan(userId) : await activePaidPlan(userId);
  return Boolean(plan && PLAN_RANK[plan] >= PLAN_RANK[MIN_PLAN[capability]]);
}

export async function requirePaidCapability(user: SessionUser, capability: PaidCapability): Promise<PaidPlan> {
  const plan = WORKSPACE_SCOPED.has(capability) ? await activeWorkspacePaidPlan(user.id) : await activePaidPlan(user.id);
  const required = MIN_PLAN[capability];
  if (!plan || PLAN_RANK[plan] < PLAN_RANK[required]) throw new PlanAccessError(required);
  return plan;
}

export function minimumPlanFor(capability: PaidCapability): PaidPlan {
  return MIN_PLAN[capability];
}
