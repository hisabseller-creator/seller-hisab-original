import { describe, expect, it } from "vitest";
import { isActiveSubscription, summarizeAuthActivity } from "@/core/admin/user-activity";

describe("admin user activity summaries", () => {
  it("counts only authentication events and keeps the newest method", () => {
    const summary = summarizeAuthActivity([
      { userId: "usr_1", action: "auth.login_success", metadataJson: JSON.stringify({ method: "password_phone" }), createdAt: "2026-09-03T08:00:00.000Z" },
      { userId: "usr_1", action: "auth.register_success", metadataJson: JSON.stringify({ method: "msg91_otp" }), createdAt: "2026-09-02T08:00:00.000Z" },
      { userId: "usr_1", action: "unrelated", metadataJson: null, createdAt: "2026-09-04T08:00:00.000Z" },
    ]).get("usr_1");

    expect(summary).toEqual({
      trackedLogins: 2,
      lastLoginAt: "2026-09-03T08:00:00.000Z",
      lastAuthMethod: "password_phone",
    });
  });

  it("treats an active non-expired subscription as paid access", () => {
    const now = 1_000;
    expect(isActiveSubscription("active", 2_000, now)).toBe(true);
    expect(isActiveSubscription("active", null, now)).toBe(true);
    expect(isActiveSubscription("active", 500, now)).toBe(false);
    expect(isActiveSubscription("cancelled", 2_000, now)).toBe(false);
  });
});
