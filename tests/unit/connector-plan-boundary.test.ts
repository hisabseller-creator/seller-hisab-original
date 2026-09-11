import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("marketplace connector plan boundary", () => {
  it("allows signed-in sellers to inspect and authorize connections without a paid-plan gate", () => {
    const statusRoute = source("app/api/account/connections/route.ts");
    const startRoute = source("app/api/account/connections/start/route.ts");
    const disconnectRoute = source("app/api/account/connections/disconnect/route.ts");

    expect(statusRoute).not.toContain('requirePaidCapability(user, "connectors")');
    expect(startRoute).not.toContain('requirePaidCapability(user, "connectors")');
    expect(disconnectRoute).not.toContain('requirePaidCapability(user, "connectors")');
    expect(startRoute).toContain('requireWorkspaceCapability(user, "connector_manage")');
    expect(disconnectRoute).toContain('requireWorkspaceCapability(user, "connector_manage")');
  });

  it("keeps marketplace sync and API-backed analysis behind Pro", () => {
    const syncRoute = source("app/api/account/connections/sync/route.ts");
    const accessPolicy = source("server/plan-access.ts");

    expect(syncRoute).toContain('requirePaidCapability(user, "connectors")');
    expect(accessPolicy).toMatch(/connectors:\s*"pro"/);
  });

  it("keeps Amazon API Connect visible while describing the Pro sync boundary", () => {
    const definitions = source("core/marketplace-definitions.ts");

    expect(definitions).toContain('state: "activation-required"');
    expect(definitions).toContain("Seller authorization is free");
    expect(definitions).toContain("API sync and analysis require Pro");
  });
});
