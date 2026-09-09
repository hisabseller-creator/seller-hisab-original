import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { WorkspacePermissionError } from "@/server/workspace-access";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import {
  acceptWorkspaceInvite,
  cancelWorkspaceInvite,
  createWorkspaceInvite,
  loadWorkspace,
  removeWorkspaceMember,
  renameWorkspace,
  switchWorkspace,
  updateActionWorkflow,
  updateMemberRole,
} from "@/server/workspace";

export const dynamic = "force-dynamic";

const roleSchema = z.enum(["admin", "analyst", "viewer"]);
const operationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("switch_workspace"), tenantId: z.string().trim().min(4).max(120) }),
  z.object({ operation: z.literal("rename_workspace"), name: z.string().trim().min(2).max(80) }),
  z.object({ operation: z.literal("create_invite"), email: z.string().trim().email().max(240), role: roleSchema }),
  z.object({ operation: z.literal("accept_invite"), token: z.string().trim().min(12).max(240) }),
  z.object({ operation: z.literal("cancel_invite"), inviteId: z.string().trim().min(4).max(120) }),
  z.object({ operation: z.literal("update_member_role"), memberUserId: z.string().trim().min(4).max(120), role: roleSchema }),
  z.object({ operation: z.literal("remove_member"), memberUserId: z.string().trim().min(4).max(120) }),
  z.object({ operation: z.literal("assign_action"), actionId: z.string().trim().min(4).max(140), assigneeUserId: z.string().trim().min(4).max(120).nullable() }),
  z.object({ operation: z.literal("request_approval"), actionId: z.string().trim().min(4).max(140) }),
  z.object({ operation: z.literal("approve_action"), actionId: z.string().trim().min(4).max(140) }),
  z.object({ operation: z.literal("reject_action"), actionId: z.string().trim().min(4).max(140), note: z.string().trim().max(240).optional() }),
  z.object({ operation: z.literal("complete_action"), actionId: z.string().trim().min(4).max(140) }),
]);

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    await requirePaidCapability(user, "workspace");
    return Response.json({ workspace: await loadWorkspace(user) });
  } catch (error) {
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    return Response.json({ error: error instanceof Error ? error.message : "Workspace could not be loaded." }, { status: error instanceof WorkspacePermissionError ? 403 : 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin workspace request blocked." }, { status: 403 });

  try {
    const input = operationSchema.parse(await request.json());
    // Invite acceptance is the only workspace mutation allowed before the invited user inherits the owner's Pro workspace plan.
    if (input.operation !== "accept_invite") await requirePaidCapability(user, "workspace");
    let invite: { token: string; expiresAt: number } | undefined;
    if (input.operation === "switch_workspace") await switchWorkspace({ user, tenantId: input.tenantId });
    if (input.operation === "rename_workspace") await renameWorkspace({ user, name: input.name });
    if (input.operation === "create_invite") invite = await createWorkspaceInvite({ user, email: input.email, role: input.role });
    if (input.operation === "accept_invite") await acceptWorkspaceInvite({ user, token: input.token });
    if (input.operation === "cancel_invite") await cancelWorkspaceInvite({ user, inviteId: input.inviteId });
    if (input.operation === "update_member_role") await updateMemberRole({ user, memberUserId: input.memberUserId, role: input.role });
    if (input.operation === "remove_member") await removeWorkspaceMember({ user, memberUserId: input.memberUserId });
    if (input.operation === "assign_action") await updateActionWorkflow({ user, actionId: input.actionId, operation: "assign", assigneeUserId: input.assigneeUserId });
    if (input.operation === "request_approval") await updateActionWorkflow({ user, actionId: input.actionId, operation: "request_approval" });
    if (input.operation === "approve_action") await updateActionWorkflow({ user, actionId: input.actionId, operation: "approve" });
    if (input.operation === "reject_action") await updateActionWorkflow({ user, actionId: input.actionId, operation: "reject", note: input.note });
    if (input.operation === "complete_action") await updateActionWorkflow({ user, actionId: input.actionId, operation: "complete" });
    return Response.json({ ok: true, invite, workspace: await loadWorkspace(user) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Workspace request is invalid." }, { status: 400 });
    if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 });
    const status = error instanceof WorkspacePermissionError ? 403 : 409;
    return Response.json({ error: error instanceof Error ? error.message : "Workspace request failed." }, { status });
  }
}
