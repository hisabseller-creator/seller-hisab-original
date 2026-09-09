"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Landmark, Loader2, RefreshCw, Save, UploadCloud, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProPlanLock } from "./pro-plan-lock";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/core/money";
import type { BankStatementParseResult } from "@/core/cash/bank-parser";
import type { CashForecastWeek, CashPayoutMatch } from "@/core/cash/reconciliation";
import type { MoneyPaise } from "@/core/types";

type CashSummary = {
  bankTransactionCount: number;
  totalCreditsPaise: MoneyPaise;
  totalDebitsPaise: MoneyPaise;
  netCashMovementPaise: MoneyPaise;
  matchedPayoutPaise: MoneyPaise;
  cashAtRiskPaise: MoneyPaise;
  cashPendingPaise: MoneyPaise;
  unmatchedCreditPaise: MoneyPaise;
  matches: CashPayoutMatch[];
  unmatchedCredits: Array<{
    id: string;
    amountPaise: MoneyPaise;
    direction: "credit" | "debit";
    currency: string;
    bookedAt: string;
    reference?: string;
    description?: string;
    sourceRow: number;
  }>;
  latestBankImport?: { fileName: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string };
  preferences: { currentBalancePaise?: MoneyPaise; weeklyFixedOutflowPaise?: MoneyPaise };
  forecast: CashForecastWeek[];
  latestConfirmedContributionPaise?: MoneyPaise;
};

function rupeesToPaise(value: string): number | undefined {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return undefined;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return undefined;
  const paise = Math.round(number * 100);
  return Number.isSafeInteger(paise) ? paise : undefined;
}

function paiseToInput(value: number | undefined): string {
  return value === undefined ? "" : (value / 100).toFixed(2).replace(/\.00$/, "");
}

function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN") : "—";
}

function matchTone(status: CashPayoutMatch["status"]): string {
  if (status === "matched") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "excess") return "bg-blue-50 text-blue-700";
  return "bg-red-50 text-red-700";
}

