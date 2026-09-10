import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { MARKETPLACE_DEFINITIONS, PRIMARY_MARKETPLACE_IDS } from "@/core/marketplace-definitions";
import { guidePages } from "@/core/marketplace-content";

export const metadata: Metadata = {
  title: "Marketplace Seller Finance Guides",
  description: "Marketplace-specific guides for Meesho, Amazon India, Flipkart, Shopify and WooCommerce plus evidence-first seller finance guides to contribution, settlement, returns and break-even decisions.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const platformGuides = PRIMARY_MARKETPLACE_IDS.map((id) => {
    const marketplace = MARKETPLACE_DEFINITIONS[id];
    return { marketplace, guide: guidePages[marketplace.guideSlug] };
  });
  const platformSlugs = new Set(platformGuides.map(({ guide }) => guide.slug));
  const financeGuides = Object.values(guidePages).filter((guide) => !platformSlugs.has(guide.slug));

  return (
    <PublicShell>
      <main className="website-editorial px-4 py-12 sm:px-6 md:py-18 lg:px-10">
        <div className="mx-auto max-w-[1160px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="liquid-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-blue-700"><BookOpen className="size-4" />Seller finance library</span>
            <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.045em] text-slate-950 sm:text-5xl">Start with where you sell.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">Choose your marketplace for platform-specific evidence and workflows, then use the finance guides when you need a deeper explanation of margins, settlement and risk.</p>
          </div>

          <section className="mt-12">
            <div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Marketplace guides</p><h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-slate-950">One clear guide for every supported platform.</h2></div><Link href="/marketplaces" className="hidden text-sm font-extrabold text-blue-700 sm:inline-flex">Compare support <ArrowRight className="ml-1.5 size-4" /></Link></div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {platformGuides.map(({ marketplace, guide }) => (
                <Link key={guide.slug} href={`/guides/${guide.slug}`} className="liquid-panel group rounded-[26px] p-6">
                  <div className="flex h-10 items-center"><Image src={marketplace.logo} alt={`${marketplace.name} logo`} width={170} height={46} className="max-h-9 w-auto max-w-[170px] object-contain object-left" /></div>
                  <h3 className="mt-4 text-xl font-black tracking-[-.025em] text-slate-950 group-hover:text-blue-700">{guide.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{guide.description}</p>
                  <span className="mt-5 inline-flex items-center text-xs font-black text-blue-700">Read guide <ArrowRight className="ml-1.5 size-4" /></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-14 border-t border-blue-100 pt-12">
            <p className="eyebrow">Finance concepts</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-slate-950">Understand the numbers behind every marketplace.</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {financeGuides.map((guide) => (
                <Link key={guide.slug} href={`/guides/${guide.slug}`} className="liquid-panel group rounded-[26px] p-6">
                  <p className="text-xs font-black uppercase tracking-[.12em] text-blue-700">{guide.eyebrow}</p>
                  <h3 className="mt-3 text-xl font-black tracking-[-.025em] text-slate-950 group-hover:text-blue-700">{guide.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{guide.description}</p>
                  <span className="mt-5 inline-flex items-center text-xs font-black text-blue-700">Read guide <ArrowRight className="ml-1.5 size-4" /></span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
