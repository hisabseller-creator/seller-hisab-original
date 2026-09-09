"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers3,
  PackageSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { channelLabel } from "@/core/channels/catalog";
import { formatInr } from "@/core/money";
import { buildOwnerOperatingView, type ApprovedProductMapping } from "@/core/operating-view";
import { localDb, type SavedProductMapping } from "@/core/storage/local-db";
import type { AnalysisResult } from "@/core/types";
import { useLanguage } from "../providers";

export function BusinessContext({ result }: { result: AnalysisResult }) {
  const { language } = useLanguage();
  const english = language === "english";
  const [previous, setPrevious] = useState<AnalysisResult | undefined>(undefined);
  const [mappings, setMappings] = useState<SavedProductMapping[]>([]);

  useEffect(() => {
    let active = true;
    const db = localDb();
    Promise.all([db.analyses.toArray(), db.productMappings.toArray()])
      .then(([analyses, savedMappings]) => {
        if (!active) return;
        const prior = analyses
          .filter((item) => item.id !== result.id)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        setPrevious(prior?.result);
        setMappings(savedMappings);
      })
      .catch(() => {
        if (!active) return;
        setPrevious(undefined);
        setMappings([]);
      });
    return () => {
      active = false;
    };
  }, [result.id]);

  const view = useMemo(
    () => buildOwnerOperatingView(result, previous, mappings as ApprovedProductMapping[], new Date()),
    [mappings, previous, result],
  );

  async function approveSuggestion(suggestion: (typeof view.mappingSuggestions)[number]) {
    const now = new Date().toISOString();
    const mapping: SavedProductMapping = {
      id: `mapping_${cryptoId()}`,
      name: suggestion.sku,
      aliasKeys: suggestion.aliasKeys,
      approvedAt: now,
      updatedAt: now,
    };
    await localDb().productMappings.put(mapping);
    const updated = await localDb().productMappings.toArray();
    setMappings(updated);
  }

  const settlementActions = view.actions.filter((action) => action.kind === "settlement").slice(0, 2);

  return (
    <section className="liquid-panel mt-6 rounded-[26px] p-5 sm:p-6" aria-labelledby="business-context-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-600">{english ? "Unified business context" : "Unified business context"}</p>
          <h2 id="business-context-title" className="mt-2 text-xl font-extrabold tracking-[-.025em] text-slate-950">
            {english ? "Marketplace-wise money, without mixing identities" : "Marketplace-wise पैसा, बिना गलत data merge किए"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            {english
              ? "Each channel stays account-scoped. Matching SKU text across marketplaces is only a suggestion until you approve the physical-product mapping."
              : "हर channel account-scoped रहता है। अलग marketplaces में same SKU text होने पर भी physical product mapping आपकी approval के बिना merge नहीं होती।"}
          </p>
        </div>
        <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold text-blue-700">
          {view.today.channels} {view.today.channels === 1 ? "channel" : "channels"} in this analysis
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {result.channels.map((channel) => (
          <article key={`${channel.channelId}:${channel.channelAccountId ?? "default"}`} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Layers3 className="size-4" /></span>
              <div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{channelLabel(channel.channelId)}</p><p className="text-[10px] font-bold text-slate-400">{channel.orders} orders • {channel.skus} SKUs</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMoney label={english ? "Confirmed" : "Confirmed"} value={channel.confirmedContributionPaise} />
              <MiniMoney label={english ? "At risk" : "At risk"} value={channel.stillAtRiskPaise} risk />
            </div>
          </article>
        ))}
      </div>

      {previous && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2"><ArrowRight className="size-4 text-slate-500" /><p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{english ? "Compared with your previous local analysis" : "Previous local analysis से comparison"}</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <DeltaMetric label={english ? "Confirmed contribution" : "Confirmed contribution"} value={view.today.confirmedContributionDeltaPaise} money />
            <DeltaMetric label={english ? "Orders" : "Orders"} value={view.today.orderDelta} />
            <DeltaMetric label={english ? "Money still at risk" : "Money still at risk"} value={view.today.stillAtRiskDeltaPaise} money invert />
          </div>
        </div>
      )}

      {settlementActions.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-center gap-2 text-amber-800"><AlertTriangle className="size-4" /><p className="text-xs font-extrabold uppercase tracking-[.1em]">{english ? "Settlement priority" : "Settlement priority"}</p></div>
          <div className="mt-3 space-y-2">
            {settlementActions.map((action) => (
              <div key={action.id} className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white/75 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-extrabold text-slate-900">{action.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{action.detail}</p></div>
                <div className="text-left sm:text-right"><p className="text-[10px] font-bold uppercase text-slate-400">{action.confidence} confidence</p><p className="mt-1 font-black tabular-nums text-amber-800">{formatInr(action.moneyImpactPaise)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view.mappingConflictCount > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          SellerHisab found {view.mappingConflictCount} conflicting approved product mapping(s). Those aliases are kept separate until the mapping is corrected.
        </div>
      )}

      {view.mappingSuggestions.length > 0 && (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Layers3 className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-950">{english ? "Possible same-product matches need your approval" : "Possible same-product matches को आपकी approval चाहिए"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{english ? "SellerHisab never merges cross-marketplace finance only because the SKU text looks the same." : "सिर्फ SKU text same दिखने पर SellerHisab cross-marketplace finance merge नहीं करता।"}</p>
              <div className="mt-3 space-y-2">
                {view.mappingSuggestions.slice(0, 5).map((suggestion) => (
                  <div key={suggestion.id} className="rounded-xl border border-blue-200 bg-white/80 p-3 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{suggestion.sku}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{suggestion.channels.map((item) => channelLabel(item.channelId)).join(" • ")}</p>
                    </div>
                    <Button size="sm" className="mt-3 bg-blue-600 font-bold sm:mt-0" onClick={() => void approveSuggestion(suggestion)}>
                      <CheckCircle2 className="mr-1.5 size-4" />Same physical product
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {view.today.channels > 1 && view.mappingSuggestions.length === 0 && view.mappingConflictCount === 0 && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/75 p-4 text-sm font-semibold text-emerald-800">
          <PackageSearch className="size-5 shrink-0" />
          Cross-channel product totals use only mappings you explicitly approved; unmapped listings remain separate.
        </div>
      )}
    </section>
  );
}

function MiniMoney({ label, value, risk = false }: { label: string; value: number; risk?: boolean }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-1 text-sm font-black tabular-nums ${risk && value > 0 ? "text-amber-700" : "text-slate-900"}`}>{formatInr(value)}</p></div>;
}

function DeltaMetric({ label, value, money = false, invert = false }: { label: string; value?: number; money?: boolean; invert?: boolean }) {
  const amount = value ?? 0;
  const positive = invert ? amount < 0 : amount > 0;
  const negative = invert ? amount > 0 : amount < 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{label}</p>
      <div className={`mt-2 flex items-center gap-1.5 text-sm font-black tabular-nums ${positive ? "text-emerald-700" : negative ? "text-red-700" : "text-slate-700"}`}>
        <ArrowRight className={`size-4 ${amount < 0 ? "rotate-180" : ""}`} />
        {money ? formatSignedInr(amount) : formatSignedNumber(amount)}
      </div>
    </div>
  );
}

function formatSignedInr(value: number) {
  if (value === 0) return formatInr(0);
  return `${value > 0 ? "+" : "−"}${formatInr(Math.abs(value))}`;
}

function formatSignedNumber(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-IN")}`;
}

function cryptoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
