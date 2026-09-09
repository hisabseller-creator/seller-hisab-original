import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { absoluteUrl } from "@/core/seo";
import { getPublishedBlogPost } from "@/server/blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post?.video.enabled) return {};
  return {
    title: post.video.title || post.title,
    description: post.video.description || post.subtitle,
    alternates: { canonical: `/videos/${post.slug}` },
    openGraph: {
      type: "video.other",
      title: post.video.title || post.title,
      description: post.video.description || post.subtitle,
      url: `/videos/${post.slug}`,
      images: post.video.thumbnailUrl ? [{ url: post.video.thumbnailUrl }] : undefined,
    },
    twitter: { card: "summary_large_image", title: post.video.title || post.title, description: post.video.description || post.subtitle, images: post.video.thumbnailUrl ? [post.video.thumbnailUrl] : undefined },
  };
}

export default async function VideoWatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post?.video.enabled || (!post.video.embedUrl && !post.video.contentUrl)) notFound();
  const video = post.video;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title || post.title,
    description: video.description || post.subtitle,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate || post.publishedAt || post.createdAt,
    duration: video.durationSeconds ? secondsToIso(video.durationSeconds) : undefined,
    embedUrl: video.embedUrl || undefined,
    contentUrl: video.contentUrl || undefined,
    url: absoluteUrl(`/videos/${post.slug}`),
  };
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="mx-auto max-w-[1050px] px-4 py-8 sm:px-6 sm:py-12">
        <Link href={`/blog/${post.slug}`} className="text-xs font-black text-blue-700 hover:underline">Read the full article</Link>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em] text-slate-950 sm:text-5xl">{video.title || post.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{video.description || post.subtitle}</p>
        <div className="mt-6 overflow-hidden rounded-[28px] bg-slate-950 shadow-xl"><div className="aspect-video">{video.embedUrl ? <iframe src={video.embedUrl} title={video.title || post.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <video src={video.contentUrl} poster={video.thumbnailUrl || undefined} controls preload="metadata" className="h-full w-full" />}</div></div>
      </main>
    </PublicShell>
  );
}

function secondsToIso(seconds: number) {
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const secs = seconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${secs ? `${secs}S` : ""}`;
}
