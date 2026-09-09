import { describe, expect, it } from "vitest";
import { buildFeatureTabs } from "@/core/navigation";
import { DEFAULT_SITE_SETTINGS } from "@/core/site-settings";

describe("public feature tabs", () => {
  it("shows every enabled real public route", () => {
    const ids = buildFeatureTabs({ loggedIn: false, hasPaidAccess: false, navigation: DEFAULT_SITE_SETTINGS.navigation }).map((tab) => tab.id);
    expect(ids).toEqual(["profit", "calculators", "blog", "pricing", "account", "help"]);
  });

  it("keeps the same real navigation after paid access", () => {
    const ids = buildFeatureTabs({ loggedIn: true, hasPaidAccess: true, navigation: DEFAULT_SITE_SETTINGS.navigation }).map((tab) => tab.id);
    expect(ids).toEqual(["profit", "calculators", "blog", "pricing", "account", "help"]);
  });

  it("keeps Profit Check, Blog and account access when optional tabs are disabled", () => {
    const ids = buildFeatureTabs({ loggedIn: false, hasPaidAccess: false, navigation: { showCalculators: false, showPricing: false, showHowToUse: false } }).map((tab) => tab.id);
    expect(ids).toEqual(["profit", "blog", "account"]);
  });
});
