import { describe, expect, it } from "vitest";
import { buildAdsEconomicsSummary } from "@/core/ads/economics";
import { analyze } from "@/core/analyze";
import { calculateTool } from "@/core/calculators";
import * as formulas from "@/core/finance/formulas";
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

describe("authoritative finance formulas", () => {
  it("contribution subtracts every known variable cost and never rises when a cost is added", () => {
    const base = { settlementPaise: 54_800, productCostPaise: 30_500, packagingCostPaise: 1_400, adCostPaise: 2_000 };
    expect(formulas.contributionPaise(base)).toBe(20_900);
    expect(formulas.contributionPaise({ ...base, variableCostPaise: 1_000 })).toBe(19_900);
    expect(formulas.contributionPaise({ settlementPaise: -11_800 })).toBe(-11_800);
  });

  it("contribution margin is undefined without positive sales and rounds to integer basis points", () => {
    expect(formulas.contributionMarginBps(20_900, 64_900)).toBe(3_220);
    expect(formulas.contributionMarginBps(-12_50, 10_000)).toBe(-1_250);
    expect(formulas.contributionMarginBps(500, 0)).toBeUndefined();
    expect(formulas.contributionMarginPct(15_000, 50_000)).toBe(30);
    expect(formulas.contributionMarginPct(15_000, 0)).toBeUndefined();
  });

  it("clamps the observed retained-settlement rate and refuses it without sales", () => {
    expect(formulas.observedRetainedRate(41_000, 50_000)).toBeCloseTo(0.82, 10);
    expect(formulas.observedRetainedRate(1, 100_000)).toBe(formulas.RETAINED_RATE_FLOOR);
    expect(formulas.observedRetainedRate(200_000, 100_000)).toBe(formulas.RETAINED_RATE_CEILING);
    expect(formulas.observedRetainedRate(100, 0)).toBeUndefined();
  });

  it("break-even price requires a positive retained rate and never goes negative", () => {
    expect(formulas.breakEvenPricePaise({ baseCostPerOrder: 34_900, expectedFailureLossPerOrder: 1_530, retainedRate: 0.84 })).toBe(43_369);
    expect(formulas.breakEvenPricePaise({ baseCostPerOrder: 26_000, expectedFailureLossPerOrder: 0, retainedRate: 0.82 })).toBe(31_707);
    expect(formulas.breakEvenPricePaise({ baseCostPerOrder: 26_000, expectedFailureLossPerOrder: 0, retainedRate: undefined })).toBeUndefined();
    expect(formulas.breakEvenPricePaise({ baseCostPerOrder: 26_000, expectedFailureLossPerOrder: 0, retainedRate: 0 })).toBeUndefined();
    expect(formulas.breakEvenPricePaise({ baseCostPerOrder: -5_000, expectedFailureLossPerOrder: 0, retainedRate: 0.8 })).toBe(0);
  });

  it("expected failure loss is zero when either observation is missing", () => {
    expect(formulas.expectedFailureLossPerOrder(8_500, 0.18)).toBeCloseTo(1_530, 6);
    expect(formulas.expectedFailureLossPerOrder(undefined, 0.18)).toBe(0);
    expect(formulas.expectedFailureLossPerOrder(8_500, undefined)).toBe(0);
  });

  it("safe failure rate needs positive success contribution and positive failure loss", () => {
    expect(formulas.maxSafeFailureRate(15_000, 9_000)).toBeCloseTo(15_000 / 24_000, 10);
    expect(formulas.maxSafeFailureRate(0, 9_000)).toBeUndefined();
    expect(formulas.maxSafeFailureRate(15_000, 0)).toBeUndefined();
    expect(formulas.maxSafeFailureRate(undefined, 9_000)).toBeUndefined();
  });

  it("break-even ROAS and max ACoS are reciprocal and undefined without positive inputs", () => {
    const roas = formulas.breakEvenRoas(12_000_00, 48_000_00);
    const acos = formulas.maxAcosRatio(12_000_00, 48_000_00);
    expect(roas).toBe(4);
    expect(acos).toBe(0.25);
    expect((roas ?? 0) * (acos ?? 0)).toBeCloseTo(1, 10);
    expect(formulas.breakEvenRoas(0, 48_000_00)).toBeUndefined();
    expect(formulas.maxAcosRatio(12_000_00, 0)).toBeUndefined();
    expect(formulas.breakEvenRoasFromMarginBps(2_500)).toBe(4);
    expect(formulas.breakEvenRoasFromMarginBps(0)).toBeUndefined();
    expect(formulas.breakEvenRoasFromMarginBps(undefined)).toBeUndefined();
  });

  it("actual ACoS distinguishes zero spend from spend without attributed sales", () => {
    expect(formulas.actualAcosBps(0, 0)).toBe(0);
    expect(formulas.actualAcosBps(2_500, 0)).toBeUndefined();
    expect(formulas.actualAcosBps(2_500, 10_000)).toBe(2_500);
    expect(formulas.actualRoas(0, 10_000)).toBeUndefined();
    expect(formulas.actualRoas(2_500, 10_000)).toBe(4);
    expect(formulas.sustainableAdSpendPaise(10_000, 2_500)).toBe(2_500);
    expect(formulas.sustainableAdSpendPaise(333, 3_333)).toBe(111);
  });

  it("failure loss and settlement gap are integer paise", () => {
    expect(formulas.failureLossPaise({ orders: 100, failureRateBps: 1_800, lossPerFailurePaise: 8_500 })).toBe(153_000);
    expect(formulas.failureLossPaise({ orders: 100, failureRateBps: 1_850, lossPerFailurePaise: 8_500 })).toBe(157_250);
    expect(formulas.failureLossPaise({ orders: 0, failureRateBps: 1_850, lossPerFailurePaise: 8_500 })).toBe(0);
    expect(formulas.settlementGapPaise(4_850_000, 4_685_000)).toBe(165_000);
    expect(formulas.settlementGapPaise(100, 120)).toBe(-20);
  });

  it("bank-reconcilable settlement excludes marketplace-financial evidence (settlement is not bank cash)", () => {
    const total = formulas.bankReconcilableSettlementPaise([
      { settlementPaise: 1_000 },
      { settlementPaise: 2_000, settlementCashStage: "payout" },
      { settlementPaise: 4_000, settlementCashStage: "marketplace-financial" },
      { settlementPaise: undefined, settlementCashStage: "payout" },
    ]);
    expect(total).toBe(3_000);
  });
});

