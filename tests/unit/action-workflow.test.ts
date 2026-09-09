import { describe, expect, it } from "vitest";
import { assertWorkflowOperationAllowed, normalizeApprovalStatus } from "@/core/workspace/action-workflow";

describe("action workflow state machine", () => {
  it("requires a pending request before approve/reject", () => {
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "not_requested" }, "approve")).toThrow();
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "pending" }, "approve")).not.toThrow();
  });

  it("does not complete approval-required actions before approval", () => {
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "pending" }, "complete")).toThrow();
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "rejected" }, "complete")).toThrow();
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "approved" }, "complete")).not.toThrow();
  });

  it("allows re-request after rejection but not duplicate pending/approved requests", () => {
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "rejected" }, "request_approval")).not.toThrow();
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "pending" }, "request_approval")).toThrow();
    expect(() => assertWorkflowOperationAllowed({ approvalRequired: true, approvalStatus: "approved" }, "request_approval")).toThrow();
  });

  it("normalizes unknown stored values safely", () => {
    expect(normalizeApprovalStatus("legacy", true)).toBe("not_requested");
    expect(normalizeApprovalStatus("legacy", false)).toBe("not_required");
  });
});
