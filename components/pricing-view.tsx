"use client";

import Link from "next/link";
import {
  ArrowRight,
  
  BarChart3,
  Check,
  Landmark,
  Layers3,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { useLanguage } from "@/components/providers";
import { PlanTierIcon } from "@/components/plan-tier-icon";

type TrialOffer = { enabled: boolean; days: number };
type TrialOffers = { starter: TrialOffer; pro: TrialOffer };

type Plan = {
  name: string;
  label: string;
  price: string;
  suffix: string;
  intro: string;
  bestFor: string;
  features: Array<{ title: string; text: string }>;
  href: string;
  cta: string;
  trialText?: string;
  featured?: boolean;
};

export function PricingView({
  actionReportPaise,
  starterMonthlyPaise,
  proMonthlyPaise,
  trials,
}: {
  actionReportPaise: number;
  starterMonthlyPaise: number;
  proMonthlyPaise: number;
  trials: TrialOffers;
}) {
  const { language } = useLanguage();
  const english = language === "english";

  const starterTrial = trials.starter.enabled ? trials.starter.days : 0;
  const proTrial = trials.pro.enabled ? trials.pro.days : 0;

  const plans: Plan[] = english ? [
    {
      name: "Free Check",
      label: "Start without paying",
      price: "₹0",
      suffix: "",
      intro: "See whether your sales are actually leaving money in your pocket.",
      bestFor: "Best for: trying SellerHisab before you pay",
      href: "/analyze",
      cta: "Check my profit free",
      features: [
        { title: "Current profit snapshot", text: "See the contribution left after the costs and losses supported by your current data." },
        { title: "Confirmed vs provisional", text: "SellerHisab separates confirmed money from values that still depend on missing or pending evidence." },
        { title: "Top 3 money problems", text: "See the three most important issues that are currently hurting your margin." },
        { title: "No payment to start", text: "See the result first. Pay only if you need a deeper report or recurring tools." },
      ],
    },
    {
      name: "Action Report",
      label: "One-time deep report",
      price: `₹${actionReportPaise / 100}`,
      suffix: "one-time",
      intro: "Unlock one analysis with a full breakdown and clear next actions.",
      bestFor: "Best for: one detailed decision report without a subscription",
      href: "/analyze",
      cta: "Analyze first",
      features: [
        { title: "Full SKU Action Board", text: "See which products are profitable, which are losing money and where to act first." },
        { title: "Break-even price & return limit", text: "See the minimum safe selling price and the return/RTO level your margin can tolerate." },
        { title: "Ads spend safety", text: "Estimate a safer ad-spend ceiling and the ROAS/ACoS level where profit turns negative." },
        { title: "What-if simulators", text: "Test price, return-rate and ad-spend changes before making the decision." },
        { title: "Excel + PDF export", text: "Download the full report for your partner, team or accountant." },
      ],
    },
    {
      name: "Starter",
      label: "Most useful for regular sellers",
      price: `₹${starterMonthlyPaise / 100}`,
      suffix: "/month",
      intro: "Run regular analyses without rebuilding your saved costs and history every time.",
      bestFor: "Best for: sellers who review profit every week or month",
      href: "/app/billing?plan=starter",
      cta: starterTrial ? `Start ${starterTrial}-day free trial` : "Choose Starter",
      trialText: starterTrial ? `${starterTrial}-day free trial • AutoPay after trial` : undefined,
      featured: true,
      features: [
        { title: "Saved analyses", text: "Keep previous analyses in your account instead of starting from zero each time." },
        { title: "Saved SKU costs", text: "Save product costs once and reuse them in later analyses." },
        { title: "Profit history", text: "Compare periods to see whether the business is improving or margin is slipping." },
        { title: "Loss & margin alerts", text: "Surface important profit problems before they quietly become larger losses." },
        { title: "Full decision reports", text: "Use detailed SellerHisab analysis and action-oriented reports on a recurring basis." },
      ],
    },
    {
      name: "Pro",
      label: "Full business control",
      price: `₹${proMonthlyPaise / 100}`,
      suffix: "/month",
      intro: "Connect sales, settlements, bank cash and operating signals into one deeper business view.",
      bestFor: "Best for: growing sellers with deeper finance and operations needs",
      href: "/app/billing?plan=pro",
      cta: proTrial ? `Start ${proTrial}-day free trial` : "Choose Pro",
      trialText: proTrial ? `${proTrial}-day free trial • AutoPay after trial` : undefined,
      features: [
        { title: "Everything in Starter", text: "Saved costs, history, alerts and recurring analyses are included." },
        { title: "Multiple seller profiles", text: "Keep multiple seller profiles or business setups organised under one account." },
        { title: "Order → Settlement → Bank", text: "Follow the money from order to marketplace settlement and then to the bank." },
        { title: "Advanced finance review", text: "Review missing or short settlements, cash mismatches and deeper reconciliation issues." },
        { title: "Ads profitability", text: "Evaluate ad spend against actual product margin, not sales or ROAS alone." },
        { title: "Inventory insights", text: "Combine stock and selling signals for better reorder and working-capital decisions." },
        { title: "Marketplace connections", text: "Reduce manual file work with supported read-only connectors and API sync." },
        { title: "Workspace + Ask + benchmarks", text: "Use advanced workspace controls, evidence-bound questions and comparison insights." },
      ],
    },
  ] : [
    {
      name: "Free Check",
      label: "बिना pay किए शुरू करें",
      price: "₹0",
      suffix: "",
      intro: "देखें कि आपकी sales के बाद वास्तव में कितना पैसा बच रहा है।",
      bestFor: "सबसे अच्छा: pay करने से पहले SellerHisab try करने के लिए",
      href: "/analyze",
      cta: "Profit free में check करें",
      features: [
        { title: "Current profit snapshot", text: "Available costs और losses के बाद कितना contribution बच रहा है, वह देखें।" },
        { title: "Confirmed vs provisional", text: "जो money confirmed है और जो missing या pending data पर depend करती है, दोनों अलग दिखेंगे।" },
        { title: "Top 3 money problems", text: "Margin को सबसे ज़्यादा नुकसान देने वाली 3 important problems पहले दिखेंगी।" },
        { title: "शुरू करने के लिए payment नहीं", text: "पहले result देखें। Deeper report या recurring tools चाहिए तभी pay करें।" },
      ],
    },
    {
      name: "Action Report",
      label: "One-time deep report",
      price: `₹${actionReportPaise / 100}`,
      suffix: "one-time",
      intro: "एक analysis का full breakdown और clear next actions unlock करें।",
      bestFor: "सबसे अच्छा: subscription के बिना एक detailed decision report के लिए",
      href: "/analyze",
      cta: "पहले analyze करें",
      features: [
        { title: "Full SKU Action Board", text: "कौन-सा product profit दे रहा है, कौन loss में है और पहले कहाँ action लेना है, देखें।" },
        { title: "Break-even price & return limit", text: "Minimum safe selling price और कितनी Return/RTO तक margin safe है, देखें।" },
        { title: "Ads spend safety", text: "Ads पर कितना spend safe है और किस ROAS/ACoS के बाद profit negative होगा, समझें।" },
        { title: "What-if simulators", text: "Price, return rate या ad spend बदलने से पहले margin पर effect check करें।" },
        { title: "Excel + PDF export", text: "Full report download करके partner, team या CA के साथ share करें।" },
      ],
    },
    {
      name: "Starter",
      label: "Regular sellers के लिए useful",
      price: `₹${starterMonthlyPaise / 100}`,
      suffix: "/month",
      intro: "Regular analysis करें और हर बार saved costs तथा history दोबारा manage न करें।",
      bestFor: "सबसे अच्छा: हर week या month profit review करने वाले sellers के लिए",
      href: "/app/billing?plan=starter",
      cta: starterTrial ? `${starterTrial}-day free trial शुरू करें` : "Starter चुनें",
      trialText: starterTrial ? `${starterTrial}-day free trial • trial के बाद AutoPay` : undefined,
      featured: true,
      features: [
        { title: "Saved analyses", text: "पुराने analyses account में रखें, ताकि हर बार zero से शुरू न करना पड़े।" },
        { title: "Saved SKU costs", text: "Product cost एक बार save करें और बाद के analyses में reuse करें।" },
        { title: "Profit history", text: "Different periods compare करके देखें कि business improve हो रहा है या margin गिर रहा है।" },
        { title: "Loss & margin alerts", text: "Important profit problems को बड़ा loss बनने से पहले identify करें।" },
        { title: "Full decision reports", text: "Regular use के लिए detailed SellerHisab analysis और action-oriented reports पाएं।" },
      ],
    },
    {
      name: "Pro",
      label: "Full business control",
      price: `₹${proMonthlyPaise / 100}`,
      suffix: "/month",
      intro: "Sales, Settlement, Bank Cash और operating signals को एक deeper business view में देखें।",
      bestFor: "सबसे अच्छा: growing sellers और deeper finance needs के लिए",
      href: "/app/billing?plan=pro",
      cta: proTrial ? `${proTrial}-day free trial शुरू करें` : "Pro चुनें",
      trialText: proTrial ? `${proTrial}-day free trial • trial के बाद AutoPay` : undefined,
      features: [
        { title: "Starter में सब कुछ", text: "Saved costs, history, alerts और recurring analyses included हैं।" },
        { title: "Multiple seller profiles", text: "एक account में अलग seller profiles या business setups organised रखें।" },
        { title: "Order → Settlement → Bank", text: "Order से marketplace Settlement और फिर Bank तक पूरा money trail देखें।" },
        { title: "Advanced finance review", text: "Missing/short settlement, cash mismatch और deeper reconciliation issues identify करें।" },
        { title: "Ads profitability", text: "Ads spend को actual product margin के साथ evaluate करें, केवल sales या ROAS पर नहीं।" },
        { title: "Inventory insights", text: "Stock और selling signals को साथ देखकर reorder तथा working-capital decisions बेहतर करें।" },
        { title: "Marketplace connections", text: "Supported read-only connectors और API sync से manual file work कम करें।" },
        { title: "Workspace + Ask + benchmarks", text: "Advanced workspace controls, evidence-bound questions और comparison insights use करें।" },
      ],
    },
  ];

  return (
    <PublicShell>
      <main lang={english?'en':'hi'} className="website-pricing min-h-screen bg-[radial-gradient(circle_at_top,#eef5ff_0,#f8fafc_42%,#f6f8fb_100%)] px-4 py-14 sm:px-6 md:py-20 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-4 py-2 text-xs font-extrabold uppercase tracking-[.12em] text-blue-700 shadow-sm">
              <Sparkles className="size-4" />
              {english ? "Plans for your next step." : "आपके अगले कदम के लिए।"}
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-[-.05em] text-slate-950 sm:text-5xl md:text-6xl">
              {english ? (
                <>Start with clarity.<span className="block text-blue-600">Grow at your pace.</span></>
              ) : (
                <>पहले अपना लाभ जानें।<span className="block text-blue-600">फिर सही प्लान चुनें।</span></>
              )}
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {english
                ? "Your first profit check is free. Choose a plan when you need saved history or a deeper view."
                : "पहला लाभ विश्लेषण मुफ़्त है। हिस्ट्री सेव करने या ज़्यादा जानकारी के लिए अपना प्लान चुनें।"}
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3 text-xs font-bold text-slate-600 sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm"><ShieldCheck className="size-4 text-emerald-600" />{english ? "Secure Razorpay checkout" : "Secure Razorpay checkout"}</span>
              
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm"><RefreshCcw className="size-4 text-violet-600" />{english ? "Monthly plans can be cancelled" : "Monthly plans cancel किए जा सकते हैं"}</span>
            </div>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => <PlanCard key={plan.name} plan={plan} english={english} />)}
          </div>

          <section className="mt-12 grid gap-5 lg:grid-cols-3">
            <InfoCard icon={<WalletCards className="size-5" />} title={english ? "How is access activated after payment?" : "Payment के बाद access कैसे activate होता है?"} text={english ? "Your plan activates after Razorpay confirms payment. If checkout closes, sign in to check your payment status." : "Razorpay से भुगतान की पुष्टि होने पर प्लान चालू होता है। Checkout बंद हो जाए तो साइन इन करके भुगतान की स्थिति देखें।"} />
            <InfoCard icon={<Landmark className="size-5" />} title={english ? "What does bank-credit comparison mean?" : "Bank-credit comparison का क्या मतलब है?"} text={english ? "Pro can compare the expected marketplace settlement with the amount that actually reached the bank, so mismatches are easier to identify." : "Pro expected marketplace Settlement को actual Bank credit से compare करके mismatch identify करने में help करता है।"} />
            <InfoCard icon={<Layers3 className="size-5" />} title={english ? "Starter or Pro?" : "Starter या Pro?"} text={english ? "Choose Starter for saved costs, history and regular profit tracking. Choose Pro when you also need deeper finance, bank, ads, inventory and connections." : "Saved costs, history और regular profit tracking के लिए Starter चुनें। Deeper finance, Bank, Ads, Inventory और connections चाहिए तो Pro चुनें।"} />
          </section>

          <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" /><div><p className="font-extrabold text-emerald-950">{english ? "Payment safety by design" : "Payment safety by design"}</p><p className="mt-1 text-sm leading-6 text-emerald-900">{english ? "Free analysis can run before sign-in. Real payments require an account so paid access can still be recovered if the browser closes." : "Free analysis sign-in से पहले चल सकता है। Real payment के लिए account ज़रूरी है, ताकि browser बंद होने पर भी paid access recover हो सके।"}</p></div></div>
          </div>

          {(starterTrial || proTrial) ? <p className="mt-6 text-center text-xs font-semibold leading-5 text-slate-600">{english ? "Free trials require Razorpay AutoPay authorisation. The monthly plan charge starts after the configured trial period unless the subscription is cancelled first." : "Free trial के लिए Razorpay AutoPay authorisation ज़रूरी है। Monthly plan charge configured trial period के बाद शुरू होता है, अगर subscription पहले cancel नहीं किया गया हो।"}</p> : null}
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">{english ? "Monthly plans are recurring subscriptions until cancelled or completed by the payment provider. Feature availability can depend on supported marketplace and data connections." : "Monthly plans recurring subscriptions हैं, जब तक वे cancel या payment provider द्वारा complete नहीं होते। Feature availability supported marketplace और data connections पर depend कर सकती है।"}</p>
        </div>
      </main>
    </PublicShell>
  );
}