describe("calculators, decision engine and ads engine share one formula source", () => {
  it("SKU break-even ROAS and max ACoS equal the public calculator for the same money", () => {
    const result = analyze(baseInput({
      adCosts: [{ sku: "SKU-1", spendPaise: 4_000, attributableSalesPaise: 50_000, allocation: "sku" }],
    }));
    const sku = result.skus[0];
    // Pre-ad contribution is 41,000 − 25,000 − 1,000 = 15,000 paise against 50,000 paise of attributable sales.
    expect(sku.breakEvenRoas).toBe(formulas.breakEvenRoas(15_000, 50_000));
    expect(sku.maxAcos).toBe(formulas.maxAcosRatio(15_000, 50_000));

    const roasTool = calculateTool("roas", { sale: "500", preAd: "150" });
    const acosTool = calculateTool("acos", { sale: "500", preAd: "150" });
    expect(roasTool.value).toBe("3.33");
    expect(Number(roasTool.value)).toBeCloseTo(sku.breakEvenRoas ?? 0, 2);
    expect(acosTool.value).toBe("30.0");
    expect(Number(acosTool.value)).toBeCloseTo((sku.maxAcos ?? 0) * 100, 1);
  });

  it("SKU break-even price equals the public calculator for identical single-order economics", () => {
    const result = analyze(baseInput());
    expect(result.skus[0].breakEvenPricePaise).toBe(31_707);
    const tool = calculateTool("break-even", { product: "250", packaging: "10", variable: "0", ads: "0", rate: "0", loss: "0", retained: "82" });
    expect(Math.round(Number(tool.value) * 100)).toBe(result.skus[0].breakEvenPricePaise);
  });

  it("SKU contribution margin uses the shared definition", () => {
    const result = analyze(baseInput());
    expect(result.skus[0].contributionMarginPct).toBe(formulas.contributionMarginPct(15_000, 50_000));
    expect(result.skus[0].contributionMarginPct).toBe(30);
  });

  it("finance engine contribution subtracts other variable cost exactly like the margin calculator", () => {
    const result = analyze(baseInput({ costs: [{ sku: "SKU-1", productCostPaise: 25_000, packagingCostPaise: 1_000, variableCostPaise: 1_000 }] }));
    expect(result.confirmedContributionPaise).toBe(14_000);
    const tool = calculateTool("margin", { sale: "500", settlement: "410", product: "250", packaging: "10", variable: "10", ads: "0" });
    expect(Math.round(Number(tool.value) * 100)).toBe(result.confirmedContributionPaise);
  });

  it("ads engine break-even ROAS is the reciprocal of its max ACoS through the shared formula", () => {
    const summary = buildAdsEconomicsSummary(
      [{ id: "r1", channelId: "meesho", reportDate: "2026-08-01", campaignName: "Launch", spendPaise: 2_500, attributedSalesPaise: 10_000 }],
      { preAdMarginBps: 2_500, returnLossBps: 0 },
    );
    expect(summary.maxAcosBps).toBe(2_500);
    expect(summary.breakEvenRoas).toBe(formulas.breakEvenRoasFromMarginBps(2_500));
    expect(summary.actualAcosBps).toBe(formulas.actualAcosBps(2_500, 10_000));
    expect(summary.actualRoas).toBe(formulas.actualRoas(2_500, 10_000));
    expect(summary.campaigns[0]?.sustainableSpendPaise).toBe(formulas.sustainableAdSpendPaise(10_000, 2_500));
    expect(summary.campaigns[0]?.modeledContributionAfterAdsPaise).toBe(0);
  });

  it("analysis bank-reconcilable settlement uses the shared rule", () => {
    const result = analyze(baseInput({ bankCreditPaise: 41_000 }));
    expect(result.bankReconcilableSettlementPaise).toBe(formulas.bankReconcilableSettlementPaise(result.orders));
    expect(result.bankCreditMismatchPaise).toBe(0);
  });
});
