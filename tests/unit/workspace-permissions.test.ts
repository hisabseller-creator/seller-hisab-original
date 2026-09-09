import { describe, expect, it } from "vitest";
import { approvalRequiredByDefault, canManageRole, canWorkspace, isWorkspaceRole } from "@/core/workspace/permissions";

describe("workspace permissions", () => {
  it("keeps viewer read-only and analyst operational without connector/admin powers", () => {
    expect(canWorkspace("viewer", "read")).toBe(true);
    expect(canWorkspace("viewer", "data_write")).toBe(false);
    expect(canWorkspace("analyst", "data_write")).toBe(true);
    expect(canWorkspace("analyst", "connector_manage")).toBe(false);
    expect(canWorkspace("admin", "connector_manage")).toBe(true);
    expect(canWorkspace("owner", "workspace_manage")).toBe(true);
  });

  it("never lets a delegated role create or demote an owner", () => {
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("admin", "analyst")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("owner", "owner")).toBe(false);
  });

  it("defaults money-moving review domains to approval-required", () => {
    expect(approvalRequiredByDefault("ads.review-reduce-spend")).toBe(true);
    expect(approvalRequiredByDefault("cash.review-missing-payout")).toBe(true);
    expect(approvalRequiredByDefault("inventory.review-reallocation")).toBe(true);
    expect(approvalRequiredByDefault("inventory.reorder-now")).toBe(false);
  });

  it("accepts only the four supported roles", () => {
    expect(isWorkspaceRole("owner")).toBe(true);
    expect(isWorkspaceRole("viewer")).toBe(true);
    expect(isWorkspaceRole("superadmin")).toBe(false);
  });
});
