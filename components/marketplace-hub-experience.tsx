"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgePercent,
  BookOpen,
  Calculator,
  Cable,
  Check,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Gauge,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dashboard } from "@/components/dashboard/dashboard";
import { PlanSubscribeButton } from "@/components/dashboard/plan-subscribe-button";
import { PublicShell } from "@/components/public-shell";
import { displayRupees, usePricing } from "@/components/use-pricing";
import { useAccountStatus, useLanguage } from "@/components/providers";
import { calculateTool, type CalculatorMathType, type CalculatorValues } from "@/core/calculators";
import { MARKETPLACE_DEFINITIONS, type MarketplaceExperienceId } from "@/core/marketplace-definitions";
import { marketplaceCalculatorGroups, type MarketplaceCalculatorEntry } from "@/core/marketplace-calculators";
import { mergeSavedCosts } from "@/core/account/saved-costs";
import { MAX_FILE_BYTES } from "@/core/parsers/files";
import { localDb } from "@/core/storage/local-db";
import type { AnalysisResult, CostRecord } from "@/core/types";

const CONNECTOR_BY_MARKETPLACE: Partial<Record<MarketplaceExperienceId, string>> = {
  amazon: "amazon-in-v1",
  flipkart: "flipkart-v1",
  shopify: "shopify-v1",
  woocommerce: "woocommerce-v1",
};

type HubTab = "analyze" | "connect" | "guides" | "calculators";
type ProgressState = { message: string; percent: number };
type ConnectionItem = {
  connectorId: string;
  channelId: string;
  label: string;
  accountStatus: "not-connected" | "connected" | "degraded" | "disabled";
  apiConfigured: boolean;
  authorization: string;
  orders: string;
  settlements: string;
  externalAccountDisplayName?: string | null;
  enabledCapabilities: string[];
  lastSuccessAt?: string;
  lastError?: string;
};

type GuideCard = { title: string; category: string; text: string };

const GUIDE_CARDS: Record<MarketplaceExperienceId, GuideCard[]> = {
  meesho: [
    { title: "Understand Meesho Settlements", category: "Settlements", text: "Start from Payments or Payments to Date and read deductions from the same evidence window." },
    { title: "Return / RTO Basics", category: "Returns", text: "See how returns and RTO affect the money finally retained from successful orders." },
    { title: "SKU Margin Guide", category: "Margins", text: "Combine settlement evidence with product, packaging and other known SKU costs." },
    { title: "Reading Your Payments File", category: "Payments", text: "Use supported payment fields without guessing missing values or hidden deductions." },
  ],
  amazon: [
    { title: "Orders vs Settlement", category: "Settlements", text: "Orders show what sold; Settlement Flat File V2 provides the marketplace money evidence." },
    { title: "Return / Refund Basics", category: "Returns", text: "Keep refunds and return timing visible when comparing contribution across periods." },
    { title: "Amazon SKU Margin", category: "Margins", text: "Attach known product costs and attributable advertising before calling contribution complete." },
    { title: "SP-API Connection Guide", category: "Connections", text: "Official read sync requires SellerHisab app configuration, approved roles/scopes and seller authorization." },
  ],
  flipkart: [
    { title: "Order Item & Settlement", category: "Settlements", text: "Use stable Order Item ID and SKU linkage when matching order and financial evidence." },
    { title: "Return / RTO Basics", category: "Returns", text: "Measure failure economics in rupees instead of judging only from a return percentage." },
    { title: "Flipkart SKU Margin", category: "Margins", text: "Keep supported settlement/P&L evidence and seller costs in one contribution view." },
    { title: "Seller API Connection", category: "Connections", text: "Order sync is authorization-dependent; settlement remains validated-file-first in this workflow." },
  ],
  shopify: [
    { title: "Orders vs Payouts", category: "Payments", text: "Orders establish the sale while Shopify Payments or gateway evidence establishes the payout." },
    { title: "Refund Timing", category: "Returns", text: "Keep cross-period refunds provisional until the relevant payout evidence arrives." },
    { title: "Store Margin Guide", category: "Margins", text: "Join order value, payout evidence, product cost and advertising without inventing gateway fees." },
    { title: "Admin API Connection", category: "Connections", text: "Read sync is available after app configuration and merchant authorization." },
  ],
  woocommerce: [
    { title: "Orders vs Gateway Payout", category: "Payments", text: "WooCommerce proves the order; your gateway or bank still has to prove the final payout." },
    { title: "Refund & Chargeback Basics", category: "Returns", text: "Gateway fees, refunds and chargebacks must stay separate from the WooCommerce order total." },
    { title: "WooCommerce Margin", category: "Margins", text: "Use actual gateway or bank payout together with seller-entered costs for contribution." },
    { title: "Read-only Connection", category: "Connections", text: "Connect a public HTTPS store using merchant-controlled WooCommerce REST read access." },
  ],
};

