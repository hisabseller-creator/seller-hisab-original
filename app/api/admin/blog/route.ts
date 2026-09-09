import { z } from "zod";
import { SITE_URL } from "@/core/site-url";
import { getSessionUser } from "@/server/auth";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { deleteBlogPost, getAdminBlogPosts, saveBlogPost } from "@/server/blog";
import { submitIndexNow } from "@/server/indexnow";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

const optionalPublicUrl = z.string().trim().max(500).refine(
  (value) => !value || (value.startsWith("/") && !value.startsWith("//")) || /^https:\/\//i.test(value),
  "Use a relative public URL or an https URL.",
);
const optionalCanonical = z.string().trim().max(500).refine(
  (value) => !value || (value.startsWith("/") && !value.startsWith("//")) || value.startsWith(SITE_URL),
  "Canonical must be a SellerHisab relative URL or sellerhisab.com URL.",
);
const optionalDate = z.union([z.literal(""), z.string().datetime({ offset: true })]).nullable().optional();

const videoSchema = z.object({
  enabled: z.boolean().default(false),
  title: z.string().trim().max(180).default(""),
  description: z.string().trim().max(500).default(""),
  thumbnailUrl: optionalPublicUrl.default(""),
  embedUrl: optionalPublicUrl.default(""),
  contentUrl: optionalPublicUrl.default(""),
  durationSeconds: z.number().int().positive().max(86_400).nullable().default(null),
  uploadDate: optionalDate,
}).strict();

const blogInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().max(100).optional(),
  title: z.string().trim().min(3).max(180),
  subtitle: z.string().trim().min(1).max(420),
  tag: z.string().trim().min(1).max(50),
  category: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  keywords: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  imageKey: z.string().trim().max(180).nullable().optional(),
  imageAlt: z.string().trim().max(180).optional(),
  imageWidth: z.number().int().positive().max(20_000).nullable().optional(),
  imageHeight: z.number().int().positive().max(20_000).nullable().optional(),
  imageCaption: z.string().trim().max(300).optional(),
  imageCredit: z.string().trim().max(200).optional(),
  htmlContent: z.string().trim().max(160_000).default(""),
  htmlContentEn: z.string().trim().max(160_000).default(""),
  localeMetadata: z.object({hi:z.object({title:z.string().trim().max(180),subtitle:z.string().trim().max(420),seoTitle:z.string().trim().max(180),seoDescription:z.string().trim().max(420)}).optional(),en:z.object({title:z.string().trim().max(180),subtitle:z.string().trim().max(420),seoTitle:z.string().trim().max(180),seoDescription:z.string().trim().max(420)}).optional()}).strict().optional(),
  status: z.enum(["draft", "published"]),
  featured: z.boolean().default(false),
  contentType: z.enum(["blog", "article", "news"]).default("blog"),
  seoTitle: z.string().trim().max(180).optional(),
  seoDescription: z.string().trim().max(420).optional(),
  canonicalUrl: optionalCanonical.optional(),
  indexable: z.boolean().default(true),
  follow: z.boolean().default(true),
  discoverEnabled: z.boolean().default(true),
  newsEnabled: z.boolean().default(true),
  preferredSourceCta: z.boolean().default(true),
  authorName: z.string().trim().max(100).optional(),
  authorUrl: optionalPublicUrl.optional(),
  reviewedAt: optionalDate,
  publishedAt: optionalDate,
  sourceUrls: z.array(z.string().url().max(500)).max(30).default([]),
  relatedSlugs: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  localeAlternates: z.array(z.object({
    locale: z.string().trim().min(2).max(15),
    url: optionalPublicUrl,
  }).strict()).max(12).default([]),
  video: videoSchema.default({
    enabled: false,
    title: "",
    description: "",
    thumbnailUrl: "",
    embedUrl: "",
    contentUrl: "",
    durationSeconds: null,
    uploadDate: null,
  }),
}).strict().superRefine((value, ctx) => {
  if (!value.htmlContent.trim() && !value.htmlContentEn.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["htmlContent"],
      message: "Add Hindi or English article HTML.",
    });
  }
});async function authorize(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { error: Response.json({ error: "Admin access is not enabled for this account." }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  try {
    return Response.json({ posts: await getAdminBlogPosts() });
  } catch {
    return Response.json({ error: "Blog posts could not be loaded. Apply the latest D1 migration first." }, { status: 503 });
  }
}

export async function POST(request: Request) { return save(request); }
export async function PUT(request: Request) { return save(request); }

async function save(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    const input = blogInputSchema.parse(await request.json());
    const post = await saveBlogPost(input, auth.user.id);
    const seo = await getPublicSeoSettings();
    if (seo.indexNow.enabled && post.status === "published" && (seo.indexNow.submitOnPublish || seo.indexNow.submitOnUpdate)) {
      const paths = [`/blog/${post.slug}`, "/blog"];
      if (post.contentType === "news") paths.push("/news");
      if (post.video.enabled) paths.push(`/videos/${post.slug}`, "/videos");
      await submitIndexNow(paths);
    }
    return Response.json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid blog post." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Blog post could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    const payload = z.object({ id: z.string().trim().min(1).max(120) }).parse(await request.json());
    const slug = await deleteBlogPost(payload.id, auth.user.id);
    const seo = await getPublicSeoSettings();
    if (slug && seo.indexNow.enabled && seo.indexNow.submitOnDelete) await submitIndexNow([`/blog/${slug}`, "/blog"]);
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid blog post id." }, { status: 400 });
    return Response.json({ error: "Blog post could not be deleted." }, { status: 503 });
  }
}

