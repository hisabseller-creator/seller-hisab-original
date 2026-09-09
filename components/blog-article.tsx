import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, ExternalLink, PlayCircle } from "lucide-react";
import type { BlogPostRecord } from "@/core/blog-cms";
import { PublicShell } from "./public-shell";
import { PreferredSourceCta } from "./preferred-source-cta";
import { BlogLocalizedContent } from "./blog-localized-content";

export function BlogArticle({
  post,
  related = [],
  articleLocale,
  localeLinks,
  preferredSourcesEnabled = false,
  preferredSourcesLabel = "Add SellerHisab as a preferred source",
}: {
  post: BlogPostRecord;
  articleLocale?: "hi" | "en";
  localeLinks?: Array<{locale:"hi"|"en";href:string}>;
  related?: BlogPostRecord[];
  preferredSourcesEnabled?: boolean;
  preferredSourcesLabel?: string;
}) {
  return (
    <PublicShell>
      <main className="pb-10">
        <section className="px-3 pb-5 pt-8 sm:px-5 sm:pb-7 sm:pt-11">
          <div className="mx-auto max-w-[980px]">
            <Link href="/blog" className="inline-flex items-center gap-2 text-xs font-black text-slate-500 transition hover:text-blue-700"><ArrowLeft className="size-4" />Back to Blog</Link>
          </div>
        </section>

        <section className="w-full max-w-[100vw] min-w-0 overflow-x-clip px-4 sm:px-5">
          <div className="blog-article-hero relative mx-auto aspect-[16/9] w-[calc(100vw-2rem)] max-w-[980px] min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm sm:w-full">
            {post.imageUrl ? (
              <Image
                src={post.imageUrl}
                alt={post.imageAlt}
                fill
                priority
                unoptimized
                sizes="(min-width: 1024px) 980px, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100" />
            )}
          </div>
          {(post.imageCaption || post.imageCredit) ? (
            <p className="mx-auto mt-2 w-[calc(100vw-2rem)] max-w-[980px] min-w-0 px-1 text-[11px] leading-5 text-slate-500 sm:w-full">
              {post.imageCaption}
              {post.imageCaption && post.imageCredit ? " · " : ""}
              {post.imageCredit ? `Image: ${post.imageCredit}` : ""}
            </p>
          ) : null}
          <div className="mx-auto mt-4 w-[calc(100vw-2rem)] max-w-[980px] min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:w-full sm:p-7 lg:p-8">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700">
              {post.category || post.tag}
            </span>
            <h1 className="mt-4 max-w-4xl break-words text-[2rem] font-black leading-[1.3] tracking-[-.025em] text-slate-950 sm:text-[2.65rem] lg:text-[3.1rem]">
              {post.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              {post.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-5 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                {post.authorName === "SellerHisab Research Team" ? (
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-blue-100 bg-blue-50">
                    <Image
                      src="/sellerhisab-mark.svg"
                      alt="SellerHisab"
                      width={36}
                      height={36}
                      className="size-9 object-contain"
                    />
                  </span>
                ) : null}
                <div>
                  <Link
                    href={post.authorUrl}
                    className="font-black text-slate-900 hover:text-blue-700 hover:underline"
                  >
                    {post.authorName}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span>{formatDateOnly(post.publishedAt ?? post.createdAt)}</span>
                    <span className="size-1 rounded-full bg-slate-300" />
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" />
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {post.updatedAt !== post.createdAt ? (
                  <span>Updated {formatDateOnly(post.updatedAt)}</span>
                ) : null}
                {post.reviewedAt ? (
                  <span>Reviewed {formatDateOnly(post.reviewedAt)}</span>
                ) : null}
                <Link
                  href="/editorial-policy"
                  className="font-bold text-blue-700 hover:underline"
                >
                  Editorial policy
                </Link>
                {preferredSourcesEnabled && post.preferredSourceCta ? (
                  <PreferredSourceCta label={preferredSourcesLabel} />
                ) : null}
              </div>
            </div>
          </div>
        </section>
        <section className="w-full max-w-[100vw] min-w-0 overflow-x-clip px-4 pt-5 sm:px-5 sm:pt-7">
        {post.video.enabled && (post.video.embedUrl || post.video.contentUrl) ? (
            <div className="mx-auto mb-5 max-w-[980px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 shadow-sm">
              <div className="aspect-video">
                {post.video.embedUrl ? <iframe src={post.video.embedUrl} title={post.video.title || post.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <video src={post.video.contentUrl} poster={post.video.thumbnailUrl || undefined} controls preload="metadata" className="h-full w-full" />}
              </div>
              <div className="bg-white p-4"><p className="flex items-center gap-2 text-sm font-black text-slate-900"><PlayCircle className="size-4 text-blue-600" />{post.video.title || post.title}</p>{post.video.description && <p className="mt-1 text-xs leading-5 text-slate-600">{post.video.description}</p>}<Link href={`/videos/${post.slug}`} className="mt-2 inline-flex items-center text-xs font-black text-blue-700">Open dedicated video page <ArrowRight className="ml-1 size-3.5" /></Link></div>
            </div>
          ) : null}

          {localeLinks?.length ? <nav aria-label="Article language" className="mx-auto mb-4 flex max-w-[980px] gap-3">{localeLinks.map(item=><Link key={item.locale} href={item.href} hrefLang={item.locale} aria-current={item.locale===articleLocale?"page":undefined} className="inline-flex min-h-11 items-center rounded-xl border px-4 font-bold">{item.locale==="hi"?"हिंदी":"English"}</Link>)}</nav>:null}
          <BlogLocalizedContent
            initialLanguage={articleLocale}
            fixedLanguage={Boolean(articleLocale)}
            hindiHtml={post.htmlContent}
            englishHtml={post.htmlContentEn}
          />
        </section>

        {post.sourceUrls.length ? (
          <section className="px-3 pt-6 sm:px-5">
            <div className="mx-auto max-w-[980px] rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-black text-slate-950">Sources & references</h2>
              <ul className="mt-3 space-y-2">{post.sourceUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex break-all text-xs font-bold text-blue-700 hover:underline">{url}<ExternalLink className="ml-1.5 mt-0.5 size-3 shrink-0" /></a></li>)}</ul>
            </div>
          </section>
        ) : null}

        <section className="px-3 pb-3 pt-8 sm:px-5 sm:pt-12">
          <div className="blog-cta mx-auto flex max-w-[980px] flex-col gap-5 rounded-[26px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-blue-700">Use your own data</p><p className="mt-1.5 text-sm leading-6 text-slate-600">Turn the article into a SKU-level decision with Profit Check.</p></div>
            <Link href="/analyze" className="liquid-button inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black">Open Profit Check <ArrowRight className="ml-2 size-4" /></Link>
          </div>
        </section>

        {related.length ? (
          <section className="px-3 pb-3 pt-8 sm:px-5 sm:pt-12">
            <div className="mx-auto max-w-[980px]">
              <h2 className="text-lg font-black tracking-[-.02em] text-slate-950">Related reading</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <Link key={item.id} href={`/blog/${item.slug}`} className="blog-related-card group overflow-hidden rounded-[22px]">
                    <div className="relative h-28 bg-gradient-to-br from-blue-50 to-indigo-100">{item.imageUrl ? <Image src={item.imageUrl} alt={item.imageAlt} fill unoptimized className="object-cover" /> : null}</div>
                    <div className="p-5"><p className="text-[10px] font-black uppercase tracking-[.1em] text-blue-700">{item.category || item.tag}</p><h3 className="mt-2 text-lg font-black leading-snug tracking-[-.025em] text-slate-950 transition group-hover:text-blue-700">{item.title}</h3><span className="mt-4 inline-flex items-center text-xs font-black text-slate-500 group-hover:text-blue-700">Read article <ArrowRight className="ml-1.5 size-3.5 transition-transform group-hover:translate-x-1" /></span></div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </PublicShell>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Published";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
function formatDateOnly(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
