"use client";

import Link from "next/link";

export default function BlogPostError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="px-3 py-12 sm:px-5">
      <div className="mx-auto max-w-[760px] rounded-[28px] border border-blue-100 bg-white/80 p-7 text-center shadow-sm backdrop-blur-xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.14em] text-blue-700">SellerHisab Blog</p>
        <h1 className="mt-3 text-2xl font-black tracking-[-.035em] text-slate-950 sm:text-3xl">This article could not load.</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Retry the article. If it was just published, a refresh usually resolves the temporary issue.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="liquid-button min-h-11 rounded-xl px-5 text-sm font-black">Retry</button>
          <Link href="/blog" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-5 text-sm font-black text-blue-700">Back to Blog</Link>
        </div>
      </div>
    </main>
  );
}
