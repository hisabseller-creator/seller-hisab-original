import {availableBlogLocales,localeBlogPath,blogLanguageAlternates} from "@/core/blog-locales";
import {getPublicSeoSettings} from "@/server/seo-settings";
import type { MetadataRoute } from "next";
import { allSeoPages } from "@/core/all-seo-pages";
import { guidePages, marketplaceHubs } from "@/core/marketplace-content";
import { PUBLIC_STATIC_PATHS, absoluteUrl } from "@/core/seo";
import { getPublishedIndexableBlogPosts, getPublishedVideoPosts, getPublishedNewsPosts } from "@/server/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo=await getPublicSeoSettings();
  const [posts, videos] = await Promise.all([getPublishedIndexableBlogPosts(), getPublishedVideoPosts()]);

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_PATHS.filter(path=>path!=="/news"&&path!=="/videos").map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === "" || path === "/blog" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/analyze" || path === "/calculators" ? 0.9 : 0.7,
  }));

  const calculatorEntries: MetadataRoute.Sitemap = Object.keys(allSeoPages).map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  const marketplaceEntries: MetadataRoute.Sitemap = Object.keys(marketplaceHubs).map((slug) => ({
    url: absoluteUrl(`/marketplaces/${slug}`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const guideEntries: MetadataRoute.Sitemap = Object.keys(guidePages).map((slug) => ({
    url: absoluteUrl(`/guides/${slug}`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const blogEntries: MetadataRoute.Sitemap = posts.flatMap<MetadataRoute.Sitemap[number]>((post) => {
    const locales=seo.future.localeUrlsEnabled?availableBlogLocales(post):[];
    if(locales.length)return locales.map(locale=>({url:absoluteUrl(localeBlogPath(post,locale)),lastModified:new Date(post.updatedAt),alternates:{languages:Object.fromEntries(Object.entries(blogLanguageAlternates(post)).map(([l,p])=>[l,absoluteUrl(p)]))}}));
    return [{
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt || post.publishedAt || post.createdAt),
    changeFrequency: post.contentType === "news" ? "daily" : "monthly",
    priority: post.featured ? 0.85 : 0.75,
    images: post.imageUrl ? [absoluteUrl(post.imageUrl)] : undefined,
  }]; });

  const videoEntries: MetadataRoute.Sitemap = videos.map((post) => ({
    url: absoluteUrl(`/videos/${post.slug}`),
    lastModified: new Date(post.updatedAt || post.publishedAt || post.createdAt),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const hubs: MetadataRoute.Sitemap = [
    ...((await getPublishedNewsPosts()).length>=3?[{ url: absoluteUrl("/news"), changeFrequency: "daily" as const, priority: 0.8 }]:[]),
    ...(videos.length>=3?[{ url: absoluteUrl("/videos"), changeFrequency: "weekly" as const, priority: 0.75 }]:[]),
  ];

  return [...staticEntries, ...calculatorEntries, ...marketplaceEntries, ...guideEntries, ...hubs, ...blogEntries, ...videoEntries];
}
