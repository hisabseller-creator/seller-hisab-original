import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("marketplace connections live UI", () => {
  it("uses the unified connections console as the account connections page", () => {
    const page = source("app/app/connections/page.tsx");
    expect(page).toContain("MarketplaceConnectionsWorkspace");
    expect(page).not.toContain('AccountWorkspace view="connections"');
  });

  it("keeps connection free while making sync, auto sync and connected reports explicit", () => {
    const ui = source("components/marketplace-connections-workspace.tsx");
    expect(ui).toContain("Connect is free");
    expect(ui).toContain("Upgrade to Pro for sync");
    expect(ui).toContain('/api/account/connections/auto-sync');
    expect(ui).toContain('/api/account/connections/report?connectorId=');
    expect(ui).toContain("Live sync ON");
    expect(ui).toContain("Sync latest 30 days");
    expect(ui).toContain("Open connected report");
  });

  it("shows future Meesho readiness without a fake connect flow", () => {
    const ui = source("components/marketplace-connections-workspace.tsx");
    expect(ui).toContain('platform.id === "meesho-api-v1"');
    expect(ui).toContain("Awaiting official access");
    expect(ui).toContain('value="Blocked"');
    expect(ui).toContain("Use Meesho file analysis now");
  });

  it("surfaces live freshness, durable job state and report revision metadata", () => {
    const ui = source("components/marketplace-connections-workspace.tsx");
    expect(ui).toContain("freshnessLabel(item)");
    expect(ui).toContain("item.retryJob.triggerKind");
    expect(ui).toContain("item.nextAutoSyncAt");
    expect(ui).toContain("item.dataRevision");
    expect(ui).toContain("item.reportFresh");
    expect(ui).toContain("report.dataRevision");
  });
});
