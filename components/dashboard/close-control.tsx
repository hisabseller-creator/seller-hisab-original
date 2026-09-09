"use client";

import {
  AlertTriangle,
  BadgeIndianRupee,
  CheckCircle2,
  Download,
  FileArchive,
  FileCheck2,
  ReceiptText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildClosePackSummary } from "@/core/close-intelligence";
import { exportCaClosePack, exportClaimEvidencePack } from "@/core/export/close-pack";
import { channelLabel } from "@/core/channels/catalog";
import { formatInr } from "@/core/money";
import type { AnalysisResult } from "@/core/types";
import { useLanguage } from "../providers";

export function CloseControl({ result, unlocked }: { result: AnalysisResult; unlocked: boolean }) {
  const close = buildClosePackSummary(result);
  const { language } = useLanguage();
  const english = language === "english";
  const readinessTone = close.readiness === "Ready"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : close.readiness === "Review"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <section className="liquid-panel mt-6 rounded-[26px] p-5 sm:p-6" aria-labelledby="monthly-close-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-700"><FileCheck2 className="size-4" /><p className="text-xs font-extrabold uppercase tracking-[.12em]">{english ? "Monthly close & recovery" : "Monthly close & recovery"}</p></div>
          <h2 id="monthly-close-heading" className="mt-2 text-xl font-black tracking-[-.025em] text-slate-950">{english ? "CA-ready reconciliation pack" : "CA-ready reconciliation pack"}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{english ? "SellerHisab prepares a traceable commerce close pack, payout-claim evidence and a clean review checklist. It does not file GST or replace accountant review." : "SellerHisab traceable commerce close pack, payout-claim evidence और clean review checklist बनाता है। यह GST filing या CA review को replace नहीं करता।"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unlocked ? (
            <>
              <Button variant="outline" className="rounded-xl bg-white/80" onClick={() => void exportCaClosePack(result)}><Download className="mr-2 size-4" />CA close pack</Button>
              <Button variant="outline" className="rounded-xl bg-white/80" disabled={close.claimCandidates.length === 0} onClick={() => void exportClaimEvidencePack(result)}><FileArchive className="mr-2 size-4" />Claim evidence ZIP</Button>
            </>
          ) : <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-bold text-slate-500">Unlock full report to export evidence</span>}
        </div>
      </div>

      <div className={`mt-5 rounded-2xl border p-4 ${readinessTone}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.1em]">Close readiness</p><p className="mt-1 text-xl font-black">{close.readiness}</p><p className="mt-1 text-xs leading-5 opacity-90">{close.readinessReason}</p></div>
          <div className="text-left sm:text-right"><p className="text-[10px] font-bold uppercase opacity-70">Period</p><p className="mt-1 text-sm font-extrabold">{close.closePeriodLabel}</p><p className="mt-1 text-[11px] font-semibold">{close.unresolvedCount} unresolved close item(s)</p></div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ReceiptText} label="Settlement attributable" value={formatInr(close.settlementPaise)} detail="Normalized settlement evidence" />
        <Metric icon={BadgeIndianRupee} label="Deterministic recovery" value={formatInr(close.deterministicRecoveryPaise)} detail={`${close.claimCandidates.length} claim candidate(s)`} good={close.deterministicRecoveryPaise > 0} />
        <Metric icon={AlertTriangle} label="Review-only payout exposure" value={formatInr(close.reviewOnlySettlementExposurePaise)} detail="Ambiguous / incomplete is not claimed" warning={close.reviewOnlySettlementExposurePaise > 0} />
        <Metric icon={ShieldCheck} label="Source evidence rows" value={close.evidenceRows.length.toLocaleString("en-IN")} detail="File • sheet • row lineage" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <div className="rounded-2xl border border-slate-200 bg-white/75 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">Close checklist</p>
          <div className="mt-3 space-y-2">
            {close.checklist.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <span className="mt-0.5 shrink-0">{item.status === "pass" ? <CheckCircle2 className="size-4 text-emerald-600" /> : item.status === "review" ? <AlertTriangle className="size-4 text-amber-600" /> : <XCircle className="size-4 text-red-600" />}</span>
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold text-slate-900">{item.label}</p>{item.count > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-500">{item.count}</span>}</div><p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/75 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">Payout claim candidates</p>
          {close.claimCandidates.length ? (
            <div className="mt-3 space-y-2">
              {close.claimCandidates.slice(0, 5).map((claim) => (
                <div key={claim.id} className="rounded-xl border border-red-200 bg-red-50/60 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-red-700">{claim.status}</span><span className="text-[10px] font-bold text-slate-400">{channelLabel(claim.channelId)}</span></div><p className="mt-1 text-sm font-extrabold text-slate-950">{claim.externalBatchId}</p><p className="mt-1 text-xs leading-5 text-slate-600">{claim.why[0] ?? "Deterministic payout exception."}</p></div>
                  <div className="mt-2 shrink-0 sm:mt-0 sm:text-right"><p className="text-[10px] font-bold uppercase text-slate-400">Recoverable</p><p className="mt-1 font-black tabular-nums text-red-700">{formatInr(claim.recoverablePaise)}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{claim.sourceReferences.length} source row(s)</p></div>
                </div>
              ))}
            </div>
          ) : <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">No deterministic short, missing or failed payout claim is supported by the supplied evidence.</div>}
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs leading-5 text-blue-900"><span className="font-extrabold">Accounting boundary:</span> SellerHisab exports normalized commerce evidence and reconciliation schedules. GST/TDS/TCS applicability, ledger posting and filing remain subject to accountant/professional review.</p>
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail, good = false, warning = false }: { icon: typeof ReceiptText; label: string; value: string; detail: string; good?: boolean; warning?: boolean }) {
  const tone = good ? "bg-emerald-50 text-emerald-700" : warning ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <article className="rounded-2xl border border-slate-200 bg-white/80 p-4"><span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4" /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{label}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p></article>;
}
