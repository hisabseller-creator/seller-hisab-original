"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  Cable,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
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
type MarketplaceId = "meesho" | "amazon-in" | "flipkart" | "shopify" | "woocommerce";
type MarketplaceOption = {
  id: MarketplaceId;
  name: string;
  logo: string;
  logoClass: string;
  fileAnalysis: boolean;
  apiConnection: boolean;
  fileHint: string;
};

const MARKETPLACES: MarketplaceOption[] = [
  { id: "meesho", name: "Meesho", logo: "/brands/marketplaces/meesho.svg", logoClass: "max-h-9 max-w-[132px]", fileAnalysis: true, apiConnection: false, fileHint: "Payments / settlement और बाकी available reports" },
  { id: "amazon-in", name: "Amazon India", logo: "/brands/marketplaces/amazon.svg", logoClass: "max-h-8 max-w-[132px]", fileAnalysis: true, apiConnection: true, fileHint: "Orders + Settlement Flat File V2" },
  { id: "flipkart", name: "Flipkart", logo: "/brands/marketplaces/flipkart.svg", logoClass: "max-h-9 max-w-[138px]", fileAnalysis: true, apiConnection: true, fileHint: "Orders + settlement / P&L reports" },
  { id: "shopify", name: "Shopify", logo: "/brands/marketplaces/shopify.svg", logoClass: "max-h-9 max-w-[142px]", fileAnalysis: true, apiConnection: true, fileHint: "Orders CSV + Shopify Payments report" },
  { id: "woocommerce", name: "WooCommerce", logo: "/brands/marketplaces/woocommerce.svg", logoClass: "max-h-9 max-w-[148px]", fileAnalysis: false, apiConnection: true, fileHint: "Read-only store connection" },
];

