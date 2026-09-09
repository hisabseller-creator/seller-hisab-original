import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("F15/F16 production hotfix contracts", () => {
  it("never asks Workers to execute the retired 600k PBKDF2 credential", () => {
    const password = source("server/password.ts");
    expect(password).toContain('export const PASSWORD_VERSION = "v3"');
    expect(password).toContain("export const PASSWORD_ITERATIONS = 100_000");
    expect(password).toContain("passwordResetRequired");
    expect(password).toContain('parsed.version === "v2"');
    expect(password).toContain("RETIRED_V2_ITERATIONS = 600_000");
    expect(password).toContain("if (iterations > WORKERS_PBKDF2_MAX_ITERATIONS)");
  });

  it("turns retired credentials into a one-time OTP reset instead of leaking the runtime exception", () => {
    const login = source("app/api/auth/password/login/route.ts");
    const client = source("components/auth-screen.tsx");
    const adminStepUp = source("components/admin-reauthentication.tsx");
    expect(login).toContain('code: "password_reset_required"');
    expect(login).not.toContain('return Response.json({ error: message }, { status });');
    expect(client).toContain('payload.code === "password_reset_required"');
    expect(client).toContain("startResetPassword();");
    expect(adminStepUp).toContain('payload.code === "password_reset_required"');
  });

  it("reconciles provider state and replaces only an abandoned created checkout when another plan is chosen", () => {
    const route = source("app/api/billing/subscription/route.ts");
    expect(route).toContain("await reconcileSubscriptionFromProvider");
    expect(route).toContain("existing = await loadOpenSubscription(user.id)");
    expect(route).toContain('existing.status === "created"');
    expect(route).toContain("await cancelRazorpaySubscription(existing.subscriptionId, false)");
    expect(route).toContain("Different plan selected after dismissing checkout");
    expect(route).toContain("reusablePendingTrial");
    expect(route).toContain("trial_checkout_rebind_failed");
    expect(route).not.toContain('code: "subscription_conflict"');
  });

  it("keeps pending checkout informational while every inactive plan button opens checkout directly", () => {
    const status = source("app/api/billing/status/route.ts");
    const ui = source("components/account-workspace.tsx");
    expect(status).toContain("subscriptionOpen");
    expect(status).toContain("needsAttention");
    expect(status).toContain("subscriptionNeedsRefresh");
    expect(ui).toContain("openWithoutAccess");
    expect(ui).toContain("Checkout pending •");
    expect(ui).toContain("/month`");
    expect(ui).toContain('buttonLabel="Choose Starter"');
    expect(ui).toContain('buttonLabel="Choose Pro"');
    expect(ui).not.toContain("Cancel pending checkout");
    expect(ui).not.toContain("Continue Starter checkout");
    expect(ui).not.toContain("Continue Pro checkout");
    expect(ui).not.toContain("focusPendingCheckout");
    expect(ui).not.toContain("Resolve existing");
    expect(ui).toContain("Not active yet");
  });

  it("cancels the actual open subscription and refreshes open subscriptions on the five-minute cron", () => {
    const cancel = source("app/api/billing/subscription/cancel/route.ts");
    const worker = source("worker/index.ts");
    const reconciliation = source("server/billing-reconciliation.ts");
    expect(cancel).toContain("status NOT IN ('cancelled','completed','expired')");
    expect(cancel).toContain('subscription.status === "active"');
    expect(worker).toContain("reconcileOpenSubscriptionsWithProvider({ limit: 8 })");
    expect(reconciliation).toContain("export async function reconcileOpenSubscriptionsWithProvider");
  });

  it("keeps provider verification and reconciliation timestamps aligned", () => {
    const billing = source("server/billing.ts");
    expect(billing).toContain("reconciliation_checked_at = ?6");
    expect(billing).toContain("reconciliation_checked_at = ?2");
  });
});
