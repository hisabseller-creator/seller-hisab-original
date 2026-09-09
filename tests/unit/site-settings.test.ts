import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS, parseSiteSettings, siteSettingsSchema } from "@/core/site-settings";

describe("admin-managed public settings", () => {
  it("fails safely to defaults for an unknown configuration shape", () => {
    expect(parseSiteSettings({ hero: { headlineEnglish: "unsafe partial" } })).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it("accepts blank contacts so fake handles are never required", () => {
    expect(siteSettingsSchema.safeParse(DEFAULT_SITE_SETTINGS).success).toBe(true);
  });

  it("rejects a URL disguised as an Instagram handle", () => {
    const result = siteSettingsSchema.safeParse({
      ...DEFAULT_SITE_SETTINGS,
      contact: { ...DEFAULT_SITE_SETTINGS.contact, instagramHandle: "https://example.com" },
    });
    expect(result.success).toBe(false);
  });
});

