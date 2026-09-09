import { describe, expect, it } from "vitest";
import { analyze } from "@/core/analyze";
import { SALES_CHANNELS, enabledAnalyzerChannels } from "@/core/channels/catalog";
import { liveConnectors } from "@/core/connectors/registry";
import { detectSalesChannel, parseTabularSource } from "@/core/parsers/tabular";
import { reconcileEvents } from "@/core/reconciliation";
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
    currency: "INR",
    subOrderId,
    sku,
    rawStatus: "Delivered",
    outcome: "delivered",
    quantity: 1,
    salePaise: 50_000,
    settlementPaise,
    source: {
      fileName: `${channelId ?? "unknown"}.csv`,
      channelId,
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: `${channelId ?? "unknown"}-fp`,
    },
  };
}

describe("multi-marketplace foundation", () => {
  it("keeps launch claims honest: P0 file analyzers are live while API automation stays separate", () => {
    expect(enabledAnalyzerChannels().map((channel) => channel.id)).toEqual([
      "meesho",
      "amazon-in",
      "flipkart",
      "shopify",
    ]);
    expect(liveConnectors().map((connector) => connector.id)).toEqual([
      "meesho-file-v1",
      "amazon-in-v1",
      "flipkart-v1",
      "shopify-v1",
      "woocommerce-v1",
    ]);
    expect(SALES_CHANNELS["amazon-in"].support).toBe("live-file");
    expect(SALES_CHANNELS.flipkart.support).toBe("live-file");
    expect(SALES_CHANNELS.shopify.support).toBe("live-file");
    expect(SALES_CHANNELS.woocommerce.support).toBe("live-api");
  });

  it("detects the existing Meesho-shaped file conservatively", () => {
    const headers = ["Net Settlement Amount", "Supplier SKU", "Sub Order Number", "Order Status"];
    expect(detectSalesChannel(headers, "payments.csv")).toBe("meesho");
    const report = parseTabularSource({
      fileName: "payments.csv",
      sheetName: "CSV",
      fingerprint: "fp",
      rows: [headers, ["401.25", "SKU-1", "SO-1", "Delivered"]],
    });
    expect(report.channelId).toBe("meesho");
    expect(report.connectorId).toBe("meesho-file-v1");
    expect(report.events[0].channelId).toBe("meesho");
  });

  it("does not merge identical order identifiers across channels", () => {
    const reconciled = reconcileEvents([
      event("meesho", "SO-1", "SKU-1"),
      event("amazon-in", "SO-1", "SKU-1"),
    ]);
    expect(reconciled.orders).toHaveLength(2);
    expect(new Set(reconciled.orders.map((order) => order.channelId))).toEqual(new Set(["meesho", "amazon-in"]));
  });

  it("keeps SKU economics channel-scoped until a human-approved master SKU mapping exists", () => {
    const result = analyze({
      events: [
        event("meesho", "SO-1", "SKU-1", 40_000),
        event("amazon-in", "SO-1", "SKU-1", 45_000),
      ],
      costs: [{ sku: "SKU-1", productCostPaise: 20_000, packagingCostPaise: 1_000 }],
    });

    expect(result.analysisScope).toBe("multi-channel");
    expect(result.channels).toHaveLength(2);
    expect(result.skus).toHaveLength(2);
    expect(result.bridge.contributionPaise).toBe(
      result.skus.reduce(
        (sum, sku) => sum + sku.confirmedContributionPaise + sku.provisionalContributionPaise,
        0,
      ),
    );
  });
  it("treats multiple accounts on one marketplace as single-channel analysis", () => {
    const first = { ...event("meesho", "SO-1", "SKU-1"), channelAccountId: "acct-a" };
    const second = { ...event("meesho", "SO-2", "SKU-2"), channelAccountId: "acct-b" };
    const result = analyze({
      events: [first, second],
      costs: [
        { sku: "SKU-1", productCostPaise: 20_000, packagingCostPaise: 1_000 },
        { sku: "SKU-2", productCostPaise: 20_000, packagingCostPaise: 1_000 },
      ],
    });

    expect(result.channels).toHaveLength(2);
    expect(result.analysisScope).toBe("single-channel");
  });

  it("does not allocate a channel-scoped SKU ad row into the same SKU on another marketplace", () => {
    const result = analyze({
      events: [
        event("meesho", "SO-1", "SKU-1", 40_000),
        event("amazon-in", "SO-2", "SKU-1", 40_000),
      ],
      costs: [{ sku: "SKU-1", productCostPaise: 20_000, packagingCostPaise: 0 }],
      adCosts: [{
        sku: "SKU-1",
        spendPaise: 10_000,
        allocation: "sku",
        source: {
          fileName: "meesho-ads.csv",
          channelId: "meesho",
          sheetName: "CSV",
          rowNumber: 2,
          parserVersion: "test",
          sourceFingerprint: "meesho-ads-fp",
        },
      }],
    });

    const meesho = result.skus.find((sku) => sku.channelId === "meesho");
    const amazon = result.skus.find((sku) => sku.channelId === "amazon-in");
    expect(meesho?.confirmedContributionPaise).toBe(10_000);
    expect(amazon?.confirmedContributionPaise).toBe(20_000);
  });

});
