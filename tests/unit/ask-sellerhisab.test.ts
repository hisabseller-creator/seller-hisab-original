import { describe, expect, it } from "vitest";
import { ASK_SELLERHISAB_MIN_COHORT, buildBenchmarkMetric, classifyAskSellerHisabQuestion, median } from "@/core/ask-sellerhisab";

describe("Ask SellerHisab governance", () => {
  it("classifies supported operational questions without needing a generative model", () => {
    expect(classifyAskSellerHisabQuestion("What should I do today?")).toBe("priority");
    expect(classifyAskSellerHisabQuestion("Mera ACoS kaisa hai aur ads me kya karu?")).toBe("ads");
    expect(classifyAskSellerHisabQuestion("कौन सा स्टॉक रीऑर्डर करना है?")).toBe("inventory");
    expect(classifyAskSellerHisabQuestion("How much cash is at risk in payouts?")).toBe("cash");
    expect(classifyAskSellerHisabQuestion("WooCommerce sync healthy hai?")).toBe("connections");
    expect(classifyAskSellerHisabQuestion("Compare me with benchmark")).toBe("benchmark");
    expect(classifyAskSellerHisabQuestion("Data me kya missing hai?")).toBe("data-gaps");
  });

  it("refuses to invent a cohort benchmark below the privacy threshold", () => {
    const result = buildBenchmarkMetric({
      id: "acos",
      label: "Actual ACoS",
      direction: "lower-is-better",
      unit: "percent",
      currentValue: 23.1,
      cohortValues: Array.from({ length: ASK_SELLERHISAB_MIN_COHORT - 1 }, (_, index) => 18 + index / 10),
    });
    expect(result.status).toBe("insufficient-cohort");
    expect(result.cohortMedian).toBeUndefined();
    expect(result.cohortSizeBand).toBeUndefined();
  });

  it("returns only an aggregate median after the minimum cohort is met", () => {
    const result = buildBenchmarkMetric({
      id: "stockout-rate",
      label: "Stockout rate",
      direction: "lower-is-better",
      unit: "percent",
      currentValue: 8,
      cohortValues: Array.from({ length: 20 }, (_, index) => 10 + index),
    });
    expect(result.status).toBe("available");
    expect(result.cohortMedian).toBe(19.5);
    expect(result.comparison).toBe("better");
    expect(result.cohortSizeBand).toBe("20–49 opted-in businesses");
  });

  it("calculates a deterministic median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });
});
