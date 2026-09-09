import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { getPublishedNewsPosts } from "@/server/blog";

const baseMetadata: Metadata = {
  title: "SellerHisab News & Seller Updates",
  description: "Timely marketplace seller updates, policy changes and profit-impact analysis from SellerHisab.",
  alternates: { canonical: "/news" },
};

export async function generateMetadata():Promise<Metadata>{return {...baseMetadata,robots:{index:(await getPublishedNewsPosts()).length>=3,follow:true}};}

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const posts = await getPublishedNewsPosts();
  return (
    <PublicShell>
      <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[.14em] text-blue-700">Seller updates</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl">News that can change seller margins.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">Marketplace fee, settlement, return, policy and product changes—explained with the practical impact on sellers.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="relative h-48 bg-slate-100">{post.imageUrl ? <Image src={post.imageUrl} alt={post.imageAlt} fill unoptimized className="object-cover" /> : null}</div>
              <div className="p-5"><p className="text-[10px] font-black uppercase tracking-[.1em] text-blue-700">{post.category}</p><h2 className="mt-2 text-xl font-black leading-snug text-slate-950">{post.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{post.subtitle}</p><span className="mt-4 inline-flex items-center text-xs font-black text-blue-700">Read update <ArrowRight className="ml-1.5 size-3.5" /></span></div>
            </Link>
          ))}
          {!posts.length ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">News posts will appear here when a published article is marked as News.</div> : null}
        </div>
      </main>
    </PublicShell>
  );
}
