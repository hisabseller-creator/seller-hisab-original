import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { randomId } from "@/server/crypto";
import { getD1 } from "@/server/runtime";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";

export const dynamic = "force-dynamic";
const createSchema = z.object({ name: z.string().trim().min(2).max(60) });
const deleteSchema = z.object({ id: z.string().min(8).max(120) });

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try { await requirePaidCapability(user, "profiles_multiple"); } catch (error) { if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 }); throw error; }
  const result = await getD1().prepare("SELECT id, name, created_at AS createdAt FROM seller_profiles WHERE user_id = ?1 ORDER BY created_at").bind(user.id).all();
  return Response.json({ profiles: result.results });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    await requirePaidCapability(user, "profiles_multiple");
    await requireWorkspaceCapability(user, "data_write");
    await enforceRateLimit(request, "account-profile-mutation", user.id, 20, 60 * 60);
    const { name } = createSchema.parse(await request.json());
    const count = await getD1().prepare("SELECT COUNT(*) AS count FROM seller_profiles WHERE user_id = ?1").bind(user.id).first<{ count: number }>();
    if ((count?.count ?? 0) >= 10) return Response.json({ error: "Pro supports up to 10 seller profiles in V1." }, { status: 409 });
    const profile = { id: randomId("prf"), name, createdAt: new Date().toISOString() };
    await getD1().prepare("INSERT INTO seller_profiles (id, user_id, name, created_at) VALUES (?1, ?2, ?3, ?4)").bind(profile.id, user.id, profile.name, profile.createdAt).run();
    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    return Response.json({ error: error instanceof z.ZodError ? "Profile name must be 2–60 characters." : "Profile could not be created." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    await requirePaidCapability(user, "profiles_multiple");
    await requireWorkspaceCapability(user, "data_write");
    await enforceRateLimit(request, "account-profile-mutation", user.id, 20, 60 * 60);
    const { id } = deleteSchema.parse(await request.json());
    await getD1().prepare("DELETE FROM seller_profiles WHERE id = ?1 AND user_id = ?2").bind(id, user.id).run();
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    return Response.json({ error: "Invalid profile." }, { status: 400 });
  }
}

