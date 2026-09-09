import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Cable, Calculator, CheckCircle2, CircleMinus, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import {
  MARKETPLACE_DEFINITIONS,
  PRIMARY_MARKETPLACE_IDS,
  type CapabilityState,
  type MarketplaceCapability,
} from "@/core/marketplace-definitions";

export const metadata: Metadata = {
  title: "Marketplace Support: Files, Connections, Guides & Calculators",
  description: "See exactly what SellerHisab supports for Meesho, Amazon India, Flipkart, Shopify and WooCommerce: file analysis, official connections, guides and calculators.",
  alternates: { canonical: "/marketplaces" },
};

const STATE_STYLES: Record<CapabilityState, string> = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-800",
  available: "border-blue-200 bg-blue-50 text-blue-800",
  "activation-required": "border-amber-200 bg-amber-50 text-amber-800",
  "not-available": "border-slate-200 bg-slate-100 text-slate-600",
};

function CapabilityRow({ capability, icon }: { capability: MarketplaceCapability; icon: ReactNode }) {
  const content = (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm">{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-slate-950">{capability.label}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${STATE_STYLES[capability.state]}`}>
            {capability.state === "live" ? "LIVE" : capability.state === "available" ? "AVAILABLE" : capability.state === "activation-required" ? "AUTH REQUIRED" : "NOT CLAIMED"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">{capability.detail}</p>
      </div>
    </div>
  );

  return capability.href ? <Link href={capability.href} className="block rounded-2xl p-2 transition hover:bg-white/70">{content}</Link> : <div className="rounded-2xl p-2">{content}</div>;
}

export default function MarketplacesPage() {
  const marketplaces = PRIMARY_MARKETPLACE_IDS.map((id) => MARKETPLACE_DEFINITIONS[id]);

  return (
    <PublicShell>
      <main className="website-editorial px-4 py-10 sm:px-6 md:py-16 lg:px-10">
        <div className="mx-auto max-w-[1220px]">
          <section className="mx-auto max-w-4xl text-center">
            <span className="liquid-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-blue-700"><ShieldCheck className="size-4" />Clear support. No fake connection claims.</span>
            <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl md:text-6xl">Choose your marketplace. See exactly what works.</h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">File analysis, official connections, guides and calculators are different features. This page shows the real support status for each platform before you start.</p>
          </section>

          <section className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3" aria-label="Marketplace status guide">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-900">LIVE</p><p className="mt-1 text-xs leading-5 text-emerald-800">Works in SellerHisab today for the stated workflow.</p></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-900">AUTH REQUIRED</p><p className="mt-1 text-xs leading-5 text-amber-800">Code support exists, but marketplace/app approval and seller authorization are still required.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4"><p className="text-xs font-black text-slate-800">NOT CLAIMED</p><p className="mt-1 text-xs leading-5 text-slate-600">SellerHisab will not pretend that workflow is supported.</p></div>
          </section>

          <section className="mt-12 grid gap-5 lg:grid-cols-2" aria-label="Supported marketplaces">
            {marketplaces.map((marketplace) => (
              <article key={marketplace.id} className="liquid-panel flex h-full flex-col rounded-[28px] p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex h-14 items-center">
                      <Image src={marketplace.logo} alt={`${marketplace.name} logo`} width={190} height={56} className="max-h-11 w-auto max-w-[190px] object-contain object-left" />
                    </div>
                    <h2 className="mt-3 text-2xl font-black tracking-[-.035em] text-slate-950">{marketplace.name}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{marketplace.summary}</p>
                  </div>
                  <Link href={marketplace.hubHref} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 transition hover:bg-blue-100" aria-label={`Open ${marketplace.name} hub`}><ArrowRight className="size-5" /></Link>
                </div>

                <div className="mt-6 grid gap-1 rounded-[22px] border border-white/80 bg-white/45 p-2">
                  <CapabilityRow capability={marketplace.fileAnalysis} icon={marketplace.fileAnalysis.state === "live" ? <FileSpreadsheet className="size-4 text-emerald-600" /> : <CircleMinus className="size-4 text-slate-500" />} />
                  <CapabilityRow capability={marketplace.connection} icon={<Cable className="size-4 text-blue-600" />} />
                  <CapabilityRow capability={marketplace.guides} icon={<BookOpen className="size-4 text-violet-600" />} />
                  <CapabilityRow capability={marketplace.calculators} icon={<Calculator className="size-4 text-amber-600" />} />
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Link href={marketplace.primaryCta.href} className="liquid-button inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold text-white">{marketplace.primaryCta.label}<ArrowRight className="ml-2 size-4" /></Link>
                  <Link href={marketplace.hubHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-100 bg-white/80 px-4 text-sm font-extrabold text-slate-700 hover:text-blue-700">View full hub</Link>
                  {marketplace.secondaryCta && marketplace.secondaryCta.href !== marketplace.hubHref ? <Link href={marketplace.secondaryCta.href} className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-extrabold text-blue-700">{marketplace.secondaryCta.label}</Link> : null}
                </div>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-[28px] border border-blue-100 bg-white/65 p-6 sm:p-8">
            <p className="eyebrow">Simple path</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-.035em] text-slate-950 sm:text-3xl">Start with the workflow that your marketplace actually supports.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-blue-50/70 p-5"><CheckCircle2 className="size-5 text-blue-600" /><p className="mt-3 text-sm font-black text-slate-950">1. Pick your marketplace</p><p className="mt-2 text-xs leading-5 text-slate-600">Open its hub instead of guessing which SellerHisab feature applies.</p></div>
              <div className="rounded-2xl bg-emerald-50/70 p-5"><CheckCircle2 className="size-5 text-emerald-600" /><p className="mt-3 text-sm font-black text-slate-950">2. Check the status</p><p className="mt-2 text-xs leading-5 text-slate-600">Use file analysis when it is live, or Connections when an approved read-only integration is the right path.</p></div>
              <div className="rounded-2xl bg-violet-50/70 p-5"><CheckCircle2 className="size-5 text-violet-600" /><p className="mt-3 text-sm font-black text-slate-950">3. Use guides + calculators</p><p className="mt-2 text-xs leading-5 text-slate-600">Understand the evidence first, then test pricing, returns and advertising decisions with your own numbers.</p></div>
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
