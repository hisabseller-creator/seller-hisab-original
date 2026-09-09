import type { SessionUser } from "./auth";
import { randomId, sha256 } from "./crypto";
import { getD1 } from "./runtime";
import { ensureWorkspaceAccess, WorkspacePermissionError } from "./workspace-access";
import { approvalRequiredByDefault, canManageRole, canWorkspace, isWorkspaceRole, type WorkspaceRole } from "@/core/workspace/permissions";
import { assertWorkflowOperationAllowed, normalizeApprovalStatus } from "@/core/workspace/action-workflow";

const INVITE_DAYS = 7;

type MemberRow = { id: string; userId: string; role: string; email: string | null; phone: string | null; name: string | null; createdAt: string };
type InviteRow = { id: string; email: string; role: string; status: string; expiresAt: number; createdAt: string };
type ActionRow = {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  expectedImpactPaise: number | null;
  confidenceBps: number;
  evidenceJson: string;
  status: string;
  createdAt: string;
  assigneeUserId: string | null;
  approvalRequired: number | null;
  approvalStatus: string | null;
  requestedByUserId: string | null;
  requestedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectedByUserId: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  completedByUserId: string | null;
  completedAt: string | null;
};

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function audit(input: { tenantId: string; userId: string; action: string; resourceType: string; resourceId?: string; metadata?: Record<string, unknown> }) {
  await getD1().prepare(`
    INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(randomId("aud"), input.tenantId, input.userId, input.action, input.resourceType, input.resourceId ?? null, input.metadata ? JSON.stringify(input.metadata) : null, new Date().toISOString()).run();
}

export async function loadWorkspace(user: SessionUser) {
  const access = await ensureWorkspaceAccess(user);
  const db = getD1();
  const tenant = await db.prepare("SELECT id, name, owner_user_id AS ownerUserId, created_at AS createdAt FROM tenants WHERE id = ?1").bind(access.tenantId).first<{ id: string; name: string; ownerUserId: string; createdAt: string }>();
  if (!tenant) throw new Error("Workspace not found.");

  const availableWorkspaces = await db.prepare(`
    SELECT DISTINCT t.id, t.name,
           CASE WHEN t.owner_user_id = ?1 THEN 'owner' ELSE tm.role END AS role
    FROM tenants t
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    WHERE t.owner_user_id = ?1 OR tm.user_id = ?1
    ORDER BY t.created_at
  `).bind(user.id).all<{ id: string; name: string; role: string }>();

  const members = await db.prepare(`
    SELECT tm.id, tm.user_id AS userId, tm.role, u.email, u.phone, u.name, tm.created_at AS createdAt
    FROM tenant_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.tenant_id = ?1
    ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'analyst' THEN 2 ELSE 3 END, tm.created_at
  `).bind(access.tenantId).all<MemberRow>();

  const invites = canWorkspace(access.role, "workspace_manage")
    ? await db.prepare(`
        SELECT id, email, role, status, expires_at AS expiresAt, created_at AS createdAt
        FROM workspace_invites
        WHERE tenant_id = ?1 AND status = 'pending' AND expires_at > ?2
        ORDER BY created_at DESC
      `).bind(access.tenantId, Date.now()).all<InviteRow>()
    : { results: [] as InviteRow[] };

  const actions = await db.prepare(`
    SELECT ar.id, ar.action_type AS actionType, ar.target_type AS targetType, ar.target_id AS targetId,
           ar.expected_impact_paise AS expectedImpactPaise, ar.confidence_bps AS confidenceBps,
           ar.evidence_json AS evidenceJson, ar.status, ar.created_at AS createdAt,
           aw.assigned_to_user_id AS assigneeUserId, aw.approval_required AS approvalRequired,
           aw.approval_status AS approvalStatus, aw.requested_by_user_id AS requestedByUserId,
           aw.requested_at AS requestedAt, aw.approved_by_user_id AS approvedByUserId,
           aw.approved_at AS approvedAt, aw.rejected_by_user_id AS rejectedByUserId,
           aw.rejected_at AS rejectedAt, aw.rejection_note AS rejectionNote,
           aw.completed_by_user_id AS completedByUserId, aw.completed_at AS completedAt
    FROM action_recommendations ar
    LEFT JOIN action_workflows aw ON aw.action_id = ar.id
    WHERE ar.tenant_id = ?1 AND ar.status = 'open'
    ORDER BY COALESCE(ar.expected_impact_paise, 0) DESC, ar.created_at DESC
    LIMIT 60
  `).bind(access.tenantId).all<ActionRow>();

  const recentAudit = canWorkspace(access.role, "workspace_manage")
    ? await db.prepare(`
        SELECT ae.id, ae.action, ae.resource_type AS resourceType, ae.resource_id AS resourceId,
               ae.created_at AS createdAt, u.email, u.phone
        FROM audit_events ae LEFT JOIN users u ON u.id = ae.user_id
        WHERE ae.tenant_id = ?1
        ORDER BY ae.created_at DESC LIMIT 30
      `).bind(access.tenantId).all<{ id: string; action: string; resourceType: string; resourceId: string | null; createdAt: string; email: string | null; phone: string | null }>()
    : { results: [] as Array<{ id: string; action: string; resourceType: string; resourceId: string | null; createdAt: string; email: string | null; phone: string | null }> };

  return {
    tenant,
    access,
    availableWorkspaces: (availableWorkspaces.results ?? []).filter((item) => isWorkspaceRole(item.role)).map((item) => ({ ...item, role: item.role as WorkspaceRole })),
    members: (members.results ?? []).map((member) => ({ ...member, role: isWorkspaceRole(member.role) ? member.role : "viewer" as WorkspaceRole })),
    invites: (invites.results ?? []).map((invite) => ({ ...invite, role: isWorkspaceRole(invite.role) ? invite.role : "viewer" as WorkspaceRole })),
    actions: (actions.results ?? []).map((action) => ({
      ...action,
      evidence: safeJson(action.evidenceJson),
      approvalRequired: action.approvalRequired == null ? approvalRequiredByDefault(action.actionType) : action.approvalRequired === 1,
      approvalStatus: action.approvalStatus ?? (approvalRequiredByDefault(action.actionType) ? "not_requested" : "not_required"),
    })),
    recentAudit: recentAudit.results ?? [],
  };
}

export async function switchWorkspace(input: { user: SessionUser; tenantId: string }) {
  const allowed = await getD1().prepare(`
    SELECT 1 FROM tenants t LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    WHERE t.id = ?2 AND (t.owner_user_id = ?1 OR tm.user_id = ?1) LIMIT 1
  `).bind(input.user.id, input.tenantId).first();
  if (!allowed) throw new WorkspacePermissionError("You are not a member of that workspace.");
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO workspace_preferences (user_id, active_tenant_id, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET active_tenant_id = excluded.active_tenant_id, updated_at = excluded.updated_at`).bind(input.user.id, input.tenantId, now).run();
  await audit({ tenantId: input.tenantId, userId: input.user.id, action: "workspace.switched", resourceType: "workspace", resourceId: input.tenantId });
}

