import {
  EMPTY_BLOG_VIDEO,
  blogImageUrl,
  calculateBlogReadTime,
  parseJsonStringList,
  parseLocaleAlternates,
  sanitizeBlogHtml,
  slugifyBlogTitle,
  type BlogContentType,
  type BlogPostInput,
  type BlogPostRecord,
  type BlogPostStatus,
} from "@/core/blog-cms";
import { getD1 } from "./runtime";
import { deleteBlogMedia } from "./blog-media";

export type BlogDbRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  category: string | null;
  tagsJson: string | null;
  keywordsJson: string | null;
  imageKey: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageCaption: string | null;
  imageCredit: string | null;
  htmlContent: string;
  htmlContentEn: string | null;
  localeMetadataJson: string | null;
  status: BlogPostStatus;
  featured: number;
  contentType: BlogContentType | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  indexable: number | null;
  follow: number | null;
  discoverEnabled: number | null;
  newsEnabled: number | null;
  preferredSourceCta: number | null;
  authorName: string | null;
  authorUrl: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUrlsJson: string | null;
  relatedSlugsJson: string | null;
  localeAlternatesJson: string | null;
  videoEnabled: number | null;
  videoTitle: string | null;
  videoDescription: string | null;
  videoThumbnailUrl: string | null;
  videoEmbedUrl: string | null;
  videoContentUrl: string | null;
  videoDurationSeconds: number | null;
  videoUploadDate: string | null;
};

const BLOG_SELECT = `
  id, slug, title, subtitle, tag,
  category,
  tags_json AS tagsJson,
  keywords_json AS keywordsJson,
  image_key AS imageKey,
  image_alt AS imageAlt,
  image_width AS imageWidth,
  image_height AS imageHeight,
  image_caption AS imageCaption,
  image_credit AS imageCredit,
  html_content AS htmlContent,
  html_content_en AS htmlContentEn,
  locale_metadata_json AS localeMetadataJson,
  status, featured,
  content_type AS contentType,
  seo_title AS seoTitle,
  seo_description AS seoDescription,
  canonical_url AS canonicalUrl,
  indexable,
  follow_links AS follow,
  discover_enabled AS discoverEnabled,
  news_enabled AS newsEnabled,
  preferred_source_cta AS preferredSourceCta,
  author_name AS authorName,
  author_url AS authorUrl,
  reviewed_at AS reviewedAt,
  published_at AS publishedAt,
  created_at AS createdAt,
  updated_at AS updatedAt,
  source_urls_json AS sourceUrlsJson,
  related_slugs_json AS relatedSlugsJson,
  locale_alternates_json AS localeAlternatesJson,
  video_enabled AS videoEnabled,
  video_title AS videoTitle,
  video_description AS videoDescription,
  video_thumbnail_url AS videoThumbnailUrl,
  video_embed_url AS videoEmbedUrl,
  video_content_url AS videoContentUrl,
  video_duration_seconds AS videoDurationSeconds,
  video_upload_date AS videoUploadDate`;

function rowToPost(row: BlogDbRow): BlogPostRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    tag: row.tag,
    category: row.category?.trim() || row.tag,
    tags: parseJsonStringList(row.tagsJson),
    keywords: parseJsonStringList(row.keywordsJson),
    imageKey: row.imageKey,
    imageUrl: blogImageUrl(row.imageKey),
    imageAlt: row.imageAlt ?? row.title,
    imageWidth: row.imageWidth ?? null,
    imageHeight: row.imageHeight ?? null,
    imageCaption: row.imageCaption ?? "",
    imageCredit: row.imageCredit ?? "",
    htmlContent: row.htmlContent ?? "",
    htmlContentEn: row.htmlContentEn ?? "",
    localeMetadata: JSON.parse(row.localeMetadataJson || "{}"),
    status: row.status,
    featured: Boolean(row.featured),
    contentType: row.contentType === "article" || row.contentType === "news" ? row.contentType : "blog",
    seoTitle: row.seoTitle?.trim() || row.title,
    seoDescription: row.seoDescription?.trim() || row.subtitle,
    canonicalUrl: row.canonicalUrl?.trim() || "",
    indexable: row.indexable !== 0,
    follow: row.follow !== 0,
    discoverEnabled: row.discoverEnabled !== 0,
    newsEnabled: row.newsEnabled !== 0,
    preferredSourceCta: row.preferredSourceCta !== 0,
    authorName: row.authorName?.trim() || "SellerHisab Research Team",
    authorUrl: row.authorUrl?.trim() || "/authors/sellerhisab-research",
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sourceUrls: parseJsonStringList(row.sourceUrlsJson),
    relatedSlugs: parseJsonStringList(row.relatedSlugsJson),
    localeAlternates: parseLocaleAlternates(row.localeAlternatesJson),
    video: {
      ...EMPTY_BLOG_VIDEO,
      enabled: Boolean(row.videoEnabled),
      title: row.videoTitle ?? "",
      description: row.videoDescription ?? "",
      thumbnailUrl: row.videoThumbnailUrl ?? "",
      embedUrl: row.videoEmbedUrl ?? "",
      contentUrl: row.videoContentUrl ?? "",
      durationSeconds: row.videoDurationSeconds ?? null,
      uploadDate: row.videoUploadDate,
    },
    readTime: calculateBlogReadTime((row.htmlContent || row.htmlContentEn || "").trim()),
  };
}

