"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import type { BlogPostRecord } from "@/core/blog-cms";
import { useLanguage } from "./providers";

const POSTS_PER_PAGE = 8;

const journalGlassStyle = {
  background: "linear-gradient(145deg, rgba(248,251,255,.76), rgba(232,240,252,.64))",
  backdropFilter: "blur(6px) saturate(140%)",
  WebkitBackdropFilter: "blur(6px) saturate(140%)",
};

export function BlogIndex({ posts, currentPage = 1 }: { posts: BlogPostRecord[]; currentPage?: number }) {
  const { language } = useLanguage();
  const english = language === "english";
  const featured = posts.find((post) => post.featured) ?? posts[0];
  const latest = posts.filter((post) => post.id !== featured?.id);
  const totalPages = Math.max(1, Math.ceil(latest.length / POSTS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * POSTS_PER_PAGE;
  const pagePosts = latest.slice(startIndex, startIndex + POSTS_PER_PAGE);

  return (
    <main className="pb-6" lang={english?'en':'hi'}>
      <section className="px-3 pb-7 pt-10 sm:px-5 sm:pb-10 sm:pt-14 lg:pt-16">
        <div className="blog-hero-shell mx-auto max-w-[1180px] overflow-hidden rounded-[30px] px-5 py-9 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.15em] text-blue-700 shadow-sm">
              SellerHisab Notes
            </div>
            <h1 className="mt-5 text-[2.4rem] font-black leading-[.98] tracking-[-.055em] text-slate-950 sm:text-5xl lg:text-6xl">
              {english ? "A clearer view of selling." : "बेहतर समझ। बेहतर बिक्री।"}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
              {english ? "Profit, returns and pricing. A little knowledge for your next decision." : "लाभ, रिटर्न और सही कीमत — आपके अगले फ़ैसले के लिए।"}
            </p>
          </div>
        </div>
      </section>

      {featured && safePage === 1 ? (
        <section className="px-3 sm:px-5">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
              <h2 className="text-xl text-slate-950 sm:text-2xl">{english ? "Editor’s pick" : "खास लेख"}</h2>
            </div>
            <FeaturedPost post={featured} />
          </div>
        </section>
      ) : null}

      <section className="px-3 pb-8 pt-10 sm:px-5 sm:pt-14">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl text-slate-950">{english ? "More to explore" : "और पढ़ें"}</h2>
            <span className="hidden text-xs font-bold text-slate-600 sm:block">{posts.length} practical guides</span>
          </div>

          {pagePosts.length ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:gap-5">
                {pagePosts.map((post) => <PostCard key={post.id} post={post} />)}
              </div>
              {totalPages > 1 ? <BlogPagination currentPage={safePage} totalPages={totalPages} /> : null}
            </>
          ) : (
            <div className="blog-post-card rounded-[24px] p-8 text-center text-sm text-slate-500">{english ? "More guides are on the way." : "नए लेख जल्द आएँगे।"}</div>
          )}
        </div>
      </section>

      <section className="px-3 pb-8 pt-4 sm:px-5 sm:pb-12">
        <div className="blog-cta mx-auto flex max-w-[1180px] flex-col gap-6 rounded-[28px] p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[.15em] text-blue-700">From reading to action</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-slate-950 sm:text-3xl">Want the answer for your own SKUs?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Run Profit Check with your seller report and product costs to see contribution, risk and next actions.</p>
          </div>
          <Link href="/analyze" className="liquid-button inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl px-5 text-sm font-black">Check my profit <ArrowRight className="ml-2 size-4" /></Link>
        </div>
      </section>
    </main>
  );
}

function BlogPagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const items = buildPaginationItems(currentPage, totalPages);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:mt-10" aria-label="Blog pagination">
      {currentPage > 1 ? (
        <Link
          href={pageHref(currentPage - 1)}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-100 bg-white/80 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          aria-label="Previous blog page"
        >
          Previous
        </Link>
      ) : (
        <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-xl border border-slate-100 bg-white/45 px-4 text-sm font-black text-slate-300">
          Previous
        </span>
      )}

      {items.map((item, index) => item === "ellipsis" ? (
        <span key={`ellipsis-${index}`} className="grid min-h-10 min-w-10 place-items-center text-sm font-black text-slate-400" aria-hidden="true">…</span>
      ) : (
        <Link
          key={item}
          href={pageHref(item)}
          aria-current={item === currentPage ? "page" : undefined}
          className={`grid min-h-10 min-w-10 place-items-center rounded-xl border px-3 text-sm font-black shadow-sm transition ${
            item === currentPage
              ? "border-blue-600 bg-blue-600 text-white shadow-blue-200/70"
              : "border-blue-100 bg-white/80 text-slate-700 hover:border-blue-200 hover:text-blue-700"
          }`}
        >
          {item}
        </Link>
      ))}

      {currentPage < totalPages ? (
        <Link
          href={pageHref(currentPage + 1)}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-100 bg-white/80 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          aria-label="Next blog page"
        >
          Next
        </Link>
      ) : (
        <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-xl border border-slate-100 bg-white/45 px-4 text-sm font-black text-slate-300">
          Next
        </span>
      )}
    </nav>
  );
}

function buildPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const visible = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const pages = Array.from(visible)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}

function pageHref(page: number) {
  return page <= 1 ? "/blog" : `/blog?page=${page}`;
}

function FeaturedPost({ post }: { post: BlogPostRecord }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="blog-featured-card group grid overflow-hidden rounded-[28px] lg:grid-cols-[.96fr_1.04fr] lg:items-center"
      style={journalGlassStyle}
    >
      <BlogMedia post={post} featured />
      <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-9">
        <Meta post={post} />
        <div className="mt-4"><span className="blog-text-tag">{post.tag}</span></div>
        <h3 className="mt-4 text-2xl font-black leading-tight tracking-[-.04em] text-slate-950 transition group-hover:text-blue-700 sm:text-3xl">{post.title}</h3>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">{post.subtitle}</p>
        <span className="mt-6 inline-flex items-center text-sm font-black text-blue-700">Read guide <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPostRecord }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="blog-post-card group flex flex-col overflow-hidden rounded-[24px]"
      style={journalGlassStyle}
    >
      <BlogMedia post={post} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <span className="blog-text-tag w-fit">{post.tag}</span>
        <h3 className="mt-3 line-clamp-3 text-xl font-black leading-tight tracking-[-.035em] text-slate-950 transition group-hover:text-blue-700 md:line-clamp-2 sm:text-[1.35rem]">{post.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.subtitle}</p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <Meta post={post} compact />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition group-hover:translate-x-1 group-hover:bg-blue-600 group-hover:text-white"><ArrowRight className="size-4" /></span>
        </div>
      </div>
    </Link>
  );
}

function BlogMedia({ post, featured = false }: { post: BlogPostRecord; featured?: boolean }) {
  return (
    <div className={`relative aspect-[16/9] w-full shrink-0 self-start overflow-hidden bg-gradient-to-br from-blue-100 via-slate-50 to-indigo-100 ${featured ? "lg:self-center" : ""}`}>
      {post.imageUrl ? <Image src={post.imageUrl} alt={post.imageAlt} fill unoptimized sizes={featured ? "(min-width: 1024px) 46vw, 100vw" : "(min-width: 768px) 50vw, 100vw"} className="object-cover" /> : (
        <div className="grid h-full place-items-center px-6 text-center text-sm font-black text-slate-400">{post.tag}</div>
      )}
    </div>
  );
}

function Meta({ post, compact = false }: { post: BlogPostRecord; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>
      <span>{formatDateTime(post.publishedAt)}</span>
      <span className="size-1 rounded-full bg-slate-300" />
      <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{post.readTime}</span>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Published";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
