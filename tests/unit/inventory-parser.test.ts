import { describe, expect, it } from "vitest";
import { parseInventoryFile } from "@/core/inventory/parser";

function csv(text: string) {
  return { name: "inventory.csv", buffer: new TextEncoder().encode(text).buffer as ArrayBuffer };
}

describe("F9 inventory parser", () => {
  it("normalizes snapshot, stock, sales velocity and planning evidence", async () => {
    const result = await parseInventoryFile(csv([
      "Snapshot Date,SKU,Master SKU,Product,Available,Inbound,Units Sold 30d,Lead Time Days,Unit Cost,Contribution Margin %,Location",
      "01/09/2026,SKU-1,MASTER-1,Bottle,8,2,60,10,250,32,Delhi",
    ].join("\n")));
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ sku: "SKU-1", masterSku: "MASTER-1", availableUnits: 8, inboundUnits: 2, unitsSold30d: 60, leadTimeDays: 10, unitCostPaise: 25_000, contributionMarginBps: 3_200, location: "Delhi" });
  });

  it("keeps valid stock when sales history is missing and warns instead of inventing velocity", async () => {
    const result = await parseInventoryFile(csv("Snapshot Date,SKU,Available\n01/09/2026,SKU-1,20\n"));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].unitsSold30d).toBeUndefined();
    expect(result.issues.some((issue) => issue.severity === "warning" && issue.message.includes("Units Sold 30d"))).toBe(true);
  });

  it("fails closed when Snapshot Date + SKU + Available cannot be identified", async () => {
    const result = await parseInventoryFile(csv("Something,Else\nA,B\n"));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(true);
  });
});
