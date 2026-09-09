import { describe, expect, it } from "vitest";
import { buildAdsEconomicsSummary } from "@/core/ads/economics";
import type { MoneyPaise } from "@/core/types";

const p = (value: number) => value as MoneyPaise;

const rows = [
  { id: "1", channelId: "amazon-in", reportDate: "2026-09-01T00:00:00.000Z", campaignName: "A", spendPaise: p(10_000), attributedSalesPaise: p(50_000), attributedOrders: 4 },
  { id: "2", channelId: "amazon-in", reportDate: "2026-09-02T00:00:00.000Z", campaignName: "A", spendPaise: p(5_000), attributedSalesPaise: p(25_000), attributedOrders: 2 },
];

describe("F8 ads economics", () => {
  it("calculates actual ACoS and ROAS from complete report evidence", () => {
    const result = buildAdsEconomicsSummary(rows, {});
    expect(result.totalSpendPaise).toBe(15_000);
    expect(result.totalAttributedSalesPaise).toBe(75_000);
    expect(result.actualAcosBps).toBe(2_000);
    expect(result.actualRoas).toBe(5);
  });

  it("does not claim profit-after-ads without an explicit margin baseline", () => {
    const result = buildAdsEconomicsSummary(rows, {});
    expect(result.modeledContributionAfterAdsPaise).toBeUndefined();
    expect(result.campaigns[0].action).toBe("Set margin baseline");
  });

  it("uses return-adjusted effective margin as max sustainable ACoS", () => {
    const result = buildAdsEconomicsSummary(rows, { preAdMarginBps: 3_000, returnLossBps: 500 });
    expect(result.effectiveMarginBps).toBe(2_500);
    expect(result.maxAcosBps).toBe(2_500);
    expect(result.breakEvenRoas).toBe(4);
    expect(result.modeledContributionAfterAdsPaise).toBe(3_750);
  });

  it("flags only the modeled spend above the sustainable boundary", () => {
    const result = buildAdsEconomicsSummary(rows, { preAdMarginBps: 1_500, returnLossBps: 0 });
    expect(result.spendAtRiskPaise).toBe(3_750);
    expect(result.campaigns[0].action).toBe("Review or reduce spend");
  });

  it("refuses aggregate ACoS when any spend row lacks attributed sales", () => {
    const result = buildAdsEconomicsSummary([...rows, { id: "3", channelId: "amazon-in", reportDate: "2026-09-03T00:00:00.000Z", campaignName: "B", spendPaise: p(1_000) }], { preAdMarginBps: 3_000 });
    expect(result.salesCoverageComplete).toBe(false);
    expect(result.actualAcosBps).toBeUndefined();
    expect(result.spendWithoutSalesPaise).toBe(1_000);
  });
});
