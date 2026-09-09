import { describe, expect, it } from "vitest";
import { analyze } from "@/core/analyze";
import { getSyntheticAnalysisForTest } from "@/tests/helpers/synthetic-analysis";
import type { AnalysisInput, NormalizedEvent } from "@/core/types";

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    eventId: "evt-1",
    kind: "payment",
    subOrderId: "SO-1",
    sku: "SKU-1",
    rawStatus: "Delivered",
    outcome: "delivered",
    quantity: 1,
    salePaise: 50_000,
    settlementPaise: 41_000,
    source: { fileName: "payments.csv", sheetName: "CSV", rowNumber: 2, parserVersion: "test", sourceFingerprint: "fp" },
    ...overrides,
  };
}

function baseInput(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return { events: [event()], costs: [{ sku: "SKU-1", productCostPaise: 25_000, packagingCostPaise: 1_000 }], sourceFingerprints: ["fp"], ...overrides };
}

describe("financial and decision engine", () => {
  it("calculates source-backed contribution once", () => {
    const result = analyze(baseInput());
    expect(result.confirmedContributionPaise).toBe(15_000);
    expect(result.bridge.contributionPaise).toBe(15_000);
    expect(result.orders[0].audit.at(-1)?.amountPaise).toBe(15_000);
  });

  it("does not label missing cost rows as confirmed", () => {
    const result = analyze(baseInput({ costs: [] }));
    expect(result.confirmedContributionPaise).toBe(0);
    expect(result.orders[0].state).toBe("incomplete");
    expect(result.skus[0].action).toBe("Add Cost");
  });

  it("does not double-count duplicate financial events", () => {
    const duplicate = event({ eventId: "evt-duplicate", source: { ...event().source, rowNumber: 3 } });
    const result = analyze(baseInput({ events: [event(), duplicate] }));
    expect(result.confirmedContributionPaise).toBe(15_000);
    expect(result.findings.some((finding) => finding.code === "duplicates")).toBe(true);
  });

  it("uses direct Ads spend and attributable sales for ad economics", () => {
    const result = analyze(baseInput({
      adCosts: [{ sku: "SKU-1", spendPaise: 4_000, attributableSalesPaise: 50_000, allocation: "sku" }],
    }));
    expect(result.confirmedContributionPaise).toBe(11_000);
    expect(result.bridge.adsPaise).toBe(4_000);
    expect(result.skus[0].breakEvenRoas).toBeCloseTo(50_000 / 15_000, 6);
    expect(result.skus[0].maxAcos).toBeCloseTo(15_000 / 50_000, 6);
  });

  it("derives break-even price from successful-order retention without double-counting failure loss", () => {
    const result = analyze(baseInput());
    expect(result.skus[0].breakEvenPricePaise).toBe(31_707);
  });

  it("derives a return/RTO break-even threshold only from observed success and failure economics", () => {
    const failure = event({ eventId: "evt-rto", subOrderId: "SO-2", rawStatus: "RTO", outcome: "rto", settlementPaise: -8_000, source: { ...event().source, rowNumber: 3 } });
    const result = analyze(baseInput({ events: [event(), failure] }));
    expect(result.skus[0].maxSafeFailureRate).toBeCloseTo(15_000 / 24_000, 6);
    expect(result.skus[0].returnRtoRate).toBe(0.5);
  });

  it("shows estimated net profit only with complete rows and explicit overhead", () => {
    expect(analyze(baseInput()).estimatedNetProfitPaise).toBeUndefined();
    expect(analyze(baseInput({ monthlyFixedOverheadPaise: 3_000 })).estimatedNetProfitPaise).toBe(12_000);
    expect(analyze(baseInput({ costs: [], monthlyFixedOverheadPaise: 3_000 })).estimatedNetProfitPaise).toBeUndefined();
  });

  it("covers loss, missing-data, provisional-risk and scale decisions with test-only synthetic data", () => {
    const result = getSyntheticAnalysisForTest();
    expect(result.lossMakingSkus).toBeGreaterThan(0);
    expect(result.skus.some((sku) => sku.action === "Add Cost")).toBe(true);
    expect(result.skus.some((sku) => sku.action === "Scale")).toBe(true);
    expect(result.stillAtRiskPaise).toBeGreaterThan(0);
  });
});
