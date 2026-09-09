import { z } from "zod";

const optionalUrl = z.union([z.literal(""), z.string().url().max(500), z.string().max(500).regex(/^\/(?!\/)[^\\\s]*$/)]);
const optionalToken = z.string().trim().max(250);
const localeCode = z.string().trim().min(2).max(15).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/, "Use a locale like en, en-IN or hi-IN.");

export const seoSettingsSchema = z.object({
  version: z.literal(1),
  identity: z.object({
    publicationName: z.string().trim().min(2).max(80),
    publisherName: z.string().trim().min(2).max(80),
    organizationDescription: z.string().trim().min(20).max(500),
    organizationLogoUrl: optionalUrl,
    defaultSocialImageUrl: optionalUrl,
    sameAs: z.array(z.string().url().max(500)).max(20),
  }).strict(),
  verification: z.object({
    googleSiteVerification: optionalToken,
    bingSiteVerification: optionalToken,
  }).strict(),
  crawlers: z.object({
    googlebot: z.boolean(),
    googleImage: z.boolean(),
    googleVideo: z.boolean(),
    bingbot: z.boolean(),
    oaiSearchbot: z.boolean(),
    gptbot: z.boolean(),
    googleExtended: z.boolean(),
  }).strict(),
  discovery: z.object({
    newsSitemapEnabled: z.boolean(),
    imageSitemapEnabled: z.boolean(),
    videoSitemapEnabled: z.boolean(),
    rssEnabled: z.boolean(),
    llmsTxtEnabled: z.boolean(),
    preferredSourcesEnabled: z.boolean(),
    preferredSourcesLabel: z.string().trim().min(3).max(80),
    discoverLargeImages: z.boolean(),
    newsLanguage: localeCode,
  }).strict(),
  indexNow: z.object({
    enabled: z.boolean(),
    submitOnPublish: z.boolean(),
    submitOnUpdate: z.boolean(),
    submitOnDelete: z.boolean(),
  }).strict(),
  future: z.object({
    defaultLocale: localeCode,
    availableLocales: z.array(localeCode).min(1).max(12),
    aiReadableFeeds: z.boolean(),
    hreflangReady: z.boolean(),
    localeUrlsEnabled: z.boolean().default(false),
  }).strict(),
}).strict();

export type SeoSettings = z.infer<typeof seoSettingsSchema>;

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  version: 1,
  identity: {
    publicationName: "SellerHisab",
    publisherName: "SellerHisab",
    organizationDescription: "SellerHisab is an independent tool for Indian online sellers. It helps sellers understand how much they actually earn after product cost, marketplace charges, returns or RTO, ads and settlements, using supported marketplace reports.",
    organizationLogoUrl: "/sellerhisab-mark-512.png",
    defaultSocialImageUrl: "/og.svg",
    sameAs: [],
  },
  verification: {
    googleSiteVerification: "",
    bingSiteVerification: "",
  },
  crawlers: {
    googlebot: true,
    googleImage: true,
    googleVideo: true,
    bingbot: true,
    oaiSearchbot: true,
    gptbot: false,
    googleExtended: true,
  },
  discovery: {
    newsSitemapEnabled: true,
    imageSitemapEnabled: true,
    videoSitemapEnabled: true,
    rssEnabled: true,
    llmsTxtEnabled: true,
    preferredSourcesEnabled: true,
    preferredSourcesLabel: "Add SellerHisab as a preferred source",
    discoverLargeImages: true,
    newsLanguage: "en",
  },
  indexNow: {
    enabled: true,
    submitOnPublish: true,
    submitOnUpdate: true,
    submitOnDelete: true,
  },
  future: {
    defaultLocale: "en-IN",
    availableLocales: ["en-IN"],
    aiReadableFeeds: true,
    hreflangReady: true,
    localeUrlsEnabled: false,
  },
};

export function parseSeoSettings(value: unknown): SeoSettings {
  const parsed = seoSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SEO_SETTINGS;
}
