import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog-index";
import { PublicShell } from "@/components/public-shell";
import { getPublishedBlogPosts } from "@/server/blog";

export const dynamic = "force-dynamic";

type BlogSearchParams = {
  page?: string | string[];
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: BlogSearchParams | Promise<BlogSearchParams>;
}): Promise<Metadata> {
  const params = await Promise.resolve(searchParams ?? {});
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;
  const canonical = currentPage > 1 ? `/blog?page=${currentPage}` : "/blog";
  return {
    title: currentPage > 1 ? `SellerHisab Blog – Page ${currentPage}` : "SellerHisab Blog",
    description: "Practical guides on seller profit, returns, RTO, settlements, pricing and SKU decisions.",
    alternates: { canonical },
    openGraph: {
      title: currentPage > 1 ? `SellerHisab Blog – Page ${currentPage}` : "SellerHisab Blog",
      description: "Practical guides for healthier marketplace margins.",
      url: canonical,
    },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams?: BlogSearchParams | Promise<BlogSearchParams>;
}) {
  const posts = await getPublishedBlogPosts();
  const params = await Promise.resolve(searchParams ?? {});
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return <PublicShell><BlogIndex posts={posts} currentPage={currentPage} /></PublicShell>;
}
