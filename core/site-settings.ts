import { z } from "zod";

const optionalEmail = z.union([z.literal(""), z.string().email().max(254)]);
const optionalPhone = z.union([
  z.literal(""),
  z.string().trim().min(7).max(24).regex(/^\+?[0-9 ()-]+$/, "Use a valid phone number."),
]);
const optionalInstagram = z.union([
  z.literal(""),
  z.string().trim().max(31).regex(/^@?[a-zA-Z0-9._]+$/, "Use only an Instagram handle."),
]);

export const socialPlatforms = ["instagram", "telegram", "youtube", "facebook", "linkedin", "x", "website", "other"] as const;
export type SocialPlatform = typeof socialPlatforms[number];

const socialLinkSchema = z.object({
  platform: z.enum(socialPlatforms),
  label: z.string().trim().max(60).default(""),
  value: z.string().trim().max(220),
}).strict();

export const siteSettingsSchema = z.object({
  version: z.literal(1),
  hero: z.object({
    headlineEnglish: z.string().trim().min(12).max(120),
    headlineHinglish: z.string().trim().min(12).max(140),
    descriptionEnglish: z.string().trim().min(20).max(280),
    descriptionHinglish: z.string().trim().min(20).max(320),
  }).strict(),
  footer: z.object({
    descriptionEnglish: z.string().trim().min(20).max(240),
    descriptionHinglish: z.string().trim().min(20).max(280),
    affiliationDisclaimer: z.string().trim().min(20).max(240),
  }).strict(),
  contact: z.object({
    supportEmail: optionalEmail,
    phoneNumber: optionalPhone,
    whatsappNumber: optionalPhone,
    instagramHandle: optionalInstagram,
    socialLinks: z.array(socialLinkSchema).max(12).default([]),
  }).strict(),
  navigation: z.object({
    showCalculators: z.boolean(),
    showPricing: z.boolean(),
    showHowToUse: z.boolean(),
  }),
}).strict();

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type SocialLink = SiteSettings["contact"]["socialLinks"][number];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  version: 1,
  hero: {
    headlineEnglish: "Know how much money you actually keep.",
    headlineHinglish: "देखो, आपके पास असल में कितना पैसा बचता है।",
    descriptionEnglish: "Upload your Payments to Date file.\nAdd product cost.\nSee profit, loss and the next action.",
    descriptionHinglish: "Payments to Date file upload करो।\nProduct cost add करो।\nProfit, loss और next action देखो।",
  },
  footer: {
    descriptionEnglish: "See real margin, not just sales. Privacy-first decision support for marketplace sellers.",
    descriptionHinglish: "सिर्फ sales नहीं, real margin देखो। Marketplace sellers के लिए privacy-first decision support।",
    affiliationDisclaimer: "Independent seller analytics utility. Not affiliated with or endorsed by any marketplace or commerce platform.",
  },
  contact: {
    supportEmail: "",
    phoneNumber: "",
    whatsappNumber: "",
    instagramHandle: "",
    socialLinks: [],
  },
  navigation: {
    showCalculators: true,
    showPricing: true,
    showHowToUse: true,
  },
};

export function parseSiteSettings(value: unknown): SiteSettings {
  const parsed = siteSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SITE_SETTINGS;
}

export function socialHref(platform: SocialPlatform, value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^\/+/, "");
  switch (platform) {
    case "instagram": return `https://instagram.com/${handle}`;
    case "telegram": return `https://t.me/${handle}`;
    case "youtube": return raw.startsWith("@") ? `https://youtube.com/${raw}` : `https://youtube.com/@${handle}`;
    case "facebook": return `https://facebook.com/${handle}`;
    case "linkedin": return `https://linkedin.com/${handle}`;
    case "x": return `https://x.com/${handle}`;
    case "website": return `https://${handle}`;
    case "other": return `https://${handle}`;
    default: return "";
  }
}

export function socialLabel(platform: SocialPlatform, value: string, customLabel = "") {
  if (customLabel.trim()) return customLabel.trim();
  const names: Record<SocialPlatform, string> = {
    instagram: "Instagram",
    telegram: "Telegram",
    youtube: "YouTube",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    x: "X",
    website: "Website",
    other: "Link",
  };
  const raw = value.trim();
  if (["instagram", "telegram", "x"].includes(platform) && raw && !/^https?:\/\//i.test(raw)) return `@${raw.replace(/^@/, "")}`;
  return names[platform];
}
