import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditBlogSeo } from "@/core/seo-diagnostics";
import { DEFAULT_SEO_SETTINGS, parseSeoSettings } from "@/core/seo-settings";

const root = process.cwd();
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8");

describe("F13 all-surface SEO", () => {
  it("keeps public search crawlers and distribution surfaces admin-managed", () => {
    const settings = parseSeoSettings(DEFAULT_SEO_SETTINGS);
    expect(settings.crawlers.googlebot).toBe(true);
    expect(settings.crawlers.googleImage).toBe(true);
    expect(settings.crawlers.googleVideo).toBe(true);
    expect(settings.crawlers.bingbot).toBe(true);
    expect(settings.crawlers.oaiSearchbot).toBe(true);
    expect(settings.discovery.newsSitemapEnabled).toBe(true);
    expect(settings.discovery.imageSitemapEnabled).toBe(true);
    expect(settings.discovery.videoSitemapEnabled).toBe(true);
    expect(settings.discovery.preferredSourcesEnabled).toBe(true);
  });

  it("requires Discover image and complete video metadata before publishing", () => {
    const result = auditBlogSeo({
      title: "Meesho settlement update and seller margin impact",
      subtitle: "A practical explanation of the latest settlement change and what sellers should review in their margins.",
      tag: "Settlements",
      htmlContent: "<h2>What changed?</h2><p>" + "useful seller detail ".repeat(400) + "</p>",
      status: "published",
      featured: false,
      contentType: "news",
      discoverEnabled: true,
      newsEnabled: true,
      indexable: true,
      authorName: "SellerHisab Research Team",
      sourceUrls: ["https://example.com/source"],
      video: { enabled: true, title: "Update", description: "Video explanation", thumbnailUrl: "", embedUrl: "", contentUrl: "" },
    });
    expect(result.diagnostics.some((item) => item.code === "discover-image" && item.level === "error")).toBe(true);
    expect(result.diagnostics.some((item) => item.code === "video" && item.level === "error")).toBe(true);
  });

  it("ships dedicated News, Image, Video, RSS, llms and watch-page routes", () => {
    expect(source("app/news-sitemap.xml/route.ts")).toContain("48 * 60 * 60 * 1000");
    expect(source("app/image-sitemap.xml/route.ts")).toContain("sitemap-image/1.1");
    expect(source("app/video-sitemap.xml/route.ts")).toContain("sitemap-video/1.1");
    expect(source("app/feed.xml/route.ts")).toContain("application/rss+xml");
    expect(source("app/llms.txt/route.ts")).toContain("experimental publisher aid");
    expect(source("app/videos/[slug]/page.tsx")).toContain('"@type": "VideoObject"');
  });

  it("uses supported article types and avoids deprecated FAQ rich-result markup", () => {
    const blogPage = source("app/blog/[slug]/page.tsx");
    expect(blogPage).toContain('"NewsArticle"');
    expect(blogPage).toContain('"Article"');
    expect(blogPage).toContain('"BlogPosting"');
    expect(blogPage).not.toContain('"FAQPage"');
  });

  it("protects historic URLs with automatic and admin-managed redirects", () => {
    const blog = source("server/blog.ts");
    const redirects = source("app/api/admin/seo-redirects/route.ts");
    expect(blog).toContain("seo_redirects");
    expect(blog).toContain("previous.slug !== slug");
    expect(redirects).toContain("requestHasSameOrigin");
    expect(redirects).toContain("isPrivateSearchPath");
  });
});
