import { describe, expect, it } from "vitest";
import { analyze } from "@/core/analyze";
import { scopedSkuKey } from "@/core/canonical/scope";
import { buildOwnerOperatingView, type ApprovedProductMapping } from "@/core/operating-view";
import type { NormalizedEvent } from "@/core/types";

function event(
  channelId: NormalizedEvent["channelId"],
  subOrderId: string,
  sku: string,
  settlementPaise = 40_000,
): NormalizedEvent {
  return {
    eventId: `${channelId ?? "unknown"}:${subOrderId}`,
    kind: "payment",
    channelId,
    channelAccountId: `${channelId ?? "unknown"}-acct`,
    currency: "INR",
    subOrderId,
    orderId: `${channelId ?? "unknown"}-order-${subOrderId}`,
    sku,
    rawStatus: "Delivered",
    outcome: "delivered",
    quantity: 1,
    salePaise: 50_000,
    settlementPaise,
    source: {
      fileName: `${channelId ?? "unknown"}.csv`,
      channelId,
      channelAccountId: `${channelId ?? "unknown"}-acct`,
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: `${channelId ?? "unknown"}-fp`,
    },
  };
}

function multiChannelResult() {
  return analyze({
    events: [
      event("meesho", "SO-1", "SAME-SKU", 40_000),
      event("amazon-in", "SO-2", "SAME-SKU", 45_000),
    ],
    costs: [{ sku: "SAME-SKU", productCostPaise: 20_000, packagingCostPaise: 1_000 }],
  });
}

describe("owner operating view", () => {
  it("keeps identical cross-channel SKU text separate until the seller approves a mapping", () => {
    const result = multiChannelResult();
    const view = buildOwnerOperatingView(result, undefined, [], new Date(result.createdAt));

    expect(view.products).toHaveLength(2);
    expect(view.products.every((product) => !product.mapped)).toBe(true);
    expect(view.mappingSuggestions).toHaveLength(1);
    expect(view.mappingSuggestions[0].sku).toBe("SAME-SKU");
    expect(view.mappingSuggestions[0].aliasKeys).toHaveLength(2);
  });

  it("aggregates channel economics only after an explicit approved mapping", () => {
    const result = multiChannelResult();
    const aliases = result.skus.map(scopedSkuKey);
    const mapping: ApprovedProductMapping = {
      id: "mapping-1",
      name: "Same physical product",
      aliasKeys: aliases,
      approvedAt: "2026-09-03T08:00:00Z",
      updatedAt: "2026-09-03T08:00:00Z",
    };

    const view = buildOwnerOperatingView(result, undefined, [mapping], new Date(result.createdAt));

    expect(view.products).toHaveLength(1);
    expect(view.products[0].mapped).toBe(true);
    expect(view.products[0].channels).toHaveLength(2);
    expect(view.products[0].confirmedContributionPaise).toBe(
      result.skus.reduce((sum, sku) => sum + sku.confirmedContributionPaise, 0),
    );
    expect(view.mappingSuggestions).toHaveLength(0);
  });

  it("fails closed when two approved mappings claim the same scoped SKU alias", () => {
    const result = multiChannelResult();
    const aliases = result.skus.map(scopedSkuKey);
    const mappings: ApprovedProductMapping[] = [
      {
        id: "mapping-a",
        name: "A",
        aliasKeys: aliases,
        approvedAt: "2026-09-03T08:00:00Z",
        updatedAt: "2026-09-03T08:00:00Z",
      },
      {
        id: "mapping-b",
        name: "B",
        aliasKeys: [aliases[0]],
        approvedAt: "2026-09-03T08:01:00Z",
        updatedAt: "2026-09-03T08:01:00Z",
      },
    ];

    const view = buildOwnerOperatingView(result, undefined, mappings, new Date(result.createdAt));

    expect(view.mappingConflictCount).toBe(1);
    expect(view.products.some((product) => product.mapped && product.channels.length === 2)).toBe(false);
    expect(view.products.find((product) => product.channels.some((item) => item.key === aliases[0]))?.mapped).toBe(false);
  });

  it("shows a missing final payout as a critical settlement action only with complete bank evidence", () => {
    const result = analyze({
      events: [event("shopify", "SO-1", "SHOP-SKU", 80_000)],
      costs: [{ sku: "SHOP-SKU", productCostPaise: 30_000, packagingCostPaise: 1_000 }],
      settlementBatches: [{
        id: "batch-1",
        channelId: "shopify",
        channelAccountId: "shopify-acct",
        externalBatchId: "PAYOUT-1",
        expectedAmountPaise: 90_000,
        currency: "INR",
        status: "paid",
        issuedAt: "2026-09-03T05:00:00Z",
        expectedBankBy: "2026-09-05T00:00:00Z",
        referenceKeys: ["UTR-1"],
        source: {
          fileName: "payouts.json",
          channelId: "shopify",
          channelAccountId: "shopify-acct",
          sheetName: "API",
          rowNumber: 1,
          parserVersion: "test",
          sourceFingerprint: "payouts-fp",
        },
      }],
      bankTransactions: [],
      bankEvidenceCompleteThrough: "2026-09-06T23:59:59Z",
    });

    const view = buildOwnerOperatingView(result, undefined, [], new Date(result.createdAt));
    const settlementAction = view.actions.find((action) => action.kind === "settlement");

    expect(settlementAction?.urgency).toBe("Critical");
    expect(settlementAction?.title).toContain("Expected payout not found");
    expect(settlementAction?.moneyImpactPaise).toBe(90_000);
  });

  it("compares the current snapshot only with the previous local analysis and does not call it yesterday", () => {
    const current = multiChannelResult();
    const previous = {
      ...current,
      id: "previous",
      confirmedContributionPaise: current.confirmedContributionPaise - 5_000,
      stillAtRiskPaise: current.stillAtRiskPaise + 2_000,
      orders: current.orders.slice(0, 1),
    };

    const view = buildOwnerOperatingView(current, previous, [], new Date(current.createdAt));

    expect(view.today.confirmedContributionDeltaPaise).toBe(5_000);
    expect(view.today.stillAtRiskDeltaPaise).toBe(-2_000);
    expect(view.today.orderDelta).toBe(current.orders.length - 1);
  });
});
