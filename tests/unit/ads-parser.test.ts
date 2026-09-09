import { describe, expect, it } from "vitest";
import { parseAdsPerformanceFile } from "@/core/ads/parser";

function csv(text: string) {
  return { name: "ads.csv", buffer: new TextEncoder().encode(text).buffer as ArrayBuffer };
}

describe("F8 ads parser", () => {
  it("normalizes dated campaign spend and attributed sales", async () => {
    const result = await parseAdsPerformanceFile(csv([
      "Date,Campaign Name,SKU,Spend,Attributed Sales,Orders,Clicks,Impressions",
      "01/09/2026,Campaign A,SKU-1,100,500,4,20,1000",
      "02/09/2026,Campaign A,SKU-1,50,250,2,10,500",
    ].join("\n")));
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(false);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ campaignName: "Campaign A", sku: "SKU-1", spendPaise: 10_000, attributedSalesPaise: 50_000, attributedOrders: 4 });
  });

  it("keeps spend rows but marks missing attributed sales as incomplete", async () => {
    const result = await parseAdsPerformanceFile(csv("Date,Campaign,Spend\n01/09/2026,Campaign A,100\n"));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].attributedSalesPaise).toBeUndefined();
    expect(result.issues.some((issue) => issue.severity === "warning" && issue.message.includes("attributed sales"))).toBe(true);
  });

  it("fails closed when Date + Campaign + Spend cannot be identified", async () => {
    const result = await parseAdsPerformanceFile(csv("Something,Else\nA,B\n"));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(true);
  });
});
