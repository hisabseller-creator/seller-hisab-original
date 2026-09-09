import { describe, expect, it } from "vitest";
import { normalizeTrialDays, trialIsActive } from "@/server/trial-policy";

describe("billing trial policy", () => {
  it("keeps admin trial duration inside the supported 1-30 day range", () => {
    expect(normalizeTrialDays(0)).toBe(1);
    expect(normalizeTrialDays(1)).toBe(1);
    expect(normalizeTrialDays(5)).toBe(5);
    expect(normalizeTrialDays(99)).toBe(30);
    expect(normalizeTrialDays("bad")).toBe(3);
  });

  it("grants trial access only while an activated trial has not expired", () => {
    expect(trialIsActive("active", 2_000, 1_000)).toBe(true);
    expect(trialIsActive("active", 1_000, 1_000)).toBe(false);
    expect(trialIsActive("checkout_pending", 2_000, 1_000)).toBe(false);
    expect(trialIsActive("payment_failed", 2_000, 1_000)).toBe(false);
  });
});