export async function getPublishedBlogPosts(): Promise<BlogPostRecord[]> {
  try {
    const result = await getD1().prepare(
      `SELECT ${BLOG_SELECT}
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY featured DESC, published_at DESC, created_at DESC`,
    ).all<BlogDbRow>();
    return result.results.map(rowToPost);
  } catch {
    return [];
  }
}

export async function getPublishedIndexableBlogPosts(): Promise<BlogPostRecord[]> {
  return (await getPublishedBlogPosts()).filter((post) => post.indexable);
}

export async function getPublishedNewsPosts(): Promise<BlogPostRecord[]> {
  return (await getPublishedBlogPosts()).filter((post) => post.contentType === "news" && post.newsEnabled && post.indexable);
}

export async function getPublishedVideoPosts(): Promise<BlogPostRecord[]> {
  return (await getPublishedBlogPosts()).filter((post) => post.video.enabled && post.indexable);
}

export async function getPublishedBlogPost(slug: string): Promise<BlogPostRecord | null> {
  try {
    const row = await getD1().prepare(
      `SELECT ${BLOG_SELECT}
       FROM blog_posts WHERE slug = ?1 AND status = 'published' LIMIT 1`,
    ).bind(slug).first<BlogDbRow>();
    return row ? rowToPost(row) : null;
  } catch {
    return null;
  }
}

export async function getAdminBlogPosts(): Promise<BlogPostRecord[]> {
  const result = await getD1().prepare(
    `SELECT ${BLOG_SELECT}
     FROM blog_posts ORDER BY updated_at DESC`,
  ).all<BlogDbRow>();
  return result.results.map(rowToPost);
}

