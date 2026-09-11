import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_MARKETPLACE_API_PLATFORM_IDS,
  MARKETPLACE_API_PLATFORMS,
  clampMarketplaceSyncInterval,
} from "@/core/connectors/platform";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("unified marketplace API platform", () => {
  it("keeps one reusable paid-sync boundary for every active API marketplace", () => {
    expect(ACTIVE_MARKETPLACE_API_PLATFORM_IDS).toEqual([
      "amazon-in-v1",
      "flipkart-v1",
      "shopify-v1",
      "woocommerce-v1",
    ]);
    for (const id of ACTIVE_MARKETPLACE_API_PLATFORM_IDS) {
      const platform = MARKETPLACE_API_PLATFORMS[id];
      expect(platform.connectorId).toBe(id);
      expect(platform.connectRequiresPlan).toBeNull();
      expect(platform.syncRequiresPlan).toBe("pro");
      expect(platform.incrementalSync).toBe(true);
      expect(platform.pollingBackstop).toBe(true);
      expect(clampMarketplaceSyncInterval(id, 1)).toBe(platform.minimumSyncIntervalMinutes);
      expect(clampMarketplaceSyncInterval(id, 5000)).toBe(platform.maximumSyncIntervalMinutes);
    }
  });

  it("keeps Meesho API architecture ready without exposing a fake connector", () => {
    const meesho = MARKETPLACE_API_PLATFORMS["meesho-api-v1"];
    expect(meesho.channelId).toBe("meesho");
    expect(meesho.connectorId).toBeNull();
    expect(meesho.activationState).toBe("partner-approval-required");
    expect(meesho.note.toLowerCase()).toContain("official/approved meesho seller api");
  });

  it("uses the provider adapter boundary for sync instead of branching in the sync engine", () => {
    const sync = source("server/connectors/sync.ts");
    const adapters = source("server/connectors/adapters.ts");
    expect(sync).toContain("connectorProviderAdapter(input.connection.connectorId)");
    expect(sync).toContain("adapter.fetchPage");
    expect(adapters).toContain('"amazon-in-v1": buildAdapter');
    expect(adapters).toContain('"flipkart-v1": buildAdapter');
    expect(adapters).toContain('"shopify-v1": buildAdapter');
    expect(adapters).toContain('"woocommerce-v1": buildAdapter');
  });

  it("persists live-sync state, data revisions and saved connected report snapshots", () => {
    const migration = source("drizzle/0023_connector_live_platform.sql");
    expect(migration).toContain("auto_sync_enabled");
    expect(migration).toContain("next_auto_sync_at");
    expect(migration).toContain("data_revision");
    expect(migration).toContain("report_revision");
    expect(migration).toContain("connector_report_snapshots");
    expect(migration).toContain("trigger_kind");
  });

  it("schedules due live syncs and refreshes reports after completed jobs", () => {
    const worker = source("worker/index.ts");
    const jobs = source("server/connectors/jobs.ts");
    expect(worker).toContain("scheduleDueMarketplaceAutoSyncs()");
    expect(jobs).toContain("data_revision=data_revision+1");
    expect(jobs).toContain("refreshConnectedReportSnapshot(connection.id)");
    expect(jobs).toContain("trigger_kind");
  });

  it("keeps enabling live sync and reading connected reports behind Pro while connection remains free", () => {
    const liveRoute = source("app/api/account/connections/auto-sync/route.ts");
    const reportRoute = source("app/api/account/connections/report/route.ts");
    const statusRoute = source("app/api/account/connections/route.ts");
    expect(liveRoute).toContain('if (input.enabled) await requirePaidCapability(user, "connectors")');
    expect(reportRoute).toContain('requirePaidCapability(user, "connectors")');
    expect(statusRoute).toContain("connectionRequiresPlan: null");
    expect(statusRoute).toContain('syncRequiresPlan: "pro"');
  });
});
