import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Calculator, FileSpreadsheet, Files } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import {
  MARKETPLACE_DEFINITIONS,
  PRIMARY_MARKETPLACE_IDS,
  type CapabilityState,
} from "@/core/marketplace-definitions";

export const metadata: Metadata = {
  title: "Marketplace Support: Files, Guides & Calculators",
  description: "Choose Meesho, Amazon India, Flipkart, Shopify or WooCommerce and open its SellerHisab marketplace hub.",
  alternates: { canonical: "/marketplaces" },
};

const STATE_STYLES: Record<CapabilityState, string> = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-800",
  available: "border-blue-200 bg-blue-50 text-blue-800",
  "activation-required": "border-amber-200 bg-amber-50 text-amber-800",
  "not-available": "border-amber-200 bg-amber-50 text-amber-800",
};

function statusText(state: CapabilityState) {
  if (state === "live") return "Live";
  if (state === "available") return "Available";
  if (state === "activation-required") return "Auth Required";
  return "Not Claimed";
}

function CompactRow({ icon, label, state }: { icon: ReactNode; label: string; state: CapabilityState }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-100 px-1 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3 text-sm font-bold text-slate-700">{icon}<span className="truncate">{label}</span></div>
      <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-extrabold ${STATE_STYLES[state]}`}>{statusText(state)}</span>
    </div>
  );
}

export default function MarketplacesPage() {
  const marketplaces = PRIMARY_MARKETPLACE_IDS.map((id) => MARKETPLACE_DEFINITIONS[id]);
  return (
    <PublicShell>
      <main className="website-editorial px-4 py-10 sm:px-6 md:py-14 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <section className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl md:text-6xl">Choose your marketplace</h1>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">Choose where you sell, then open all available SellerHisab tools for that marketplace in one place.</p>
          </section>

          <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="SellerHisab marketplaces">
            {marketplaces.map((marketplace) => (
              <article key={marketplace.id} className="flex h-full flex-col rounded-[24px] border border-slate-200/80 bg-white/85 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-28 shrink-0 items-center"><Image src={marketplace.logo} alt={`${marketplace.name} logo`} width={145} height={56} className="max-h-12 w-auto max-w-[112px] object-contain object-left" /></div>
                    <h2 className="min-w-0 text-lg font-black tracking-[-.025em] text-slate-950">{marketplace.name}</h2>
                  </div>
                  <Link href={marketplace.hubHref} aria-label={`Open ${marketplace.name} hub`} className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700 transition hover:bg-blue-100"><ArrowRight className="size-4" /></Link>
                </div>

                <div className="mt-2">
                  <CompactRow icon={<FileSpreadsheet className="size-4 text-blue-600" />} label="File Analyze" state={marketplace.fileAnalysis.state} />
                  <CompactRow icon={<Files className="size-4 text-blue-600" />} label="File First Only" state={marketplace.fileAnalysis.state} />
                  <CompactRow icon={<BookOpen className="size-4 text-blue-600" />} label="Guides Available" state={marketplace.guides.state} />
                  <CompactRow icon={<Calculator className="size-4 text-blue-600" />} label="Calculators Available" state={marketplace.calculators.state} />
                </div>

                <Link href={marketplace.hubHref} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700">View Full Hub <ArrowRight className="ml-2 size-4" /></Link>
              </article>
            ))}
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
