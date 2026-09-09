import { absoluteUrl } from "@/core/seo";
import { getPublishedIndexableBlogPosts } from "@/server/blog";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await getPublicSeoSettings();
  if (!seo.discovery.rssEnabled) return new Response("Not found", { status: 404 });
  const posts = (await getPublishedIndexableBlogPosts()).slice(0, 50);
  const items = posts.map((post) => `<item><title>${xml(post.title)}</title><link>${xml(absoluteUrl(`/blog/${post.slug}`))}</link><guid isPermaLink="true">${xml(absoluteUrl(`/blog/${post.slug}`))}</guid><pubDate>${new Date(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate><description>${xml(post.seoDescription || post.subtitle)}</description></item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(seo.identity.publicationName)}</title><link>${xml(absoluteUrl("/blog"))}</link><description>${xml(seo.identity.organizationDescription)}</description>${items}</channel></rss>`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}

function xml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