export async function renameWorkspace(input: { user: SessionUser; name: string }) {
  const access = await ensureWorkspaceAccess(input.user);
  if (!canWorkspace(access.role, "workspace_manage")) throw new WorkspacePermissionError();
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw new Error("Workspace name is too short.");
  await getD1().prepare("UPDATE tenants SET name = ?2, updated_at = ?3 WHERE id = ?1").bind(access.tenantId, name, new Date().toISOString()).run();
  await audit({ tenantId: access.tenantId, userId: input.user.id, action: "workspace.renamed", resourceType: "workspace", resourceId: access.tenantId, metadata: { name } });
}

export async function createWorkspaceInvite(input: { user: SessionUser; email: string; role: WorkspaceRole }) {
  const access = await ensureWorkspaceAccess(input.user);
  if (!canWorkspace(access.role, "workspace_manage") || !canManageRole(access.role, input.role)) throw new WorkspacePermissionError();
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  const existing = await getD1().prepare(`
    SELECT 1 FROM tenant_members tm JOIN users u ON u.id = tm.user_id WHERE tm.tenant_id = ?1 AND lower(u.email) = ?2 LIMIT 1
  `).bind(access.tenantId, email).first();
  if (existing) throw new Error("This user is already a workspace member.");
  const token = randomId("winv");
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const expiresAt = Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000;
  await getD1().batch([
    getD1().prepare("UPDATE workspace_invites SET status = 'cancelled' WHERE tenant_id = ?1 AND lower(email) = ?2 AND status = 'pending'").bind(access.tenantId, email),
    getD1().prepare(`
      INSERT INTO workspace_invites (id, tenant_id, email, role, token_hash, invited_by_user_id, status, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8)
    `).bind(randomId("wiv"), access.tenantId, email, input.role, tokenHash, input.user.id, expiresAt, now),
  ]);
  await audit({ tenantId: access.tenantId, userId: input.user.id, action: "workspace.invite.created", resourceType: "workspace_invite", metadata: { email, role: input.role } });
  return { token, expiresAt };
}

