export type ApprovalStatus = "not_required" | "not_requested" | "pending" | "approved" | "rejected";
export type WorkflowOperation = "assign" | "request_approval" | "approve" | "reject" | "complete";

export type WorkflowState = {
  approvalRequired: boolean;
  approvalStatus: ApprovalStatus;
};

export function normalizeApprovalStatus(value: unknown, approvalRequired: boolean): ApprovalStatus {
  if (value === "not_required" || value === "not_requested" || value === "pending" || value === "approved" || value === "rejected") return value;
  return approvalRequired ? "not_requested" : "not_required";
}

export function assertWorkflowOperationAllowed(state: WorkflowState, operation: WorkflowOperation): void {
  if (operation === "assign") return;
  if (operation === "request_approval") {
    if (state.approvalStatus === "pending") throw new Error("Approval is already pending.");
    if (state.approvalStatus === "approved") throw new Error("This action is already approved.");
    return;
  }
  if (operation === "approve" || operation === "reject") {
    if (!state.approvalRequired || state.approvalStatus !== "pending") {
      throw new Error("Only a pending approval request can be approved or rejected.");
    }
    return;
  }
  if (state.approvalRequired && state.approvalStatus !== "approved") {
    throw new Error("This action requires approval before it can be marked complete.");
  }
}
