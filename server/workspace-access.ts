import type { SessionUser } from "./auth";
import { ensureTenantForUser, findUserTenantId } from "./connectors/store";
import { getD1 } from "./runtime";
import { canWorkspace, isWorkspaceRole, type WorkspaceCapability, type WorkspaceRole } from "@/core/workspace/permissions";

export type WorkspaceAccess = { tenantId: string; role: WorkspaceRole };

export class WorkspacePermissionError extends Error {
  status = 403;
  constructor(message = "Your workspace role does not allow this action.") {
    super(message);
  }
}

export async function getWorkspaceAccess(userId: string): Promise<WorkspaceAccess | null> {
  const tenantId = await findUserTenantId(userId);
  if (!tenantId) return null;
  const row = await getD1().prepare(`
    SELECT CASE WHEN t.owner_user_id = ?1 THEN 'owner' ELSE tm.role END AS role
    FROM tenants t
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    WHERE t.id = ?2 AND (t.owner_user_id = ?1 OR tm.user_id = ?1)
    LIMIT 1
  `).bind(userId, tenantId).first<{ role: string | null }>();
  if (!row || !isWorkspaceRole(row.role)) return null;
  return { tenantId, role: row.role };
}

export async function ensureWorkspaceAccess(user: SessionUser): Promise<WorkspaceAccess> {
  await ensureTenantForUser(user);
  const access = await getWorkspaceAccess(user.id);
  if (!access) throw new WorkspacePermissionError("Workspace access could not be resolved.");
  return access;
}

export async function requireWorkspaceCapability(user: SessionUser, capability: WorkspaceCapability): Promise<WorkspaceAccess> {
  const access = await ensureWorkspaceAccess(user);
  if (!canWorkspace(access.role, capability)) throw new WorkspacePermissionError();
  return access;
}
