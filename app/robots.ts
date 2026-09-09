import type { MetadataRoute } from "next";
import { SITE_URL } from "@/core/site-url";
import { PRIVATE_SEARCH_PREFIXES } from "@/core/seo";
import { getPublicSeoSettings } from "@/server/seo-settings";

const disallow = [...PRIVATE_SEARCH_PREFIXES];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getPublicSeoSettings();
  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: "/", disallow },
    seo.crawlers.googlebot ? { userAgent: "Googlebot", allow: "/", disallow } : { userAgent: "Googlebot", disallow: "/" },
    seo.crawlers.googleImage ? { userAgent: "Googlebot-Image", allow: "/", disallow } : { userAgent: "Googlebot-Image", disallow: "/" },
    seo.crawlers.googleVideo ? { userAgent: "Googlebot-Video", allow: "/", disallow } : { userAgent: "Googlebot-Video", disallow: "/" },
    seo.crawlers.bingbot ? { userAgent: "bingbot", allow: "/", disallow } : { userAgent: "bingbot", disallow: "/" },
    seo.crawlers.oaiSearchbot ? { userAgent: "OAI-SearchBot", allow: "/", disallow } : { userAgent: "OAI-SearchBot", disallow: "/" },
    seo.crawlers.gptbot ? { userAgent: "GPTBot", allow: "/", disallow } : { userAgent: "GPTBot", disallow: "/" },
    seo.crawlers.googleExtended ? { userAgent: "Google-Extended", allow: "/", disallow } : { userAgent: "Google-Extended", disallow: "/" },
  ];

  const sitemap = [`${SITE_URL}/sitemap.xml`];
  if (seo.discovery.newsSitemapEnabled) sitemap.push(`${SITE_URL}/news-sitemap.xml`);
  if (seo.discovery.imageSitemapEnabled) sitemap.push(`${SITE_URL}/image-sitemap.xml`);
  if (seo.discovery.videoSitemapEnabled) sitemap.push(`${SITE_URL}/video-sitemap.xml`);

  return { rules, sitemap, host: SITE_URL };
}
