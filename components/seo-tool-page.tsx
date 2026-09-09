"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, FileCheck2, Info, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateTool, type CalculatorMathType, type CalculatorValues } from "@/core/calculators";
import { calculatorCatalog } from "@/core/calculator-catalog";
import { calculatorEntryForSlug, calculatorGroupForSlug } from "@/core/marketplace-calculators";
import { MARKETPLACE_DEFINITIONS, type MarketplaceExperienceId } from "@/core/marketplace-definitions";
import { mapHeaders } from "@/core/parsers/aliases";
import type { SeoPageConfig } from "@/core/seo-pages";
import { PublicShell } from "./public-shell";

export function SeoToolPage({ config }: { config: SeoPageConfig }) {
  const calculatorEntry = calculatorEntryForSlug(config.slug);
  const marketplace = calculatorEntry ? MARKETPLACE_DEFINITIONS[calculatorEntry.marketplaceId] : undefined;
  const exactHref = marketplace?.fileAnalysis.state === "live" ? "/analyze" : marketplace?.connection.href ?? "/analyze";
  const exactLabel = marketplace?.fileAnalysis.state === "live" ? "Open Profit Check" : marketplace ? "Open Connections" : "Open Profit Check";
  const exactEyebrow = marketplace?.fileAnalysis.state === "live" ? "Exact report check" : marketplace ? "Read-only connection" : "Exact report check";
  const exactCopy = marketplace?.fileAnalysis.state === "live"
    ? `Use supported ${marketplace.name} report evidence to move beyond a quick estimate and see confirmed, provisional or incomplete economics.`
    : marketplace
      ? `${marketplace.name} file analysis is not claimed here. Use the supported connection for order evidence and enter actual gateway or bank payout values in the calculators.`
      : "Upload the report to see confirmed contribution, risk and every supported SKU action.";

  return (
    <PublicShell>
      <main className="website-editorial">
        <section className="px-4 py-9 sm:px-6 md:py-14 lg:px-10">
          <div className="mx-auto max-w-[1220px]">
            <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs font-bold text-slate-500"><Link href="/" className="hover:text-blue-700">Home</Link><span aria-hidden="true">/</span><Link href="/calculators" className="hover:text-blue-700">Calculators</Link><span aria-hidden="true">/</span><span aria-current="page" className="text-slate-800">{config.title}</span></nav>

            <CalculatorSwitcher currentSlug={config.slug} />

            <div className="mt-8 grid items-start gap-8 lg:grid-cols-[.82fr_1.18fr]">
              <div className="lg:sticky lg:top-28">
                {marketplace ? <div className="mb-5 flex h-11 items-center"><Image src={marketplace.logo} alt={`${marketplace.name} logo`} width={180} height={48} className="max-h-10 w-auto max-w-[180px] object-contain object-left" /></div> : null}
                <p className="eyebrow">{config.eyebrow}</p>
                <h1 className="mt-4 text-balance text-4xl font-black leading-tight tracking-[-.045em] text-slate-950 sm:text-5xl">{config.headline}</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">{config.intro}</p>
                <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-slate-600"><span className="liquid-pill inline-flex items-center gap-1.5 rounded-full px-3 py-2"><CheckCircle2 className="size-4 text-emerald-600" />No login</span><span className="liquid-pill inline-flex items-center gap-1.5 rounded-full px-3 py-2"><ShieldCheck className="size-4 text-blue-600" />Calculation stays local</span>{marketplace ? <Link href={marketplace.hubHref} className="liquid-pill inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-blue-700">{marketplace.name} hub <ArrowRight className="size-3.5" /></Link> : null}</div>
              </div>
              <MiniTool type={config.toolType} marketplaceId={calculatorEntry?.marketplaceId} />
            </div>
          </div>
        </section>

        <section className="border-t border-white/80 bg-white/30 px-4 py-12 sm:px-6 md:py-16 lg:px-10">
          <div className="mx-auto max-w-[1220px]">
            <div className="grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
              <article className="liquid-panel rounded-[26px] p-6 sm:p-8">
                <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-slate-950">The short version</h2>
                <p className="mt-4 text-sm leading-7 text-slate-700">{config.directAnswer}</p>
                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs font-black text-slate-900">Formula</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{config.formula}</p>
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-xs font-black text-slate-900">Worked example</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{config.example}</p>
                </div>
              </article>

              <article className="liquid-panel rounded-[26px] p-6 sm:p-8">
                <h2 className="text-2xl font-black tracking-[-.03em] text-slate-950">{config.guideTitle}</h2>
                <ul className="mt-6 space-y-4">{config.guide.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
                <p className="mt-7 border-t border-blue-100 pt-6 text-sm leading-6 text-slate-600">This quick calculator is an estimate. Full evidence review also has to account for identifiers, payout/settlement timing, multiple periods and missing costs where those inputs matter.</p>
              </article>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.72fr]">
              <section className="liquid-panel rounded-[26px] p-6 sm:p-8">
                <h2 className="text-2xl font-black tracking-[-.03em] text-slate-950">Common questions</h2>
                <div className="mt-6 space-y-5">
                  {config.faqs.map(([question, answer]) => (
                    <div key={question} className="border-b border-blue-100 pb-5 last:border-0 last:pb-0">
                      <h3 className="text-sm font-black text-slate-950">{question}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap gap-2 border-t border-blue-100 pt-6">
                  {config.related.map((item) => (
                    <Link key={item.href} href={item.href} className="liquid-pill rounded-full px-4 py-2 text-xs font-extrabold text-slate-700 hover:text-blue-700">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </section>

              <aside className="navy-frost rounded-[26px] p-6 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[.16em] text-blue-200">{exactEyebrow}</p>
                <h2 className="mt-4 text-2xl font-black tracking-[-.03em]">Go from estimate to evidence.</h2>
                <p className="mt-4 text-sm leading-6 text-blue-100">{exactCopy}</p>
                <Button asChild className="mt-6 w-full bg-white font-extrabold text-blue-800 hover:bg-blue-50"><Link href={exactHref}>{exactLabel} <ArrowRight className="ml-2 size-4" /></Link></Button>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

function CalculatorSwitcher({ currentSlug }: { currentSlug: string }) {
  const group = calculatorGroupForSlug(currentSlug);
  if (group) {
    return (
      <nav className="liquid-panel rounded-[22px] p-2" aria-label={`Choose ${group.label} calculator`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {group.calculators.map((tool) => {
            const active = currentSlug === tool.slug;
            return <Link key={tool.slug} href={`/${tool.slug}`} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center justify-center rounded-2xl px-2 text-center text-[11px] font-extrabold transition sm:text-xs ${active ? "liquid-button" : "liquid-soft text-slate-700 hover:text-blue-700"}`}>{tool.shortTitle}</Link>;
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="liquid-panel grid grid-cols-2 gap-2 rounded-[22px] p-2 sm:grid-cols-5" aria-label="Choose calculator">
      {calculatorCatalog.map((tool) => {
        const active = currentSlug === tool.href.slice(1);
        return <Link key={tool.id} href={tool.href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center justify-center rounded-2xl px-2 text-center text-[11px] font-extrabold transition sm:text-xs ${active ? "liquid-button" : "liquid-soft text-slate-700 hover:text-blue-700"}`}>{tool.title}</Link>;
      })}
    </nav>
  );
}

function MiniTool({ type, marketplaceId }: { type: SeoPageConfig["toolType"]; marketplaceId?: MarketplaceExperienceId }) {
  const [values, setValues] = useState<CalculatorValues>(() => initialValues(type));
  const output = useMemo(() => calculateDisplay(type, values), [type, values]);
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <section className="calculator-shell rounded-[30px] p-4 sm:p-6" aria-label="Interactive calculator">
      <div className="flex items-center gap-3">
        <span className="liquid-button grid size-11 place-items-center rounded-2xl text-white">{type === "headers" ? <FileCheck2 className="size-5" /> : <Calculator className="size-5" />}</span>
        <div><p className="text-base font-black text-slate-950">Instant calculator</p><p className="mt-0.5 text-xs text-slate-500">Enter your own numbers • result updates instantly</p></div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <div className="calculator-entry-panel rounded-[22px] p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">1. Enter your numbers</h2><span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">₹ values</span></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fieldsFor(type, marketplaceId).map((field) => (
              <div key={field.key} className={field.key === "headers" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`tool-${field.key}`} className="text-xs font-extrabold text-slate-800">{field.label}</Label>
                <Input id={`tool-${field.key}`} className="calculator-input mt-2 h-12 rounded-xl" inputMode={field.key === "headers" ? "text" : "decimal"} value={values[field.key] ?? ""} onChange={(event) => set(field.key, event.target.value)} />
                <p className="mt-1.5 text-[10px] leading-4 text-slate-500">{field.helper}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`calculator-answer rounded-[22px] p-5 ${output.tone === "danger" ? "calculator-answer-danger" : output.tone === "warning" ? "calculator-answer-warning" : "calculator-answer-good"}`}>
          <div className="flex items-center gap-2"><Sparkles className="size-4" /><h2 className="text-sm font-black">2. Your answer</h2></div>
          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[.12em] opacity-75">{output.label}</p>
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 break-words text-3xl font-black tracking-[-.045em] tabular-nums sm:text-4xl">{output.value}</p>
          <p className="mt-2 text-sm font-bold opacity-80">{output.detail}</p>
          <div className="mt-6 rounded-2xl border border-white/70 bg-white/55 p-3 text-xs leading-5 text-slate-700"><span className="font-extrabold">Formula:</span> {output.formula}</div>
          <div className="mt-3 flex gap-2 text-[10px] leading-4 opacity-75"><Info className="mt-0.5 size-3.5 shrink-0" />Use actual observed costs and payout/settlement evidence wherever possible. This tool does not invent marketplace fee assumptions.</div>
        </div>
      </div>
    </section>
  );
}

function calculateDisplay(type: SeoPageConfig["toolType"], values: CalculatorValues) {
  if (type === "headers") {
    const headers = (values.headers ?? "").split(/[,\t;\n]+/).map((item) => item.trim()).filter(Boolean);
    const mapped = mapHeaders(headers).mapping;
    const valid = [mapped.subOrderId, mapped.sku, mapped.settlementAmount].every((item) => item !== undefined);
    return {
      label: "Format status",
      value: valid ? "Core headers found" : "Cannot safely calculate",
      detail: valid ? `${Object.keys(mapped).length} recognized columns` : "Sub-order, SKU and settlement amount are required.",
      formula: "Recognized header fingerprint + required critical fields",
      tone: valid ? "good" as const : "danger" as const,
    };
  }
  const result = calculateTool(type as CalculatorMathType, values);
  if (result.status === "insufficient") {
    return { label: resultLabel(type), value: "Add required values", detail: "A trustworthy answer needs positive source numbers.", formula: result.formula, tone: "warning" as const };
  }
  const numeric = Number(result.value);
  const value = type === "roas" ? `${result.value}x` : type === "acos" ? `${result.value}%` : formatInr(numeric);
  return {
    label: resultLabel(type),
    value,
    detail: result.secondaryValue ?? "",
    formula: result.formula,
    tone: Number.isFinite(numeric) && numeric < 0 ? "danger" as const : "good" as const,
  };
}

function resultLabel(type: Exclude<SeoPageConfig["toolType"], "headers">) {
  if (type === "margin") return "Contribution per order";
  if (type === "failure") return "Estimated RTO / return loss";
  if (type === "break-even") return "Approx. break-even price";
  if (type === "roas") return "Break-even ROAS";
  if (type === "acos") return "Maximum sustainable ACoS";
  return "Unexplained payment gap";
}

function initialValues(type: SeoPageConfig["toolType"]): CalculatorValues {
  if (type === "headers") return { headers: "Sub Order Number, Supplier SKU, Order Status, Selling Price, Net Settlement Amount" };
  if (type === "roas" || type === "acos") return { sale: "48000", preAd: "12000" };
  if (type === "failure") return { orders: "100", rate: "18", loss: "85" };
  if (type === "break-even") return { product: "305", packaging: "14", variable: "10", ads: "20", rate: "18", loss: "85", retained: "84" };
  if (type === "gap") return { expected: "48500", received: "46850" };
  return { sale: "649", settlement: "548", product: "305", packaging: "14", ads: "20" };
}

function fieldsFor(type: SeoPageConfig["toolType"], marketplaceId?: MarketplaceExperienceId) {
  const payoutLabel = marketplaceId === "woocommerce" ? "Net gateway / bank payout ₹" : marketplaceId === "shopify" ? "Net payout / balance amount ₹" : "Settlement received ₹";
  const payoutHelper = marketplaceId === "woocommerce"
    ? "Use actual payment-gateway or bank payout; WooCommerce order total alone is not settlement"
    : marketplaceId === "shopify"
      ? "Use Shopify Payments balance evidence or another actual gateway payout"
      : "Amount attributable to this order from supported settlement/payout evidence";
  const retainedLabel = marketplaceId === "woocommerce" || marketplaceId === "shopify" ? "Retained net payout %" : "Retained settlement %";
  const retainedHelper = marketplaceId === "woocommerce"
    ? "Actual gateway/bank payout ÷ selling price from your history"
    : marketplaceId === "shopify"
      ? "Actual net payout ÷ selling price from your history"
      : "Settlement ÷ selling price from your history";

  if (type === "margin") return [
    { key: "sale", label: "Selling price ₹", helper: "Customer-facing order value" },
    { key: "settlement", label: payoutLabel, helper: payoutHelper },
    { key: "product", label: "Product cost ₹", helper: "Your purchase or manufacturing cost" },
    { key: "packaging", label: "Packaging ₹", helper: "Bag, box, tape and labels" },
    { key: "ads", label: "Ads per order ₹", helper: "Attributable advertising cost" },
  ];
  if (type === "failure") return [
    { key: "orders", label: "Orders in sample", helper: "Use one consistent evidence period" },
    { key: "rate", label: "Return / RTO / refund rate %", helper: "Use the observed failure rate relevant to this channel" },
    { key: "loss", label: "Average loss per failure ₹", helper: "Observed economic loss per failed order" },
  ];
  if (type === "break-even") return [
    { key: "product", label: "Product cost ₹", helper: "Purchase or manufacturing cost" },
    { key: "packaging", label: "Packaging ₹", helper: "Per shipped order" },
    { key: "variable", label: "Other variable cost ₹", helper: "Only costs that change with orders" },
    { key: "ads", label: "Ads per order ₹", helper: "Attributable ad cost" },
    { key: "rate", label: "Failure rate %", helper: "Observed Return/RTO/refund percentage" },
    { key: "loss", label: "Loss per failure ₹", helper: "Observed average economic loss" },
    { key: "retained", label: retainedLabel, helper: retainedHelper },
  ];
  if (type === "roas" || type === "acos") return [
    { key: "sale", label: "Attributable ad sales ₹", helper: "Sales linked to this advertising spend" },
    { key: "preAd", label: "Pre-ad contribution ₹", helper: "Contribution available before paying for ads" },
  ];
  if (type === "gap") return [
    { key: "expected", label: "Expected settlement ₹", helper: "Total from the same report period" },
    { key: "received", label: "Bank credit received ₹", helper: "Actual credit for the same period" },
  ];
  return [{ key: "headers", label: "Paste comma/tab-separated header row", helper: "Rows and monetary values are not required" }];
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}
