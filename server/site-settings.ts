import { DEFAULT_SITE_SETTINGS, parseSiteSettings, type SiteSettings } from "@/core/site-settings";
import { getD1 } from "./runtime";

const PUBLIC_SETTINGS_ID = "public";

export async function getPublicSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await getD1().prepare(
      "SELECT config_json AS configJson FROM site_settings WHERE id = ?1",
    ).bind(PUBLIC_SETTINGS_ID).first<{ configJson: string }>();
    if (!row) return DEFAULT_SITE_SETTINGS;
    return parseSiteSettings(JSON.parse(row.configJson));
  } catch {
    // A fresh deployment can safely use defaults until its newest migration runs.
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function savePublicSiteSettings(settings: SiteSettings, userId: string): Promise<string> {
  const updatedAt = new Date().toISOString();
  await getD1().prepare(
    `INSERT INTO site_settings (id, config_json, updated_by, updated_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  ).bind(PUBLIC_SETTINGS_ID, JSON.stringify(settings), userId, updatedAt).run();
  return updatedAt;
}

