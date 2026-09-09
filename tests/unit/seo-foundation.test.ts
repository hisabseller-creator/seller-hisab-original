import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import { INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "@/core/indexnow";
import { absoluteUrl, BRAND_DESCRIPTION, isPrivateSearchPath, PUBLIC_STATIC_PATHS } from "@/core/seo";
import { guidePages, marketplaceHubs } from "@/core/seo-hubs";
import { seoPages } from "@/core/seo-pages";

// app/robots is intentionally backed by D1-managed SEO settings in production.
// Unit tests run in Node/Vitest, where the Cloudflare-only `cloudflare:workers`
// runtime module does not exist. Mock only the settings boundary so this test
// exercises robots policy generation without importing the Worker runtime.
vi.mock("@/server/seo-settings", async () => {
  const { DEFAULT_SEO_SETTINGS } = await import("@/core/seo-settings");
  return {
    getPublicSeoSettings: async () => DEFAULT_SEO_SETTINGS,
  };
});

describe("SEO foundation", () => {
  it("keeps private routes outside search surfaces", () => {
    expect(isPrivateSearchPath("/app")).toBe(true);
    expect(isPrivateSearchPath("/app/billing")).toBe(true);
    expect(isPrivateSearchPath("/admin")).toBe(true);
    expect(isPrivateSearchPath("/api/account/data")).toBe(true);
    expect(isPrivateSearchPath("/pricing")).toBe(false);
    expect(PUBLIC_STATIC_PATHS.some((path) => path.startsWith("/app"))).toBe(false);
  });

  it("explicitly allows OAI SearchBot on public content while disallowing private prefixes", async () => {
    const policy = await robots();
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    const oai = rules.find((rule) => rule.userAgent === "OAI-SearchBot");
    expect(oai).toBeTruthy();
    expect(oai?.allow).toBe("/");
    expect(oai?.disallow).toEqual(expect.arrayContaining(["/app", "/admin", "/api/account", "/api/auth", "/api/payments"]));
    expect(oai?.disallow).not.toContain("/api/blog/media");
    expect(Array.isArray(policy.sitemap) ? policy.sitemap : [policy.sitemap]).toContain("https://sellerhisab.com/sitemap.xml");
  });

  it("gives every calculator answer-first content and internal links", () => {
    for (const page of Object.values(seoPages)) {
      expect(page.directAnswer.length).toBeGreaterThan(60);
      expect(page.formula.length).toBeGreaterThan(15);
      expect(page.example.length).toBeGreaterThan(30);
      expect(page.faqs.length).toBeGreaterThanOrEqual(3);
      expect(page.related.length).toBeGreaterThanOrEqual(3);
      expect(page.related.every((item) => item.href.startsWith("/"))).toBe(true);
    }
  });

  it("ships focused marketplace and seller-finance topic hubs", () => {
    expect(Object.keys(marketplaceHubs).sort()).toEqual(["amazon", "flipkart", "meesho"]);
    expect(Object.keys(guidePages)).toEqual(expect.arrayContaining([
      "contribution-margin",
      "settlement-reconciliation",
      "rto-impact",
      "break-even-price",
      "sku-profitability",
    ]));
  });

  it("keeps the SellerHisab brand definition simple and seller-friendly", () => {
    expect(BRAND_DESCRIPTION).toContain("online sellers");
    expect(BRAND_DESCRIPTION).toContain("actually earn");
    expect(BRAND_DESCRIPTION).toContain("returns or RTO");
    expect(BRAND_DESCRIPTION).not.toContain("decision intelligence platform");
  });

  it("has a valid public IndexNow key location", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    expect(INDEXNOW_KEY_LOCATION).toBe(absoluteUrl(`/${INDEXNOW_KEY}.txt`));
  });
});
