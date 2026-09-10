import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("profit check marketplace-first experience", () => {
  it("lets the seller explicitly choose every supported marketplace entry point", () => {
    const wizard = source("components/analyze-wizard.tsx");
    for (const asset of ["meesho.svg", "shopify.svg", "amazon.svg", "flipkart.svg", "woocommerce.svg"]) {
      expect(wizard).toContain(`/brands/marketplaces/${asset}`);
      expect(fs.existsSync(path.join(root, "public/brands/marketplaces", asset))).toBe(true);
    }
    expect(wizard).toContain('role="radiogroup"');
    expect(wizard).toContain("Choose where you sell");
    expect(wizard).toContain("आप कहाँ बेचते हैं?");
    expect(wizard).toContain("SellerHisab will not choose a marketplace for you.");
  });

  it("shows only capabilities that are honest for the chosen marketplace", () => {
    const wizard = source("components/analyze-wizard.tsx");
    expect(wizard).toContain('id: "meesho"');
    expect(wizard).toContain('fileAnalysis: true, apiConnection: false');
    expect(wizard).toContain('id: "amazon-in"');
    expect(wizard).toContain('id: "flipkart"');
    expect(wizard).toContain('id: "shopify"');
    expect(wizard.match(/fileAnalysis: true, apiConnection: true/g)?.length).toBeGreaterThanOrEqual(3);
    expect(wizard).toContain('id: "woocommerce"');
    expect(wizard).toContain('fileAnalysis: false, apiConnection: true');
    expect(wizard).toContain("Automatic connect — Pro");
    expect(wizard).toContain("File analysis is not shown because it is not live yet.");
  });

  it("keeps the normal path simple and hides fallback inputs until needed", () => {
    const wizard = source("components/analyze-wizard.tsx");
    expect(wizard).toContain("Choose all the reports you have");
    expect(wizard).toContain("जो reports हैं, सब एक साथ चुनें");
    expect(wizard).toContain("Costs are reused automatically");
    expect(wizard).toContain("पुरानी costs अपने-आप use होंगी");
    expect(wizard).toContain("Only if a report is missing — add optional numbers");
    expect(wizard).toContain("सिर्फ report missing हो तो — optional numbers भरें");
    expect(wizard).toContain("मेरा हिसाब दिखाओ");
    expect(wizard).not.toContain("fails closed on unknown schemas");
    expect(wizard).not.toContain("unknown schema पर SellerHisab guess नहीं करेगा");
  });

  it("unlocks Action Report and paid-plan capabilities for explicit admins", () => {
    const wizard = source("components/analyze-wizard.tsx");
    const planAccess = source("server/plan-access.ts");
    expect(wizard).toContain("initiallyUnlocked={Boolean(user?.isAdmin)}");
    expect(planAccess).toContain("isAdminEmail");
    expect(planAccess).toContain("isAdminPhone");
    expect(planAccess).toContain('if (isExplicitAdminSession(user)) return "pro";');
    expect(planAccess.match(/isExplicitAdminUserId\(userId\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
