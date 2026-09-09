import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { analyze } from "@/core/analyze";
import type { AnalysisInput, NormalizedEvent } from "@/core/types";

function makeInput(settlement: number, product: number, packaging: number, extra: number): AnalysisInput {
  const events: NormalizedEvent[] = [{
    eventId: "e1", kind: "payment", subOrderId: "SO-1", sku: "SKU-1", rawStatus: "Delivered", outcome: "delivered", quantity: 1, salePaise: Math.max(settlement, 1), settlementPaise: settlement,
    source: { fileName: "f.csv", sheetName: "CSV", rowNumber: 2, parserVersion: "test", sourceFingerprint: "fp" },
  }];
  return { events, costs: [{ sku: "SKU-1", productCostPaise: product, packagingCostPaise: packaging, variableCostPaise: extra }], sourceFingerprints: ["fp"] };
}

describe("financial invariants", () => {
  it("adding an expense cannot increase contribution", () => {
    fc.assert(fc.property(
      fc.integer({ min: -100_000, max: 2_000_000 }),
      fc.integer({ min: 0, max: 500_000 }),
      fc.integer({ min: 0, max: 100_000 }),
      fc.integer({ min: 0, max: 100_000 }),
      fc.integer({ min: 0, max: 100_000 }),
      (settlement, product, packaging, extra, added) => {
        const before = analyze(makeInput(settlement, product, packaging, extra)).bridge.contributionPaise;
        const after = analyze(makeInput(settlement, product, packaging, extra + added)).bridge.contributionPaise;
        expect(after).toBeLessThanOrEqual(before);
      },
    ), { numRuns: 300 });
  });

  it("removing required cost cannot produce a more trustworthy state", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 500_000 }), (cost) => {
      const complete = analyze(makeInput(50_000, cost, 1_000, 0));
      const missing = analyze({ ...makeInput(50_000, cost, 1_000, 0), costs: [] });
      expect(complete.orders[0].state).toBe("confirmed");
      expect(missing.orders[0].state).toBe("incomplete");
      expect(missing.confirmedContributionPaise).toBe(0);
    }), { numRuns: 100 });
  });

  it("source row reordering does not change economic totals", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 10_000, max: 100_000 }), { minLength: 2, maxLength: 30 }), (settlements) => {
      const base = makeInput(1, 100, 10, 0);
      const events = settlements.map((settlement, index) => ({ ...base.events[0], eventId: `e${index}`, subOrderId: `SO-${index}`, settlementPaise: settlement, source: { ...base.events[0].source, rowNumber: index + 2 } }));
      const costs = [{ sku: "SKU-1", productCostPaise: 100, packagingCostPaise: 10 }];
      const first = analyze({ events, costs });
      const second = analyze({ events: [...events].reverse(), costs });
      expect(second.bridge).toEqual(first.bridge);
      expect(second.confirmedContributionPaise).toBe(first.confirmedContributionPaise);
    }), { numRuns: 100 });
  });

  it("SKU contribution reconciles to overall contribution", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -20_000, max: 100_000 }), { minLength: 1, maxLength: 50 }), (settlements) => {
      const base = makeInput(1, 100, 10, 0);
      const events = settlements.map((settlement, index) => ({ ...base.events[0], eventId: `e${index}`, subOrderId: `SO-${index}`, sku: `SKU-${index % 5}`, settlementPaise: settlement, source: { ...base.events[0].source, rowNumber: index + 2 } }));
      const costs = Array.from({ length: 5 }, (_, index) => ({ sku: `SKU-${index}`, productCostPaise: 100, packagingCostPaise: 10 }));
      const result = analyze({ events, costs });
      const skuTotal = result.skus.reduce((sum, sku) => sum + sku.confirmedContributionPaise + sku.provisionalContributionPaise, 0);
      expect(skuTotal).toBe(result.bridge.contributionPaise);
    }), { numRuns: 100 });
  });
});
