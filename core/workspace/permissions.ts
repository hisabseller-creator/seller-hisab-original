export type WorkspaceRole = "owner" | "admin" | "analyst" | "viewer";
export type WorkspaceCapability = "read" | "data_write" | "connector_manage" | "workspace_manage" | "approve";

const rank: Record<WorkspaceRole, number> = {
  viewer: 0,
  analyst: 1,
  admin: 2,
  owner: 3,
};

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "analyst" || value === "viewer";
}

export function canWorkspace(role: WorkspaceRole, capability: WorkspaceCapability): boolean {
  if (capability === "read") return true;
  if (capability === "data_write") return rank[role] >= rank.analyst;
  if (capability === "connector_manage") return rank[role] >= rank.admin;
  if (capability === "workspace_manage") return rank[role] >= rank.admin;
  return rank[role] >= rank.admin;
}

export function canManageRole(actor: WorkspaceRole, target: WorkspaceRole): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  return actor === "admin" && (target === "analyst" || target === "viewer");
}

export function approvalRequiredByDefault(actionType: string): boolean {
  return actionType.startsWith("ads.") || actionType === "inventory.review-reallocation" || actionType.startsWith("cash.");
}
