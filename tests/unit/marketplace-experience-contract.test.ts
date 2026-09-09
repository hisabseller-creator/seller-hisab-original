import { describe, expect, it } from "vitest";
import { allSeoPages } from "@/core/all-seo-pages";
import { marketplaceCalculatorGroups } from "@/core/marketplace-calculators";
import { guidePages, marketplaceHubs } from "@/core/marketplace-content";
import { MARKETPLACE_DEFINITIONS, PRIMARY_MARKETPLACE_IDS } from "@/core/marketplace-definitions";

describe("marketplace full experience contract", () => {
  it("keeps one honest capability definition for all five primary platforms", () => {
    expect(PRIMARY_MARKETPLACE_IDS).toEqual(["meesho", "amazon", "flipkart", "shopify", "woocommerce"]);
    expect(MARKETPLACE_DEFINITIONS.meesho.fileAnalysis.state).toBe("live");
    expect(MARKETPLACE_DEFINITIONS.meesho.connection.state).toBe("not-available");

    for (const id of ["amazon", "flipkart", "shopify"] as const) {
      expect(MARKETPLACE_DEFINITIONS[id].fileAnalysis.state).toBe("live");
      expect(MARKETPLACE_DEFINITIONS[id].connection.state).toBe("activation-required");
    }

    expect(MARKETPLACE_DEFINITIONS.woocommerce.fileAnalysis.state).toBe("not-available");
    expect(MARKETPLACE_DEFINITIONS.woocommerce.connection.state).toBe("available");
  });

  it("gives every primary platform a hub, dedicated guide and five calculators", () => {
    expect(Object.keys(marketplaceHubs).sort()).toEqual([...PRIMARY_MARKETPLACE_IDS].sort());
    expect(marketplaceCalculatorGroups).toHaveLength(5);

    for (const id of PRIMARY_MARKETPLACE_IDS) {
      const definition = MARKETPLACE_DEFINITIONS[id];
      expect(marketplaceHubs[id]).toBeTruthy();
      expect(guidePages[definition.guideSlug]).toBeTruthy();
      expect(definition.guides.state).toBe("live");
      expect(definition.calculators.state).toBe("live");
      expect(definition.calculatorSlugs).toHaveLength(5);
      const group = marketplaceCalculatorGroups.find((item) => item.marketplaceId === id);
      expect(group?.calculators).toHaveLength(5);
      for (const slug of definition.calculatorSlugs) expect(allSeoPages[slug]).toBeTruthy();
    }
  });

  it("does not turn WooCommerce order data into a fake settlement claim", () => {
    const config = allSeoPages["woocommerce-profit-calculator"];
    expect(config).toBeTruthy();
    expect(config.directAnswer).toContain("WooCommerce order totals alone do not prove settlement");
    expect(MARKETPLACE_DEFINITIONS.woocommerce.fileAnalysis.label).toContain("not claimed");
  });

  it("keeps activation-dependent marketplace APIs distinct from a connected account", () => {
    expect(MARKETPLACE_DEFINITIONS.amazon.connection.detail).toContain("seller authorization");
    expect(MARKETPLACE_DEFINITIONS.flipkart.connection.detail).toContain("seller authorization");
    expect(MARKETPLACE_DEFINITIONS.shopify.connection.detail).toContain("merchant authorization");
  });
});
