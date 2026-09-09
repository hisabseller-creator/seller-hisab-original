"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CircleDollarSign, FileSpreadsheet, Loader2, Megaphone, RefreshCw, Save, Target, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProPlanLock } from "./pro-plan-lock";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/core/money";
import type { AdsPerformanceParseResult } from "@/core/ads/parser";
import type { AdsCampaignEconomics, AdsEconomicsSummary } from "@/core/ads/economics";

const CHANNELS = [
  { id: "amazon-in", label: "Amazon India" },
  { id: "flipkart", label: "Flipkart" },
  { id: "meesho", label: "Meesho" },
  { id: "shopify", label: "Shopify / D2C" },
] as const;

type AdsWorkspaceSummary = AdsEconomicsSummary & {
  latestImport?: { fileName: string | null; channelId: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string };
};

function percentToBps(value: string): number | undefined {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return undefined;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const percent = Number(normalized);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return undefined;
  return Math.round(percent * 100);
}

function bpsToInput(value: number | undefined): string {
  if (value === undefined) return "";
  return (value / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatPercentBps(value: number | undefined): string {
  return value === undefined ? "—" : `${(value / 100).toFixed(1)}%`;
}

function formatRoas(value: number | undefined): string {
  if (value === undefined) return "—";
  if (!Number.isFinite(value)) return "∞";
  return `${value.toFixed(2)}x`;
}

function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN") : "—";
}

function channelName(channelId: string | null | undefined): string {
  return CHANNELS.find((item) => item.id === channelId)?.label ?? channelId ?? "—";
}

function actionTone(action: AdsCampaignEconomics["action"]): string {
  if (action === "Review or reduce spend") return "border-red-200 bg-red-50 text-red-800";
  if (action === "Watch margin") return "border-amber-200 bg-amber-50 text-amber-800";
  if (action === "Review scale opportunity") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (action === "Add attributed sales" || action === "Set margin baseline") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function AdsWorkspaceView() {
  const [summary, setSummary] = useState<AdsWorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<AdsPerformanceParseResult | null>(null);
  const [channelId, setChannelId] = useState<(typeof CHANNELS)[number]["id"]>("amazon-in");
  const [preAdMargin, setPreAdMargin] = useState("");
  const [returnLoss, setReturnLoss] = useState("0");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account/ads", { cache: "no-store" });
    const payload = await response.json() as { summary?: AdsWorkspaceSummary; error?: string; requiredPlan?: string };
    if (response.status === 402) {
      setPlanLocked(true);
      setSummary(null);
      return;
    }
    if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Ads summary could not be loaded.");
    setPlanLocked(false);
    setSummary(payload.summary);
    setPreAdMargin(bpsToInput(payload.summary.preAdMarginBps));
    setReturnLoss(bpsToInput(payload.summary.returnLossBps) || "0");
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      refresh()
        .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Ads summary could not be loaded."); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);

  const criticalParserIssue = parsed?.issues.some((item) => item.severity === "critical") ?? false;
  const rowsWithSales = useMemo(() => parsed?.rows.filter((row) => row.attributedSalesPaise !== undefined).length ?? 0, [parsed]);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setParsed(null);
    try {
      const { parseAdsPerformanceFile } = await import("@/core/ads/parser");
      const result = await parseAdsPerformanceFile({ name: file.name, buffer: await file.arrayBuffer() });
      setParsed(result);
      if (result.rows.length) toast.success(`${result.rows.length} normalized ad rows ready. Raw report stays in this browser.`);
      else toast.error(result.issues[0]?.message ?? "No usable ad rows were found.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ad report could not be parsed.");
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!parsed || !parsed.rows.length || criticalParserIssue) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "import",
          channelId,
          fileName: parsed.fileName,
          sourceFingerprint: parsed.sourceFingerprint,
          coverageStart: parsed.coverageStart,
          coverageEnd: parsed.coverageEnd,
          rows: parsed.rows,
        }),
      });
      const payload = await response.json() as { importedCount?: number; duplicate?: boolean; summary?: AdsWorkspaceSummary; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Ad rows could not be imported.");
      setSummary(payload.summary);
      setParsed(null);
      toast.success(payload.duplicate ? "This ad report was already imported for this channel." : `${payload.importedCount ?? 0} normalized ad rows saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ad rows could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAssumptions() {
    const preAdMarginBps = percentToBps(preAdMargin);
    const returnLossBps = percentToBps(returnLoss);
    if (preAdMargin.trim() && (preAdMarginBps === undefined || preAdMarginBps === 0)) return toast.error("Pre-ad contribution margin must be above 0% and at most 100%.");
    if (returnLossBps === undefined) return toast.error("Return/RTO loss % is invalid.");
    if (preAdMarginBps !== undefined && returnLossBps > preAdMarginBps) return toast.error("Return/RTO loss % cannot exceed the pre-ad contribution margin.");
    setBusy(true);
    try {
      const response = await fetch("/api/account/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preferences", preAdMarginBps, returnLossBps }),
      });
      const payload = await response.json() as { summary?: AdsWorkspaceSummary; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Ads assumptions could not be saved.");
      setSummary(payload.summary);
      toast.success("Ads economics assumptions saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ads assumptions could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mt-6 grid place-items-center rounded-2xl border border-slate-200 bg-white py-20"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (planLocked) return <div className="mt-6 space-y-5"><div><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Ads & Marketing Economics</h1></div><ProPlanLock title="Ads & Marketing Economics requires Pro" description="Upgrade to Pro to import normalized ad performance, calculate ACoS/ROAS from evidence and review modeled spend boundaries." /></div>;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Ads & Marketing Economics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Ad console sales नहीं — spend के बाद कितना margin बच सकता है, कौन-सा campaign sustainable limit पार कर रहा है, और कहाँ human review चाहिए. Raw ad file browser में parse होती है.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); refresh().finally(() => setLoading(false)); }} disabled={busy}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ad spend" value={formatInr(summary?.totalSpendPaise ?? 0)} note={`${summary?.rowCount ?? 0} saved rows`} />
        <MetricCard label="Attributed sales" value={formatInr(summary?.totalAttributedSalesPaise ?? 0)} note={summary?.salesCoverageComplete ? "Complete sales coverage" : `${formatInr(summary?.spendWithoutSalesPaise ?? 0)} spend lacks sales`} />
        <MetricCard label="Actual ACoS" value={formatPercentBps(summary?.actualAcosBps)} note={summary?.salesCoverageComplete ? `ROAS ${formatRoas(summary?.actualRoas)}` : "Incomplete — not guessed"} />
        <MetricCard label="Spend above model" value={formatInr(summary?.spendAtRiskPaise ?? 0)} note={summary?.preAdMarginBps ? `Max ACoS ${formatPercentBps(summary.maxAcosBps)}` : "Set margin baseline to unlock"} danger={(summary?.spendAtRiskPaise ?? 0) > 0} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileSpreadsheet className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-slate-950">Import ad performance</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">CSV / XLSX / XLS • max 20 MB. Required: Date, Campaign, Spend. Attributed Sales is optional, but SellerHisab will not calculate ACoS/ROAS where sales evidence is missing.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="text-xs font-bold text-slate-700">Channel
            <select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400" value={channelId} onChange={(event) => setChannelId(event.target.value as (typeof CHANNELS)[number]["id"])} disabled={busy}>
              {CHANNELS.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-5 text-sm font-bold text-blue-800 hover:bg-blue-50">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
            Choose ads CSV/XLSX
            <input className="sr-only" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>
        </div>
        {parsed && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-extrabold text-slate-900">{parsed.fileName}</p><p className="mt-1 text-xs text-slate-500">{parsed.rows.length} rows • {rowsWithSales} rows with attributed sales • {formatDate(parsed.coverageStart)} → {formatDate(parsed.coverageEnd)}</p></div>
            <Button onClick={() => void importRows()} disabled={busy || criticalParserIssue || !parsed.rows.length} className="bg-blue-600 font-bold">Save normalized rows</Button>
          </div>
          {parsed.issues.length > 0 && <div className="mt-3 space-y-2">{parsed.issues.map((issue, index) => <p key={`${issue.message}:${index}`} className={`flex gap-2 text-xs leading-5 ${issue.severity === "critical" ? "text-red-700" : "text-amber-700"}`}><AlertTriangle className="mt-0.5 size-4 shrink-0" />{issue.message}</p>)}</div>}
        </div>}
        {summary?.latestImport && <p className="mt-3 text-xs text-slate-500">Latest saved import: <strong className="text-slate-700">{summary.latestImport.fileName ?? "Ad report"}</strong> • {channelName(summary.latestImport.channelId)} • {formatDate(summary.latestImport.coverageStart)} → {formatDate(summary.latestImport.coverageEnd)}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CircleDollarSign className="size-5" /></span><div><h2 className="font-extrabold text-slate-950">Profit boundary assumptions</h2><p className="mt-1 text-xs leading-5 text-slate-500">Actual spend/sales metrics come from your report. Profit-after-ads is modeled only from the explicit margin assumptions below. SellerHisab never silently invents product margin or return loss.</p></div></div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-xs font-bold text-slate-700">Pre-ad contribution margin %<Input className="mt-2" inputMode="decimal" placeholder="e.g. 28" value={preAdMargin} onChange={(event) => setPreAdMargin(event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-700">Return/RTO loss % of ad sales<Input className="mt-2" inputMode="decimal" placeholder="e.g. 3" value={returnLoss} onChange={(event) => setReturnLoss(event.target.value)} /></label>
          <div className="flex items-end"><Button className="w-full bg-emerald-600 font-bold hover:bg-emerald-700" onClick={() => void saveAssumptions()} disabled={busy}><Save className="mr-2 size-4" />Save assumptions</Button></div>
        </div>
        {summary?.preAdMarginBps ? <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"><SmallMetric label="Effective margin before ads" value={formatPercentBps(summary.effectiveMarginBps)} /><SmallMetric label="Break-even ROAS" value={formatRoas(summary.breakEvenRoas)} /><SmallMetric label="Modeled contribution after ads" value={formatInr(summary.modeledContributionAfterAdsPaise)} danger={(summary.modeledContributionAfterAdsPaise ?? 0) < 0} /></div> : <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">No margin baseline saved yet. SellerHisab will show actual spend, attributed sales and complete ACoS/ROAS only — no profit claim.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Target className="size-5" /></span><div><h2 className="font-extrabold text-slate-950">Campaign action review</h2><p className="mt-1 text-xs text-slate-500">Deterministic recommendations only; no autonomous bid/budget changes.</p></div></div><span className="text-xs font-bold text-slate-500">{summary?.campaigns.length ?? 0} campaign(s)</span></div>
        <div className="mt-4 space-y-3">
          {(summary?.campaigns ?? []).slice(0, 20).map((campaign) => <CampaignCard key={campaign.key} campaign={campaign} />)}
          {!summary?.campaigns.length && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"><Megaphone className="mx-auto mb-2 size-6" />Import an ad report to build campaign economics.</div>}
        </div>
      </section>

      {(summary?.channelSummaries.length ?? 0) > 1 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BarChart3 className="size-5 text-blue-700" /><h2 className="font-extrabold text-slate-950">Cross-channel ad view</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2">{summary?.channelSummaries.map((channel) => <div key={channel.channelId} className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-extrabold text-slate-900">{channelName(channel.channelId)}</p><p className="mt-2 text-xs text-slate-500">Spend {formatInr(channel.spendPaise)} • Sales {formatInr(channel.attributedSalesPaise)}</p><p className="mt-1 text-xs font-bold text-slate-700">ACoS {formatPercentBps(channel.actualAcosBps)} • ROAS {formatRoas(channel.actualRoas)}</p></div>)}</div></section>}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: AdsCampaignEconomics }) {
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">{channelName(campaign.channelId)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${actionTone(campaign.action)}`}>{campaign.action}</span></div><h3 className="mt-1 text-sm font-extrabold text-slate-950">{campaign.campaignName}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{campaign.reason}</p></div><div className="shrink-0 text-left sm:text-right"><p className="text-sm font-black text-slate-950">Spend {formatInr(campaign.spendPaise)}</p><p className="mt-1 text-xs text-slate-500">Sales {formatInr(campaign.attributedSalesPaise)} • ACoS {formatPercentBps(campaign.actualAcosBps)} • ROAS {formatRoas(campaign.actualRoas)}</p>{campaign.overshootPaise !== undefined && campaign.overshootPaise > 0 && <p className="mt-1 text-xs font-extrabold text-red-700">Above sustainable spend: {formatInr(campaign.overshootPaise)}</p>}</div></div></article>;
}

function MetricCard({ label, value, note, danger = false }: { label: string; value: string; note: string; danger?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-2 text-2xl font-black tracking-[-.03em] ${danger ? "text-red-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function SmallMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-1 text-sm font-black ${danger ? "text-red-700" : "text-slate-900"}`}>{value}</p></div>;
}
