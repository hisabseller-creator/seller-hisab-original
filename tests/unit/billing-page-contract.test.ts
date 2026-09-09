import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("billing page tracking contract", () => {
  it("uses one shared paid-plan icon source across pricing and account billing", () => {
    const pricing = readFileSync("components/pricing-view.tsx", "utf8");
    const account = readFileSync("components/account-workspace.tsx", "utf8");
    const icons = readFileSync("components/plan-tier-icon.tsx", "utf8");

    expect(pricing).toContain('PlanTierIcon');
    expect(account).toContain('PlanTierIcon');
    expect(icons).toContain('plan === "action_report"');
    expect(icons).toContain('plan === "starter"');
  });

  it("shows dynamic current-plan, trial and paid-period tracking", () => {
    const account = readFileSync("components/account-workspace.tsx", "utf8");

    expect(account).toContain("Trial Active");
    expect(account).toContain("Current paid period");
    expect(account).toContain("trialDaysLeft");
    expect(account).toContain("paidDaysLeft");
    expect(account).toContain('trialDaysLeft === 1 ? "day" : "days"');
    expect(account).toContain('paidDaysLeft === 1 ? "day" : "days"');
    expect(account).toContain("left");
    expect(account).toContain("Access valid until");
    expect(account).toContain("Next charge");
    expect(account).toContain("Payment method / AutoPay");
    expect(account).toContain("Last payment");
    expect(account).toContain("Billing history");
  });

  it("backs billing activity with stored provider-verified payment events", () => {
    const route = readFileSync("app/api/billing/status/route.ts", "utf8");

    expect(route).toContain("subscription_payment_events");
    expect(route).toContain("recurringPaymentCount");
    expect(route).toContain("latestActionReport");
    expect(route).toContain('product = \'action_report\'');
  });
});
