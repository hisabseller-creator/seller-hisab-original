import { absoluteUrl } from "@/core/seo";
import { getPublishedIndexableBlogPosts } from "@/server/blog";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await getPublicSeoSettings();
  if (!seo.discovery.imageSitemapEnabled) return new Response("Not found", { status: 404 });
  const posts = (await getPublishedIndexableBlogPosts()).filter((post) => post.imageUrl);
  const body = posts.map((post) => `  <url>\n    <loc>${xml(absoluteUrl(`/blog/${post.slug}`))}</loc>\n    <image:image><image:loc>${xml(absoluteUrl(post.imageUrl!))}</image:loc></image:image>\n  </url>`).join("\n");
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>`);
}

function xml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function xmlResponse(body: string) { return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } }); }