function PlanCard({ plan, english }: { plan: Plan; english: boolean }) {
  const featured = Boolean(plan.featured);
  const icon = plan.name === "Free Check" ? <BarChart3 className="size-5" /> : <PlanTierIcon plan={plan.name === "Action Report" ? "action_report" : plan.name === "Starter" ? "starter" : "pro"} />;
  return <article className={["relative flex min-h-full flex-col overflow-hidden rounded-[28px] border p-6 transition-transform duration-200 hover:-translate-y-1", featured ? "border-blue-500 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,.18)]" : "border-slate-200/90 bg-white/95 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,.07)]"].join(" ")}>
    {featured && <div className="absolute right-4 top-4 rounded-full bg-blue-500 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white">{english ? "More depth" : "ज़्यादा जानकारी"}</div>}
    <div className={["flex size-11 items-center justify-center rounded-2xl", featured ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-700"].join(" ")}>{icon}</div>
    <p className={["mt-5 text-xs font-extrabold uppercase tracking-[.12em]", featured ? "text-blue-300" : "text-blue-700"].join(" ")}>{plan.label}</p>
    <h2 className="mt-2 text-2xl font-black tracking-[-.035em]">{plan.name}</h2>
    <p className={["mt-3 min-h-[72px] text-sm leading-6", featured ? "text-slate-300" : "text-slate-600"].join(" ")}>{plan.intro}</p>
    <div className="mt-5 flex items-end gap-1"><span className="text-4xl font-black tracking-[-.055em]">{plan.price}</span>{plan.suffix && <span className={featured ? "pb-1 text-xs font-semibold text-slate-400" : "pb-1 text-xs font-semibold text-slate-500"}>{plan.suffix}</span>}</div>
    {plan.trialText && <div className={featured ? "mt-3 rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-xs font-extrabold text-blue-200" : "mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700"}>{plan.trialText}</div>}
    <p className={["mt-3 rounded-2xl px-3 py-2 text-xs font-bold leading-5", featured ? "bg-white/10 text-slate-200" : "bg-slate-50 text-slate-600"].join(" ")}>{plan.bestFor}</p>
    <div className={featured ? "my-5 h-px bg-white/10" : "my-5 h-px bg-slate-100"} />
    <ul className="flex-1 space-y-4">{plan.features.map((feature) => <li key={feature.title} className="flex gap-3"><span className={["mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", featured ? "bg-blue-500 text-white" : "bg-emerald-50 text-emerald-700"].join(" ")}><Check className="size-3.5 stroke-[3]" /></span><div><p className={featured ? "text-sm font-extrabold text-white" : "text-sm font-extrabold text-slate-900"}>{feature.title}</p><p className={featured ? "mt-1 text-xs leading-5 text-slate-300" : "mt-1 text-xs leading-5 text-slate-600"}>{feature.text}</p></div></li>)}</ul>
    <Button asChild variant={featured ? "default" : "outline"} className={["mt-7 h-11 w-full rounded-xl font-extrabold", featured ? "bg-blue-500 text-white hover:bg-blue-400" : "border-slate-300 bg-white hover:bg-slate-50"].join(" ")}><Link href={plan.href}>{plan.cta}<ArrowRight className="ml-2 size-4" /></Link></Button>
  </article>;
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</div><p className="mt-4 font-extrabold text-slate-950">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>; }