export function CashWorkspaceView() {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<BankStatementParseResult | null>(null);
  const [currentBalance, setCurrentBalance] = useState("");
  const [weeklyOutflow, setWeeklyOutflow] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account/cash", { cache: "no-store" });
    const payload = await response.json() as { summary?: CashSummary; error?: string; requiredPlan?: string };
    if (response.status === 402) {
      setPlanLocked(true);
      setSummary(null);
      return;
    }
    if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Cash summary could not be loaded.");
    setPlanLocked(false);
    setSummary(payload.summary);
    setCurrentBalance(paiseToInput(payload.summary.preferences.currentBalancePaise));
    setWeeklyOutflow(paiseToInput(payload.summary.preferences.weeklyFixedOutflowPaise));
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      refresh()
        .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Cash summary could not be loaded."); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);

  const criticalParserIssue = parsed?.issues.some((item) => item.severity === "critical") ?? false;
  const previewCredits = useMemo(() => parsed?.transactions.filter((item) => item.direction === "credit").length ?? 0, [parsed]);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setParsed(null);
    try {
      const { parseBankStatementFile } = await import("@/core/cash/bank-parser");
      const result = await parseBankStatementFile({ name: file.name, buffer: await file.arrayBuffer() });
      setParsed(result);
      if (result.transactions.length) toast.success(`${result.transactions.length} normalized bank rows ready. Raw file remains in this browser.`);
      else toast.error(result.issues[0]?.message ?? "No usable bank rows were found.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bank file could not be parsed.");
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!parsed || !parsed.transactions.length || criticalParserIssue) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "import",
          fileName: parsed.fileName,
          sourceFingerprint: parsed.sourceFingerprint,
          coverageStart: parsed.coverageStart,
          coverageEnd: parsed.coverageEnd,
          transactions: parsed.transactions,
        }),
      });
      const payload = await response.json() as { importedCount?: number; duplicate?: boolean; summary?: CashSummary; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Bank rows could not be imported.");
      setSummary(payload.summary);
      setParsed(null);
      toast.success(payload.duplicate ? "This bank file was already imported; no duplicate rows were created." : `${payload.importedCount ?? 0} normalized bank transactions saved.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bank rows could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    const currentBalancePaise = rupeesToPaise(currentBalance);
    const weeklyFixedOutflowPaise = rupeesToPaise(weeklyOutflow);
    if (currentBalance.trim() && currentBalancePaise === undefined) return toast.error("Current bank balance is invalid.");
    if (weeklyOutflow.trim() && (weeklyFixedOutflowPaise === undefined || weeklyFixedOutflowPaise < 0)) return toast.error("Weekly fixed outflow is invalid.");
    setBusy(true);
    try {
      const response = await fetch("/api/account/cash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preferences", currentBalancePaise, weeklyFixedOutflowPaise }),
      });
      const payload = await response.json() as { summary?: CashSummary; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Cash settings could not be saved.");
      setSummary(payload.summary);
      toast.success("Cash runway inputs saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cash settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mt-6 grid place-items-center rounded-2xl border border-slate-200 bg-white py-20"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (planLocked) return <div className="mt-6 space-y-5"><div><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Bank & Cash Truth</h1></div><ProPlanLock title="Bank & Cash Truth requires Pro" description="Upgrade to Pro to save normalized bank rows, reconcile payouts and use the conservative cash runway view." /></div>;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Bank & Cash Truth</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Marketplace payout क्या expected था, bank में क्या आया, और कितना cash अभी risk में है — एक जगह. Raw bank file upload नहीं होती; browser normalized rows बनाता है.</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); refresh().finally(() => setLoading(false)); }} disabled={busy}><RefreshCw className="mr-2 size-4" />Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Bank credits" value={formatInr(summary?.totalCreditsPaise ?? 0)} note={`${summary?.bankTransactionCount ?? 0} imported rows`} />
        <MetricCard label="Matched payouts" value={formatInr(summary?.matchedPayoutPaise ?? 0)} note="Confirmed bank matches" positive />
        <MetricCard label="Cash at risk" value={formatInr(summary?.cashAtRiskPaise ?? 0)} note="Missing / short / ambiguous" danger={(summary?.cashAtRiskPaise ?? 0) > 0} />
        <MetricCard label="Net cash movement" value={formatInr(summary?.netCashMovementPaise ?? 0)} note={`Debits ${formatInr(summary?.totalDebitsPaise ?? 0)}`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileSpreadsheet className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-slate-950">Import bank statement</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">CSV / XLSX / XLS • max 20 MB. SellerHisab stores normalized date, amount, direction and limited narration/reference only. Raw file bytes and full account number are not sent.</p>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-6 text-sm font-bold text-blue-800 hover:bg-blue-50">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
          Choose bank CSV/XLSX
          <input className="sr-only" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </label>

        {parsed && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-extrabold text-slate-900">{parsed.fileName}</p><p className="mt-1 text-xs text-slate-500">{parsed.transactions.length} rows • {previewCredits} credits • {formatDate(parsed.coverageStart)} → {formatDate(parsed.coverageEnd)}</p></div>
              <Button onClick={importRows} disabled={busy || !parsed.transactions.length || criticalParserIssue}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save normalized rows</Button>
            </div>
            {parsed.issues.length > 0 && <ul className="mt-3 space-y-1.5">{parsed.issues.slice(0, 8).map((issue, index) => <li key={`${issue.message}-${index}`} className={`text-xs leading-5 ${issue.severity === "critical" ? "font-semibold text-red-700" : "text-amber-700"}`}>{issue.severity === "critical" ? "⛔" : "⚠"} {issue.message}</li>)}</ul>}
          </div>
        )}
        {summary?.latestBankImport && <p className="mt-3 text-xs text-slate-500">Latest saved import: <span className="font-bold text-slate-700">{summary.latestBankImport.fileName ?? "Bank statement"}</span> • {formatDate(summary.latestBankImport.coverageStart)} → {formatDate(summary.latestBankImport.coverageEnd)}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold text-slate-950">Payout → bank reconciliation</h2><p className="mt-1 text-xs leading-5 text-slate-500">Exact reference first. Otherwise only a unique exact amount + currency candidate inside the date window is auto-matched. SellerHisab does not guess ambiguous cash.</p></div><Landmark className="size-5 text-slate-400" /></div>
        {(summary?.matches.length ?? 0) === 0 ? (
          <EmptyCash text="No persisted API payout observations are available yet. Bank import still gives cash movement; payout matching will populate when a connected channel supplies payout evidence." />
        ) : (
          <div className="mt-4 space-y-3">
            {summary?.matches.slice(0, 20).map((item) => (
              <div key={item.expectedId} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-extrabold text-slate-900">{item.channelLabel ?? "Marketplace payout"}{item.externalReference ? ` • ${item.externalReference}` : ""}</p><p className="mt-1 text-xs text-slate-500">Expected {formatInr(item.expectedPaise)}{item.actualPaise !== undefined ? ` • Bank ${formatInr(item.actualPaise)}` : ""} • {formatDate(item.expectedBankBy ?? item.occurredAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${matchTone(item.status)}`}>{item.status}</span></div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.why}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold text-slate-950">Unmatched bank credits</h2><p className="mt-1 text-xs leading-5 text-slate-500">These may be non-marketplace receipts, refunds, capital or payouts that need a reference.</p></div><WalletCards className="size-5 text-slate-400" /></div>
          {(summary?.unmatchedCredits.length ?? 0) === 0 ? <EmptyCash text="No unmatched credit is currently visible." /> : <div className="mt-4 space-y-2">{summary?.unmatchedCredits.slice(0, 12).map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-700">{formatDate(item.bookedAt)}</p><p className="text-sm font-extrabold text-slate-950">{formatInr(item.amountPaise)}</p></div><p className="mt-1 truncate text-xs text-slate-500">{item.reference || item.description || `Bank row ${item.sourceRow}`}</p></div>)}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-slate-950">13-week cash runway foundation</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Conservative view: current cash minus your known weekly fixed outflow. It does not invent future marketplace payouts or sales.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label htmlFor="cash-balance" className="text-xs font-bold text-slate-700">Current bank cash (₹)</label><Input id="cash-balance" value={currentBalance} onChange={(event) => setCurrentBalance(event.target.value)} inputMode="decimal" placeholder="100000" className="mt-1" /></div><div><label htmlFor="weekly-outflow" className="text-xs font-bold text-slate-700">Known weekly fixed outflow (₹)</label><Input id="weekly-outflow" value={weeklyOutflow} onChange={(event) => setWeeklyOutflow(event.target.value)} inputMode="decimal" placeholder="15000" className="mt-1" /></div></div>
          <Button className="mt-3" variant="outline" onClick={savePreferences} disabled={busy}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save runway inputs</Button>
          {(summary?.forecast.length ?? 0) > 0 ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{summary?.forecast.map((week) => <div key={week.week} className={`rounded-xl border p-3 ${week.closingBalancePaise < 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-600">Week {week.week}</span><span className={`text-xs font-extrabold ${week.closingBalancePaise < 0 ? "text-red-700" : "text-slate-900"}`}>{formatInr(week.closingBalancePaise)}</span></div></div>)}</div> : <p className="mt-4 text-xs text-slate-500">Add both inputs to generate the conservative 13-week runway.</p>}
        </section>
      </div>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950">
        <div className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-700" /><p><span className="font-extrabold">Cash truth rule:</span> bank movement is evidence of cash, not proof of profit. Latest saved analysis contribution is {summary?.latestConfirmedContributionPaise === undefined ? "not available" : formatInr(summary.latestConfirmedContributionPaise)} and is shown separately from bank receipts.</p></div>
        {(summary?.cashPendingPaise ?? 0) > 0 && <div className="mt-2 flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" /><p>{formatInr(summary?.cashPendingPaise ?? 0)} of expected payout is still inside the grace period, so SellerHisab keeps it pending instead of calling it missing.</p></div>}
      </section>
    </div>
  );
}

function MetricCard({ label, value, note, positive = false, danger = false }: { label: string; value: string; note: string; positive?: boolean; danger?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-5 shadow-sm ${danger ? "border-red-200" : positive ? "border-emerald-200" : "border-slate-200"}`}><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-2 text-2xl font-extrabold tracking-tight ${danger ? "text-red-700" : positive ? "text-emerald-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function EmptyCash({ text }: { text: string }) {
  return <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs leading-5 text-slate-500">{text}</div>;
}
