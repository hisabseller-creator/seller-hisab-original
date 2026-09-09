import { absoluteUrl } from "@/core/seo";
import { getPublishedIndexableBlogPosts } from "@/server/blog";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await getPublicSeoSettings();
  if (!seo.discovery.llmsTxtEnabled || !seo.future.aiReadableFeeds) return new Response("Not found", { status: 404 });
  const posts = (await getPublishedIndexableBlogPosts()).slice(0, 50);
  const lines = [
    `# ${seo.identity.publicationName}`,
    "",
    seo.identity.organizationDescription,
    "",
    "## Core public pages",
    `- ${absoluteUrl("/")}`,
    `- ${absoluteUrl("/methodology")}`,
    `- ${absoluteUrl("/blog")}`,
    `- ${absoluteUrl("/calculators")}`,
    "",
    "## Recent articles",
    ...posts.map((post) => `- ${post.title}: ${absoluteUrl(`/blog/${post.slug}`)}`),
    "",
    "This file is an experimental publisher aid. Standard crawling, indexing, structured data and content quality remain authoritative.",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=900" } });
}
