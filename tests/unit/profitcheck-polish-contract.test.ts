import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("profit check marketplace + intro polish", () => {
  it("shows only live Profit Check marketplaces with the supplied SVG logos", () => {
    const wizard = source("components/analyze-wizard.tsx");
    for (const asset of ["meesho.svg", "shopify.svg", "amazon.svg", "flipkart.svg"]) {
      expect(wizard).toContain(`/brands/marketplaces/${asset}`);
      expect(fs.existsSync(path.join(root, "public/brands/marketplaces", asset))).toBe(true);
    }
    expect(wizard).not.toContain('/brands/marketplaces/woocommerce.svg');
    expect(wizard.match(/File analysis live/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps marketplace cards clean without technical subtitles", () => {
    const wizard = source("components/analyze-wizard.tsx");
    expect(wizard).toContain('text-[9px]');
    expect(wizard).not.toContain("Payments, orders, returns/RTO and ads through validated seller files.");
    expect(wizard).not.toContain("Orders CSV + Shopify Payments balance-transactions CSV give source-backed profit analysis.");
    expect(wizard).not.toContain("Orders export + Settlement Flat File V2 are supported locally");
    expect(wizard).not.toContain("settlement/P&L export are supported with deterministic order linking");
  });

  it("explains Profit Check in plain language and removes schema jargon", () => {
    const wizard = source("components/analyze-wizard.tsx");
    expect(wizard).toContain("Upload your marketplace payment or settlement report.");
    expect(wizard).toContain("how much profit and margin you actually kept.");
    expect(wizard).toContain("कितना profit/margin बचा");
    expect(wizard).not.toContain("fails closed on unknown schemas");
    expect(wizard).not.toContain("unknown schema पर SellerHisab guess नहीं करेगा");
  });
});
