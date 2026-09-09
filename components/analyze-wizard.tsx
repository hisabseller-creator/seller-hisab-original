"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
  Info,
  Loader2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dashboard } from "@/components/dashboard/dashboard";
import { AnalysisAccountSave } from "@/components/dashboard/analysis-account-save";
import { parseCostFile, parseCostPaste } from "@/core/parsers/costs";
import { MAX_FILE_BYTES } from "@/core/parsers/files";
import { mergeSavedCosts } from "@/core/account/saved-costs";
import { localDb } from "@/core/storage/local-db";
import type { AnalysisResult, CostRecord } from "@/core/types";
import { useAccountStatus, useLanguage } from "./providers";

type InlineCost = { id: string; sku: string; product: string; packaging: string; variable: string };
type ProgressState = { message: string; percent: number };

export function AnalyzeWizard() {
  const { language } = useLanguage();
  const { user } = useAccountStatus();
  const english = language === "english";
  const [primaryFiles, setPrimaryFiles] = useState<File[]>([]);
  const [optionalFiles, setOptionalFiles] = useState<File[]>([]);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [costPaste, setCostPaste] = useState("");
  const [inlineCosts, setInlineCosts] = useState<InlineCost[]>([{ id: cryptoId(), sku: "", product: "", packaging: "", variable: "" }]);
  const [defaultPackaging, setDefaultPackaging] = useState("15");
  const [adSpend, setAdSpend] = useState("");
  const [fixedOverhead, setFixedOverhead] = useState("");
  const [bankCredit, setBankCredit] = useState("");
  const [saveCosts, setSaveCosts] = useState(true);
  const [savedCosts, setSavedCosts] = useState<CostRecord[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ message: "Ready", percent: 0 });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const db = localDb();
    db.costs.toArray().then(setSavedCosts).catch(() => setSavedCosts([]));

    const resumeId = new URLSearchParams(window.location.search).get("resume");
    if (resumeId) {
      db.analyses.get(resumeId)
        .then((saved) => {
          if (saved?.result) setResult(saved.result);
        })
        .catch(() => undefined);
    }

    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const db = localDb();
    Promise.all([
      db.costs.toArray(),
      fetch("/api/account/costs", { cache: "no-store" })
        .then(async (response) => response.ok ? await response.json() as { costs?: Array<CostRecord & { updatedAt: string }> } : { costs: [] })
        .then((payload) => payload.costs ?? []),
    ])
      .then(async ([localCosts, remoteCosts]) => {
        if (!active) return;
        const merged = mergeSavedCosts(localCosts, remoteCosts);
        setSavedCosts(merged);
        if (merged.length) await db.costs.bulkPut(merged);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user]);

  async function runAnalysis() {
    if (!primaryFiles.length) {
      setError(english ? "Add at least one supported marketplace settlement/payment file." : "कम-से-कम एक supported marketplace settlement/payment file add करें।");
      return;
    }
    setProcessing(true);
    setError(null);
    setProgress({ message: "Reading file", percent: 5 });
    try {
      const costs = await collectCosts();
      const allFiles = [...primaryFiles, ...optionalFiles];
      const fileInputs = await Promise.all(allFiles.map(async (file) => ({ name: file.name, buffer: await file.arrayBuffer() })));
      const worker = new Worker(new URL("../core/workers/analyzer.worker.ts", import.meta.url), { type: "module", name: "margin-analyzer" });
      workerRef.current = worker;
      worker.onmessage = async (event: MessageEvent) => {
        const message = event.data as { type: string; message?: string; percent?: number; result?: AnalysisResult };
        if (message.type === "progress") {
          setProgress({ message: message.message ?? "Processing", percent: message.percent ?? 0 });
          return;
        }
        if (message.type === "error") {
          setError(message.message ?? "Files could not be analyzed safely.");
          setProcessing(false);
          worker.terminate();
          workerRef.current = null;
          return;
        }
        if (message.type === "result" && message.result) {
          setProgress({ message: "Action board ready", percent: 100 });
          setResult(message.result);
          setProcessing(false);
          worker.terminate();
          workerRef.current = null;
          await localDb().analyses.put({ id: message.result.id, createdAt: message.result.createdAt, result: message.result, label: "Current analysis" });
          if (saveCosts) {
            await localDb().costs.bulkPut(costs.map((cost) => ({ ...cost, updatedAt: new Date().toISOString() })));
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      };
      worker.onerror = () => {
        setError(english ? "The browser worker could not start. Refresh the page and try again." : "Browser worker start नहीं हो सका। Page refresh करके retry करें।");
        setProcessing(false);
        worker.terminate();
        workerRef.current = null;
      };
      worker.postMessage({
        type: "analyze",
        files: fileInputs,
        input: {
          costs,
          defaultPackagingPaise: toPaise(defaultPackaging),
          manualAdSpendPaise: adSpend ? toPaise(adSpend) : undefined,
          adAllocation: "sales-share",
          monthlyFixedOverheadPaise: fixedOverhead ? toPaise(fixedOverhead) : undefined,
          bankCreditPaise: bankCredit ? toPaise(bankCredit) : undefined,
          minimumSampleSize: 5,
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inputs could not be prepared.");
      setProcessing(false);
    }
  }

  function cancel() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setProcessing(false);
    setProgress({ message: "Cancelled — inputs preserved", percent: 0 });
    toast.message(english ? "Processing cancelled. Your files and costs are preserved." : "Processing cancelled. आपकी files और costs सुरक्षित हैं।");
  }

  async function collectCosts(): Promise<CostRecord[]> {
    const combined = new Map(savedCosts.map((cost) => [cost.sku, cost]));
    if (costFile) (await parseCostFile(costFile)).forEach((cost) => combined.set(cost.sku, cost));
    parseCostPaste(costPaste).forEach((cost) => combined.set(cost.sku, cost));
    for (const row of inlineCosts) {
      if (!row.sku.trim() && !row.product.trim()) continue;
      if (!row.sku.trim() || !row.product.trim()) throw new Error(english ? "Each inline cost row requires both SKU and Product Cost." : "Inline cost row में SKU और Product Cost दोनों required हैं।");
      const productCostPaise = toPaise(row.product);
      const packagingCostPaise = row.packaging ? toPaise(row.packaging) : undefined;
      const variableCostPaise = row.variable ? toPaise(row.variable) : undefined;
      combined.set(row.sku.trim(), { sku: row.sku.trim(), productCostPaise, packagingCostPaise, variableCostPaise });
    }
    return [...combined.values()];
  }

  if (result) {
    return (
      <div>
        <Dashboard result={result} onEditCosts={() => setResult(null)} />
        <AnalysisAccountSave result={result} />
      </div>
    );
  }

  return (
    <main className="app-wallpaper min-h-[75vh] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.15em] text-blue-600">{english ? "Free • Private • No login required" : "Free • Private • Login ज़रूरी नहीं"}</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-950 sm:text-4xl">{english ? "Check how much money you keep" : "देखो कितना पैसा बचता है"}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              {english
                ? "Upload your marketplace payment or settlement report. If an Orders file is needed, SellerHisab will tell you. Add your product cost, then see what you earned, what was deducted, and how much profit and margin you actually kept."
                : "अपना marketplace payment या settlement report upload करो। अगर Orders file की जरूरत होगी, SellerHisab बता देगा। फिर product cost add करो। Result में साफ दिखेगा—कितना कमाया, कितना कटा और आखिर में कितना profit/margin बचा।"}
            </p>
          </div>
        </div>

        <MarketplaceReadiness english={english} />

        <SetupRail english={english} />

        <div className="mt-8 grid gap-5">
          <WizardCard number="1" title={english ? "Upload settlement / payment file" : "Settlement / payment file upload करो"} required helper={english ? "Marketplace financial report • XLSX, CSV, TSV, TXT or ZIP" : "Marketplace financial report • XLSX, CSV, TSV, TXT या ZIP"}>
            <FileDrop english={english} files={primaryFiles} onFiles={(files) => addValidated(files, primaryFiles, setPrimaryFiles, english)} onRemove={(index) => setPrimaryFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} accept=".xlsx,.xls,.csv,.tsv,.txt,.zip" />
            <Link className="mt-3 inline-flex text-xs font-extrabold text-blue-700 hover:underline" href="/help#download-report">{english ? "Where can I get this file?" : "File कहाँ से मिलेगी?"}</Link>
          </WizardCard>

          <WizardCard number="2" title={english ? "Add product cost" : "Product cost add करो"} helper={english ? `Choose the easiest method • ${savedCosts.length} saved SKU cost(s) on this device` : `Easy method choose करो • ${savedCosts.length} saved SKU cost(s) इस device पर`}>
            <Tabs defaultValue="paste" className="mt-1">
              <TabsList className="cost-method-tabs grid h-auto w-full grid-cols-3"><TabsTrigger value="upload" className="cost-method-tab py-3 text-xs">Upload sheet</TabsTrigger><TabsTrigger value="paste" className="cost-method-tab py-3 text-xs">Paste costs</TabsTrigger><TabsTrigger value="inline" className="cost-method-tab py-3 text-xs">Enter in app</TabsTrigger></TabsList>
              <TabsContent value="upload" className="mt-4"><Label htmlFor="cost-sheet" className="sr-only">Cost sheet</Label><Input id="cost-sheet" className="data-entry h-12" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setCostFile(event.target.files?.[0] ?? null)} />{costFile && <p className="mt-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="mr-1 inline size-3.5" />{costFile.name}</p>}</TabsContent>
              <TabsContent value="paste" className="mt-4"><Label htmlFor="cost-paste" className="text-xs font-bold text-slate-700">SKU, Product Cost, Packaging Cost, Variable Cost</Label><Textarea id="cost-paste" className="data-entry mt-2 min-h-32 font-mono text-xs" value={costPaste} onChange={(event) => setCostPaste(event.target.value)} placeholder={english ? "Paste cost-sheet rows here" : "Cost-sheet की rows यहाँ paste करें"} /><p className="mt-2 text-xs text-slate-500">{english ? "Copy 2–4 columns from Excel and paste them directly." : "Excel से 2–4 columns copy करके सीधे paste कर सकते हैं।"}</p></TabsContent>
              <TabsContent value="inline" className="mt-4"><div className="space-y-3">{inlineCosts.map((row, index) => <InlineCostRow key={row.id} row={row} onChange={(next) => setInlineCosts((current) => current.map((item) => item.id === row.id ? next : item))} onRemove={() => setInlineCosts((current) => current.filter((item) => item.id !== row.id))} canRemove={inlineCosts.length > 1} index={index} />)}</div><Button variant="outline" size="sm" className="mt-3" onClick={() => setInlineCosts((current) => [...current, { id: cryptoId(), sku: "", product: "", packaging: "", variable: "" }])}><Plus className="mr-1.5 size-4" />Add SKU</Button></TabsContent>
            </Tabs>
            <div className="mt-5 grid gap-4 border-t border-blue-200/80 pt-5 sm:grid-cols-2"><div><Label htmlFor="default-packaging" className="text-xs font-bold">Default packaging cost / shipped order (₹)</Label><Input id="default-packaging" inputMode="decimal" value={defaultPackaging} onChange={(event) => setDefaultPackaging(event.target.value)} className="data-entry mt-2 h-12" /></div><label className="data-entry-card flex items-start gap-3 rounded-xl p-3"><Checkbox checked={saveCosts} onCheckedChange={(checked) => setSaveCosts(checked === true)} /><span><span className="block text-xs font-extrabold text-slate-800">Reuse costs on this device</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{english ? "Saved locally in IndexedDB, never on the server." : "IndexedDB में locally save; server पर नहीं।"}</span></span></label></div>
          </WizardCard>

          <WizardCard number="3" title={english ? "Improve accuracy (optional)" : "Accuracy improve करें (optional)"} helper={english ? "Orders, Ads, overhead or bank credit help explain more" : "Orders, Ads, overhead या bank credit से ज़्यादा clear result मिलेगा"}>
            <FileDrop english={english} files={optionalFiles} onFiles={(files) => addValidated(files, optionalFiles, setOptionalFiles, english)} onRemove={(index) => setOptionalFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} accept=".xlsx,.xls,.csv,.tsv,.txt,.zip" />
            <div className="mt-4 grid gap-4 sm:grid-cols-3"><div><Label htmlFor="ad-spend" className="text-xs font-bold">Manual total ad spend (₹)</Label><Input id="ad-spend" inputMode="decimal" value={adSpend} onChange={(event) => setAdSpend(event.target.value)} placeholder="Optional" className="data-entry mt-2 h-12" /><p className="mt-1.5 text-[11px] text-slate-500">{english ? "Uses a sales-share estimate when no Ads report is supplied." : "Ads report न हो तो sales share estimate।"}</p></div><div><Label htmlFor="overhead" className="text-xs font-bold">Monthly fixed overhead (₹)</Label><Input id="overhead" inputMode="decimal" value={fixedOverhead} onChange={(event) => setFixedOverhead(event.target.value)} placeholder="Optional" className="data-entry mt-2 h-12" /><p className="mt-1.5 text-[11px] text-slate-500">{english ? "Estimated Net Profit appears only with complete inputs." : "Complete inputs पर ही Estimated Net Profit।"}</p></div><div><Label htmlFor="bank-credit" className="text-xs font-bold">Bank credit for same period (₹)</Label><Input id="bank-credit" inputMode="decimal" value={bankCredit} onChange={(event) => setBankCredit(event.target.value)} placeholder="Optional" className="data-entry mt-2 h-12" /><p className="mt-1.5 text-[11px] text-slate-500">{english ? "A simple mismatch check against total settlements." : "Settlement total का simple mismatch check।"}</p></div></div>
          </WizardCard>
        </div>

        {error && <Alert className="mt-5 border-red-200 bg-red-50"><AlertCircle className="text-red-600" /><AlertTitle className="font-extrabold">Safe calculation stopped</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {processing && <div className="liquid-panel mt-5 rounded-[24px] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Loader2 className="size-5 animate-spin text-blue-600" /><div><p className="text-sm font-extrabold text-slate-900">{progress.message}</p><p className="mt-1 text-xs text-slate-500">{english ? "Your screen stays responsive while the browser calculates." : "Browser calculate करेगा और screen responsive रहेगी।"}</p></div></div><span className="text-sm font-black tabular-nums text-blue-700">{progress.percent}%</span></div><Progress className="mt-4" value={progress.percent} /><Button variant="ghost" size="sm" className="mt-3 text-red-700" onClick={cancel}><X className="mr-1.5 size-4" />Cancel processing</Button></div>}

        <div className="glass-nav sticky bottom-3 z-20 mt-6 rounded-[22px] p-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><LockKeyhole className="size-4" /></span><div><p className="text-xs font-extrabold text-slate-900">Raw files stay on your device</p><p className="mt-0.5 text-[11px] text-slate-500">No report rows are sent with this analysis.</p></div></div>
          <div className="mt-4 flex gap-2 sm:mt-0"><Button variant="outline" className="rounded-xl bg-white/70" onClick={() => { setPrimaryFiles([]); setOptionalFiles([]); setError(null); }} disabled={processing}><RotateCcw className="mr-1.5 size-4" />{english ? "Reset" : "Reset"}</Button><Button className="liquid-button rounded-xl font-extrabold" onClick={runAnalysis} disabled={processing || !primaryFiles.length}>{processing ? "Processing…" : english ? "See My Margin — Free" : "मेरा Margin देखो — Free"}</Button></div>
        </div>
      </div>
    </main>
  );
}

function MarketplaceReadiness({ english }: { english: boolean }) {
  const channels = [
    { name: "Meesho", logo: "/brands/marketplaces/meesho.svg", logoClass: "max-h-9 max-w-[132px]" },
    { name: "Shopify", logo: "/brands/marketplaces/shopify.svg", logoClass: "max-h-9 max-w-[142px]" },
    { name: "Amazon India", logo: "/brands/marketplaces/amazon.svg", logoClass: "max-h-8 max-w-[132px]" },
    { name: "Flipkart", logo: "/brands/marketplaces/flipkart.svg", logoClass: "max-h-9 max-w-[138px]" },
  ];

  return (
    <section className="mt-7" aria-label="Marketplaces with live file analysis">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {channels.map((channel) => (
          <article key={channel.name} className="liquid-soft flex min-h-[76px] items-center justify-between gap-4 rounded-2xl border border-white/80 px-4 py-3">
            <img
              src={channel.logo}
              alt={`${channel.name} logo`}
              className={`block h-auto w-auto min-w-0 object-contain ${channel.logoClass}`}
            />
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-extrabold tracking-[.03em] text-emerald-700">
              {english ? "File analysis live" : "File analysis live"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function WizardCard({ number, title, required, helper, children }: { number: string; title: string; required?: boolean; helper: string; children: React.ReactNode }) {
  return <section className="liquid-panel wizard-card rounded-[26px] p-5 sm:p-6"><div className="flex items-start gap-4"><span className="liquid-button grid size-10 shrink-0 place-items-center rounded-[14px] text-sm font-black text-white">{number}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-extrabold text-slate-950 sm:text-lg">{title}</h2>{required && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-700">Required</span>}</div><p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p><div className="mt-5">{children}</div></div></div></section>;
}

function FileDrop({ english, files, onFiles, onRemove, accept }: { english: boolean; files: File[]; onFiles: (files: File[]) => void; onRemove: (index: number) => void; accept: string }) {
  const ready=useSyncExternalStore(subscribeReady,()=>true,()=>false);
  return <div><label className="liquid-drop flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[22px] px-4 py-8 text-center transition hover:border-blue-500 hover:bg-blue-50/70 focus-within:ring-2 focus-within:ring-blue-600"><input disabled={!ready} className="sr-only" type="file" multiple accept={accept} onChange={(event) => onFiles(Array.from(event.target.files ?? []))} /><span className="liquid-icon grid size-12 place-items-center rounded-2xl"><UploadCloud className="size-6 text-blue-600" /></span><span className="mt-4 text-sm font-extrabold text-slate-900">{english ? "Tap to choose file" : "File choose करने के लिए tap करें"}</span><span className="mt-1 text-xs text-slate-500">{english ? "or drop it here • XLSX, CSV, TSV, TXT, ZIP • max 50 MB" : "या यहाँ drop करें • XLSX, CSV, TSV, TXT, ZIP • max 50 MB"}</span></label>{files.length > 0 && <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}`} className="liquid-soft flex items-center gap-3 rounded-xl px-3 py-2"><span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">{file.name.endsWith(".zip") ? <FileArchive className="size-4" /> : <FileSpreadsheet className="size-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{file.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => onRemove(index)}><Trash2 className="size-4 text-red-600" /></Button></li>)}</ul>}</div>;
}

function SetupRail({ english }: { english: boolean }) {
  const steps = english ? ["Marketplace files", "Product cost", "Your margin"] : ["Marketplace files", "Product cost", "आपका margin"];
  return <ol className="liquid-panel mt-7 grid rounded-[22px] p-2 sm:grid-cols-3" aria-label="Analysis steps">{steps.map((step, index) => <li key={step} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-sm"}`}>{index + 1}</span><span className={`text-xs font-extrabold ${index === 0 ? "text-blue-700" : "text-slate-600"}`}>{step}</span>{index < 2 && <span className="ml-auto hidden text-blue-300 sm:inline" aria-hidden="true">→</span>}</li>)}</ol>;
}

function InlineCostRow({ row, onChange, onRemove, canRemove, index }: { row: InlineCost; onChange: (row: InlineCost) => void; onRemove: () => void; canRemove: boolean; index: number }) {
  return <div className="cost-entry-row grid gap-3 rounded-2xl p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"><div><Label className="text-[10px] font-bold" htmlFor={`sku-${row.id}`}>SKU</Label><Input id={`sku-${row.id}`} className="data-entry mt-1 h-11" value={row.sku} onChange={(event) => onChange({ ...row, sku: event.target.value })} placeholder={`SKU ${index + 1}`} /></div><div><Label className="text-[10px] font-bold" htmlFor={`product-${row.id}`}>Product ₹</Label><Input id={`product-${row.id}`} className="data-entry mt-1 h-11" inputMode="decimal" value={row.product} onChange={(event) => onChange({ ...row, product: event.target.value })} /></div><div><Label className="text-[10px] font-bold" htmlFor={`pack-${row.id}`}>Packaging ₹</Label><Input id={`pack-${row.id}`} className="data-entry mt-1 h-11" inputMode="decimal" value={row.packaging} onChange={(event) => onChange({ ...row, packaging: event.target.value })} /></div><div><Label className="text-[10px] font-bold" htmlFor={`variable-${row.id}`}>Other ₹</Label><Input id={`variable-${row.id}`} className="data-entry mt-1 h-11" inputMode="decimal" value={row.variable} onChange={(event) => onChange({ ...row, variable: event.target.value })} /></div>{canRemove && <Button variant="ghost" size="icon" className="self-end" aria-label="Remove cost row" onClick={onRemove}><Trash2 className="size-4 text-red-600" /></Button>}</div>;
}

function addValidated(incoming: File[], current: File[], setter: React.Dispatch<React.SetStateAction<File[]>>, english: boolean) {
  const accepted = incoming.filter((file) => {
    if (file.size > MAX_FILE_BYTES) { toast.error(english ? `${file.name} is larger than 50 MB.` : `${file.name} 50 MB से बड़ा है।`); return false; }
    if (!/\.(xlsx|xls|csv|tsv|txt|zip)$/i.test(file.name)) { toast.error(english ? `${file.name} is not a supported format.` : `${file.name} supported format नहीं है।`); return false; }
    return !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
  });
  setter((items) => [...items, ...accepted]);
}

function toPaise(value: string) {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error(`Invalid rupee amount: ${value || "blank"}`);
  const paise = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error(`Invalid rupee amount: ${value}`);
  return paise;
}

function cryptoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

void Info;

function subscribeReady(){return ()=>{};}
