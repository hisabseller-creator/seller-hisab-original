import type { Metadata } from "next";
import { availableBlogLocales,localeBlogPath } from "@/core/blog-locales";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { absoluteUrl } from "@/core/seo";
import { getPublishedBlogPost, getPublishedBlogPosts, getRelatedPosts, resolveSeoRedirect } from "@/server/blog";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

function canonicalFor(post: Awaited<ReturnType<typeof getPublishedBlogPost>>) {
  if (!post) return "";
  if (!post.canonicalUrl) return `/blog/${post.slug}`;
  return post.canonicalUrl;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return {};
  const canonical = canonicalFor(post);
  const seo=await getPublicSeoSettings();
  const languages = seo.future.localeUrlsEnabled?Object.fromEntries(post.localeAlternates.map((item) => [item.locale, item.url])):{};
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.subtitle,
    keywords: post.keywords.length ? post.keywords : undefined,
    authors: [{ name: post.authorName, url: post.authorUrl }],
    alternates: {
      canonical,
      languages: Object.keys(languages).length ? languages : undefined,
    },
    robots: {
      index: post.indexable,
      follow: post.follow,
      googleBot: {
        index: post.indexable,
        follow: post.follow,
        "max-image-preview": post.discoverEnabled ? "large" : "standard",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.subtitle,
      url: canonical,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [post.authorUrl],
      section: post.category,
      tags: post.tags,
      images: post.imageUrl ? [{ url: post.imageUrl, width: post.imageWidth ?? undefined, height: post.imageHeight ?? undefined, alt: post.imageAlt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.subtitle,
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, posts, seo] = await Promise.all([getPublishedBlogPost(slug), getPublishedBlogPosts(), getPublicSeoSettings()]);
  if (!post) {
    const legacy = await resolveSeoRedirect(`/blog/${slug}`);
    if (legacy?.toPath) redirect(legacy.toPath);
    notFound();
  }
  const locales=seo.future.localeUrlsEnabled?availableBlogLocales(post):[];
  if(locales.length)permanentRedirect(localeBlogPath(post,locales[0]));
  const related = getRelatedPosts(post, posts, 3);
  const path = `/blog/${post.slug}`;
  const schemaType = post.contentType === "news" ? "NewsArticle" : post.contentType === "article" ? "Article" : "BlogPosting";
  const image = post.imageUrl ? {
    "@type": "ImageObject",
    url: absoluteUrl(post.imageUrl),
    width: post.imageWidth ?? undefined,
    height: post.imageHeight ?? undefined,
    caption: post.imageCaption || undefined,
  } : undefined;
  const structuredData: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": schemaType,
      headline: post.title,
      description: post.seoDescription || post.subtitle,
      image,
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt,
      author: {
        "@type": post.authorUrl.includes("/authors/") ? "Organization" : "Person",
        name: post.authorName,
        url: absoluteUrl(post.authorUrl),
      },
      publisher: {
        "@type": "Organization",
        name: seo.identity.publisherName,
        url: absoluteUrl("/"),
        logo: { "@type": "ImageObject", url: absoluteUrl(seo.identity.organizationLogoUrl || "/sellerhisab-mark-512.png") },
      },
      mainEntityOfPage: absoluteUrl(path),
      articleSection: post.category,
      keywords: post.keywords.join(", ") || undefined,
      citation: post.sourceUrls.length ? post.sourceUrls : undefined,
      inLanguage: post.htmlContent.trim() && post.htmlContentEn.trim()
      ? ["hi-IN", "en-IN"]
      : post.htmlContentEn.trim()
        ? "en-IN"
        : "hi-IN",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
        { "@type": "ListItem", position: 3, name: post.title, item: absoluteUrl(path) },
      ],
    },
  ];
  if (post.video.enabled) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: post.video.title || post.title,
      description: post.video.description || post.subtitle,
      thumbnailUrl: post.video.thumbnailUrl,
      uploadDate: post.video.uploadDate || post.publishedAt || post.createdAt,
      duration: post.video.durationSeconds ? secondsToIso(post.video.durationSeconds) : undefined,
      embedUrl: post.video.embedUrl || undefined,
      contentUrl: post.video.contentUrl || undefined,
      url: absoluteUrl(`/videos/${post.slug}`),
    });
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <BlogArticle post={post} related={related} preferredSourcesEnabled={seo.discovery.preferredSourcesEnabled} preferredSourcesLabel={seo.discovery.preferredSourcesLabel} />
    </>
  );
}

function secondsToIso(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${secs ? `${secs}S` : ""}`;
}