async function uniqueSlug(baseInput: string, existingId?: string): Promise<string> {
  const db = getD1();
  const base = slugifyBlogTitle(baseInput);
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const row = await db.prepare("SELECT id FROM blog_posts WHERE slug = ?1 LIMIT 1").bind(candidate).first<{ id: string }>();
    if (!row || row.id === existingId) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function safeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function json(values: string[] | undefined): string {
  return JSON.stringify([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 30));
}

export async function saveBlogPost(input: BlogPostInput, userId: string): Promise<BlogPostRecord> {
  const db = getD1();
  const now = new Date().toISOString();
  const id = input.id ?? `blog_${crypto.randomUUID()}`;
  const previous = input.id ? await db.prepare(
    "SELECT id, slug, image_key AS imageKey, published_at AS publishedAt, created_at AS createdAt FROM blog_posts WHERE id = ?1 LIMIT 1",
  ).bind(input.id).first<{ id: string; slug: string; imageKey: string | null; publishedAt: string | null; createdAt: string }>() : null;

  const requestedSlug = input.slug?.trim() || input.title;
  const slug = await uniqueSlug(requestedSlug, input.id);
  const providedPublishedAt = safeDate(input.publishedAt);
  const publishedAt = input.status === "published"
    ? (providedPublishedAt ?? previous?.publishedAt ?? now)
    : (previous?.publishedAt ?? providedPublishedAt ?? null);
  const createdAt = previous?.createdAt ?? now;
  const htmlContent = sanitizeBlogHtml(input.htmlContent ?? "");
  const htmlContentEn = sanitizeBlogHtml(input.htmlContentEn ?? "");
  if (!htmlContent.trim() && !htmlContentEn.trim()) {
    throw new Error("Add Hindi or English article HTML before saving.");
  }
  const imageKey = input.imageKey?.trim() || null;
  const imageAlt = input.imageAlt?.trim() || input.title.trim();
  const contentType: BlogContentType = input.contentType === "article" || input.contentType === "news" ? input.contentType : "blog";
  const video = {
    enabled: Boolean(input.video?.enabled),
    title: input.video?.title?.trim() || "",
    description: input.video?.description?.trim() || "",
    thumbnailUrl: input.video?.thumbnailUrl?.trim() || "",
    embedUrl: input.video?.embedUrl?.trim() || "",
    contentUrl: input.video?.contentUrl?.trim() || "",
    durationSeconds: input.video?.durationSeconds ?? null,
    uploadDate: input.video?.uploadDate ?? null,
  };

  const statements = [];
  if (input.featured && input.status === "published") {
    statements.push(db.prepare("UPDATE blog_posts SET featured = 0 WHERE featured = 1 AND id != ?1").bind(id));
  }

  if (previous?.slug && previous.slug !== slug) {
    statements.push(db.prepare(
      `INSERT INTO seo_redirects (id, from_path, to_path, status_code, active, created_at, updated_at, updated_by)
       VALUES (?1, ?2, ?3, 308, 1, ?4, ?4, ?5)
       ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path, status_code = 308, active = 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(`redir_${crypto.randomUUID()}`, `/blog/${previous.slug}`, `/blog/${slug}`, now, userId));
  }

  statements.push(db.prepare(
    `INSERT INTO blog_posts (
      id, slug, title, subtitle, tag, category, tags_json, keywords_json,
      image_key, image_alt, image_width, image_height, image_caption, image_credit,
      html_content, status, featured, content_type, seo_title, seo_description, canonical_url,
      indexable, follow_links, discover_enabled, news_enabled, preferred_source_cta,
      author_name, author_url, reviewed_at, published_at, created_at, updated_at, updated_by,
      source_urls_json, related_slugs_json, locale_alternates_json,
      video_enabled, video_title, video_description, video_thumbnail_url, video_embed_url,
      video_content_url, video_duration_seconds, video_upload_date,
      html_content_en, locale_metadata_json
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
      ?9, ?10, ?11, ?12, ?13, ?14,
      ?15, ?16, ?17, ?18, ?19, ?20, ?21,
      ?22, ?23, ?24, ?25, ?26,
      ?27, ?28, ?29, ?30, ?31, ?32, ?33,
      ?34, ?35, ?36,
      ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44,
      ?45, ?46
    )
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      subtitle = excluded.subtitle,
      tag = excluded.tag,
      category = excluded.category,
      tags_json = excluded.tags_json,
      keywords_json = excluded.keywords_json,
      image_key = excluded.image_key,
      image_alt = excluded.image_alt,
      image_width = excluded.image_width,
      image_height = excluded.image_height,
      image_caption = excluded.image_caption,
      image_credit = excluded.image_credit,
      html_content = excluded.html_content,
      status = excluded.status,
      featured = excluded.featured,
      content_type = excluded.content_type,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      canonical_url = excluded.canonical_url,
      indexable = excluded.indexable,
      follow_links = excluded.follow_links,
      discover_enabled = excluded.discover_enabled,
      news_enabled = excluded.news_enabled,
      preferred_source_cta = excluded.preferred_source_cta,
      author_name = excluded.author_name,
      author_url = excluded.author_url,
      reviewed_at = excluded.reviewed_at,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by,
      source_urls_json = excluded.source_urls_json,
      related_slugs_json = excluded.related_slugs_json,
      locale_alternates_json = excluded.locale_alternates_json,
      video_enabled = excluded.video_enabled,
      video_title = excluded.video_title,
      video_description = excluded.video_description,
      video_thumbnail_url = excluded.video_thumbnail_url,
      video_embed_url = excluded.video_embed_url,
      video_content_url = excluded.video_content_url,
      video_duration_seconds = excluded.video_duration_seconds,
      video_upload_date = excluded.video_upload_date,
      html_content_en = excluded.html_content_en,
      locale_metadata_json = excluded.locale_metadata_json`,
  ).bind(
    id,
    slug,
    input.title.trim(),
    input.subtitle.trim(),
    input.tag.trim(),
    input.category?.trim() || input.tag.trim(),
    json(input.tags),
    json(input.keywords),
    imageKey,
    imageAlt,
    input.imageWidth ?? null,
    input.imageHeight ?? null,
    input.imageCaption?.trim() || "",
    input.imageCredit?.trim() || "",
    htmlContent,
    input.status,
    input.featured ? 1 : 0,
    contentType,
    input.seoTitle?.trim() || "",
    input.seoDescription?.trim() || "",
    input.canonicalUrl?.trim() || "",
    input.indexable === false ? 0 : 1,
    input.follow === false ? 0 : 1,
    input.discoverEnabled === false ? 0 : 1,
    input.newsEnabled === false ? 0 : 1,
    input.preferredSourceCta === false ? 0 : 1,
    input.authorName?.trim() || "SellerHisab Research Team",
    input.authorUrl?.trim() || "/authors/sellerhisab-research",
    safeDate(input.reviewedAt),
    publishedAt,
    createdAt,
    now,
    userId,
    json(input.sourceUrls),
    json(input.relatedSlugs),
    JSON.stringify((input.localeAlternates ?? []).slice(0, 12)),
    video.enabled ? 1 : 0,
    video.title,
    video.description,
    video.thumbnailUrl,
    video.embedUrl,
    video.contentUrl,
    video.durationSeconds ?? null,
    safeDate(video.uploadDate),
    htmlContentEn,
    JSON.stringify(input.localeMetadata ?? {}),
  ));

  await db.batch(statements);

  if (previous?.imageKey && previous.imageKey !== imageKey) await deleteBlogMedia(previous.imageKey);

  const saved = await db.prepare(
    `SELECT ${BLOG_SELECT} FROM blog_posts WHERE id = ?1 LIMIT 1`,
  ).bind(id).first<BlogDbRow>();
  if (!saved) throw new Error("Blog post could not be read after save.");
  return rowToPost(saved);
}

export async function deleteBlogPost(id: string, userId?: string) {
  const db = getD1();
  const previous = await db.prepare(
    "SELECT slug, image_key AS imageKey FROM blog_posts WHERE id = ?1 LIMIT 1",
  ).bind(id).first<{ slug: string; imageKey: string | null }>();
  if (previous?.slug && userId) {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO seo_redirects (id, from_path, to_path, status_code, active, created_at, updated_at, updated_by)
       VALUES (?1, ?2, '/blog', 308, 1, ?3, ?3, ?4)
       ON CONFLICT(from_path) DO UPDATE SET to_path = '/blog', status_code = 308, active = 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(`redir_${crypto.randomUUID()}`, `/blog/${previous.slug}`, now, userId).run();
  }
  await db.prepare("DELETE FROM blog_posts WHERE id = ?1").bind(id).run();
  await deleteBlogMedia(previous?.imageKey);
  return previous?.slug ?? null;
}

export async function resolveSeoRedirect(fromPath: string): Promise<{ toPath: string; statusCode: number } | null> {
  try {
    const row = await getD1().prepare(
      "SELECT to_path AS toPath, status_code AS statusCode FROM seo_redirects WHERE from_path = ?1 AND active = 1 LIMIT 1",
    ).bind(fromPath).first<{ toPath: string; statusCode: number }>();
    return row ?? null;
  } catch {
    return null;
  }
}

export function getRelatedPosts(post: BlogPostRecord, posts: BlogPostRecord[], limit = 3): BlogPostRecord[] {
  const manual = new Map(post.relatedSlugs.map((slug, index) => [slug, 100 - index]));
  const postTags = new Set(post.tags.map((tag) => tag.toLowerCase()));
  return posts
    .filter((candidate) => candidate.id !== post.id && candidate.indexable)
    .map((candidate) => {
      let score = manual.get(candidate.slug) ?? 0;
      if (candidate.category.toLowerCase() === post.category.toLowerCase()) score += 20;
      if (candidate.tag.toLowerCase() === post.tag.toLowerCase()) score += 10;
      for (const tag of candidate.tags) if (postTags.has(tag.toLowerCase())) score += 4;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || +new Date(b.candidate.publishedAt ?? b.candidate.createdAt) - +new Date(a.candidate.publishedAt ?? a.candidate.createdAt))
    .slice(0, limit)
    .map((item) => item.candidate);
}
