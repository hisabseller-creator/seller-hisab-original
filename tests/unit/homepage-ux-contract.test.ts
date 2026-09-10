import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SITE_SETTINGS, parseSiteSettings, socialHref } from "@/core/site-settings";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("homepage UX refresh", () => {
  it("moves marketplace brands into the hero and removes the duplicate standalone strip", () => {
    const landing = source("components/website-landing.tsx");
    expect(landing).toContain("hero-marketplace-card");
    expect(landing).toContain("MarketplaceBrandRow");
    expect(landing).not.toContain('<section className="website-market-strip');
  });

  it("shows all four public commercial choices on the homepage", () => {
    const landing = source("components/website-landing.tsx");
    expect(landing).toContain("Free Check");
    expect(landing).toContain("Action Report");
    expect(landing).toContain("starterMonthlyPaise");
    expect(landing).toContain("proMonthlyPaise");
    expect(landing).toContain("/app/billing?plan=starter");
    expect(landing).toContain("/app/billing?plan=pro");
  });

  it("uses horizontal navigation tabs on phone and tablet instead of the hamburger gate", () => {
    const header = source("components/website-header.tsx");
    expect(header).toContain("website-mobile-tabs");
    expect(header).not.toContain("website-menu-toggle");
  });

  it("supports admin-managed social links while remaining compatible with old saved settings", () => {
    const legacy = structuredClone(DEFAULT_SITE_SETTINGS) as unknown as { contact: { socialLinks?: unknown } };
    delete legacy.contact.socialLinks;
    const parsed = parseSiteSettings(legacy);
    expect(parsed.contact.socialLinks).toEqual([]);
    expect(socialHref("telegram", "@sellerhisab")).toBe("https://t.me/sellerhisab");
    expect(socialHref("youtube", "@sellerhisab")).toBe("https://youtube.com/@sellerhisab");
  });

  it("uses real social-brand icon components in the footer", () => {
    const footer = source("components/site-footer.tsx");
    const icons = source("components/social-brand-icon.tsx");
    expect(footer).toContain("SocialBrandIcon");
    expect(footer).toContain("footer-brand-card");
    expect(icons).toContain('case "instagram"');
    expect(icons).toContain('case "telegram"');
    expect(icons).toContain('case "youtube"');
    expect(icons).toContain('case "whatsapp"');
  });
});
