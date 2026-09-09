"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, FileSpreadsheet, Loader2, PackageCheck, RefreshCw, Save, Truck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProPlanLock } from "./pro-plan-lock";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/core/money";
import type { InventoryParseResult } from "@/core/inventory/parser";
import type { InventoryAllocationSuggestion, InventoryEconomicsSummary, InventoryPositionEconomics, InventoryPositionStatus } from "@/core/inventory/economics";

const CHANNELS = [
  { id: "amazon-in", label: "Amazon India" },
  { id: "flipkart", label: "Flipkart" },
  { id: "meesho", label: "Meesho" },
  { id: "shopify", label: "Shopify / D2C" },
] as const;

type InventoryWorkspaceSummary = InventoryEconomicsSummary & {
  latestImport?: { fileName: string | null; channelId: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string };
};

function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN") : "—";
}

function channelName(channelId: string | null | undefined): string {
  return CHANNELS.find((item) => item.id === channelId)?.label ?? channelId ?? "—";
}

function integerInput(value: string, label: string, min: number, max: number): number | undefined {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    toast.error(`${label} must be a whole number.`);
    return undefined;
  }
  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) {
    toast.error(`${label} must be between ${min} and ${max}.`);
    return undefined;
  }
  return number;
}

function statusTone(status: InventoryPositionStatus): string {
  if (status === "Stockout") return "border-red-200 bg-red-50 text-red-800";
  if (status === "Reorder now") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Overstock review" || status === "No recent sales") return "border-violet-200 bg-violet-50 text-violet-800";
  if (status === "Add sales history") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function formatDays(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(value < 10 ? 1 : 0)} days`;
}

function formatMargin(value: number | undefined): string {
  return value === undefined ? "—" : `${(value / 100).toFixed(1)}%`;
}

export function InventoryWorkspaceView() {
  const [summary, setSummary] = useState<InventoryWorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<InventoryParseResult | null>(null);
  const [channelId, setChannelId] = useState<(typeof CHANNELS)[number]["id"]>("amazon-in");
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState("14");
  const [safetyDays, setSafetyDays] = useState("7");
  const [targetCoverDays, setTargetCoverDays] = useState("30");
  const [overstockDays, setOverstockDays] = useState("120");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account/inventory", { cache: "no-store" });
    const payload = await response.json() as { summary?: InventoryWorkspaceSummary; error?: string; requiredPlan?: string };
    if (response.status === 402) {
      setPlanLocked(true);
      setSummary(null);
      return;
    }
    if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Inventory summary could not be loaded.");
    setPlanLocked(false);
    setSummary(payload.summary);
    setDefaultLeadTimeDays(String(payload.summary.preferences.defaultLeadTimeDays));
    setSafetyDays(String(payload.summary.preferences.safetyDays));
    setTargetCoverDays(String(payload.summary.preferences.targetCoverDays));
    setOverstockDays(String(payload.summary.preferences.overstockDays));
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      refresh()
        .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Inventory summary could not be loaded."); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);

  const criticalParserIssue = parsed?.issues.some((item) => item.severity === "critical") ?? false;
  const rowsWithVelocity = useMemo(() => parsed?.rows.filter((row) => row.unitsSold30d !== undefined).length ?? 0, [parsed]);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setParsed(null);
    try {
      const { parseInventoryFile } = await import("@/core/inventory/parser");
      const result = await parseInventoryFile({ name: file.name, buffer: await file.arrayBuffer() });
      setParsed(result);
      if (result.rows.length) toast.success(`${result.rows.length} normalized inventory rows ready. Raw report stays in this browser.`);
      else toast.error(result.issues[0]?.message ?? "No usable inventory rows were found.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inventory report could not be parsed.");
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!parsed || !parsed.rows.length || criticalParserIssue) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/inventory", {
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
      const payload = await response.json() as { importedCount?: number; duplicate?: boolean; summary?: InventoryWorkspaceSummary; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Inventory rows could not be imported.");
      setSummary(payload.summary);
      setParsed(null);
      toast.success(payload.duplicate ? "This inventory report was already imported for this channel." : `${payload.importedCount ?? 0} normalized inventory rows saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inventory rows could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    const lead = integerInput(defaultLeadTimeDays, "Default lead time", 1, 365);
    const safety = integerInput(safetyDays, "Safety buffer", 0, 180);
    const target = integerInput(targetCoverDays, "Target cover", 1, 365);
    const overstock = integerInput(overstockDays, "Overstock threshold", 30, 730);
    if (lead === undefined || safety === undefined || target === undefined || overstock === undefined) return;
    if (overstock <= target) return toast.error("Overstock threshold must be above target cover days.");
    setBusy(true);
    try {
      const response = await fetch("/api/account/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preferences", defaultLeadTimeDays: lead, safetyDays: safety, targetCoverDays: target, overstockDays: overstock }),
      });
      const payload = await response.json() as { summary?: InventoryWorkspaceSummary; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Inventory assumptions could not be saved.");
      setSummary(payload.summary);
      toast.success("Inventory planning assumptions saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inventory assumptions could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mt-6 grid place-items-center rounded-2xl border border-slate-200 bg-white py-20"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (planLocked) return <div className="mt-6 space-y-5"><div><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Inventory & Reorder Intelligence</h1></div><ProPlanLock title="Inventory & Reorder Intelligence requires Pro" description="Upgrade to Pro to save inventory snapshots, calculate stock risk and review deterministic reorder suggestions." /></div>;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Inventory & Reorder Intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Stock कितना है से आगे — reported sales velocity, lead time और safety buffer के आधार पर stock-out risk, reorder quantity और overstock review. Missing inputs को SellerHisab guess नहीं करता.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); refresh().finally(() => setLoading(false)); }} disabled={busy}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available units" value={(summary?.totalAvailableUnits ?? 0).toLocaleString("en-IN")} note={`${summary?.rowCount ?? 0} current SKU/location positions`} />
        <MetricCard label="Urgent stock risk" value={String((summary?.stockoutCount ?? 0) + (summary?.reorderNowCount ?? 0))} note={`${summary?.stockoutCount ?? 0} stockout • ${summary?.reorderNowCount ?? 0} reorder now`} danger={(summary?.stockoutCount ?? 0) > 0} />
        <MetricCard label="Suggested reorder" value={`${(summary?.totalSuggestedReorderUnits ?? 0).toLocaleString("en-IN")} units`} note="Only where 30-day sales velocity exists" />
        <MetricCard label="Known inventory value" value={formatInr(summary?.knownInventoryValuePaise ?? 0)} note={`${summary?.costCoverageRows ?? 0}/${summary?.rowCount ?? 0} current rows have unit cost`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileSpreadsheet className="size-5" /></span><div><h2 className="font-extrabold text-slate-950">Import inventory snapshot</h2><p className="mt-1 text-xs leading-5 text-slate-500">CSV / XLSX / XLS • max 20 MB. Required: Snapshot Date, SKU, Available. Units Sold 30d unlocks velocity and reorder math. Raw file stays browser-local; normalized rows only are saved.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="text-xs font-bold text-slate-700">Channel
            <select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400" value={channelId} onChange={(event) => setChannelId(event.target.value as (typeof CHANNELS)[number]["id"])} disabled={busy}>
              {CHANNELS.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-5 text-sm font-bold text-blue-800 hover:bg-blue-50">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}Choose inventory CSV/XLSX
            <input className="sr-only" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>
        </div>
        {parsed && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-slate-900">{parsed.fileName}</p><p className="mt-1 text-xs text-slate-500">{parsed.rows.length} rows • {rowsWithVelocity} with 30-day sales • {formatDate(parsed.coverageStart)} → {formatDate(parsed.coverageEnd)}</p></div><Button onClick={() => void importRows()} disabled={busy || criticalParserIssue || !parsed.rows.length} className="bg-blue-600 font-bold">Save normalized rows</Button></div>{parsed.issues.length > 0 && <div className="mt-3 space-y-2">{parsed.issues.map((issue, index) => <p key={`${issue.message}:${index}`} className={`flex gap-2 text-xs leading-5 ${issue.severity === "critical" ? "text-red-700" : "text-amber-700"}`}><AlertTriangle className="mt-0.5 size-4 shrink-0" />{issue.message}</p>)}</div>}</div>}
        {summary?.latestImport && <p className="mt-3 text-xs text-slate-500">Latest saved import: <strong className="text-slate-700">{summary.latestImport.fileName ?? "Inventory report"}</strong> • {channelName(summary.latestImport.channelId)} • {formatDate(summary.latestImport.coverageStart)} → {formatDate(summary.latestImport.coverageEnd)}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Truck className="size-5" /></span><div><h2 className="font-extrabold text-slate-950">Reorder assumptions</h2><p className="mt-1 text-xs leading-5 text-slate-500">Row-level Lead Time Days wins. The default is used only where the report omits lead time. Safety and target cover are explicit planning assumptions, not hidden predictions.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-bold text-slate-700">Default lead time days<Input className="mt-2" inputMode="numeric" value={defaultLeadTimeDays} onChange={(event) => setDefaultLeadTimeDays(event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-700">Safety buffer days<Input className="mt-2" inputMode="numeric" value={safetyDays} onChange={(event) => setSafetyDays(event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-700">Target cover days<Input className="mt-2" inputMode="numeric" value={targetCoverDays} onChange={(event) => setTargetCoverDays(event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-700">Overstock review days<Input className="mt-2" inputMode="numeric" value={overstockDays} onChange={(event) => setOverstockDays(event.target.value)} /></label>
          <div className="flex items-end"><Button className="w-full bg-emerald-600 font-bold hover:bg-emerald-700" onClick={() => void savePreferences()} disabled={busy}><Save className="mr-2 size-4" />Save assumptions</Button></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Boxes className="size-5" /></span><div><h2 className="font-extrabold text-slate-950">SKU stock review</h2><p className="mt-1 text-xs text-slate-500">Latest saved snapshot per channel + SKU + location. No automatic purchase order or stock transfer is created.</p></div></div><span className="text-xs font-bold text-slate-500">{summary?.positions.length ?? 0} position(s)</span></div>
        <div className="mt-4 space-y-3">{(summary?.positions ?? []).slice(0, 30).map((position) => <PositionCard key={`${position.channelId}:${position.sku}:${position.location ?? ""}`} position={position} />)}{!summary?.positions.length && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"><PackageCheck className="mx-auto mb-2 size-6" />Import an inventory snapshot to build reorder intelligence.</div>}</div>
      </section>

      {(summary?.allocationSuggestions.length ?? 0) > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-950">Cross-channel allocation review</h2><p className="mt-1 text-xs leading-5 text-slate-500">Shown only when the file explicitly supplies the same Master SKU across channels plus contribution margin evidence. SellerHisab does not auto-merge raw SKUs.</p><div className="mt-4 space-y-3">{summary?.allocationSuggestions.map((suggestion) => <AllocationCard key={`${suggestion.masterSku}:${suggestion.fromChannelId}:${suggestion.toChannelId}`} suggestion={suggestion} />)}</div></section>}

      {(summary?.channelSummaries.length ?? 0) > 1 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-950">Cross-channel inventory view</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{summary?.channelSummaries.map((channel) => <div key={channel.channelId} className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-extrabold text-slate-900">{channelName(channel.channelId)}</p><p className="mt-2 text-xs text-slate-500">Available {channel.availableUnits.toLocaleString("en-IN")} • Inbound {channel.inboundUnits.toLocaleString("en-IN")}</p><p className="mt-1 text-xs font-bold text-slate-700">{channel.stockoutCount} stockout • {channel.reorderNowCount} reorder now • {channel.overstockCount} overstock review</p></div>)}</div></section>}
    </div>
  );
}

function PositionCard({ position }: { position: InventoryPositionEconomics }) {
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">{channelName(position.channelId)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${statusTone(position.status)}`}>{position.status}</span>{position.leadTimeSource === "default" && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">default lead time</span>}</div><h3 className="mt-1 truncate text-sm font-extrabold text-slate-950">{position.productName ?? position.sku}</h3><p className="mt-1 text-xs font-semibold text-slate-500">SKU {position.sku}{position.masterSku ? ` • Master ${position.masterSku}` : ""}{position.location ? ` • ${position.location}` : ""}</p><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">{position.reason}</p></div><div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3"><Mini label="Available" value={position.availableUnits.toLocaleString("en-IN")} /><Mini label="Inbound" value={(position.inboundUnits ?? 0).toLocaleString("en-IN")} /><Mini label="Sold 30d" value={position.unitsSold30d === undefined ? "—" : position.unitsSold30d.toLocaleString("en-IN")} /><Mini label="Days cover" value={formatDays(position.daysCover)} /><Mini label="Reorder" value={position.suggestedReorderUnits === undefined ? "—" : `${position.suggestedReorderUnits.toLocaleString("en-IN")} units`} /><Mini label="Margin" value={formatMargin(position.contributionMarginBps)} /></div></div></article>;
}

function AllocationCard({ suggestion }: { suggestion: InventoryAllocationSuggestion }) {
  return <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4"><p className="text-sm font-extrabold text-slate-950">Review transfer of {suggestion.suggestedTransferUnits.toLocaleString("en-IN")} units • {suggestion.masterSku}</p><p className="mt-1 text-xs font-semibold text-slate-600">{channelName(suggestion.fromChannelId)} ({suggestion.fromSku}, margin {formatMargin(suggestion.sourceMarginBps)}) → {channelName(suggestion.toChannelId)} ({suggestion.toSku}, margin {formatMargin(suggestion.destinationMarginBps)})</p><p className="mt-2 text-xs leading-5 text-slate-600">{suggestion.reason}</p></div>;
}

function MetricCard({ label, value, note, danger = false }: { label: string; value: string; note: string; danger?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-2 text-2xl font-black tracking-[-.03em] ${danger ? "text-red-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">{label}</p><p className="mt-0.5 font-extrabold text-slate-800">{value}</p></div>;
}
