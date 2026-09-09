import { absoluteUrl } from "@/core/seo";
import { getPublishedVideoPosts } from "@/server/blog";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await getPublicSeoSettings();
  if (!seo.discovery.videoSitemapEnabled) return new Response("Not found", { status: 404 });
  const posts = await getPublishedVideoPosts();
  const body = posts.map((post) => {
    const video = post.video;
    const player = video.embedUrl ? `<video:player_loc>${xml(video.embedUrl)}</video:player_loc>` : "";
    const content = video.contentUrl ? `<video:content_loc>${xml(video.contentUrl)}</video:content_loc>` : "";
    const duration = video.durationSeconds ? `<video:duration>${video.durationSeconds}</video:duration>` : "";
    const date = video.uploadDate || post.publishedAt || post.createdAt;
    return `  <url>\n    <loc>${xml(absoluteUrl(`/videos/${post.slug}`))}</loc>\n    <video:video>\n      <video:thumbnail_loc>${xml(video.thumbnailUrl)}</video:thumbnail_loc>\n      <video:title>${xml(video.title || post.title)}</video:title>\n      <video:description>${xml(video.description || post.subtitle)}</video:description>\n      ${player}${content}${duration}\n      <video:publication_date>${xml(date)}</video:publication_date>\n    </video:video>\n  </url>`;
  }).join("\n");
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${body}\n</urlset>`);
}

function xml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function xmlResponse(body: string) { return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } }); }
