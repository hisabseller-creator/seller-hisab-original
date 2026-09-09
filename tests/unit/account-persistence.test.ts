import { describe, expect, it } from "vitest";
import { buildSavedAnalysisPayload } from "@/core/account/analysis-summary";
import { mergeSavedCosts, syncableSavedCosts } from "@/core/account/saved-costs";
import { analyze } from "@/core/analyze";
import type { NormalizedEvent } from "@/core/types";

function event(): NormalizedEvent {
  return {
    eventId: "evt-1",
    kind: "payment",
    channelId: "meesho",
    channelAccountId: "meesho-account",
    currency: "INR",
    subOrderId: "SECRET-SUBORDER-123",
    orderId: "SECRET-ORDER-123",
    sku: "SECRET-SKU-123",
    rawStatus: "Delivered",
    outcome: "delivered",
    quantity: 1,
    salePaise: 50_000,
    settlementPaise: 40_000,
    source: {
      fileName: "private-payments.csv",
      channelId: "meesho",
      channelAccountId: "meesho-account",
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: "private-source-fingerprint",
    },
  };
}

describe("account persistence boundary", () => {
  it("keeps raw report, order and SKU identifiers out of the saved analysis payload", () => {
    const result = analyze({
      events: [event()],
      costs: [{ sku: "SECRET-SKU-123", productCostPaise: 20_000, packagingCostPaise: 1_000 }],
    });

    const payload = buildSavedAnalysisPayload(result);
    const serialized = JSON.stringify(payload);

    expect(payload.summary.orderCount).toBe(1);
    expect(payload.summary.skuCount).toBe(1);
    expect(serialized).not.toContain("SECRET-SUBORDER-123");
    expect(serialized).not.toContain("SECRET-ORDER-123");
    expect(serialized).not.toContain("SECRET-SKU-123");
    expect(serialized).not.toContain("private-payments.csv");
    expect(serialized).not.toContain("private-source-fingerprint");
  });

  it("stores only missing-cost counts in analysis history", () => {
    const result = analyze({ events: [event()], costs: [] });
    const payload = buildSavedAnalysisPayload(result);

    expect(payload.summary.missingCostCount).toBeGreaterThan(0);
    expect(Object.keys(payload.summary)).toEqual([
      "confirmedContributionPaise",
      "provisionalContributionPaise",
      "stillAtRiskPaise",
      "lossMakingSkus",
      "needsReviewCount",
      "qualityScore",
      "qualityStatus",
      "skuCount",
      "orderCount",
      "missingCostCount",
      "returnRtoCount",
      "observedReturnRtoLossPaise",
      "openReturnExposurePaise",
      "potentialRecoveryPaise",
    ]);
  });

  it("uses the newest cost record when local and account copies share a SKU", () => {
    const merged = mergeSavedCosts(
      [{ sku: "SKU-1", productCostPaise: 10_000, updatedAt: "2026-09-01T10:00:00.000Z" }],
      [{ sku: "SKU-1", productCostPaise: 12_000, updatedAt: "2026-09-02T10:00:00.000Z" }],
    );

    expect(merged).toEqual([{ sku: "SKU-1", productCostPaise: 12_000, updatedAt: "2026-09-02T10:00:00.000Z" }]);
  });

  it("never syncs a saved cost without a valid product cost", () => {
    const costs = syncableSavedCosts([
      { sku: "VALID", productCostPaise: 15_000, packagingCostPaise: 500, updatedAt: "2026-09-02T10:00:00.000Z" },
      { sku: "NO-COST", packagingCostPaise: 500, updatedAt: "2026-09-02T10:00:00.000Z" },
    ]);

    expect(costs).toHaveLength(1);
    expect(costs[0].sku).toBe("VALID");
    expect(costs[0].productCostPaise).toBe(15_000);
  });
});