export function AnalyzeWizard() {
  const { language } = useLanguage();
  const { user } = useAccountStatus();
  const english = language === "english";
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceId | null>(null);
  const [primaryFiles, setPrimaryFiles] = useState<File[]>([]);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [costPaste, setCostPaste] = useState("");
  const [inlineCosts, setInlineCosts] = useState<InlineCost[]>([{ id: cryptoId(), sku: "", product: "", packaging: "", variable: "" }]);
  const [defaultPackaging, setDefaultPackaging] = useState("");
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
  const selected = MARKETPLACES.find((marketplace) => marketplace.id === selectedMarketplace) ?? null;

  useEffect(() => {
    const db = localDb();
    db.costs.toArray().then(setSavedCosts).catch(() => setSavedCosts([]));
    const resumeId = new URLSearchParams(window.location.search).get("resume");
    if (resumeId) db.analyses.get(resumeId).then((saved) => { if (saved?.result) setResult(saved.result); }).catch(() => undefined);
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
    ]).then(async ([localCosts, remoteCosts]) => {
      if (!active) return;
      const merged = mergeSavedCosts(localCosts, remoteCosts);
      setSavedCosts(merged);
      if (merged.length) await db.costs.bulkPut(merged);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  function chooseMarketplace(id: MarketplaceId) {
    if (processing) return;
    if (id !== selectedMarketplace && primaryFiles.length) {
      setPrimaryFiles([]);
      toast.message(english ? "Files cleared for the new marketplace." : "नए marketplace के लिए पुरानी files हटा दी गई हैं।");
    }
    setSelectedMarketplace(id);
    setError(null);
  }

  async function runAnalysis() {
    if (!selectedMarketplace || !selected) {
      setError(english ? "Choose your marketplace first." : "पहले अपना marketplace चुनें।");
      return;
    }
    if (!selected.fileAnalysis) {
      setError(english ? `${selected.name} currently uses the account connection flow.` : `${selected.name} के लिए अभी account connection वाला flow उपलब्ध है।`);
      return;
    }
    if (!primaryFiles.length) {
      setError(english ? `Add ${selected.name} reports to continue.` : `${selected.name} की report files add करें।`);
      return;
    }

    setProcessing(true);
    setError(null);
    setProgress({ message: english ? "Understanding your reports" : "आपकी reports समझ रहे हैं", percent: 5 });
    try {
      const costs = await collectCosts();
      const fileInputs = await Promise.all(primaryFiles.map(async (file) => ({ name: file.name, buffer: await file.arrayBuffer() })));
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
          const knownChannels = message.result.channels.map((channel) => String(channel.channelId)).filter((channelId) => channelId !== "unknown");
          if (selectedMarketplace && knownChannels.length && knownChannels.some((channelId) => channelId !== selectedMarketplace)) {
            const picked = MARKETPLACES.find((marketplace) => marketplace.id === selectedMarketplace)?.name ?? selectedMarketplace;
            setError(english ? `These reports do not match ${picked}. Choose the marketplace the reports came from and try again.` : `ये reports ${picked} की नहीं लग रही हैं। जिस marketplace से reports ली हैं वही चुनकर दोबारा try करें।`);
            setProcessing(false);
            worker.terminate();
            workerRef.current = null;
            return;
          }
          setProgress({ message: english ? "Your action board is ready" : "आपका action board तैयार है", percent: 100 });
          setResult(message.result);
          setProcessing(false);
          worker.terminate();
          workerRef.current = null;
          await localDb().analyses.put({ id: message.result.id, createdAt: message.result.createdAt, result: message.result, label: "Current analysis" });
          if (saveCosts) await localDb().costs.bulkPut(costs.map((cost) => ({ ...cost, updatedAt: new Date().toISOString() })));
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
          defaultPackagingPaise: defaultPackaging ? toPaise(defaultPackaging) : undefined,
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
      if (!row.sku.trim() || !row.product.trim()) throw new Error(english ? "Each manual cost row needs both SKU and Product Cost." : "Manual cost row में SKU और Product Cost दोनों भरें।");
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
        <Dashboard result={result} initiallyUnlocked={Boolean(user?.isAdmin)} onEditCosts={() => setResult(null)} />
        <AnalysisAccountSave result={result} />
      </div>
    );
  }

  return (
    <main className="app-wallpaper min-h-[75vh] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.15em] text-blue-600">{english ? "Simple • Private • Seller controlled" : "Simple • Private • Control आपका"}</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-950 sm:text-4xl">{english ? "Choose where you sell" : "आप कहाँ बेचते हैं?"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">{english ? "Choose your marketplace first. SellerHisab will show only the options that work for that marketplace, so you never have to guess what to upload or connect." : "पहले अपना marketplace चुनें। SellerHisab उसी marketplace के काम आने वाले options दिखाएगा—आपको यह guess नहीं करना पड़ेगा कि क्या upload या connect करना है।"}</p>
        </div>

        <MarketplaceSelector english={english} selected={selectedMarketplace} disabled={processing} onSelect={chooseMarketplace} />

        {selected && (
          <>
            <SetupRail english={english} selected />
            <MarketplacePathCard marketplace={selected} english={english} />

            {selected.fileAnalysis ? (
              <>
                <section className="liquid-panel mt-5 rounded-[26px] p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="liquid-button grid size-10 shrink-0 place-items-center rounded-[14px] text-sm font-black text-white">1</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">{english ? `Add your ${selected.name} reports` : `${selected.name} की reports add करें`}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{english ? `Add the reports you have. SellerHisab will understand supported Orders, Settlement/Payments and Ads files inside this ${selected.name} flow.` : `जो reports आपके पास हैं, एक साथ add कर दें। SellerHisab इसी ${selected.name} flow में supported Orders, Settlement/Payments और Ads files को खुद समझ लेगा।`}</p>
                      <div className="mt-5"><FileDrop english={english} files={primaryFiles} onFiles={(files) => addValidated(files, primaryFiles, setPrimaryFiles, english)} onRemove={(index) => setPrimaryFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} accept=".xlsx,.xls,.csv,.tsv,.txt,.zip" /></div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <p className="text-xs font-semibold text-slate-600">{selected.fileHint}</p>
                        <Link className="text-xs font-extrabold text-blue-700 hover:underline" href="/help#download-report">{english ? "Where do I get these reports?" : "ये reports कहाँ से मिलेंगी?"}</Link>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="liquid-panel mt-5 rounded-[26px] p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-sm font-black text-emerald-700">2</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">{english ? "Costs are reused automatically" : "पुरानी costs अपने-आप use होंगी"}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{savedCosts.length > 0 ? (english ? `${savedCosts.length} saved SKU cost(s) are already ready. Only add or change costs when something is new.` : `${savedCosts.length} saved SKU cost(s) पहले से ready हैं। सिर्फ नए या बदले हुए product की cost add करें।`) : (english ? "You can analyze first. If product cost is missing, SellerHisab will mark the result clearly instead of inventing a number." : "आप पहले analysis चला सकते हैं। Product cost missing होगी तो SellerHisab साफ बताएगा—कोई number guess नहीं करेगा।")}</p>

                      <details className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                        <summary className="cursor-pointer text-sm font-extrabold text-blue-700">{english ? "Add or update product costs" : "Product cost add / update करें"}</summary>
                        <div className="mt-4">
                          <Tabs defaultValue="upload">
                            <TabsList className="cost-method-tabs grid h-auto w-full grid-cols-3">
                              <TabsTrigger value="upload" className="cost-method-tab py-3 text-xs">{english ? "Upload sheet" : "Sheet upload"}</TabsTrigger>
                              <TabsTrigger value="paste" className="cost-method-tab py-3 text-xs">Paste</TabsTrigger>
                              <TabsTrigger value="inline" className="cost-method-tab py-3 text-xs">{english ? "Type manually" : "Manually"}</TabsTrigger>
                            </TabsList>
                            <TabsContent value="upload" className="mt-4"><Label htmlFor="cost-sheet" className="sr-only">Cost sheet</Label><Input id="cost-sheet" className="data-entry h-12" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setCostFile(event.target.files?.[0] ?? null)} />{costFile && <p className="mt-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="mr-1 inline size-3.5" />{costFile.name}</p>}</TabsContent>
                            <TabsContent value="paste" className="mt-4"><Label htmlFor="cost-paste" className="text-xs font-bold text-slate-700">SKU, Product Cost, Packaging Cost, Variable Cost</Label><Textarea id="cost-paste" className="data-entry mt-2 min-h-32 font-mono text-xs" value={costPaste} onChange={(event) => setCostPaste(event.target.value)} placeholder={english ? "Paste cost-sheet rows here" : "Cost-sheet की rows यहाँ paste करें"} /><p className="mt-2 text-xs text-slate-500">{english ? "Copy 2–4 columns from Excel and paste them directly." : "Excel से 2–4 columns copy करके सीधे paste कर सकते हैं।"}</p></TabsContent>
                            <TabsContent value="inline" className="mt-4"><div className="space-y-3">{inlineCosts.map((row, index) => <InlineCostRow key={row.id} row={row} onChange={(next) => setInlineCosts((current) => current.map((item) => item.id === row.id ? next : item))} onRemove={() => setInlineCosts((current) => current.filter((item) => item.id !== row.id))} canRemove={inlineCosts.length > 1} index={index} />)}</div><Button variant="outline" size="sm" className="mt-3" onClick={() => setInlineCosts((current) => [...current, { id: cryptoId(), sku: "", product: "", packaging: "", variable: "" }])}><Plus className="mr-1.5 size-4" />{english ? "Add SKU" : "SKU add करें"}</Button></TabsContent>
                          </Tabs>
                          <div className="mt-5 grid gap-4 border-t border-blue-200/80 pt-5 sm:grid-cols-2">
                            <div><Label htmlFor="default-packaging" className="text-xs font-bold">{english ? "Default packaging cost / shipped order (₹)" : "एक shipped order की normal packaging cost (₹)"}</Label><Input id="default-packaging" inputMode="decimal" value={defaultPackaging} onChange={(event) => setDefaultPackaging(event.target.value)} placeholder={english ? "Only if you know it" : "पता हो तभी भरें"} className="data-entry mt-2 h-12" /></div>
                            <label className="data-entry-card flex items-start gap-3 rounded-xl p-3"><Checkbox checked={saveCosts} onCheckedChange={(checked) => setSaveCosts(checked === true)} /><span><span className="block text-xs font-extrabold text-slate-800">{english ? "Remember these costs" : "इन costs को याद रखें"}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{english ? "Reuse them automatically next time." : "अगली बार अपने-आप use होंगी।"}</span></span></label>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </section>

                <details className="liquid-panel mt-5 rounded-[24px] p-5">
                  <summary className="cursor-pointer text-sm font-extrabold text-slate-800">{english ? "Only if a report is missing — add optional numbers" : "सिर्फ report missing हो तो — optional numbers भरें"}</summary>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{english ? "Skip this when your reports already contain the data. SellerHisab should use source data first." : "अगर reports में data मौजूद है तो इसे छोड़ दें। SellerHisab पहले report वाला data ही use करेगा।"}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div><Label htmlFor="ad-spend" className="text-xs font-bold">Total ad spend (₹)</Label><Input id="ad-spend" inputMode="decimal" value={adSpend} onChange={(event) => setAdSpend(event.target.value)} placeholder="Optional" className="data-entry mt-2 h-12" /><p className="mt-1.5 text-[11px] text-slate-500">{english ? "Only when no Ads report is available." : "Ads report न हो तभी।"}</p></div>
                    <div><Label htmlFor="overhead" className="text-xs font-bold">{english ? "Monthly fixed business expenses (₹)" : "Monthly fixed business खर्च (₹)"}</Label><Input id="overhead" inputMode="decimal" value={fixedOverhead} onChange={(event) => setFixedOverhead(event.target.value)} placeholder="Optional" className="data-entry mt-2 h-12" /></div>
                    <div><Label htmlFor="bank-credit" className="text-xs font-bold">{english ? "Bank credit for this period (₹)" : "इस period में bank में आया amount (₹)"}</Label><Input id="bank-credit" inputMode="decimal" value={bankCredit} onChange={(event) => setBankCredit(event.target.value)} placeholder="Optional" className="data-entry mt-2 h-12" /><p className="mt-1.5 text-[11px] text-slate-500">{english ? "For full matching, Pro users can use Bank & Cash." : "Full matching के लिए Pro में Bank & Cash use करें।"}</p></div>
                  </div>
                </details>

                {error && <Alert className="mt-5 border-red-200 bg-red-50"><AlertCircle className="text-red-600" /><AlertTitle className="font-extrabold">{english ? "We need one correction" : "एक चीज़ ठीक करनी है"}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {processing && <div className="liquid-panel mt-5 rounded-[24px] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Loader2 className="size-5 animate-spin text-blue-600" /><div><p className="text-sm font-extrabold text-slate-900">{progress.message}</p><p className="mt-1 text-xs text-slate-500">{english ? "You can stay on this screen while the browser calculates." : "Calculation browser में हो रही है; screen responsive रहेगी।"}</p></div></div><span className="text-sm font-black tabular-nums text-blue-700">{progress.percent}%</span></div><Progress className="mt-4" value={progress.percent} /><Button variant="ghost" size="sm" className="mt-3 text-red-700" onClick={cancel}><X className="mr-1.5 size-4" />Cancel</Button></div>}

                <div className="glass-nav sticky bottom-3 z-20 mt-6 rounded-[22px] p-4 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><LockKeyhole className="size-4" /></span><div><p className="text-xs font-extrabold text-slate-900">{english ? "Raw files stay on your device" : "Raw files आपके device पर रहती हैं"}</p><p className="mt-0.5 text-[11px] text-slate-500">{english ? "SellerHisab calculates from the reports without uploading raw report rows." : "Raw report rows upload किए बिना analysis होता है।"}</p></div></div>
                  <div className="mt-4 flex gap-2 sm:mt-0"><Button variant="outline" className="rounded-xl bg-white/70" onClick={() => { setPrimaryFiles([]); setError(null); }} disabled={processing}><RotateCcw className="mr-1.5 size-4" />Reset</Button><Button className="liquid-button rounded-xl font-extrabold" onClick={runAnalysis} disabled={processing || !primaryFiles.length}>{processing ? "Processing…" : english ? "Show My Hisaab" : "मेरा हिसाब दिखाओ"}</Button></div>
                </div>
              </>
            ) : (
              <section className="liquid-panel mt-5 rounded-[26px] p-6">
                <div className="flex items-start gap-3"><Cable className="mt-0.5 size-5 text-blue-600" /><div><h2 className="font-extrabold text-slate-950">{english ? "Connect WooCommerce to continue" : "आगे बढ़ने के लिए WooCommerce connect करें"}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{english ? "WooCommerce currently uses the read-only connection flow. File analysis is not shown because it is not live yet." : "WooCommerce में अभी read-only connection वाला flow supported है। File analysis live नहीं है, इसलिए हम वह option दिखा नहीं रहे।"}</p><Button asChild className="mt-4 bg-blue-600 font-bold"><Link href="/app/connections"><Cable className="mr-2 size-4" />{english ? "Connect WooCommerce" : "WooCommerce connect करें"}</Link></Button></div></div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MarketplaceSelector({ english, selected, disabled, onSelect }: { english: boolean; selected: MarketplaceId | null; disabled: boolean; onSelect: (id: MarketplaceId) => void }) {
  return (
    <section className="mt-7" aria-labelledby="marketplace-choice-title">
      <div><h2 id="marketplace-choice-title" className="text-sm font-extrabold text-slate-950">{english ? "Select marketplace" : "Marketplace चुनें"}</h2><p className="mt-1 text-xs text-slate-500">{english ? "You choose it. SellerHisab will not choose a marketplace for you." : "Marketplace आप चुनेंगे। SellerHisab आपके लिए marketplace select नहीं करेगा।"}</p></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="radiogroup" aria-label="Marketplace">
        {MARKETPLACES.map((marketplace) => {
          const active = marketplace.id === selected;
          return <button key={marketplace.id} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onSelect(marketplace.id)} className={`liquid-soft relative flex min-h-[96px] flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-4 text-center transition ${active ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-100" : "border-white/80 hover:border-blue-300 hover:bg-white"}`}><img src={marketplace.logo} alt={`${marketplace.name} logo`} className={`block h-auto w-auto object-contain ${marketplace.logoClass}`} /><span className={`text-[11px] font-extrabold ${active ? "text-blue-700" : "text-slate-600"}`}>{active ? "Selected ✓" : marketplace.name}</span></button>;
        })}
      </div>
    </section>
  );
}

function MarketplacePathCard({ marketplace, english }: { marketplace: MarketplaceOption; english: boolean }) {
  return (
    <section className="liquid-panel mt-5 rounded-[24px] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-blue-600">{marketplace.name}</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">{english ? "Use the easiest available method" : "जो आसान तरीका available है, वही use करें"}</h2></div>
        <div className="flex flex-wrap gap-2">
          {marketplace.fileAnalysis && <span className="inline-flex min-h-10 items-center rounded-xl bg-emerald-50 px-3 text-xs font-extrabold text-emerald-700"><FileSpreadsheet className="mr-2 size-4" />{english ? "Upload reports" : "Reports upload"}</span>}
          {marketplace.apiConnection && <Button asChild variant="outline" className="rounded-xl bg-white/80 font-bold"><Link href="/app/connections"><Cable className="mr-2 size-4" />{english ? "Connect automatically — Pro" : "Automatic connect — Pro"}</Link></Button>}
        </div>
      </div>
      {!marketplace.apiConnection && <p className="mt-3 text-xs leading-5 text-slate-500">{english ? "An account-connection option is not shown for this marketplace because SellerHisab does not currently claim a supported general API connection." : "इस marketplace के लिए account-connect option नहीं दिखाया जा रहा, क्योंकि SellerHisab अभी supported general API connection claim नहीं करता।"}</p>}
    </section>
  );
}

function SetupRail({ english, selected }: { english: boolean; selected: boolean }) {
  const steps = english ? ["Marketplace chosen", "Add reports", "See your result"] : ["Marketplace चुना", "Reports add करें", "Result देखें"];
  return <ol className="liquid-panel mt-7 grid rounded-[22px] p-2 sm:grid-cols-3" aria-label="Analysis steps">{steps.map((step, index) => <li key={step} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${index === 0 && selected ? "bg-emerald-600 text-white" : index === 1 ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-sm"}`}>{index === 0 && selected ? "✓" : index + 1}</span><span className={`text-xs font-extrabold ${index === 1 ? "text-blue-700" : "text-slate-600"}`}>{step}</span>{index < 2 && <span className="ml-auto hidden text-blue-300 sm:inline" aria-hidden="true">→</span>}</li>)}</ol>;
}

function FileDrop({ english, files, onFiles, onRemove, accept }: { english: boolean; files: File[]; onFiles: (files: File[]) => void; onRemove: (index: number) => void; accept: string }) {
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  return <div><label className="liquid-drop flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[22px] px-4 py-8 text-center transition hover:border-blue-500 hover:bg-blue-50/70 focus-within:ring-2 focus-within:ring-blue-600"><input disabled={!ready} className="sr-only" type="file" multiple accept={accept} onChange={(event) => onFiles(Array.from(event.target.files ?? []))} /><span className="liquid-icon grid size-12 place-items-center rounded-2xl"><UploadCloud className="size-6 text-blue-600" /></span><span className="mt-4 text-sm font-extrabold text-slate-900">{english ? "Choose all the reports you have" : "जो reports हैं, सब एक साथ चुनें"}</span><span className="mt-1 text-xs text-slate-500">{english ? "One or many files / ZIP • max 50 MB each" : "एक या कई files / ZIP • हर file max 50 MB"}</span></label>{files.length > 0 && <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}`} className="liquid-soft flex items-center gap-3 rounded-xl px-3 py-2"><span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">{file.name.endsWith(".zip") ? <FileArchive className="size-4" /> : <FileSpreadsheet className="size-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{file.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => onRemove(index)}><Trash2 className="size-4 text-red-600" /></Button></li>)}</ul>}</div>;
}

function InlineCostRow({ row, onChange, onRemove, canRemove, index }: { row: InlineCost; onChange: (row: InlineCost) => void; onRemove: () => void; canRemove: boolean; index: number }) {
  return <div className="cost-entry-row grid gap-3 rounded-2xl p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"><div><Label className="text-[10px] font-bold" htmlFor={`sku-${row.id}`}>SKU</Label><Input id={`sku-${row.id}`} className="data-entry mt-1 h-11" value={row.sku} onChange={(event) => onChange({ ...row, sku: event.target.value })} placeholder={`SKU ${index + 1}`} /></div><div><Label className="text-[10px] font-bold" htmlFor={`product-${row.id}`}>Product ₹</Label><Input id={`product-${row.id}`} className="data-entry mt-1 h-11" inputMode="decimal" value={row.product} onChange={(event) => onChange({ ...row, product: event.target.value })} /></div><div><Label className="text-[10px] font-bold" htmlFor={`pack-${row.id}`}>Packaging ₹</Label><Input id={`pack-${row.id}`} className="data-entry mt-1 h-11" inputMode="decimal" value={row.packaging} onChange={(event) => onChange({ ...row, packaging: event.target.value })} /></div><div><Label className="text-[10px] font-bold" htmlFor={`variable-${row.id}`}>Other ₹</Label><Input id={`variable-${row.id}`} className="data-entry mt-1 h-11" inputMode="decimal" value={row.variable} onChange={(event) => onChange({ ...row, variable: event.target.value })} /></div>{canRemove && <Button variant="ghost" size="icon" className="self-end" aria-label="Remove cost row" onClick={onRemove}><Trash2 className="size-4 text-red-600" /></Button>}</div>;
}

function addValidated(incoming: File[], current: File[], setter: Dispatch<SetStateAction<File[]>>, english: boolean) {
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

function subscribeReady() { return () => {}; }
