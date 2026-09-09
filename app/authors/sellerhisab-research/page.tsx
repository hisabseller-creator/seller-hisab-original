import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { absoluteUrl } from "@/core/seo";

export const metadata: Metadata = {
  title: "SellerHisab Research Team",
  description: "The SellerHisab Research Team covers marketplace seller profitability, settlement reconciliation, Return/RTO economics, break-even and evidence-first decision intelligence.",
  alternates: { canonical: "/authors/sellerhisab-research" },
};

export default function ResearchAuthorPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Organization",
      name: "SellerHisab Research Team",
      url: absoluteUrl("/authors/sellerhisab-research"),
      description: "Seller-finance research and editorial team covering marketplace contribution, settlement, Return/RTO and break-even economics.",
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <PublicShell>
      <main className="px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <article className="liquid-panel mx-auto max-w-4xl rounded-[30px] p-6 sm:p-10">
          <p className="eyebrow">Author profile</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-.045em] text-slate-950 sm:text-5xl">SellerHisab Research Team</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">The SellerHisab Research Team publishes evidence-first explainers about Indian marketplace seller profitability and the financial logic implemented inside SellerHisab.</p>
          <div className="mt-9 grid gap-6 md:grid-cols-2">
            <section><h2 className="text-xl font-black text-slate-950">Coverage</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600"><li>Contribution margin and SKU economics</li><li>Returns and RTO impact</li><li>Settlement and bank reconciliation</li><li>Break-even pricing, ROAS and ACoS</li><li>Marketplace report interpretation</li></ul></section>
            <section><h2 className="text-xl font-black text-slate-950">Publishing rules</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600"><li>Primary sources for time-sensitive marketplace claims</li><li>Visible assumptions for financial calculations</li><li>No invented report mappings or fake benchmarks</li><li>Real review/update dates rather than cosmetic freshness</li></ul></section>
          </div>
          <div className="mt-9 flex flex-wrap gap-3 border-t border-blue-100 pt-7 text-sm font-bold">
            <Link href="/editorial-policy" className="text-blue-700 hover:underline">Editorial Policy</Link>
            <Link href="/corrections-policy" className="text-blue-700 hover:underline">Corrections Policy</Link>
            <Link href="/methodology" className="text-blue-700 hover:underline">Calculation Methodology</Link>
            <Link href="/blog" className="text-blue-700 hover:underline">Blog</Link>
          </div>
        </article>
      </main>
      </PublicShell>
    </>
  );
}
