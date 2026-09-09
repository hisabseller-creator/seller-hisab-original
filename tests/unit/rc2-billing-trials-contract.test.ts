import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("RC2 billing + language contracts", () => {
  it("keeps pricing fully English in English mode and exact HinEnglish hero copy", () => {
    const pricing = source("components/pricing-view.tsx");
    expect(pricing).toContain("See your profit first.");
    expect(pricing).toContain("Then pay only for the depth you need.");
    expect(pricing).toContain("पहले profit देखो.");
    expect(pricing).toContain("फिर jitni depth चाहिए, उतना hi pay करो.");
    expect(pricing).not.toContain("फिर जितनी depth चाहिए, उतना ही pay करो.");
  });

  it("uses a future Razorpay subscription start for free trials and keeps AutoPay recurring", () => {
    const subscription = source("app/api/billing/subscription/route.ts");
    expect(subscription).toContain("requestBody.start_at");
    expect(subscription).toMatch(/total_count:\s*120/);
    expect(subscription).toContain("A verified mobile number is required");
    expect(subscription).toContain("Enter an email address");
  });

  it("passes SellerHisab branding into both Razorpay checkout paths", () => {
    const recurring = source("components/dashboard/plan-subscribe-button.tsx");
    const oneTime = source("components/dashboard/unlock-report.tsx");
    expect(recurring).toContain("sellerhisab-favicon-512.png");
    expect(oneTime).toContain("sellerhisab-favicon-512.png");
  });

  it("keeps one free-trial claim per account and tracks first post-trial charge", () => {
    const migration = source("drizzle/0016_billing_trials.sql");
    const webhook = source("server/billing-event-processing.ts");
    expect(migration).toContain("billing_trial_claims_user_unique");
    expect(webhook).toContain('eventType === "subscription.charged"');
    expect(webhook).toContain("markTrialSubscriptionCharged");
    const trials = source("server/trials.ts");
    const adminTrials = source("app/api/admin/billing-trials/route.ts");
    expect(trials).toContain('status = "payment_retry"');
    expect(trials).toContain('providerStatus === "halted"');
    expect(adminTrials).toContain("paymentRetrying");
  });

  it("protects trial settings behind admin auth and same-origin writes", () => {
    const admin = source("app/api/admin/billing-trials/route.ts");
    expect(admin).toContain("isAdminUser");
    expect(admin).toContain("requestHasSameOrigin");
    expect(admin).toContain("min(1).max(30)");
  });
});
