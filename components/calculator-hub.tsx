"use client";

import Link from "next/link";
import { ArrowRight, BadgePercent, Calculator, Gauge, RotateCcw, ShieldCheck, Target } from "lucide-react";
import { calculatorCatalog } from "@/core/calculator-catalog";
import { PublicShell } from "./public-shell";
import { useLanguage } from "./providers";

const iconMap = {
  profit: Calculator,
  rto: RotateCcw,
  "break-even": Target,
  acos: BadgePercent,
  roas: Gauge,
} as const;

export function CalculatorHub() {
  const { language } = useLanguage();
  const english = language === "english";
  return (
    <PublicShell>
      <main className="px-4 py-10 sm:px-6 md:py-16 lg:px-10" lang={english?'en':'hi'}>
        <div className="mx-auto max-w-[1220px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="liquid-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold text-blue-700"><ShieldCheck className="size-4" />{english ? "Private. Free. No sign-in." : "निजी। मुफ़्त। बिना साइन इन।"}</span>
            <h1 className="mt-5 text-balance text-4xl font-black tracking-[-.045em] text-slate-950 sm:text-5xl">{english ? "Run the numbers." : "अपने आँकड़े जाँचें।"}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">{english ? "Choose what you want to check. Every tool shows the formula, the result and what the number means." : "जो check करना है उसे चुनो। हर tool formula, result और उसका सीधा मतलब दिखाएगा।"}</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {calculatorCatalog.map((tool) => {
              const Icon = iconMap[tool.id];
              return (
                <Link key={tool.id} href={tool.href} className={`calculator-choice calculator-choice-${tool.tone}`}>
                  <span className="calculator-choice-icon"><Icon className="size-6" /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-black tracking-[-.025em] text-slate-950">{english ? tool.title : tool.hinglishTitle}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
                    <p className="mt-4 rounded-xl bg-white/65 px-3 py-2 text-[11px] font-bold text-slate-600">{tool.formula}</p>
                  </div>
                  <ArrowRight className="mt-1 size-5 shrink-0 text-blue-600" />
                </Link>
              );
            })}
          </div>

          <div className="navy-frost mt-8 flex flex-col gap-4 rounded-[26px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div><h2 className="text-xl font-black">{english ? "See the picture behind every order." : "हर ऑर्डर का पूरा हिसाब देखें।"}</h2></div>
            <Link href="/analyze" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-extrabold text-blue-800 shadow-sm">Open Profit Check <ArrowRight className="ml-2 size-4" /></Link>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
