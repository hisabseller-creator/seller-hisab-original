"use client";

import Link from "next/link";
import { ArrowRight, BadgePercent, Calculator, Gauge, RotateCcw, ShieldCheck, Target } from "lucide-react";
import { universalCalculatorCatalog, type UniversalCalculatorKind } from "@/core/universal-calculators";
import { PublicShell } from "./public-shell";
import { useLanguage } from "./providers";

const iconMap: Record<UniversalCalculatorKind, typeof Calculator> = {
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
            <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.045em] text-slate-950 sm:text-5xl">{english ? "5 universal calculators. Use them for any marketplace." : "5 universal calculators — किसी भी marketplace के लिए।"}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">{english ? "No duplicate calculator for every platform. Use your actual payout, costs, return/RTO evidence and ad numbers for Meesho, Amazon, Flipkart, Shopify, WooCommerce or another marketplace." : "हर marketplace के लिए अलग duplicate calculator नहीं। Meesho, Amazon, Flipkart, Shopify, WooCommerce या किसी दूसरे marketplace के अपने actual payout, costs, return/RTO और ads numbers डालें।"}</p>
          </div>

          <section className="liquid-panel mt-12 rounded-[28px] p-5 sm:p-7" aria-labelledby="universal-calculators">
            <div className="flex flex-col gap-3 border-b border-blue-100/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.14em] text-blue-700">All marketplaces</p>
                <h2 id="universal-calculators" className="mt-2 text-2xl font-black tracking-[-.035em] text-slate-950">{english ? "Choose what you want to calculate" : "क्या calculate करना है, चुनें"}</h2>
              </div>
              <p className="text-xs font-bold text-slate-500">Meesho • Amazon • Flipkart • Shopify • WooCommerce • More</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {universalCalculatorCatalog.map((tool) => {
                const Icon = iconMap[tool.kind];
                return (
                  <Link key={tool.href} href={tool.href} className={`calculator-choice calculator-choice-${tool.tone} min-h-[190px] flex-col items-start`}>
                    <span className="calculator-choice-icon"><Icon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black tracking-[-.02em] text-slate-950">{tool.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{tool.description}</p>
                      <p className="mt-3 rounded-xl border border-white/50 bg-white/35 px-3 py-2 text-[10px] font-bold leading-4 text-slate-600">{tool.formula}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="navy-frost mt-8 flex flex-col gap-4 rounded-[26px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div><h2 className="text-xl font-black">{english ? "Need the exact picture from your report?" : "Report से exact हिसाब चाहिए?"}</h2><p className="mt-1 text-sm text-blue-100">{english ? "Use Profit Check where file analysis is supported, or open Connections for an approved read-only integration." : "जहाँ file analysis live है वहाँ Profit Check use करें, या read-only integration के लिए Connections खोलें।"}</p></div>
            <div className="flex flex-wrap gap-2"><Link href="/analyze" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-extrabold text-blue-800 shadow-sm">Open Profit Check <ArrowRight className="ml-2 size-4" /></Link><Link href="/app/connections" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-extrabold text-white">Connections</Link></div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
