"use client";

import { useState, type SyntheticEvent, useEffect, useRef } from "react";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  IndianRupee,
  ListChecks,
  LockKeyhole,
  MoveRight,
  ShieldCheck,
  Tags,
  Truck,
  Upload,
  XCircle,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PublicShell } from "./public-shell";
import { useLanguage } from "./providers";
import { publicFaqs, publicFaqsHinglish } from "@/core/content";
import { displayRupees, type PublicPricing } from "./use-pricing";

export function LandingPage({ pricing }: { pricing: PublicPricing }) {
  const { language } = useLanguage();
  const english = language === "english";
  const faqs = english ? publicFaqs : publicFaqsHinglish;

  return (
    <PublicShell>
      <main>
        {/* FRAMER_EXACT_EXPORT_EMBED_V1 */}
        <FramerExactExportHero english={english} />

        <section className="section-pad">
          <div className="section-wrap">
            <div className="liquid-panel rounded-[28px] p-6 sm:p-8">
              <p className="eyebrow">{english ? "SellerHisab in simple words" : "SellerHisab simple words \u092e\u0947\u0902"}</p>
              <h2 className="mt-4 max-w-4xl text-3xl font-black tracking-[-.035em] text-slate-950 sm:text-4xl">
                {english
                  ? "Know where your money came from, where it went, and what is really left."
                  : "\u092a\u0948\u0938\u093e \u0915\u0939\u093e\u0901 \u0938\u0947 \u0906\u092f\u093e, \u0915\u0939\u093e\u0901 \u0917\u092f\u093e \u0914\u0930 \u0905\u0938\u0932 \u092e\u0947\u0902 \u0915\u093f\u0924\u0928\u093e \u092c\u091a\u093e \u2014 \u0938\u0940\u0927\u0947 \u0938\u092e\u091d\u0947\u0902\u0964"}
              </h2>
              <p className="mt-5 max-w-4xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {english
                  ? "SellerHisab is a simple money and profit-checking tool for online sellers. Add a supported marketplace report and your product cost, then see what you earned, what is still pending, where Return/RTO is hurting you, and what to fix first."
                  : "SellerHisab online sellers \u0915\u0947 \u0932\u093f\u090f simple money \u0914\u0930 profit-checking tool \u0939\u0948\u0964 Supported marketplace report \u0914\u0930 product cost add \u0915\u0930\u094b, \u092b\u093f\u0930 \u0938\u0940\u0927\u093e \u0926\u0947\u0916\u094b: \u0915\u093f\u0924\u0928\u093e \u0915\u092e\u093e\u092f\u093e, \u0915\u093f\u0924\u0928\u093e \u092a\u0948\u0938\u093e pending \u0939\u0948, Return/RTO \u092e\u0947\u0902 \u0915\u0939\u093e\u0901 loss \u0939\u094b \u0930\u0939\u093e \u0939\u0948 \u0914\u0930 \u0938\u092c\u0938\u0947 \u092a\u0939\u0932\u0947 \u0915\u094d\u092f\u093e fix \u0915\u0930\u0928\u093e \u0939\u0948\u0964"}
              </p>

              <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: "Sales",
                    en: "Order value. Sales and profit are not the same thing.",
                    hi: "Order \u0915\u0940 value\u0964 Sales \u0914\u0930 profit \u090f\u0915 \u091a\u0940\u091c\u093c \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
                  },
                  {
                    title: "Settlement",
                    en: "The payout shown by the marketplace after its adjustments.",
                    hi: "Marketplace \u0928\u0947 adjustments \u0915\u0947 \u092c\u093e\u0926 \u0915\u093f\u0924\u0928\u093e payout \u0926\u093f\u0916\u093e\u092f\u093e\u0964",
                  },
                  {
                    title: "Bank Cash",
                    en: "The money that actually reached your bank.",
                    hi: "Bank \u092e\u0947\u0902 actual \u0915\u093f\u0924\u0928\u093e \u092a\u0948\u0938\u093e \u0906\u092f\u093e\u0964",
                  },
                  {
                    title: "Profit view",
                    en: "What is left after available costs and losses are counted. If important data is missing, SellerHisab does not guess.",
                    hi: "Available costs \u0914\u0930 losses \u0917\u093f\u0928\u0928\u0947 \u0915\u0947 \u092c\u093e\u0926 \u0915\u094d\u092f\u093e \u092c\u091a\u093e\u0964 Important data missing \u0939\u094b \u0924\u094b SellerHisab guess \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u093e\u0964",
                  },
                ].map((item) => (
                  <div key={item.title} className="liquid-soft rounded-[22px] p-5">
                    <h3 className="text-base font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{english ? item.en : item.hi}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/methodology" className="text-sm font-black text-blue-700 hover:underline">
                  {english ? "How calculations work" : "Calculation \u0915\u0948\u0938\u0947 \u0939\u094b\u0924\u0940 \u0939\u0948"}
                </Link>
                <span className="text-slate-300" aria-hidden="true">|</span>
                <Link href="/calculators" className="text-sm font-black text-blue-700 hover:underline">Free calculators</Link>
                <span className="text-slate-300" aria-hidden="true">|</span>
                <Link href="/marketplaces" className="text-sm font-black text-blue-700 hover:underline">Marketplace guides</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section-pad border-y border-white/80 bg-white/35">
          <div className="section-wrap">
            <SectionHeading eyebrow={english ? "Three easy steps" : "बस तीन easy steps"} title={english ? "Your report becomes a clear money decision" : "आपकी report से सीधा money decision"} description={english ? "No accounting knowledge needed. Each step tells you what to add and why it matters." : "Accounting समझना ज़रूरी नहीं। हर step बताता है क्या add करना है और क्यों।"} />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <StepCard number="1" icon={Upload} title={english ? "Upload payment report" : "Payment report upload करो"} text={english ? "Add Payments to Date in XLSX, CSV or a supported ZIP." : "Payments to Date की XLSX, CSV या supported ZIP add करो।"} />
              <StepCard number="2" icon={IndianRupee} title={english ? "Add product cost" : "Product cost add करो"} text={english ? "Upload a sheet, paste from Excel or type costs directly." : "Sheet upload, Excel से paste या cost सीधे type करो।"} />
              <StepCard number="3" icon={ListChecks} title={english ? "See what to do first" : "पहले क्या करना है देखो"} text={english ? "Get loss, risk and action in simple seller language." : "Loss, risk और action simple seller language में देखो।"} />
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="section-wrap">
            <SectionHeading
              eyebrow="SKU Action Board"
              title={english ? "See the problem, understand why, then take action." : "Problem देखो, reason समझो, फिर action लो।"}
              description={english ? "The Action Board is generated from your own uploaded report and costs. SellerHisab does not publish invented SKU results on the website." : "Action Board आपकी अपनी uploaded report और costs से बनता है। Website पर invented SKU results नहीं दिखाए जाते।"}
            />
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              <CapabilityCard
                icon={XCircle}
                title={english ? "Loss-making SKUs" : "Loss-making SKUs"}
                text={english ? "Identify SKUs whose observed contribution is below zero and see the supporting calculation." : "जिन SKUs का observed contribution zero से नीचे है, उन्हें calculation के साथ पहचानो।"}
              />
              <CapabilityCard
                icon={Truck}
                title={english ? "Return & RTO risk" : "Return & RTO risk"}
                text={english ? "Separate delivered economics from return/RTO exposure before making a pause or pricing decision." : "Pause या pricing decision से पहले delivered economics और return/RTO exposure अलग देखो।"}
              />
              <CapabilityCard
                icon={Tags}
                title={english ? "Missing-data review" : "Missing-data review"}
                text={english ? "When product cost or another critical input is missing, the engine marks the result incomplete instead of guessing." : "Product cost या critical input missing हो तो engine guess करने के बजाय result को incomplete mark करता है।"}
              />
            </div>
            <div className="mt-6 text-center">
              <Button asChild className="liquid-button rounded-xl font-extrabold"><Link href="/analyze">{english ? "Analyze my real report" : "अपनी real report analyze करें"}<MoveRight className="ml-2 size-4" /></Link></Button>
            </div>
          </div>
        </section>

        <section className="section-pad border-y border-white/80 bg-white/35">
          <div className="section-wrap grid items-center gap-10 lg:grid-cols-2">
            <div>
              <SectionHeading eyebrow={english ? "No confusing profit claim" : "Confusing profit claim नहीं"} title={english ? "Confirmed money stays separate from money at risk" : "Confirmed पैसा और risk वाला पैसा अलग रहेगा"} description={english ? "You can immediately see what is trustworthy, what may change and what data is missing." : "सीधे देखो: क्या reliable है, क्या बदल सकता है और क्या missing है।"} align="left" />
              <div className="mt-7 space-y-3">
                <StateRow icon={CheckCircle2} tone="green" title="Confirmed Contribution" text={english ? "Settlement and required costs are available." : "Settlement और required costs available हैं।"} />
                <StateRow icon={CircleAlert} tone="amber" title="Still at Risk" text={english ? "Pending settlement, return or adjustment can change this." : "Pending settlement, return या adjustment इसे बदल सकता है।"} />
                <StateRow icon={XCircle} tone="red" title="Incomplete" text={english ? "A critical cost or field is missing, so the engine does not guess." : "Critical cost या field missing है, इसलिए engine guess नहीं करता।"} />
              </div>
            </div>
            <div className="liquid-panel rounded-[28px] p-6 sm:p-8">
              <p className="eyebrow">Contribution logic</p>
              <h3 className="mt-2 text-lg font-extrabold text-slate-950">{english ? "Your own report determines every amount" : "हर amount आपकी अपनी report से आता है"}</h3>
              <div className="mt-7 space-y-3">
                <FormulaRow sign="+" label={english ? "Settlement received / retained value" : "Settlement received / retained value"} />
                <FormulaRow sign="−" label={english ? "Product and packaging costs" : "Product और packaging costs"} />
                <FormulaRow sign="−" label={english ? "Ads and other available variable costs" : "Ads और available variable costs"} />
                <FormulaRow sign="±" label={english ? "Returns, RTO and settlement adjustments" : "Returns, RTO और settlement adjustments"} />
                <div className="mt-5 border-t border-blue-200 pt-5">
                  <p className="text-sm font-black text-emerald-800">= {english ? "Observed contribution" : "Observed contribution"}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{english ? "No sample rupee value is hard-coded here. The dashboard calculates from the seller's uploaded evidence." : "यहाँ कोई sample rupee value hard-code नहीं है। Dashboard seller की uploaded evidence से calculate करता है।"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="section-wrap grid items-center gap-9 lg:grid-cols-[.8fr_1.2fr]">
            <div className="liquid-panel mx-auto grid size-48 place-items-center rounded-full"><div className="liquid-button grid size-28 place-items-center rounded-full"><LockKeyhole className="size-12" strokeWidth={1.8} /></div></div>
            <div>
              <p className="eyebrow">Privacy by design</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-[-.035em] text-slate-950 sm:text-4xl">{english ? "Your marketplace files stay on your device." : "आपकी marketplace files आपके device पर ही रहती हैं।"}</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">{english ? "Reports are parsed and calculated in your browser. Raw rows, order IDs, SKU names and customer data are not sent to our server." : "Reports browser में parse और calculate होती हैं। Raw rows, order IDs, SKU names और customer data server को नहीं भेजा जाता।"}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{[english ? "Browser-local calculation" : "Browser में calculation", "No marketplace password", english ? "No raw report upload" : "Raw report upload नहीं", "Clear Local Data control"].map((item) => <div key={item} className="flex items-center gap-2 text-sm font-bold text-slate-800"><Check className="size-4 text-emerald-600" />{item}</div>)}</div>
            </div>
          </div>
        </section>

        <section className="section-pad border-y border-white/80 bg-white/35">
          <div className="section-wrap">
            <SectionHeading
              eyebrow={english ? "Seller finance library" : "Seller finance library"}
              title={english ? "Learn the logic before you trust the number." : "Number trust करने से पहले logic समझो।"}
              description={english ? "Marketplace hubs and answer-first guides explain contribution, settlement, RTO, break-even and SKU profitability with visible assumptions." : "Marketplace hubs और answer-first guides contribution, settlement, RTO, break-even और SKU profitability को visible assumptions के साथ समझाते हैं।"}
            />
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                { href: "/marketplaces/meesho", title: "Meesho seller hub", text: "Profit, RTO, returns, break-even and settlement tools." },
                { href: "/guides/settlement-reconciliation", title: "Settlement reconciliation", text: "Order → marketplace payout → bank actual." },
                { href: "/guides/contribution-margin", title: "Contribution margin", text: "Understand what the number includes—and what it does not." },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="liquid-panel group rounded-[24px] p-6">
                  <h3 className="text-lg font-black text-slate-950 group-hover:text-blue-700">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                  <span className="mt-5 inline-flex items-center text-xs font-black text-blue-700">Read <ArrowRight className="ml-1.5 size-4" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad border-y border-white/80 bg-white/35" id="pricing">
          <div className="section-wrap">
            <SectionHeading eyebrow={english ? "See value first" : "Value पहले देखो"} title={english ? "Start at ₹0. Pay only for deeper action." : "₹0 से start करो। Full action चाहिए तब pay करो।"} description={english ? "The free headline result is never hidden behind a login or payment wall." : "Free headline result login या payment के पीछे hide नहीं होता।"} />
            <div className="mt-10 grid gap-5 lg:grid-cols-4">
              <PriceCard name="Free Check" price="₹0" suffix="" features={["Current-period analysis", "Confirmed vs at risk", "Data-quality check", "Top 3 actions"]} cta="Start free" href="/analyze" />
              <PriceCard name="Action Report" price={displayRupees(pricing.actionReportPaise)} suffix="one-time" features={["Full Action Board", "Break-even calculations", "3 simulators", "Excel + PDF exports"]} cta="Check first" href="/analyze" featured />
              <PriceCard name="Starter" price={displayRupees(pricing.starterMonthlyPaise)} suffix="/month" features={["Unlimited fair-use checks", "Saved SKU costs", "History", "Alerts + reports"]} cta="View plan" href="/pricing" />
              <PriceCard name="Pro" price={displayRupees(pricing.proMonthlyPaise)} suffix="/month" features={["Multiple seller profiles", "Settlement review", "Bank-credit comparison", "All Starter features"]} cta="View plan" href="/pricing" />
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="mx-auto max-w-3xl">
            <SectionHeading eyebrow="FAQ" title={english ? "Simple answers" : "सीधे answers"} />
            <Accordion type="single" collapsible className="liquid-panel mt-8 rounded-[24px] px-5 sm:px-7">
              {faqs.map(([question, answer]) => <AccordionItem value={question} key={question}><AccordionTrigger className="min-h-14 text-left text-sm font-extrabold text-slate-900">{question}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-slate-600">{answer}</AccordionContent></AccordionItem>)}
            </Accordion>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-10">
          <div className="liquid-panel mx-auto max-w-5xl rounded-[30px] bg-blue-50/60 px-5 py-12 text-center sm:px-10">
            <p className="eyebrow">{english ? "Sales are not profit" : "Sales profit नहीं होती"}</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-.04em] text-slate-950 sm:text-4xl">{english ? "See which product makes money—and what to fix first." : "देखो कौनसा product पैसा बना रहा है—और पहले क्या fix करना है।"}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">{english ? "No login. No credit card. Your report stays on your device." : "Login नहीं। Credit card नहीं। Report device पर ही रहेगी।"}</p>
            <Button asChild size="lg" className="liquid-button mt-7 h-13 rounded-2xl px-7 font-extrabold"><Link href="/analyze">{english ? "Upload Payment File" : "Payment File Upload करें"}<ArrowRight className="ml-2 size-4" /></Link></Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}


const FRAMER_DESIGN_WIDTH = 1200;

function FramerExactExportHero({ english }: { english: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(FRAMER_DESIGN_WIDTH);
  const [heights, setHeights] = useState({ english: 1180, hinglish: 1180 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updateWidth = () => {
      const next = Math.min(FRAMER_DESIGN_WIDTH, Math.max(1, host.clientWidth));
      setHostWidth((current) => (Math.abs(current - next) < 1 ? current : next));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const handleLoad =
    (language: "english" | "hinglish") =>
    (event: SyntheticEvent<HTMLIFrameElement>) => {
      const frame = event.currentTarget;
      const doc = frame.contentDocument;
      if (!doc) return;

      let scheduled = 0;
      const measure = () => {
        scheduled = 0;
        const root = doc.querySelector<HTMLElement>("[data-framer-root]");
        if (!root) return;

        const rootRect = root.getBoundingClientRect();
        let visualBottom = rootRect.bottom;

        const candidates = root.querySelectorAll<HTMLElement>(
          "section, [data-framer-name]",
        );

        candidates.forEach((node) => {
          const view = doc.defaultView;
          const style = view?.getComputedStyle(node);
          if (style?.position === "fixed") return;

          const rect = node.getBoundingClientRect();
          if (!Number.isFinite(rect.bottom)) return;
          visualBottom = Math.max(visualBottom, rect.bottom);
        });

        const height = Math.ceil(
          Math.max(rootRect.height, visualBottom - rootRect.top) + 16,
        );

        if (height <= 0) return;
        setHeights((current) =>
          Math.abs(current[language] - height) < 2
            ? current
            : { ...current, [language]: height },
        );
      };

      const scheduleMeasure = () => {
        if (scheduled) return;
        scheduled = window.requestAnimationFrame(measure);
      };

      measure();

      if (frame.dataset.sellerhisabV5Observed !== "1") {
        frame.dataset.sellerhisabV5Observed = "1";
        const root = doc.querySelector<HTMLElement>("[data-framer-root]");
        if (root) {
          new ResizeObserver(scheduleMeasure).observe(root);
          new MutationObserver(scheduleMeasure).observe(root, {
            childList: true,
            subtree: true,
          });
        }
        void doc.fonts?.ready.then(scheduleMeasure);
      }

      window.setTimeout(scheduleMeasure, 100);
      window.setTimeout(scheduleMeasure, 500);
      window.setTimeout(scheduleMeasure, 1200);
      window.setTimeout(scheduleMeasure, 1800);
    };

  const scale = Math.min(1, hostWidth / FRAMER_DESIGN_WIDTH);
  const activeHeight = english ? heights.english : heights.hinglish;
  const scaledHeight = Math.ceil(activeHeight * scale);

  const frameClass = (active: boolean) =>
    `absolute left-0 top-0 block border-0 bg-transparent transition-opacity duration-150 ${
      active
        ? "pointer-events-auto opacity-100"
        : "pointer-events-none opacity-0"
    }`;

  const frameStyle = (height: number) => ({
    width: `${FRAMER_DESIGN_WIDTH}px`,
    height: `${height}px`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: "transparent",
  });

  return (
    <section className="w-full overflow-hidden bg-transparent">
      <div
        ref={hostRef}
        className="relative mx-auto w-full max-w-[1200px] overflow-x-hidden overflow-y-visible"
        style={{ height: `${scaledHeight}px` }}
      >
        <iframe
          src="/framer-home-exact/different-grocery-524870.framer.app/index-english-v3.html"
          title="SellerHisab business clarity"
          aria-hidden={!english}
          tabIndex={english ? 0 : -1}
          className={frameClass(english)}
          scrolling="no"
          loading="eager"
          style={frameStyle(heights.english)}
          onLoad={handleLoad("english")}
        />
        <iframe
          src="/framer-home-exact/different-grocery-524870.framer.app/index.html"
          title="SellerHisab business clarity Hinglish"
          aria-hidden={english}
          tabIndex={english ? -1 : 0}
          className={frameClass(!english)}
          scrolling="no"
          loading="eager"
          style={frameStyle(heights.hinglish)}
          onLoad={handleLoad("hinglish")}
        />
      </div>
    </section>
  );
}
function HeroPoint({ tone, icon, title, text }: { tone: "blue" | "amber" | "green"; icon: "sales" | "settlement" | "bank"; title: string; text: string }) {
  return (
    <div className="seller-hero-point flex items-center gap-4 sm:gap-5">
      <span className={`seller-hero-point-icon seller-hero-point-${tone}`} aria-hidden="true">
        {icon === "sales" ? <SalesChartSvg /> : icon === "settlement" ? <SettlementSvg /> : <BankSvg />}
      </span>
      <div>
        <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-base">{text}</p>
      </div>
    </div>
  );
}

function BusinessMoneyFlow({ english }: { english: boolean }) {
  const nodes = [
    { id: "store", title: english ? "Marketplace" : "Marketplace", subtitle: english ? "Orders arrive" : "Orders आते हैं", icon: <StoreSvg />, tone: "store" },
    { id: "sales", title: "Sales", subtitle: english ? "Orders & sales" : "ऑर्डर & बिक्री", icon: <SalesChartSvg />, tone: "sales" },
    { id: "settlements", title: "Settlements", subtitle: english ? "Marketplace payout" : "मार्केटप्लेस भुगतान", icon: <SettlementSvg />, tone: "settlement" },
    { id: "cash", title: "Bank Cash", subtitle: english ? "In your bank" : "आपके बैंक में", icon: <RupeeCoinSvg />, tone: "cash" },
    { id: "bank", title: english ? "Bank" : "Bank", subtitle: english ? "Money received" : "पैसा प्राप्त", icon: <BankSvg />, tone: "bank" },
  ];

  return (
    <div className="seller-money-flow mt-8 overflow-hidden rounded-[26px] sm:mt-10">
      <div className="seller-money-flow-scroll">
        <div className="seller-money-flow-track">
          {nodes.map((node, index) => (
            <div className="contents" key={node.id}>
              <div className={`seller-flow-node seller-flow-${node.tone}`} style={{ animationDelay: `${index * 180}ms` }}>
                <span className="seller-flow-visual" aria-hidden="true">{node.icon}</span>
                <p className="seller-flow-title">{node.title}</p>
                <p className="seller-flow-subtitle">{node.subtitle}</p>
              </div>
              {index < nodes.length - 1 ? <FlowConnector delay={index * 0.55} /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowConnector({ delay }: { delay: number }) {
  return (
    <div className="seller-flow-connector" aria-hidden="true">
      <span className="seller-flow-line" />
      <span className="seller-flow-particle" style={{ animationDelay: `${delay}s` }} />
      <span className="seller-flow-arrow">›</span>
    </div>
  );
}

function SalesChartSvg() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M12 50h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><rect x="15" y="34" width="7" height="13" rx="2" fill="currentColor" opacity=".42"/><rect x="27" y="27" width="7" height="20" rx="2" fill="currentColor" opacity=".62"/><rect x="39" y="19" width="7" height="28" rx="2" fill="currentColor" opacity=".9"/><path d="M14 29l10-7 9 3 15-14" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M43 11h5v5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function SettlementSvg() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M19 13h26l-5 11-8 8-8-8-5-11Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M24 40l8-8 8 8 5 11H19l5-11Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M24 14h16M25 50h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}

function BankSvg() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M9 25 32 11l23 14H9Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M14 28h36M12 52h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M18 29v19M28 29v19M38 29v19M48 29v19" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M9 53h46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}

function RupeeCoinSvg() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="currentColor" opacity=".15"/><circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="3"/><path d="M23 21h19M23 28h19M26 21c8 0 11 3 11 7 0 5-4 8-11 8h-3l15 12" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function StoreSvg() {
  return <svg viewBox="0 0 72 64" fill="none" aria-hidden="true"><path d="M13 25h46v29H13V25Z" fill="currentColor" opacity=".13"/><path d="M16 24h40l-4-12H20l-4 12Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M14 24c0 5 8 6 11 1 3 5 9 5 12 0 3 5 9 5 12 0 3 5 9 4 10-1" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M17 29v25h38V29M23 54V39h13v15M42 37h8v8h-8" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="M10 55h52" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}
function CapabilityCard({ icon: Icon, title, text }: { icon: typeof XCircle; title: string; text: string }) {
  return <article className="liquid-panel rounded-[24px] p-6"><span className="liquid-icon grid size-12 place-items-center rounded-2xl text-blue-600"><Icon className="size-5" /></span><h3 className="mt-5 text-lg font-extrabold text-slate-950">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>;
}

function FormulaRow({ sign, label }: { sign: string; label: string }) {
  return <div className="liquid-soft flex items-center gap-3 rounded-2xl p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-sm font-black text-blue-800">{sign}</span><p className="text-sm font-extrabold text-slate-800">{label}</p></div>;
}

function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow: string; title: string; description?: string; align?: "left" | "center" }) {
  return <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className="eyebrow">{eyebrow}</p><h2 className="mt-4 text-balance text-3xl font-black tracking-[-.035em] text-slate-950 sm:text-4xl">{title}</h2>{description && <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>}</div>;
}

function StepCard({ number, icon: Icon, title, text }: { number: string; icon: typeof Upload; title: string; text: string }) {
  return <article className="liquid-panel rounded-[24px] p-6"><div className="flex items-center justify-between"><span className="liquid-icon grid size-12 place-items-center rounded-2xl text-blue-600"><Icon className="size-5" /></span><span className="grid size-8 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">{number}</span></div><h3 className="mt-6 text-lg font-extrabold text-slate-950">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>;
}

function StateRow({ icon: Icon, tone, title, text }: { icon: typeof CheckCircle2; tone: "green" | "amber" | "red"; title: string; text: string }) {
  return <div className="liquid-soft flex gap-4 rounded-2xl p-4"><span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl state-${tone}`}><Icon className="size-5" /></span><div><h3 className="text-sm font-extrabold text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>;
}

function PriceCard({ name, price, suffix, features, cta, href, featured = false }: { name: string; price: string; suffix: string; features: string[]; cta: string; href: string; featured?: boolean }) {
  return <article className={`relative flex flex-col rounded-[24px] p-5 ${featured ? "liquid-button" : "liquid-panel"}`}>{featured && <span className="absolute -top-3 left-5 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-white">Most useful</span>}<p className={`text-sm font-extrabold ${featured ? "text-blue-100" : "text-slate-600"}`}>{name}</p><div className="mt-4 flex items-end gap-1"><span className="text-4xl font-black tracking-[-.05em]">{price}</span><span className={`mb-1 text-xs ${featured ? "text-blue-100" : "text-slate-500"}`}>{suffix}</span></div><ul className="mt-6 flex-1 space-y-3">{features.map((feature) => <li key={feature} className={`flex gap-2 text-sm ${featured ? "text-blue-50" : "text-slate-600"}`}><Check className={`mt-0.5 size-4 shrink-0 ${featured ? "text-white" : "text-emerald-600"}`} />{feature}</li>)}</ul><Button asChild variant={featured ? "secondary" : "outline"} className={`mt-7 w-full rounded-xl font-bold ${featured ? "text-blue-700" : "bg-white/60"}`}><Link href={href}>{cta}</Link></Button></article>;
}
