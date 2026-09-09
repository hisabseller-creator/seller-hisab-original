import { absoluteUrl } from "@/core/seo";
import { getPublishedNewsPosts } from "@/server/blog";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await getPublicSeoSettings();
  if (!seo.discovery.newsSitemapEnabled) return new Response("Not found", { status: 404 });
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const posts = (await getPublishedNewsPosts()).filter((post) => +new Date(post.publishedAt ?? post.createdAt) >= cutoff);
  const body = posts.map((post) => `  <url>\n    <loc>${xml(absoluteUrl(`/blog/${post.slug}`))}</loc>\n    <news:news>\n      <news:publication><news:name>${xml(seo.identity.publicationName)}</news:name><news:language>${xml(seo.discovery.newsLanguage)}</news:language></news:publication>\n      <news:publication_date>${xml(post.publishedAt ?? post.createdAt)}</news:publication_date>\n      <news:title>${xml(post.title)}</news:title>\n    </news:news>\n  </url>`).join("\n");
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>`);
}

function xml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function xmlResponse(body: string) { return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } }); }
