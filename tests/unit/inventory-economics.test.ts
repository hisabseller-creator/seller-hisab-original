import { describe, expect, it } from "vitest";
import { buildInventoryEconomicsSummary } from "@/core/inventory/economics";
import type { MoneyPaise } from "@/core/types";

const p = (value: number) => value as MoneyPaise;

const baseRows = [
  { id: "1", channelId: "amazon-in", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "SKU-A", masterSku: "M-1", availableUnits: 8, inboundUnits: 0, unitsSold30d: 60, leadTimeDays: 10, unitCostPaise: p(20_000), contributionMarginBps: 3_500 },
  { id: "2", channelId: "amazon-in", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "SKU-B", availableUnits: 150, inboundUnits: 0, unitsSold30d: 15, leadTimeDays: 10, unitCostPaise: p(15_000) },
];

describe("F9 inventory economics", () => {
  it("calculates days cover and a deterministic reorder quantity from reported velocity", () => {
    const result = buildInventoryEconomicsSummary(baseRows, { defaultLeadTimeDays: 14, safetyDays: 7, targetCoverDays: 30, overstockDays: 120 });
    const first = result.positions.find((item) => item.sku === "SKU-A");
    expect(first?.daysCover).toBe(4);
    expect(first?.status).toBe("Reorder now");
    expect(first?.targetStockUnits).toBe(94);
    expect(first?.suggestedReorderUnits).toBe(86);
  });

  it("does not invent reorder math when 30-day unit sales are absent", () => {
    const result = buildInventoryEconomicsSummary([{ id: "3", channelId: "meesho", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "SKU-C", availableUnits: 20 }]);
    expect(result.positions[0].status).toBe("Add sales history");
    expect(result.positions[0].daysCover).toBeUndefined();
    expect(result.positions[0].suggestedReorderUnits).toBeUndefined();
  });

  it("marks very high days-cover for overstock review", () => {
    const result = buildInventoryEconomicsSummary(baseRows, { overstockDays: 120 });
    const slow = result.positions.find((item) => item.sku === "SKU-B");
    expect(slow?.daysCover).toBe(300);
    expect(slow?.status).toBe("Overstock review");
  });

  it("uses an explicit Master SKU and margin evidence before suggesting cross-channel reallocation", () => {
    const result = buildInventoryEconomicsSummary([
      { id: "a", channelId: "amazon-in", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "AMZ-1", masterSku: "MASTER-1", availableUnits: 4, unitsSold30d: 60, leadTimeDays: 10, contributionMarginBps: 3_500 },
      { id: "b", channelId: "flipkart", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "FK-1", masterSku: "MASTER-1", availableUnits: 200, unitsSold30d: 30, leadTimeDays: 10, contributionMarginBps: 2_500 },
    ], { safetyDays: 7, targetCoverDays: 30, overstockDays: 120 });
    expect(result.allocationSuggestions).toHaveLength(1);
    expect(result.allocationSuggestions[0]).toMatchObject({ masterSku: "MASTER-1", fromChannelId: "flipkart", toChannelId: "amazon-in" });
  });

  it("does not auto-merge identical channel SKUs without an explicit Master SKU", () => {
    const result = buildInventoryEconomicsSummary([
      { id: "a", channelId: "amazon-in", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "SAME", availableUnits: 4, unitsSold30d: 60, leadTimeDays: 10, contributionMarginBps: 3_500 },
      { id: "b", channelId: "flipkart", snapshotDate: "2026-09-01T00:00:00.000Z", sku: "SAME", availableUnits: 200, unitsSold30d: 30, leadTimeDays: 10, contributionMarginBps: 2_500 },
    ]);
    expect(result.allocationSuggestions).toHaveLength(0);
  });
});
