"use client";

import {
  AlertTriangle,
  BadgeIndianRupee,
  Layers3,
  PackageSearch,
  ReceiptText,
  Target,
} from "lucide-react";
import { channelLabel } from "@/core/channels/catalog";
import { formatInr } from "@/core/money";
import { buildReturnRecoverySummary } from "@/core/returns-intelligence";
import type { AnalysisResult, ReturnRecoveryAction, ReturnSkuRisk } from "@/core/types";
import { useLanguage } from "../providers";

export function ReturnsRecovery({ result }: { result: AnalysisResult }) {
  const { language } = useLanguage();
  const english = language === "english";
  const summary = result.returnRecovery ?? buildReturnRecoverySummary(result.orders, result.skus, result.settlementReconciliation);
  const failureCount = summary.returnCount + summary.rtoCount;
  const hasSignal = failureCount > 0 || summary.openReturnCount > 0 || summary.settlementRecoverablePaise > 0 || summary.settlementReviewExposurePaise > 0;

  if (!hasSignal) {
    return (
      <section className="liquid-panel mt-6 rounded-[26px] p-5 sm:p-6" aria-labelledby="returns-recovery-title">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><PackageSearch className="size-5" /></span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.13em] text-emerald-700">{english ? "Returns & recovery" : "Returns & recovery"}</p>
            <h2 id="returns-recovery-title" className="mt-2 text-xl font-extrabold tracking-[-.025em] text-slate-950">{english ? "No return/RTO leakage is visible in the supplied evidence" : "Supplied evidence में return/RTO leakage नहीं दिखी"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{english ? "SellerHisab will surface return loss, open exposure and payout recovery only when the imported evidence supports it." : "SellerHisab return loss, open exposure और payout recovery तभी दिखाता है जब imported evidence उसे support करे।"}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="liquid-panel mt-6 rounded-[26px] p-5 sm:p-6" aria-labelledby="returns-recovery-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-600">{english ? "F4 • Returns / RTO / recovery" : "F4 • Returns / RTO / recovery"}</p>
          <h2 id="returns-recovery-title" className="mt-2 text-xl font-extrabold tracking-[-.025em] text-slate-950">{english ? "Where returns and payout leakage are costing you money" : "Returns और payout leakage में पैसा कहाँ जा रहा है"}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{english ? "Booked loss, open return exposure and deterministic payout recovery are kept separate. Exposure is never presented as final loss." : "Booked loss, open return exposure और deterministic payout recovery अलग रखे जाते हैं। Exposure को final loss नहीं बताया जाता।"}</p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-extrabold text-slate-600">{failureCount} {english ? "completed return/RTO" : "completed return/RTO"}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ReceiptText} label={english ? "Observed return/RTO loss" : "Observed return/RTO loss"} value={formatInr(summary.observedReturnRtoLossPaise)} detail={english ? "Known cash + handling loss" : "Known cash + handling loss"} tone="red" />
        <MetricCard icon={AlertTriangle} label={english ? "Open return exposure" : "Open return exposure"} value={formatInr(summary.openReturnExposurePaise)} detail={`${summary.openReturnCount} ${english ? "open flow(s), not booked loss" : "open flow(s), booked loss नहीं"}`} tone="amber" />
        <MetricCard icon={Layers3} label={english ? "Observed failure rate" : "Observed failure rate"} value={summary.returnRtoRate === undefined ? "—" : `${(summary.returnRtoRate * 100).toFixed(1)}%`} detail={`${summary.returnCount} returns • ${summary.rtoCount} RTO`} tone="slate" />
        <MetricCard icon={BadgeIndianRupee} label={english ? "Recoverable payout evidence" : "Recoverable payout evidence"} value={formatInr(summary.potentialRecoveryPaise)} detail={english ? "Only deterministic short / missing / failed payouts" : "सिर्फ deterministic short / missing / failed payouts"} tone="green" />
      </div>

      {summary.channels.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summary.channels.map((channel) => (
            <article key={`${channel.channelId}:${channel.channelAccountId ?? "default"}`} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-slate-900">{channelLabel(channel.channelId)}</p><span className="text-xs font-black tabular-nums text-slate-700">{channel.returnRtoRate === undefined ? "—" : `${(channel.returnRtoRate * 100).toFixed(1)}%`}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Mini label="Return / RTO" value={`${channel.returns} / ${channel.rto}`} />
                <Mini label="Open" value={String(channel.openReturns)} />
                <Mini label="Known loss" value={formatInr(channel.observedLossPaise)} danger={channel.observedLossPaise > 0} />
                <Mini label="Exposure" value={formatInr(channel.openExposurePaise)} warning={channel.openExposurePaise > 0} />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white/75 p-4">
          <div className="flex items-center gap-2"><PackageSearch className="size-4 text-blue-700" /><p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{english ? "Observed causes" : "Observed causes"}</p></div>
          {summary.topCauses.length ? (
            <div className="mt-3 space-y-2">
              {summary.topCauses.map((cause) => (
                <div key={cause.cause} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-slate-900">{cause.label}</p><span className="text-xs font-black text-slate-600">{cause.count}</span></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500"><span>Loss {formatInr(cause.lossPaise)}</span><span>Open exposure {formatInr(cause.openExposurePaise)}</span></div>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">No supportable return reason was supplied.</p>}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2"><Target className="size-4 text-amber-800" /><p className="text-xs font-extrabold uppercase tracking-[.1em] text-amber-800">{english ? "Recovery actions" : "Recovery actions"}</p></div>
          <div className="mt-3 space-y-2">
            {summary.actions.length ? summary.actions.slice(0, 5).map((action) => <RecoveryActionCard key={action.id} action={action} />) : <p className="text-sm text-slate-600">No money-ranked return/recovery action is supportable yet.</p>}
          </div>
        </div>
      </div>

      {summary.skuRisks.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white/75">
          <div className="border-b border-slate-200 p-4"><p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{english ? "Highest return/RTO risk SKUs" : "Highest return/RTO risk SKUs"}</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500"><tr>{["Channel", "SKU", "Return/RTO", "Safe limit", "Top cause", "Known loss", "Open exposure", "Avoidable", "Confidence"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{summary.skuRisks.slice(0, 8).map((sku) => <RiskRow key={`${sku.channelId}:${sku.channelAccountId ?? "default"}:${sku.sku}`} sku={sku} />)}</tbody></table></div>
        </div>
      )}

      {(summary.settlementRecoverablePaise > 0 || summary.settlementReviewExposurePaise > 0) && (
        <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs leading-5 text-blue-900"><span className="font-extrabold">Payout recovery:</span> {formatInr(summary.settlementRecoverablePaise)} is supported by short/missing/failed payout evidence. Another {formatInr(summary.settlementReviewExposurePaise)} remains review-only because the evidence is ambiguous or incomplete.</p>
      )}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof ReceiptText; label: string; value: string; detail: string; tone: "red" | "amber" | "green" | "slate" }) {
  const tones = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
  return <article className="rounded-2xl border border-slate-200 bg-white/80 p-4"><span className={`grid size-9 place-items-center rounded-xl ${tones}`}><Icon className="size-4" /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{label}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p></article>;
}

function Mini({ label, value, danger = false, warning = false }: { label: string; value: string; danger?: boolean; warning?: boolean }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.06em] text-slate-400">{label}</p><p className={`mt-1 font-black tabular-nums ${danger ? "text-red-700" : warning ? "text-amber-700" : "text-slate-900"}`}>{value}</p></div>;
}

function RecoveryActionCard({ action }: { action: ReturnRecoveryAction }) {
  const tone = action.urgency === "Critical" ? "text-red-700" : action.urgency === "High" ? "text-amber-800" : "text-slate-700";
  return <div className="rounded-xl border border-amber-200 bg-white/80 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`text-[10px] font-extrabold uppercase tracking-[.08em] ${tone}`}>{action.kind}</span>{action.channelId && <span className="text-[10px] font-bold text-slate-400">{channelLabel(action.channelId)}</span>}</div><p className="mt-1 text-sm font-extrabold text-slate-950">{action.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{action.detail}</p></div><div className="mt-2 shrink-0 sm:mt-0 sm:text-right"><p className="text-[10px] font-bold uppercase text-slate-400">Money impact</p><p className="mt-1 font-black tabular-nums text-amber-900">{formatInr(action.moneyImpactPaise)}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{action.confidence} confidence</p></div></div>;
}

function RiskRow({ sku }: { sku: ReturnSkuRisk }) {
  return <tr><td className="px-4 py-3 font-bold text-slate-700">{channelLabel(sku.channelId)}</td><td className="px-4 py-3 font-mono font-bold text-slate-900">{sku.sku}</td><td className="px-4 py-3 tabular-nums">{sku.returnRtoRate === undefined ? "—" : `${(sku.returnRtoRate * 100).toFixed(1)}%`} <span className="text-slate-400">({sku.returns}/{sku.rto})</span></td><td className="px-4 py-3 tabular-nums text-slate-600">{sku.safeFailureRate === undefined ? "—" : `${(sku.safeFailureRate * 100).toFixed(1)}%`}</td><td className="px-4 py-3 text-slate-700">{sku.topCauseLabel}</td><td className="px-4 py-3 font-bold tabular-nums text-red-700">{formatInr(sku.observedLossPaise)}</td><td className="px-4 py-3 font-bold tabular-nums text-amber-700">{formatInr(sku.openExposurePaise)}</td><td className="px-4 py-3 font-black tabular-nums text-blue-700">{formatInr(sku.avoidableLossPaise)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-600">{sku.confidence}</span></td></tr>;
}
