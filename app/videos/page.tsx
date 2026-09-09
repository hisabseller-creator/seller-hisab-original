import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { getPublishedVideoPosts } from "@/server/blog";

const baseMetadata: Metadata = {
  title: "SellerHisab Videos",
  description: "SellerHisab video explainers for marketplace profit, settlements, RTO, pricing and seller finance.",
  alternates: { canonical: "/videos" },
};

export async function generateMetadata():Promise<Metadata>{return {...baseMetadata,robots:{index:(await getPublishedVideoPosts()).length>=3,follow:true}};}

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const posts = await getPublishedVideoPosts();
  return (
    <PublicShell>
      <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[.14em] text-blue-700">Video library</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl">SellerHisab video explainers.</h1>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/videos/${post.slug}`} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-video bg-slate-950">{post.video.thumbnailUrl ? <Image src={post.video.thumbnailUrl} alt={post.video.title || post.title} fill unoptimized className="object-cover" /> : null}<span className="absolute inset-0 grid place-items-center"><PlayCircle className="size-12 text-white drop-shadow" /></span></div>
              <div className="p-5"><h2 className="text-lg font-black leading-snug text-slate-950">{post.video.title || post.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{post.video.description || post.subtitle}</p></div>
            </Link>
          ))}
          {!posts.length ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Video posts will appear here after video SEO fields are completed and published.</div> : null}
        </div>
      </main>
    </PublicShell>
  );
}
