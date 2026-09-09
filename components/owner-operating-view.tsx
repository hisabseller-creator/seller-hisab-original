"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  Cable,
  CircleCheck,
  CircleHelp,
  Clock3,
  Link2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { channelLabel } from "@/core/channels/catalog";
import { formatInr } from "@/core/money";
import {
  buildOwnerOperatingView,
  type OwnerOperatingView,
  type ProductMappingSuggestion,
} from "@/core/operating-view";
import {
  localDb,
  type SavedAnalysis,
  type SavedProductMapping,
} from "@/core/storage/local-db";

type AlertItem = { id: string; message: string };
type ViewKey = "today" | "money" | "products" | "actions";

export function OwnerOperatingView({
  userLabel,
  savedAnalysisCount,
  savedCostCount,
  alerts,
}: {
  userLabel: string;
  savedAnalysisCount: number;
  savedCostCount: number;
  alerts: AlertItem[];
}) {
  const [view, setView] = useState<ViewKey>("today");
  const [latest, setLatest] = useState<SavedAnalysis | null>(null);
  const [previous, setPrevious] = useState<SavedAnalysis | null>(null);
  const [mappings, setMappings] = useState<SavedProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappingBusy, setMappingBusy] = useState<string | null>(null);

  const reloadLocal = useCallback(async () => {
    setLoading(true);
    try {
      const db = localDb();
      const analyses = await db.analyses.orderBy("createdAt").reverse().limit(2).toArray();
      const productMappings = await db.productMappings.orderBy("updatedAt").reverse().toArray();
      setLatest(analyses[0] ?? null);
      setPrevious(analyses[1] ?? null);
      setMappings(productMappings);
    } catch {
      setLatest(null);
      setPrevious(null);
      setMappings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const db = localDb();

    Promise.all([
      db.analyses.orderBy("createdAt").reverse().limit(2).toArray(),
      db.productMappings.orderBy("updatedAt").reverse().toArray(),
    ])
      .then(([analyses, productMappings]) => {
        if (cancelled) return;
        setLatest(analyses[0] ?? null);
        setPrevious(analyses[1] ?? null);
        setMappings(productMappings);
      })
      .catch(() => {
        if (cancelled) return;
        setLatest(null);
        setPrevious(null);
        setMappings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const operating = useMemo<OwnerOperatingView | null>(() => {
    if (!latest) return null;
    return buildOwnerOperatingView(latest.result, previous?.result, mappings);
  }, [latest, previous, mappings]);

  async function approveSuggestion(suggestion: ProductMappingSuggestion) {
    setMappingBusy(suggestion.id);
    try {
      const existing = await localDb().productMappings.toArray();
      const usedAliases = new Set(existing.flatMap((mapping) => mapping.aliasKeys));
      if (suggestion.aliasKeys.some((alias) => usedAliases.has(alias))) {
        await reloadLocal();
        return;
      }
      const now = new Date().toISOString();
      await localDb().productMappings.put({
        id: `map_${crypto.randomUUID().replace(/-/g, "")}`,
        name: suggestion.sku,
        aliasKeys: suggestion.aliasKeys,
        approvedAt: now,
        updatedAt: now,
      });
      await reloadLocal();
    } finally {
      setMappingBusy(null);
    }
  }

  async function removeMapping(mappingId: string) {
    setMappingBusy(mappingId);
    try {
      await localDb().productMappings.delete(mappingId);
      await reloadLocal();
    } finally {
      setMappingBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-6 grid min-h-[360px] place-items-center rounded-[26px] border border-slate-200 bg-white/80">
        <RefreshCw className="size-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!operating || !latest) {
    return (
      <div className="mt-6">
        <div className="rounded-[28px] border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-blue-600">Seller home</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-slate-950">Today • Money • Products • Actions</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Pehla local analysis run karo. SellerHisab usi derived result se morning operating view banayega—raw marketplace file upload nahi hogi.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-blue-600 font-bold"><Link href="/analyze"><Upload className="mr-2 size-4" />Analyze report</Link></Button>
            <Button asChild variant="outline"><Link href="/app/connections"><Cable className="mr-2 size-4" />Connections</Link></Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Saved analyses" value={String(savedAnalysisCount)} />
          <MiniStat label="Saved costs" value={String(savedCostCount)} />
          <MiniStat label="Open alerts" value={String(alerts.length)} />
        </div>
      </div>
    );
  }

  const activeTab = (
    <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-white/85 p-1 shadow-sm">
      {([
        ["today", "Today"],
        ["money", "Money"],
        ["products", "Products"],
        ["actions", "Actions"],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setView(key)}
          className={`rounded-xl px-2 py-2.5 text-xs font-extrabold transition sm:text-sm ${view === key ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mt-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-extrabold uppercase tracking-[.14em] text-blue-600">Aaj ka SellerHisab</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${operating.dataAgeDays === 0 ? "bg-emerald-50 text-emerald-700" : operating.dataAgeDays <= 3 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  {operating.dataAgeDays === 0 ? "Analyzed today" : `${operating.dataAgeDays} day old analysis`}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-[-.04em] text-slate-950 sm:text-3xl">One business. Four questions.</h1>
              <p className="mt-2 text-sm text-slate-500">{userLabel} • latest browser analysis {new Date(operating.generatedAt).toLocaleString("en-IN")}</p>
            </div>
            <div className="w-full lg:w-[430px]">{activeTab}</div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {view === "today" && <TodayPanel operating={operating} alerts={alerts} savedAnalysisCount={savedAnalysisCount} savedCostCount={savedCostCount} onShowActions={() => setView("actions")} />}
          {view === "money" && <MoneyPanel operating={operating} />}
          {view === "products" && <ProductsPanel operating={operating} mappingBusy={mappingBusy} onApprove={approveSuggestion} onRemove={removeMapping} />}
          {view === "actions" && <ActionsPanel operating={operating} />}
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/75 p-4 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span><ShieldCheck className="mr-1.5 inline size-4 text-emerald-600" />This owner view uses the full analysis stored in this browser. Raw marketplace files are still not uploaded.</span>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline"><Link href={`/analyze?resume=${encodeURIComponent(operating.analysisId)}`}>Open analysis</Link></Button>
          <Button asChild size="sm" className="bg-blue-600 font-bold"><Link href="/analyze">New analysis</Link></Button>
        </div>
      </div>
    </div>
  );
}

function TodayPanel({ operating, alerts, savedAnalysisCount, savedCostCount, onShowActions }: { operating: OwnerOperatingView; alerts: AlertItem[]; savedAnalysisCount: number; savedCostCount: number; onShowActions: () => void }) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BadgeIndianRupee} label="Observed sales" value={formatInr(operating.today.observedSalesPaise)} helper={`${operating.today.orders} order rows`} />
        <MetricCard icon={BadgeIndianRupee} label="Confirmed contribution" value={formatInr(operating.today.confirmedContributionPaise)} helper={<Delta value={operating.today.confirmedContributionDeltaPaise} suffix=" vs previous analysis" />} tone={operating.today.confirmedContributionPaise < 0 ? "danger" : "good"} />
        <MetricCard icon={Clock3} label="Profit still at risk" value={formatInr(operating.today.stillAtRiskPaise)} helper={<Delta value={operating.today.stillAtRiskDeltaPaise} reverse suffix=" vs previous analysis" />} tone={operating.today.stillAtRiskPaise > 0 ? "warn" : "good"} />
        <MetricCard icon={Target} label="Needs review" value={String(operating.today.needsReviewCount)} helper={`${operating.today.returnRtoCount} return/RTO • ${operating.today.channels} channel scope(s)`} tone={operating.today.needsReviewCount > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-blue-300">Top 3 right now</p><h2 className="mt-2 text-xl font-black">Pehle ye karo</h2></div>
            <Sparkles className="size-5 text-blue-300" />
          </div>
          <div className="mt-4 space-y-2">
            {operating.actions.slice(0, 3).map((action, index) => (
              <div key={action.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-black">{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{action.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{action.detail}</p></div>
                  {action.moneyImpactPaise > 0 && <p className="shrink-0 text-sm font-black text-emerald-300">{formatInr(action.moneyImpactPaise)}</p>}
                </div>
              </div>
            ))}
            {!operating.actions.length && <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No deterministic action is urgent in this snapshot.</div>}
          </div>
          {operating.actions.length > 0 && <button type="button" onClick={onShowActions} className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-300 hover:text-white">View all actions <ArrowRight className="size-3.5" /></button>}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-400">Setup health</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="History" value={String(savedAnalysisCount)} compact />
              <MiniStat label="Costs" value={String(savedCostCount)} compact />
              <MiniStat label="Alerts" value={String(alerts.length)} compact />
            </div>
          </div>
          {alerts.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-extrabold text-amber-950">Account alerts</p><ul className="mt-3 space-y-2">{alerts.slice(0, 3).map((alert) => <li key={alert.id} className="flex gap-2 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{alert.message}</li>)}</ul></div>}
        </div>
      </div>
    </div>
  );
}

function MoneyPanel({ operating }: { operating: OwnerOperatingView }) {
  const money = operating.money;
  const gap = money.bankDifferencePaise;
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={CircleCheck} label="Confirmed" value={formatInr(money.confirmedContributionPaise)} helper="Resolved evidence + known costs" tone={money.confirmedContributionPaise < 0 ? "danger" : "good"} />
        <MetricCard icon={Clock3} label="Provisional" value={formatInr(money.provisionalContributionPaise)} helper="Known enough to estimate, not final" tone="warn" />
        <MetricCard icon={CircleHelp} label="Incomplete / at risk" value={formatInr(money.stillAtRiskPaise)} helper={`Data quality: ${money.confidence}`} tone={money.stillAtRiskPaise > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_.9fr]">
        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><WalletCards className="size-5" /></span><div><p className="text-xs font-extrabold uppercase tracking-[.1em] text-blue-600">Payout → bank truth</p><h2 className="mt-1 text-lg font-black text-slate-950">Expected vs actually matched</h2></div></div>
          {money.expectedBankPaise !== undefined ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MoneyBox label="Expected payout" value={formatInr(money.expectedBankPaise)} />
              <MoneyBox label="Bank matched" value={formatInr(money.actualMatchedBankPaise ?? 0)} />
              <MoneyBox label="Gap" value={formatInr(gap)} danger={(gap ?? 0) < 0} />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-blue-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">Payout-batch evidence is not available in this analysis. SellerHisab is intentionally not converting order revenue into a bank receipt.</div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600"><span className="rounded-full bg-white px-2.5 py-1">Settlement confidence: {money.settlementConfidence ?? "Incomplete"}</span><span className="rounded-full bg-white px-2.5 py-1">No guessed bank match</span></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-400">Why</p>
          <h2 className="mt-2 text-lg font-black text-slate-950">SellerHisab ne ye number kyun dikhaya?</h2>
          <ul className="mt-4 space-y-3">{money.settlementWhy.slice(0, 5).map((reason) => <li key={reason} className="flex gap-2 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-600" />{reason}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}

function ProductsPanel({ operating, mappingBusy, onApprove, onRemove }: { operating: OwnerOperatingView; mappingBusy: string | null; onApprove: (suggestion: ProductMappingSuggestion) => Promise<void>; onRemove: (mappingId: string) => Promise<void> }) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[.1em] text-blue-600">Master product view</p><h2 className="mt-2 text-xl font-black text-slate-950">Same product, channel-wise economics</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">SellerHisab never merges two marketplace SKUs silently. Cross-channel totals appear only after an explicit mapping approval.</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">{operating.products.filter((item) => item.mapped).length} approved mapping(s)</span>
      </div>

      {operating.mappingConflictCount > 0 && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="mr-2 inline size-4" />{operating.mappingConflictCount} SKU alias conflict(s) detected. Conflicting aliases remain unmerged.</div>}

      {operating.mappingSuggestions.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><Link2 className="size-4" /></span><div><h3 className="text-sm font-extrabold text-amber-950">Mapping review</h3><p className="mt-1 text-xs leading-5 text-amber-800">Exact SKU text multiple channels me mila. Ye sirf suggestion hai—finance merge tabhi hoga jab tum approve karoge.</p></div></div>
          <div className="mt-4 space-y-3">
            {operating.mappingSuggestions.slice(0, 6).map((suggestion) => (
              <div key={suggestion.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-extrabold text-slate-900">{suggestion.sku}</p><p className="mt-1 text-xs text-slate-500">{suggestion.channels.map((item) => channelLabel(item.channelId)).join(" • ")}</p></div>
                <Button size="sm" variant="outline" disabled={mappingBusy === suggestion.id} onClick={() => void onApprove(suggestion)}>{mappingBusy === suggestion.id ? <RefreshCw className="mr-2 size-3.5 animate-spin" /> : <Link2 className="mr-2 size-3.5" />}Same product — approve</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 space-y-3">
        {operating.products.slice(0, 30).map((product) => {
          const total = product.confirmedContributionPaise + product.provisionalContributionPaise;
          return (
            <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{product.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${product.mapped ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{product.mapped ? `${product.channels.length} channel mapping approved` : "Channel-scoped"}</span></div>
                  <div className="mt-3 flex flex-wrap gap-2">{product.channels.map((item) => <span key={item.key} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">{channelLabel(item.channelId)} • {item.sku}</span>)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[470px]">
                  <ProductStat label="Contribution" value={formatInr(total)} danger={total < 0} />
                  <ProductStat label="Orders" value={String(product.orders)} />
                  <ProductStat label="Return/RTO" value={product.returnRtoRate === undefined ? "—" : `${(product.returnRtoRate * 100).toFixed(1)}%`} danger={(product.returnRtoRate ?? 0) > 0.25} />
                  <ProductStat label="Action" value={product.action} />
                </div>
              </div>
              {product.mappingId && <div className="mt-4 border-t border-slate-100 pt-3 text-right"><button type="button" disabled={mappingBusy === product.mappingId} onClick={() => void onRemove(product.mappingId!)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600"><Trash2 className="size-3.5" />Remove mapping</button></div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ActionsPanel({ operating }: { operating: OwnerOperatingView }) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.1em] text-blue-600">Money-ranked action inbox</p><h2 className="mt-2 text-xl font-black text-slate-950">Kya karna hai — priority order me</h2><p className="mt-1 text-sm leading-6 text-slate-500">Settlement exceptions and SKU actions are ranked together. No autonomous marketplace write is performed.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">{operating.actions.length} open deterministic action(s)</span></div>
      <div className="mt-5 space-y-3">
        {operating.actions.map((action, index) => (
          <article key={action.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <span className={`grid size-9 place-items-center rounded-xl text-sm font-black ${action.urgency === "Critical" ? "bg-red-50 text-red-700" : action.urgency === "High" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{index + 1}</span>
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{action.title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-600">{action.confidence} confidence</span>{action.channelId && <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700">{channelLabel(action.channelId)}</span>}</div><p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p>{action.sku && <p className="mt-1 font-mono text-[11px] text-slate-400">{action.sku}</p>}</div>
              <div className="text-left sm:text-right"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">Money impact</p><p className={`mt-1 text-lg font-black ${action.moneyImpactPaise > 0 ? "text-emerald-700" : "text-slate-700"}`}>{action.moneyImpactPaise > 0 ? formatInr(action.moneyImpactPaise) : "Evidence first"}</p></div>
            </div>
          </article>
        ))}
        {!operating.actions.length && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CircleCheck className="mx-auto size-6 text-emerald-700" /><p className="mt-3 font-extrabold text-emerald-950">No urgent deterministic action in this snapshot</p><p className="mt-1 text-sm text-emerald-800">Run a newer analysis when fresh marketplace data is available.</p></div>}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; helper: ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const iconTone = tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-700" : tone === "danger" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><span className={`grid size-9 place-items-center rounded-xl ${iconTone}`}><Icon className="size-4" /></span><p className="mt-4 text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className="mt-1 text-2xl font-black tracking-[-.04em] text-slate-950">{value}</p><div className="mt-2 min-h-5 text-xs leading-5 text-slate-500">{helper}</div></div>;
}

function MoneyBox({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded-xl border border-blue-100 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-2 text-xl font-black ${danger ? "text-red-700" : "text-slate-950"}`}>{value}</p></div>;
}

function ProductStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className={`mt-1 truncate text-xs font-extrabold ${danger ? "text-red-700" : "text-slate-800"}`}>{value}</p></div>;
}

function MiniStat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className={`rounded-xl bg-slate-50 ${compact ? "p-2.5" : "p-4"}`}><p className={`${compact ? "text-lg" : "text-xl"} font-black text-slate-950`}>{value}</p><p className="mt-0.5 text-[10px] font-bold text-slate-500">{label}</p></div>;
}

function Delta({ value, suffix, reverse = false }: { value?: number; suffix: string; reverse?: boolean }) {
  if (value === undefined) return <span>No previous local analysis to compare</span>;
  if (value === 0) return <span>No change{suffix}</span>;
  const positive = value > 0;
  const favourable = reverse ? !positive : positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-1 font-bold ${favourable ? "text-emerald-700" : "text-red-700"}`}><Icon className="size-3.5" />{formatInr(Math.abs(value))}{suffix}</span>;
}
