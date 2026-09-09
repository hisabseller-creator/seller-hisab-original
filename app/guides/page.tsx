import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { guidePages } from "@/core/seo-hubs";

export const metadata: Metadata = {
  title: "Marketplace Seller Finance Guides",
  description: "Evidence-first guides to contribution margin, settlement reconciliation, RTO impact, break-even price, SKU profitability and marketplace P&L.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <PublicShell>
      <main className="px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <div className="mx-auto max-w-[1100px]">
          <p className="eyebrow">Seller finance library</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.045em] text-slate-950 sm:text-5xl">Make sense of every sale.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Clear explanations of margins, settlements and returns, with examples you can use.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {Object.values(guidePages).map((guide) => (
              <Link key={guide.slug} href={`/guides/${guide.slug}`} className="liquid-panel group rounded-[26px] p-6">
                <p className="text-xs font-black uppercase tracking-[.12em] text-blue-700">{guide.eyebrow}</p>
                <h2 className="mt-3 text-xl font-black tracking-[-.025em] text-slate-950 group-hover:text-blue-700">{guide.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{guide.description}</p>
                <span className="mt-5 inline-flex items-center text-xs font-black text-blue-700">Read guide <ArrowRight className="ml-1.5 size-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