export function MarketplaceHubExperience({ marketplaceId }: { marketplaceId: MarketplaceExperienceId }) {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  const canAnalyze = definition.fileAnalysis.state === "live";
  const canConnect = definition.connection.state !== "not-available";
  const [tab, setTab] = useState<HubTab>(canAnalyze ? "analyze" : canConnect ? "connect" : "guides");
  const { language } = useLanguage();
  const english = language === "english";

  return (
    <PublicShell>
      <main className="website-editorial min-h-screen px-4 py-8 sm:px-6 md:py-12 lg:px-10" lang={english ? "en" : "hi"}>
        <div className="mx-auto max-w-[1280px]">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Link href="/marketplaces" className="text-blue-700 hover:underline">Marketplaces</Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-800">{definition.name}</span>
          </nav>

          <section className="mt-6 rounded-[26px] border border-slate-200/80 bg-white/80 p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-40 shrink-0 items-center sm:w-44">
                <Image src={definition.logo} alt={`${definition.name} logo`} width={190} height={76} className="max-h-20 w-auto max-w-[176px] object-contain object-left" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-[-.045em] text-slate-950 sm:text-4xl">{definition.name} Hub</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {canAnalyze
                    ? english
                      ? `Analyze your ${definition.name} data, use practical guides and run calculators — all in one place.`
                      : `${definition.name} data analyze करें, guides देखें और calculators चलाएँ — सब एक ही जगह।`
                    : english
                      ? `Use the supported ${definition.name} connection, guides and calculators from one place.`
                      : `${definition.name} connection, guides और calculators एक ही जगह use करें।`}
                </p>
              </div>
            </div>
          </section>

          <nav className={`mt-5 grid overflow-hidden rounded-[20px] border border-slate-200 bg-white/85 shadow-sm ${canConnect ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`} aria-label={`${definition.name} hub tools`}>
            {canAnalyze && <HubTabButton active={tab === "analyze"} icon={FileSpreadsheet} onClick={() => setTab("analyze")}>File Analyze</HubTabButton>}
            {canConnect && <HubTabButton active={tab === "connect"} icon={Cable} onClick={() => setTab("connect")}>API Connect</HubTabButton>}
            <HubTabButton active={tab === "guides"} icon={BookOpen} onClick={() => setTab("guides")}>Guides</HubTabButton>
            <HubTabButton active={tab === "calculators"} icon={Calculator} onClick={() => setTab("calculators")}>Calculators</HubTabButton>
          </nav>

          {tab === "analyze" && canAnalyze ? <MarketplaceAnalyzer marketplaceId={marketplaceId} /> : null}
          {tab === "connect" && canConnect ? <MarketplaceConnection marketplaceId={marketplaceId} /> : null}
          {tab === "guides" ? <MarketplaceGuides marketplaceId={marketplaceId} /> : null}
          {tab === "calculators" ? <MarketplaceCalculators marketplaceId={marketplaceId} /> : null}
        </div>
      </main>
    </PublicShell>
  );
}