export async function acceptWorkspaceInvite(input: { user: SessionUser; token: string }) {
  const email = input.user.email?.trim().toLowerCase();
  if (!email) throw new Error("Sign in with the invited email address to accept this invite.");
  const tokenHash = await sha256(input.token.trim());
  const invite = await getD1().prepare(`
    SELECT id, tenant_id AS tenantId, email, role FROM workspace_invites
    WHERE token_hash = ?1 AND status = 'pending' AND expires_at > ?2 LIMIT 1
  `).bind(tokenHash, Date.now()).first<{ id: string; tenantId: string; email: string; role: string }>();
  if (!invite || invite.email.toLowerCase() !== email || !isWorkspaceRole(invite.role) || invite.role === "owner") throw new Error("This workspace invite is invalid, expired, or belongs to another email.");
  const now = new Date().toISOString();
  await getD1().batch([
    getD1().prepare(`INSERT OR IGNORE INTO tenant_members (id, tenant_id, user_id, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(randomId("tmem"), invite.tenantId, input.user.id, invite.role, now),
    getD1().prepare("UPDATE workspace_invites SET status = 'accepted', accepted_at = ?2 WHERE id = ?1 AND status = 'pending'").bind(invite.id, now),
    getD1().prepare(`INSERT INTO workspace_preferences (user_id, active_tenant_id, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET active_tenant_id = excluded.active_tenant_id, updated_at = excluded.updated_at`).bind(input.user.id, invite.tenantId, now),
  ]);
  await audit({ tenantId: invite.tenantId, userId: input.user.id, action: "workspace.invite.accepted", resourceType: "workspace_invite", resourceId: invite.id, metadata: { role: invite.role } });
}

export async function cancelWorkspaceInvite(input: { user: SessionUser; inviteId: string }) {
  const access = await ensureWorkspaceAccess(input.user);
  if (!canWorkspace(access.role, "workspace_manage")) throw new WorkspacePermissionError();
  await getD1().prepare("UPDATE workspace_invites SET status = 'cancelled' WHERE id = ?1 AND tenant_id = ?2 AND status = 'pending'").bind(input.inviteId, access.tenantId).run();
  await audit({ tenantId: access.tenantId, userId: input.user.id, action: "workspace.invite.cancelled", resourceType: "workspace_invite", resourceId: input.inviteId });
}

export async function updateMemberRole(input: { user: SessionUser; memberUserId: string; role: WorkspaceRole }) {
  const access = await ensureWorkspaceAccess(input.user);
  if (!canManageRole(access.role, input.role)) throw new WorkspacePermissionError();
  const target = await getD1().prepare(`SELECT role FROM tenant_members WHERE tenant_id = ?1 AND user_id = ?2 LIMIT 1`).bind(access.tenantId, input.memberUserId).first<{ role: string }>();
  if (!target || target.role === "owner" || !isWorkspaceRole(target.role) || !canManageRole(access.role, target.role)) throw new WorkspacePermissionError("You cannot change this member's role.");
  await getD1().prepare("UPDATE tenant_members SET role = ?3 WHERE tenant_id = ?1 AND user_id = ?2").bind(access.tenantId, input.memberUserId, input.role).run();
  await audit({ tenantId: access.tenantId, userId: input.user.id, action: "workspace.member.role_updated", resourceType: "workspace_member", resourceId: input.memberUserId, metadata: { from: target.role, to: input.role } });
}

export async function removeWorkspaceMember(input: { user: SessionUser; memberUserId: string }) {
  const access = await ensureWorkspaceAccess(input.user);
  const target = await getD1().prepare(`SELECT role FROM tenant_members WHERE tenant_id = ?1 AND user_id = ?2 LIMIT 1`).bind(access.tenantId, input.memberUserId).first<{ role: string }>();
  if (!target || !isWorkspaceRole(target.role) || target.role === "owner" || !canManageRole(access.role, target.role)) throw new WorkspacePermissionError("You cannot remove this member.");
  await getD1().prepare("DELETE FROM tenant_members WHERE tenant_id = ?1 AND user_id = ?2").bind(access.tenantId, input.memberUserId).run();
  await audit({ tenantId: access.tenantId, userId: input.user.id, action: "workspace.member.removed", resourceType: "workspace_member", resourceId: input.memberUserId, metadata: { role: target.role } });
}

async function actionInTenant(tenantId: string, actionId: string) {
  return await getD1().prepare("SELECT id, action_type AS actionType FROM action_recommendations WHERE id = ?1 AND tenant_id = ?2 AND status = 'open' LIMIT 1").bind(actionId, tenantId).first<{ id: string; actionType: string }>();
}

async function ensureActionWorkflow(tenantId: string, actionId: string, actionType: string) {
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT OR IGNORE INTO action_workflows (action_id, tenant_id, approval_required, approval_status, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?5)
  `).bind(actionId, tenantId, approvalRequiredByDefault(actionType) ? 1 : 0, approvalRequiredByDefault(actionType) ? "not_requested" : "not_required", now).run();
}

export async function updateActionWorkflow(input: { user: SessionUser; actionId: string; operation: "assign" | "request_approval" | "approve" | "reject" | "complete"; assigneeUserId?: string | null; note?: string }) {
  const access = await ensureWorkspaceAccess(input.user);
  if (!canWorkspace(access.role, "data_write")) throw new WorkspacePermissionError();
  const action = await actionInTenant(access.tenantId, input.actionId);
  if (!action) throw new Error("Action is no longer open.");
  await ensureActionWorkflow(access.tenantId, input.actionId, action.actionType);
  const db = getD1();
  const current = await db.prepare(`
    SELECT approval_required AS approvalRequired, approval_status AS approvalStatus
    FROM action_workflows WHERE action_id = ?1 AND tenant_id = ?2 LIMIT 1
  `).bind(input.actionId, access.tenantId).first<{ approvalRequired: number; approvalStatus: string }>();
  if (!current) throw new Error("Action workflow is unavailable.");
  const state = {
    approvalRequired: current.approvalRequired === 1,
    approvalStatus: normalizeApprovalStatus(current.approvalStatus, current.approvalRequired === 1),
  };
  assertWorkflowOperationAllowed(state, input.operation);
  const now = new Date().toISOString();

  if (input.operation === "assign") {
    if (input.assigneeUserId) {
      const member = await db.prepare("SELECT 1 FROM tenant_members WHERE tenant_id = ?1 AND user_id = ?2 LIMIT 1").bind(access.tenantId, input.assigneeUserId).first();
      if (!member) throw new Error("Assignee must be a current workspace member.");
    }
    const updated = await db.prepare("UPDATE action_workflows SET assigned_to_user_id = ?3, updated_at = ?4 WHERE action_id = ?1 AND tenant_id = ?2")
      .bind(input.actionId, access.tenantId, input.assigneeUserId ?? null, now).run();
    if ((updated.meta.changes ?? 0) !== 1) throw new Error("Action assignment changed concurrently. Refresh and try again.");
    await audit({ tenantId: access.tenantId, userId: input.user.id, action: "action.assigned", resourceType: "action", resourceId: input.actionId, metadata: { assigneeUserId: input.assigneeUserId ?? null } });
    return;
  }

  if (input.operation === "request_approval") {
    const updated = await db.prepare(`
      UPDATE action_workflows
      SET approval_required = 1, approval_status = 'pending', requested_by_user_id = ?3, requested_at = ?4,
          approved_by_user_id = NULL, approved_at = NULL, rejected_by_user_id = NULL, rejected_at = NULL,
          rejection_note = NULL, completed_by_user_id = NULL, completed_at = NULL, updated_at = ?4
      WHERE action_id = ?1 AND tenant_id = ?2 AND approval_status IN ('not_required','not_requested','rejected')
    `).bind(input.actionId, access.tenantId, input.user.id, now).run();
    if ((updated.meta.changes ?? 0) !== 1) throw new Error("Approval state changed concurrently. Refresh and try again.");
    await audit({ tenantId: access.tenantId, userId: input.user.id, action: "action.approval_requested", resourceType: "action", resourceId: input.actionId });
    return;
  }

  if (input.operation === "approve" || input.operation === "reject") {
    if (!canWorkspace(access.role, "approve")) throw new WorkspacePermissionError("Only an owner or admin can approve or reject actions.");
    if (input.operation === "approve") {
      const updated = await db.prepare(`
        UPDATE action_workflows
        SET approval_status = 'approved', approved_by_user_id = ?3, approved_at = ?4,
            rejected_by_user_id = NULL, rejected_at = NULL, rejection_note = NULL, updated_at = ?4
        WHERE action_id = ?1 AND tenant_id = ?2 AND approval_required = 1 AND approval_status = 'pending'
      `).bind(input.actionId, access.tenantId, input.user.id, now).run();
      if ((updated.meta.changes ?? 0) !== 1) throw new Error("Approval state changed concurrently. Refresh and try again.");
      await audit({ tenantId: access.tenantId, userId: input.user.id, action: "action.approved", resourceType: "action", resourceId: input.actionId });
    } else {
      const note = input.note?.trim().slice(0, 240) ?? null;
      const updated = await db.prepare(`
        UPDATE action_workflows
        SET approval_status = 'rejected', rejected_by_user_id = ?3, rejected_at = ?4, rejection_note = ?5,
            approved_by_user_id = NULL, approved_at = NULL, updated_at = ?4
        WHERE action_id = ?1 AND tenant_id = ?2 AND approval_required = 1 AND approval_status = 'pending'
      `).bind(input.actionId, access.tenantId, input.user.id, now, note).run();
      if ((updated.meta.changes ?? 0) !== 1) throw new Error("Approval state changed concurrently. Refresh and try again.");
      await audit({ tenantId: access.tenantId, userId: input.user.id, action: "action.rejected", resourceType: "action", resourceId: input.actionId, metadata: note ? { note } : undefined });
    }
    return;
  }

  // Completion uses conditional writes so a concurrent approval change cannot be bypassed.
  const completedWorkflow = await db.prepare(`
    UPDATE action_workflows
    SET completed_by_user_id = ?3, completed_at = ?4, updated_at = ?4
    WHERE action_id = ?1 AND tenant_id = ?2
      AND (approval_required = 0 OR approval_status = 'approved')
      AND completed_at IS NULL
  `).bind(input.actionId, access.tenantId, input.user.id, now).run();
  if ((completedWorkflow.meta.changes ?? 0) !== 1) throw new WorkspacePermissionError("This action is not in a completable state.");
  const completedAction = await db.prepare("UPDATE action_recommendations SET status = 'done', updated_at = ?3 WHERE id = ?1 AND tenant_id = ?2 AND status = 'open'")
    .bind(input.actionId, access.tenantId, now).run();
  if ((completedAction.meta.changes ?? 0) !== 1) throw new Error("Action changed concurrently. Refresh before continuing.");
  await audit({ tenantId: access.tenantId, userId: input.user.id, action: "action.completed", resourceType: "action", resourceId: input.actionId });
}
