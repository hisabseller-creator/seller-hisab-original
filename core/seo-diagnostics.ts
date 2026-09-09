import { stripBlogHtml, type BlogPostInput } from "./blog-cms";

export type SeoDiagnostic = {
  level: "pass" | "warning" | "error";
  code: string;
  message: string;
};

export function auditBlogSeo(input: BlogPostInput): { score: number; diagnostics: SeoDiagnostic[] } {
  const diagnostics: SeoDiagnostic[] = [];
  const title = (input.seoTitle || input.title).trim();
  const description = (input.seoDescription || input.subtitle).trim();
  const text = stripBlogHtml(input.htmlContent);
  const words = text.split(/\s+/).filter(Boolean).length;

  diagnostics.push(title.length >= 25 && title.length <= 70
    ? pass("title", "SEO title length is healthy.")
    : warning("title", "Keep the SEO title roughly 25–70 characters and make the main intent obvious."));

  diagnostics.push(description.length >= 70 && description.length <= 180
    ? pass("description", "Meta description length is healthy.")
    : warning("description", "Use a clear meta description around 70–180 characters."));

  diagnostics.push(words >= 350
    ? pass("depth", "Article has enough text for a substantial page.")
    : warning("depth", "Thin pages are harder to earn durable search visibility. Add original useful detail."));

  diagnostics.push(/<h2\b/i.test(input.htmlContent)
    ? pass("headings", "Article includes H2 structure.")
    : warning("headings", "Add descriptive H2 sections for readers and search systems."));

  if (input.discoverEnabled) {
    diagnostics.push(input.imageKey && input.imageAlt?.trim()
      ? pass("discover-image", "Discover hero image and alt text are present.")
      : error("discover-image", "Discover-enabled posts need a 1200px+ hero image and useful alt text."));
  }

  if (input.contentType === "news") {
    diagnostics.push(input.authorName?.trim()
      ? pass("news-author", "News author is set.")
      : error("news-author", "News posts need a visible author."));
    diagnostics.push(input.newsEnabled
      ? pass("news-surface", "News sitemap eligibility is enabled.")
      : warning("news-surface", "This news post is excluded from the news sitemap."));
  }

  if (input.video?.enabled) {
    const complete = Boolean(input.video.title?.trim() && input.video.description?.trim() && input.video.thumbnailUrl?.trim() && (input.video.embedUrl?.trim() || input.video.contentUrl?.trim()));
    diagnostics.push(complete
      ? pass("video", "VideoObject/watch-page fields are complete.")
      : error("video", "Video SEO needs title, description, thumbnail and an embed or content URL."));
  }

  if (!input.indexable) diagnostics.push(warning("noindex", "This post is intentionally noindex and will be excluded from search sitemaps."));
  if (!input.sourceUrls?.length) diagnostics.push(warning("sources", "Add primary/official sources when the article depends on external facts."));

  const penalties = diagnostics.reduce((sum, item) => sum + (item.level === "error" ? 20 : item.level === "warning" ? 6 : 0), 0);
  return { score: Math.max(0, 100 - penalties), diagnostics };
}

function pass(code: string, message: string): SeoDiagnostic { return { level: "pass", code, message }; }
function warning(code: string, message: string): SeoDiagnostic { return { level: "warning", code, message }; }
function error(code: string, message: string): SeoDiagnostic { return { level: "error", code, message }; }
