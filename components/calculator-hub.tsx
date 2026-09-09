"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgePercent, Calculator, Gauge, RotateCcw, ShieldCheck, Target } from "lucide-react";
import { marketplaceCalculatorGroups, type MarketplaceCalculatorKind } from "@/core/marketplace-calculators";
import { PublicShell } from "./public-shell";
import { useLanguage } from "./providers";

const iconMap: Record<MarketplaceCalculatorKind, typeof Calculator> = {
  profit: Calculator,
  failure: RotateCcw,
  "break-even": Target,
  acos: BadgePercent,
  roas: Gauge,
};

export function CalculatorHub() {
  const { language } = useLanguage();
  const english = language === "english";

  return (
    <PublicShell>
      <main className="website-editorial px-4 py-10 sm:px-6 md:py-16 lg:px-10" lang={english ? "en" : "hi"}>
        <div className="mx-auto max-w-[1220px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="liquid-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-blue-700"><ShieldCheck className="size-4" />{english ? "Private. Free. No sign-in." : "निजी। मुफ़्त। बिना साइन इन।"}</span>
            <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.045em] text-slate-950 sm:text-5xl">{english ? "Choose your marketplace, then run the numbers." : "पहले marketplace चुनें, फिर अपना हिसाब देखें।"}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">{english ? "Each marketplace gets the same clear workflow: profit, return/RTO loss, break-even price, ACoS and ROAS using your own evidence." : "हर marketplace के लिए profit, return/RTO loss, break-even price, ACoS और ROAS अपने data से check करें।"}</p>
          </div>

          <div className="mt-12 space-y-6">
            {marketplaceCalculatorGroups.map((group) => (
              <section key={group.marketplaceId} className="liquid-panel rounded-[28px] p-5 sm:p-7" aria-labelledby={`calculator-${group.marketplaceId}`}>
                <div className="flex flex-col gap-4 border-b border-blue-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex h-11 items-center"><Image src={group.logo} alt={`${group.label} logo`} width={180} height={48} className="max-h-10 w-auto max-w-[180px] object-contain object-left" /></div>
                    <h2 id={`calculator-${group.marketplaceId}`} className="mt-3 text-2xl font-black tracking-[-.035em] text-slate-950">{group.label} calculators</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{group.summary}</p>
                  </div>
                  <Link href={`/marketplaces/${group.marketplaceId}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white/80 px-4 text-xs font-extrabold text-blue-700">Open marketplace hub <ArrowRight className="ml-1.5 size-4" /></Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {group.calculators.map((tool) => {
                    const Icon = iconMap[tool.kind];
                    return (
                      <Link key={tool.slug} href={`/${tool.slug}`} className={`calculator-choice calculator-choice-${tool.tone} min-h-[170px] flex-col items-start`}>
                        <span className="calculator-choice-icon"><Icon className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black tracking-[-.02em] text-slate-950">{tool.shortTitle}</h3>
                          <p className="mt-2 text-xs leading-5 text-slate-600">{tool.description}</p>
                          <p className="mt-3 rounded-xl bg-white/65 px-3 py-2 text-[10px] font-bold leading-4 text-slate-600">{tool.formula}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="navy-frost mt-8 flex flex-col gap-4 rounded-[26px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div><h2 className="text-xl font-black">{english ? "Need the exact picture from your report?" : "Report से exact हिसाब चाहिए?"}</h2><p className="mt-1 text-sm text-blue-100">{english ? "Use Profit Check where file analysis is supported, or open Connections for an approved read-only integration." : "जहाँ file analysis live है वहाँ Profit Check use करें, या read-only integration के लिए Connections खोलें।"}</p></div>
            <div className="flex flex-wrap gap-2"><Link href="/analyze" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-extrabold text-blue-800 shadow-sm">Open Profit Check <ArrowRight className="ml-2 size-4" /></Link><Link href="/app/connections" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-extrabold text-white">Connections</Link></div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