function HubTabButton({ active, icon: Icon, onClick, children }: { active: boolean; icon: typeof Calculator; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-16 items-center justify-center gap-2 border-b-2 px-3 text-xs font-extrabold transition sm:text-sm ${active ? "border-blue-600 bg-blue-50/70 text-blue-700" : "border-transparent text-slate-700 hover:bg-slate-50 hover:text-blue-700"}`}>
      <Icon className="size-5" />{children}
    </button>
  );
}

function MarketplaceAnalyzer({ marketplaceId }: { marketplaceId: MarketplaceExperienceId }) {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  const { language } = useLanguage();
  const english = language === "english";
  const { user, hasPaidAccess, refresh } = useAccountStatus();
  const [files, setFiles] = useState<File[]>([]);
  const [savedCosts, setSavedCosts] = useState<CostRecord[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ message: "Ready", percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [pendingResult, setPendingResult] = useState<AnalysisResult | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [actionUnlocked, setActionUnlocked] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const entitled = Boolean(user?.isAdmin || hasPaidAccess || actionUnlocked);

  useEffect(() => {
    let active = true;
    const db = localDb();
    Promise.all([
      db.costs.toArray(),
      user
        ? fetch("/api/account/costs", { cache: "no-store" })
            .then(async (response) => response.ok ? await response.json() as { costs?: Array<CostRecord & { updatedAt: string }> } : { costs: [] })
            .then((payload) => payload.costs ?? [])
        : Promise.resolve([] as Array<CostRecord & { updatedAt: string }>),
    ]).then(async ([localCosts, remoteCosts]) => {
      if (!active) return;
      const merged = mergeSavedCosts(localCosts, remoteCosts);
      setSavedCosts(merged);
      if (merged.length) await db.costs.bulkPut(merged);
    }).catch(() => undefined);

    const resumeId = new URLSearchParams(window.location.search).get("resume");
    if (resumeId) {
      db.analyses.get(resumeId).then((saved) => {
        if (!active || !saved?.result) return;
        if (user?.isAdmin || hasPaidAccess) setResult(saved.result);
        else { setPendingResult(saved.result); setPricingOpen(true); }
      }).catch(() => undefined);
    }
    return () => { active = false; workerRef.current?.terminate(); };
  }, [hasPaidAccess, user]);

  function addFiles(list: FileList | File[]) {
    const next = Array.from(list);
    const allowed = /\.(xlsx|xls|csv|tsv|txt|zip)$/i;
    const accepted: File[] = [];
    for (const file of next) {
      if (!allowed.test(file.name)) { toast.error(`${file.name}: unsupported file type.`); continue; }
      if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name}: file is too large.`); continue; }
      accepted.push(file);
    }
    setFiles((current) => {
      const byKey = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      for (const file of accepted) byKey.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      return [...byKey.values()];
    });
    setError(null);
  }

  async function analyze() {
    if (!files.length || processing) return;
    setProcessing(true);
    setError(null);
    setProgress({ message: english ? "Understanding your reports" : "आपकी reports समझ रहे हैं", percent: 5 });
    try {
      const inputs = await Promise.all(files.map(async (file) => ({ name: file.name, buffer: await file.arrayBuffer() })));
      const worker = new Worker(new URL("../core/workers/analyzer.worker.ts", import.meta.url), { type: "module", name: "marketplace-hub-analyzer" });
      workerRef.current = worker;
      worker.onmessage = async (event: MessageEvent) => {
        const message = event.data as { type: string; message?: string; percent?: number; result?: AnalysisResult };
        if (message.type === "progress") { setProgress({ message: message.message ?? "Processing", percent: message.percent ?? 0 }); return; }
        if (message.type === "error") {
          setError(message.message ?? "Files could not be analyzed safely.");
          setProcessing(false); worker.terminate(); workerRef.current = null; return;
        }
        if (message.type === "result" && message.result) {
          const knownChannels = message.result.channels.map((channel) => String(channel.channelId)).filter((channelId) => channelId !== "unknown");
          if (knownChannels.length && knownChannels.some((channelId) => channelId !== definition.channelId)) {
            setError(english ? `These reports do not match ${definition.name}. Add reports exported from ${definition.name} and try again.` : `ये reports ${definition.name} की नहीं लग रही हैं। ${definition.name} से export की गई reports add करके retry करें।`);
            setProcessing(false); worker.terminate(); workerRef.current = null; return;
          }
          const ready = message.result;
          await localDb().analyses.put({ id: ready.id, createdAt: ready.createdAt, result: ready, label: `${definition.name} analysis` });
          setProgress({ message: english ? "Analysis ready" : "Analysis तैयार है", percent: 100 });
          setProcessing(false); worker.terminate(); workerRef.current = null;
          if (user?.isAdmin || hasPaidAccess) setResult(ready);
          else { setPendingResult(ready); setPricingOpen(true); }
        }
      };
      worker.onerror = () => {
        setError(english ? "The browser analyzer could not start. Refresh and try again." : "Browser analyzer start नहीं हो सका। Refresh करके retry करें।");
        setProcessing(false); worker.terminate(); workerRef.current = null;
      };
      worker.postMessage({ type: "analyze", files: inputs, input: { costs: savedCosts, adAllocation: "sales-share", minimumSampleSize: 5 } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Files could not be prepared.");
      setProcessing(false);
    }
  }

  if (result) return <div className="mt-6"><Dashboard result={result} initiallyUnlocked={entitled} /></div>;

  const reportChips = marketplaceId === "meesho"
    ? ["Payments", "Orders", "Returns", "Ads", "Inventory"]
    : marketplaceId === "amazon"
      ? ["Orders", "Settlement Flat File V2", "Returns", "Ads"]
      : marketplaceId === "flipkart"
        ? ["Orders", "Settlement / P&L", "Returns", "Ads"]
        : ["Orders CSV", "Payments", "Refunds", "Ads"];

  return (
    <>
      <section className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-7">
        <h2 className="text-2xl font-black tracking-[-.035em] text-slate-950">Upload {definition.name} Reports</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{english ? `Add the ${definition.name} reports you already have. SellerHisab reads supported files in your browser.` : `${definition.name} की जो reports आपके पास हैं, उन्हें add करें। SellerHisab supported files को browser में समझेगा।`}</p>

        <label className="mt-6 grid min-h-[250px] cursor-pointer place-items-center rounded-[24px] border-2 border-dashed border-blue-200 bg-blue-50/30 p-6 text-center transition hover:border-blue-400 hover:bg-blue-50/60">
          <input className="sr-only" type="file" multiple accept=".xlsx,.xls,.csv,.tsv,.txt,.zip" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
          <div>
            <CloudUpload className="mx-auto size-14 text-blue-600" />
            <p className="mt-4 text-base font-black text-slate-950">Drag and drop your {definition.name} reports here</p>
            <p className="mt-1 text-sm text-slate-500">or click to browse files</p>
            <span className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white shadow-sm">Choose Files</span>
          </div>
        </label>

        {files.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{files.map((file, index) => <div key={`${file.name}:${file.size}:${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{file.name}</p><p className="text-[10px] text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><Trash2 className="size-4 text-slate-500" /></Button></div>)}</div>}

        <div className="mt-5">
          <p className="text-xs font-extrabold text-slate-700">Accepted {definition.name} report types</p>
          <div className="mt-2 flex flex-wrap gap-2">{reportChips.map((chip) => <span key={chip} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><FileSpreadsheet className="mr-1.5 inline size-3.5" />{chip}</span>)}</div>
        </div>

        <div className={`mt-5 rounded-2xl border p-4 ${savedCosts.length ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}>
          <div className="flex gap-3"><CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${savedCosts.length ? "text-emerald-600" : "text-blue-600"}`} /><div><p className="text-sm font-extrabold text-slate-900">{savedCosts.length ? `${savedCosts.length} saved SKU cost(s) will be reused automatically` : "No repeated setup before your first check"}</p><p className="mt-1 text-xs leading-5 text-slate-600">{savedCosts.length ? "You do not need to enter the same product costs again." : "Run the report first. Missing costs stay clearly marked instead of being guessed."}</p></div></div>
        </div>

        {error && <Alert className="mt-5 border-red-200 bg-red-50"><AlertCircle className="text-red-600" /><AlertTitle className="font-extrabold">We need one correction</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {processing && <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Loader2 className="size-4 animate-spin text-blue-600" /><p className="text-sm font-extrabold text-slate-900">{progress.message}</p></div><span className="text-xs font-black text-blue-700">{progress.percent}%</span></div><Progress className="mt-3" value={progress.percent} /></div>}

        <Button type="button" onClick={analyze} disabled={!files.length || processing} className="mt-5 min-h-13 w-full rounded-xl bg-blue-600 text-base font-extrabold hover:bg-blue-700">{processing ? "Analyzing…" : `Start ${definition.name} Analysis`}<ArrowRight className="ml-2 size-5" /></Button>
        <p className="mt-3 text-center text-[11px] font-semibold text-slate-500"><ShieldCheck className="mr-1 inline size-3.5 text-emerald-600" />Raw marketplace files stay on this device; SellerHisab stores only derived data when you explicitly save it.</p>
      </section>

      <MarketplacePricingDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        analysis={pendingResult}
        marketplaceId={marketplaceId}
        onActionUnlocked={() => {
          if (!pendingResult) return;
          setActionUnlocked(true);
          setResult(pendingResult);
          setPricingOpen(false);
        }}
        onSubscriptionActive={async () => {
          await refresh();
          if (pendingResult) setResult(pendingResult);
          setPricingOpen(false);
        }}
      />
    </>
  );
}

function MarketplaceGuides({ marketplaceId }: { marketplaceId: MarketplaceExperienceId }) {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  const cards = GUIDE_CARDS[marketplaceId];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(cards.map((card) => card.category)))];
  const visible = cards.filter((card) => (category === "All" || card.category === category) && `${card.title} ${card.text}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-black tracking-[-.035em] text-slate-950">Guides</h2>
      <p className="mt-2 text-sm text-slate-600">Step-by-step help for understanding your {definition.name} business.</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 rounded-xl pl-11" placeholder="Search guides..." /></label>
        <div className="flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-xs font-extrabold ${category === item ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{item}</button>)}</div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {visible.map((card) => <details key={card.title} className="group rounded-[20px] border border-slate-200 bg-white p-5"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">{card.category}</span><h3 className="mt-3 text-base font-black text-slate-950">{card.title}</h3></div><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700 transition group-open:rotate-90"><ArrowRight className="size-4" /></span></div></summary><p className="mt-4 text-sm leading-6 text-slate-600">{card.text}</p></details>)}
      </div>
      {!visible.length && <p className="mt-8 text-center text-sm text-slate-500">No guide matches this search.</p>}
    </section>
  );
}

function MarketplaceCalculators({ marketplaceId }: { marketplaceId: MarketplaceExperienceId }) {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  const group = marketplaceCalculatorGroups.find((item) => item.marketplaceId === marketplaceId)!;
  const [selected, setSelected] = useState<MarketplaceCalculatorEntry | null>(null);
  const iconMap = { profit: Calculator, failure: RotateCcw, "break-even": Target, acos: BadgePercent, roas: Gauge } as const;
  return (
    <section className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-7">
      <div className="rounded-[20px] border border-blue-100 bg-blue-50/60 p-5"><h2 className="text-xl font-black text-slate-950">All calculators are available right here</h2><p className="mt-1 text-sm text-slate-600">Run {definition.name} calculations without leaving this marketplace hub.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {group.calculators.map((tool) => { const Icon = iconMap[tool.kind]; return <article key={tool.slug} className="flex flex-col rounded-[20px] border border-slate-200 bg-white p-5"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><h3 className="mt-4 text-base font-black text-slate-950">{tool.title}</h3><p className="mt-2 flex-1 text-xs leading-5 text-slate-600">{tool.description}</p><Button type="button" className="mt-5 w-full rounded-xl bg-blue-600 font-extrabold hover:bg-blue-700" onClick={() => setSelected(tool)}>Use Calculator <ArrowRight className="ml-2 size-4" /></Button></article>; })}
      </div>
      {selected && <InlineMarketplaceCalculator tool={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function InlineMarketplaceCalculator({ tool, onClose }: { tool: MarketplaceCalculatorEntry; onClose: () => void }) {
  const type: CalculatorMathType = tool.kind === "profit" ? "margin" : tool.kind === "failure" ? "failure" : tool.kind === "break-even" ? "break-even" : tool.kind;
  const [values, setValues] = useState<CalculatorValues>({});
  const output = useMemo(() => calculateTool(type, values), [type, values]);
  const fields = calculatorFields(type);
  const value = output.status === "insufficient" ? "Add required values" : type === "acos" ? `${output.value}%` : type === "roas" ? `${output.value}x` : `₹${output.value}`;
  return (
    <div className="mt-6 rounded-[24px] border border-blue-200 bg-blue-50/35 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-blue-600">Interactive calculator</p><h3 className="mt-2 text-xl font-black text-slate-950">{tool.title}</h3></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close calculator"><X className="size-5" /></Button></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="grid gap-4 rounded-2xl bg-white p-4 sm:grid-cols-2">{fields.map((field) => <div key={field.key}><Label htmlFor={`hub-calc-${tool.slug}-${field.key}`} className="text-xs font-extrabold text-slate-700">{field.label}</Label><Input id={`hub-calc-${tool.slug}-${field.key}`} inputMode="decimal" className="mt-2 h-11" value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /></div>)}</div>
        <div className="rounded-2xl bg-blue-600 p-5 text-white"><p className="text-xs font-extrabold uppercase tracking-[.12em] text-blue-100">Your answer</p><p className="mt-4 break-words text-3xl font-black tracking-[-.04em]">{value}</p>{output.secondaryValue && <p className="mt-2 text-sm font-bold text-blue-100">{output.secondaryValue}</p>}<p className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-5 text-blue-50">{output.formula}</p></div>
      </div>
    </div>
  );
}

function calculatorFields(type: CalculatorMathType) {
  if (type === "margin") return [
    { key: "settlement", label: "Net payout / settlement (₹)", placeholder: "540" },
    { key: "sale", label: "Selling price / sales (₹)", placeholder: "699" },
    { key: "product", label: "Product cost (₹)", placeholder: "300" },
    { key: "packaging", label: "Packaging cost (₹)", placeholder: "15" },
    { key: "variable", label: "Other variable cost (₹)", placeholder: "0" },
    { key: "ads", label: "Attributed ads cost (₹)", placeholder: "0" },
  ];
  if (type === "failure") return [
    { key: "orders", label: "Orders", placeholder: "200" },
    { key: "rate", label: "Return / RTO rate (%)", placeholder: "9" },
    { key: "loss", label: "Average loss per failed order (₹)", placeholder: "80" },
  ];
  if (type === "break-even") return [
    { key: "product", label: "Product cost (₹)", placeholder: "300" },
    { key: "packaging", label: "Packaging cost (₹)", placeholder: "15" },
    { key: "variable", label: "Other variable cost (₹)", placeholder: "0" },
    { key: "ads", label: "Ads cost per order (₹)", placeholder: "0" },
    { key: "rate", label: "Failure rate (%)", placeholder: "8" },
    { key: "loss", label: "Loss per failure (₹)", placeholder: "80" },
    { key: "retained", label: "Observed retained payout rate (%)", placeholder: "80" },
  ];
  return [
    { key: "sale", label: "Attributed ad sales (₹)", placeholder: "60000" },
    { key: "preAd", label: "Pre-ad contribution (₹)", placeholder: "15000" },
  ];
}

function MarketplaceConnection({ marketplaceId }: { marketplaceId: MarketplaceExperienceId }) {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  const { user, refresh: refreshAccount } = useAccountStatus();
  const [item, setItem] = useState<ConnectionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shop, setShop] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const connectorId = CONNECTOR_BY_MARKETPLACE[marketplaceId];

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/account/connections", { cache: "no-store" });
      if (response.status === 401) { setItem(null); setPlanLocked(false); return; }
      if (response.status === 402) { setPlanLocked(true); setItem(null); return; }
      const payload = await response.json() as { connections?: ConnectionItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Connection status could not be loaded.");
      setPlanLocked(false);
      setItem(payload.connections?.find((entry) => entry.connectorId === connectorId) ?? null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Connection status could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [connectorId]);

  async function startConnection() {
    if (!item) return;
    setBusy(true);
    try {
      if (marketplaceId === "woocommerce") {
        const response = await fetch("/api/account/connections/woocommerce/authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storeUrl }) });
        const payload = await response.json() as { authorizationUrl?: string; error?: string };
        if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error ?? "WooCommerce authorization could not start.");
        window.location.assign(payload.authorizationUrl); return;
      }
      const response = await fetch("/api/account/connections/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectorId: item.connectorId, shop: marketplaceId === "shopify" ? shop : undefined }) });
      const payload = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error ?? "Marketplace authorization could not start.");
      window.location.assign(payload.authorizationUrl);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Connection could not start."); setBusy(false); }
  }

  async function sync() {
    if (!item) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/connections/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectorId: item.connectorId, days: 30 }) });
      const payload = await response.json() as { jobId?: string; summary?: { orderCount: number; financialRecordCount: number }; error?: string };
      if (!response.ok && response.status !== 202) throw new Error(payload.error ?? "Sync could not start.");
      toast.success(payload.jobId ? "Sync queued. You can keep using SellerHisab." : `Synced ${payload.summary?.orderCount ?? 0} order rows.`);
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Sync failed."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    if (!item) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/connections/disconnect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectorId: item.connectorId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Disconnect failed.");
      toast.success(`${definition.name} disconnected.`); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Disconnect failed."); }
    finally { setBusy(false); }
  }

  if (!user) return <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-7 text-center"><Cable className="mx-auto size-10 text-blue-600" /><h2 className="mt-4 text-xl font-black text-slate-950">Sign in to connect {definition.name}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Connections belong to your SellerHisab account so they can be safely disconnected and recovered.</p><Button asChild className="mt-5 bg-blue-600 font-extrabold hover:bg-blue-700"><Link href={`/app?returnTo=${encodeURIComponent(definition.hubHref)}`}>Sign in <ArrowRight className="ml-2 size-4" /></Link></Button></section>;
  if (loading) return <section className="mt-6 grid min-h-64 place-items-center rounded-[28px] border border-slate-200 bg-white"><Loader2 className="size-6 animate-spin text-blue-600" /></section>;
  if (planLocked) return <section className="mt-6 rounded-[28px] border border-blue-200 bg-white p-6 sm:p-8"><Cable className="size-8 text-blue-600" /><h2 className="mt-4 text-2xl font-black text-slate-950">API Connect is included in Pro</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Keep file analysis separate. Upgrade to Pro only when you want a supported read-only marketplace connection and automatic sync.</p><div className="mt-5 max-w-sm"><PlanSubscribeButton plan="pro" userEmail={user.email} userPhone={user.phone} onActive={async () => { await refreshAccount(); await refresh(); }} buttonLabel="Choose Pro" /></div></section>;
  if (!item) return <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-7"><h2 className="text-xl font-black text-slate-950">Connection is not available right now</h2><p className="mt-2 text-sm text-slate-600">SellerHisab is not showing a connect button because a supported connector is not currently available for this marketplace.</p></section>;

  const connected = item.accountStatus === "connected";
  const ready = item.apiConfigured;
  return (
    <section className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-black tracking-[-.035em] text-slate-950">Connect {definition.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.authorization}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold ${connected ? "bg-emerald-100 text-emerald-800" : ready ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{connected ? "Connected" : ready ? "Ready to connect" : "Setup required"}</span></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">Orders</p><p className="mt-2 text-sm font-bold leading-6 text-slate-700">{item.orders}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">Money / settlement</p><p className="mt-2 text-sm font-bold leading-6 text-slate-700">{item.settlements}</p></div></div>
      {connected && item.externalAccountDisplayName && <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Connected account: {item.externalAccountDisplayName}</p>}
      {!connected && ready && marketplaceId === "shopify" && <div className="mt-5 max-w-lg"><Label htmlFor="hub-shopify-domain" className="text-xs font-extrabold">Shopify store domain</Label><Input id="hub-shopify-domain" className="mt-2 h-11" value={shop} onChange={(event) => setShop(event.target.value)} placeholder="your-store.myshopify.com" /></div>}
      {!connected && ready && marketplaceId === "woocommerce" && <div className="mt-5 max-w-lg"><Label htmlFor="hub-woo-url" className="text-xs font-extrabold">WooCommerce store URL</Label><Input id="hub-woo-url" className="mt-2 h-11" value={storeUrl} onChange={(event) => setStoreUrl(event.target.value)} placeholder="https://store.example.com" inputMode="url" /></div>}
      <div className="mt-6 flex flex-wrap gap-2">
        {connected ? <><Button type="button" onClick={sync} disabled={busy} className="bg-blue-600 font-extrabold hover:bg-blue-700">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Sync latest data</Button><Button type="button" variant="outline" onClick={disconnect} disabled={busy} className="text-red-700"><Unplug className="mr-2 size-4" />Disconnect</Button></> : ready ? <Button type="button" onClick={startConnection} disabled={busy || (marketplaceId === "shopify" && !shop.trim()) || (marketplaceId === "woocommerce" && !storeUrl.trim())} className="bg-blue-600 font-extrabold hover:bg-blue-700">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Connect {definition.name}</Button> : <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">SellerHisab connector setup is not active yet, so no fake connect button is shown.</div>}
      </div>
      {item.lastError && <p className="mt-4 text-xs font-semibold text-red-700">{item.lastError}</p>}
      {item.lastSuccessAt && <p className="mt-3 text-xs text-emerald-700">Last successful sync: {new Date(item.lastSuccessAt).toLocaleString("en-IN")}</p>}
    </section>
  );
}

function MarketplacePricingDialog({ open, onOpenChange, analysis, marketplaceId, onActionUnlocked, onSubscriptionActive }: { open: boolean; onOpenChange: (open: boolean) => void; analysis: AnalysisResult | null; marketplaceId: MarketplaceExperienceId; onActionUnlocked: () => void; onSubscriptionActive: () => Promise<void> }) {
  const definition = MARKETPLACE_DEFINITIONS[marketplaceId];
  const pricing = usePricing();
  const { user } = useAccountStatus();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-[28px] border-slate-200 p-5 sm:p-7">
        <DialogHeader className="text-center sm:text-center"><DialogTitle className="text-2xl font-black tracking-[-.04em] text-slate-950 sm:text-3xl">Unlock Marketplace Analysis</DialogTitle><DialogDescription className="mx-auto max-w-2xl text-sm leading-6">Your {definition.name} analysis is ready. Choose how you want to access the result.</DialogDescription></DialogHeader>
        {!user && <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-semibold text-blue-900">Sign in once before payment so your access can be recovered on another device.</div>}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <PlanCard price={displayRupees(pricing.actionReportPaise)} name="Action Report" suffix="one-time" items={["One complete analysis", "Full SKU action board", "Break-even & return insights", "PDF + Excel export"]}>
            {user && analysis ? <ActionReportPurchaseButton analysisId={analysis.id} onUnlocked={onActionUnlocked} /> : <Button asChild className="w-full bg-blue-600 font-extrabold hover:bg-blue-700"><Link href={`/app?returnTo=${encodeURIComponent(`${definition.hubHref}?resume=${analysis?.id ?? ""}`)}`}>Sign in to choose</Link></Button>}
          </PlanCard>
          <PlanCard featured price={displayRupees(pricing.starterMonthlyPaise)} name="Starter" suffix="/month" items={["Multiple saved analyses", "Saved SKU costs", "Profit history", "Recurring decision reports"]}>
            {user ? <PlanSubscribeButton compact plan="starter" userEmail={user.email} userPhone={user.phone} onActive={onSubscriptionActive} buttonLabel="Choose Starter" /> : <Button asChild className="w-full bg-blue-600 font-extrabold hover:bg-blue-700"><Link href={`/app?returnTo=${encodeURIComponent(`${definition.hubHref}?resume=${analysis?.id ?? ""}`)}`}>Sign in to choose</Link></Button>}
          </PlanCard>
          <PlanCard price={displayRupees(pricing.proMonthlyPaise)} name="Pro" suffix="/month" items={["Everything in Starter", "Supported marketplace connections", "Bank & advanced reconciliation", "Ads + inventory tools"]}>
            {user ? <PlanSubscribeButton compact plan="pro" userEmail={user.email} userPhone={user.phone} onActive={onSubscriptionActive} buttonLabel="Choose Pro" /> : <Button asChild className="w-full bg-blue-600 font-extrabold hover:bg-blue-700"><Link href={`/app?returnTo=${encodeURIComponent(`${definition.hubHref}?resume=${analysis?.id ?? ""}`)}`}>Sign in to choose</Link></Button>}
          </PlanCard>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">Secure payment • Access is activated only after server verification</p>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({ price, name, suffix, items, featured = false, children }: { price: string; name: string; suffix: string; items: string[]; featured?: boolean; children: React.ReactNode }) {
  return <article className={`relative flex flex-col rounded-[22px] border bg-white p-5 ${featured ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>{featured && <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black text-white">Most Popular</span>}<p className="text-3xl font-black tracking-[-.04em] text-slate-950">{price}</p><h3 className="mt-1 text-lg font-black text-slate-950">{name}</h3><p className="mt-1 text-xs font-bold text-blue-600">{suffix}</p><ul className="my-5 space-y-3">{items.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-slate-600"><Check className="mt-0.5 size-4 shrink-0 text-blue-600" />{item}</li>)}</ul><div className="mt-auto">{children}</div></article>;
}

function ActionReportPurchaseButton({ analysisId, onUnlocked }: { analysisId: string; onUnlocked: () => void }) {
  const [loading, setLoading] = useState(false);
  async function start() {
    setLoading(true);
    try {
      const response = await fetch("/api/payments/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analysisId, product: "action_report" }) });
      const order = await response.json() as { mode?: string; orderId?: string; amount?: number; currency?: string; keyId?: string; checkoutImage?: string; customer?: Record<string, string>; entitlementToken?: string; error?: string };
      if (!response.ok) throw new Error(order.error ?? "Payment could not start.");
      if (order.mode === "restored" && order.entitlementToken) { localStorage.setItem(`smg-entitlement:${analysisId}`, order.entitlementToken); onUnlocked(); return; }
      if (!order.orderId || order.amount === undefined || !order.currency) throw new Error("Payment setup is incomplete.");
      await loadRazorpay();
      const RazorpayCtor = (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!RazorpayCtor) throw new Error("Secure checkout could not load.");
      const checkout = new RazorpayCtor({ key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId, name: "SellerHisab", image: order.checkoutImage, description: "Marketplace Action Report", prefill: order.customer, theme: { color: "#2563EB" }, modal: { ondismiss: () => setLoading(false) }, handler: async (payment: Record<string, string>) => {
        try {
          const verify = await fetch("/api/payments/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analysisId, orderId: order.orderId, razorpayPaymentId: payment.razorpay_payment_id, razorpaySignature: payment.razorpay_signature }) });
          const verified = await verify.json() as { entitlementToken?: string; error?: string };
          if (!verify.ok || !verified.entitlementToken) throw new Error(verified.error ?? "Payment verification failed.");
          localStorage.setItem(`smg-entitlement:${analysisId}`, verified.entitlementToken); setLoading(false); toast.success("Action Report unlocked."); onUnlocked();
        } catch (error) { setLoading(false); toast.error(error instanceof Error ? error.message : "Payment verification failed."); }
      } });
      checkout.open();
    } catch (error) { setLoading(false); toast.error(error instanceof Error ? error.message : "Payment could not start."); }
  }
  return <Button type="button" onClick={start} disabled={loading} className="w-full bg-blue-600 font-extrabold hover:bg-blue-700">{loading && <Loader2 className="mr-2 size-4 animate-spin" />}Choose Plan</Button>;
}

async function loadRazorpay() {
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Checkout failed to load.")), { once: true }); return; }
    const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("Checkout failed to load.")); document.head.appendChild(script);
  });
}
