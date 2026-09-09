export type BlogPostStatus = "draft" | "published";
export type BlogContentType = "blog" | "article" | "news";

export type BlogVideo = {
  enabled: boolean;
  title: string;
  description: string;
  thumbnailUrl: string;
  embedUrl: string;
  contentUrl: string;
  durationSeconds: number | null;
  uploadDate: string | null;
};

export type BlogLocaleAlternate = { locale: string; url: string };

export type BlogLocaleMetadata = Partial<Record<"hi" | "en", {title:string;subtitle:string;seoTitle:string;seoDescription:string}>>;

export type BlogPostRecord = {
  localeMetadata?: BlogLocaleMetadata;
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  category: string;
  tags: string[];
  keywords: string[];
  imageKey: string | null;
  imageUrl: string | null;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
  imageCaption: string;
  imageCredit: string;
  htmlContent: string;
  htmlContentEn: string;
  status: BlogPostStatus;
  featured: boolean;
  contentType: BlogContentType;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  indexable: boolean;
  follow: boolean;
  discoverEnabled: boolean;
  newsEnabled: boolean;
  preferredSourceCta: boolean;
  authorName: string;
  authorUrl: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUrls: string[];
  relatedSlugs: string[];
  localeAlternates: BlogLocaleAlternate[];
  video: BlogVideo;
  readTime: string;
};

export type BlogPostInput = {
  localeMetadata?: BlogLocaleMetadata;
  id?: string;
  slug?: string;
  title: string;
  subtitle: string;
  tag: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  imageKey?: string | null;
  imageAlt?: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageCaption?: string;
  imageCredit?: string;
  htmlContent: string;
  htmlContentEn?: string;
  status: BlogPostStatus;
  featured: boolean;
  contentType?: BlogContentType;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  indexable?: boolean;
  follow?: boolean;
  discoverEnabled?: boolean;
  newsEnabled?: boolean;
  preferredSourceCta?: boolean;
  authorName?: string;
  authorUrl?: string;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  sourceUrls?: string[];
  relatedSlugs?: string[];
  localeAlternates?: BlogLocaleAlternate[];
  video?: Partial<BlogVideo>;
};

export const EMPTY_BLOG_VIDEO: BlogVideo = {
  enabled: false,
  title: "",
  description: "",
  thumbnailUrl: "",
  embedUrl: "",
  contentUrl: "",
  durationSeconds: null,
  uploadDate: null,
};

export function blogImageUrl(imageKey: string | null | undefined): string | null {
  if (!imageKey) return null;
  return `/api/blog/media/${encodeURIComponent(imageKey)}`;
}

export function slugifyBlogTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "post";
}

export function stripBlogHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateBlogReadTime(html: string): string {
  const words = stripBlogHtml(html).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

export function normalizeStringList(values: unknown, max = 30): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const clean = value.trim().slice(0, 180);
    if (clean) unique.add(clean);
    if (unique.size >= max) break;
  }
  return [...unique];
}

export function parseJsonStringList(value: string | null | undefined): string[] {
  if (!value) return [];
  try { return normalizeStringList(JSON.parse(value)); } catch { return []; }
}

export function parseLocaleAlternates(value: string | null | undefined): BlogLocaleAlternate[] {
  if (!value) return [];
  try {
    const raw = JSON.parse(value);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const locale = String((item as { locale?: unknown }).locale ?? "").trim().slice(0, 15);
      const url = String((item as { url?: unknown }).url ?? "").trim().slice(0, 500);
      return locale && url ? [{ locale, url }] : [];
    }).slice(0, 12);
  } catch { return []; }
}

const BLOG_ALLOWED_TAGS = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "blockquote", "code", "pre", "a", "br", "hr"]);
const BLOG_VOID_TAGS = new Set(["br", "hr"]);

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, code: string) => {
      const numeric = code.toLowerCase().startsWith("x") ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : "";
    })
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&amp;/gi, "&");
}

function safeBlogHref(raw: string | undefined): string | null {
  if (!raw) return null;
  const decoded = decodeBasicHtmlEntities(raw).replace(/[\u0000-\u001f\u007f\s]+/g, "").trim();
  if (!decoded) return null;
  if (decoded.startsWith("/") && !decoded.startsWith("//")) return raw.trim();
  if (/^https?:\/\//i.test(decoded)) return raw.trim();
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(decoded)) return raw.trim();
  return null;
}

function htmlAttr(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeBlogHtml(input: string): string {
  let html = input.replace(/\u0000/g, "");
  html = html.replace(/<(script|style|iframe|object|embed|form|template|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<!--([\s\S]*?)-->/g, "");

  let output = "";
  let cursor = 0;
  const tagPattern = /<\/?([a-zA-Z0-9]+)([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    output += html.slice(cursor, match.index);
    cursor = tagPattern.lastIndex;
    let tag = match[1].toLowerCase();
    const closing = /^<\//.test(match[0]);
    if (tag === "b") tag = "strong";
    if (tag === "i") tag = "em";
    if (!BLOG_ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      if (!BLOG_VOID_TAGS.has(tag)) output += `</${tag}>`;
      continue;
    }
    if (tag === "a") {
      const href = safeBlogHref(htmlAttr(match[2], "href"));
      const title = htmlAttr(match[2], "title")?.slice(0, 200);
      output += `<a${href ? ` href="${escapeHtmlAttribute(href)}"` : ""}${title ? ` title="${escapeHtmlAttribute(title)}"` : ""} rel="nofollow noopener noreferrer">`;
      continue;
    }
    output += `<${tag}>`;
  }
  output += html.slice(cursor);
  output = output.replace(/<(?!\/?(?:p|h2|h3|h4|ul|ol|li|strong|em|blockquote|code|pre|a|br|hr)(?:\s|>|\/))/gi, "&lt;");
  return output.trim();
}
