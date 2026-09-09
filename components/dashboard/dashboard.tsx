"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeIndianRupee,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Equal,
  FileSearch,
  Home,
  Layers3,
  LockKeyhole,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  TableProperties,
  Upload,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { channelLabel } from "@/core/channels/catalog";
import { exportExcel, exportPdf } from "@/core/export/reports";
import { formatInr } from "@/core/money";
import type { AnalysisResult, AuditLine, SkuEconomics } from "@/core/types";
import { UnlockReport } from "./unlock-report";
import { BusinessContext } from "./business-context";
import { ReturnsRecovery } from "./returns-recovery";
import { CloseControl } from "./close-control";
import { UnifiedActionInbox } from "./unified-action-inbox";
import { useLanguage } from "../providers";

const filters = ["All", "Urgent", "Losing Money", "Reprice", "Reduce Ads", "Scale", "Data Missing", "Settlement Review"] as const;
type Filter = (typeof filters)[number];

export function Dashboard({
  result,
  initiallyUnlocked = false,
  onEditCosts,
}: {
  result: AnalysisResult;
  initiallyUnlocked?: boolean;
  onEditCosts?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  const [selectedSkuKey, setSelectedSkuKey] = useState(result.skus[0] ? skuKey(result.skus[0]) : "");
  const { t, language } = useLanguage();
  const english = language === "english";

  useEffect(() => {
    if (initiallyUnlocked) return;
    let active = true;
    const restore = async () => {
      const token = localStorage.getItem(`smg-entitlement:${result.id}`);
      if (token) {
        const response = await fetch("/api/entitlements/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ analysisId: result.id, token }),
        });
        const payload = await response.json() as { valid?: boolean };
        if (payload.valid) { if (active) setUnlocked(true); return; }
      }
      const response = await fetch("/api/entitlements/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId: result.id }),
      });
      const payload = await response.json() as { restored?: boolean; entitlementToken?: string };
      if (payload.restored && payload.entitlementToken) {
        localStorage.setItem(`smg-entitlement:${result.id}`, payload.entitlementToken);
        if (active) setUnlocked(true);
      }
    };
    restore().catch(() => { if (active) setUnlocked(false); });
    return () => { active = false; };
  }, [initiallyUnlocked, result.id]);

  const filtered = useMemo(() => result.skus.filter((sku) => matchesFilter(sku, filter)), [filter, result.skus]);
  const visible = unlocked ? filtered : filtered.slice(0, 3);
  const critical = result.findings.find((finding) => finding.severity === "critical");

  return (
    <div className="app-wallpaper min-h-screen pb-20 md:pb-0">
      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span>{english ? "Your report" : "आपकी report"}</span><ChevronRight className="size-3.5" /><span className="text-slate-900">{english ? "Result ready" : "Result ready है"}</span></div>
            <h1 className="mt-3 text-2xl font-black tracking-[-.035em] text-slate-950 sm:text-3xl">{english ? "Your money snapshot" : "आपके पैसे का सीधा हिसाब"}</h1>
            <p className="mt-2 text-sm text-slate-500">{result.orders.length} {english ? "orders checked" : "orders check हुए"} • {result.skus.length} products</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onEditCosts && <Button variant="outline" className="liquid-soft rounded-xl bg-white/70" onClick={onEditCosts}><Upload className="mr-2 size-4" />{english ? "Edit inputs" : "Inputs बदलें"}</Button>}
            {unlocked && (
              <>
                <Button variant="outline" className="liquid-soft rounded-xl bg-white/70" onClick={() => exportExcel(result)}><TableProperties className="mr-2 size-4" />Excel</Button>
                <Button variant="outline" className="liquid-soft rounded-xl bg-white/70" onClick={() => exportPdf(result)}><Download className="mr-2 size-4" />PDF</Button>
              </>
            )}
          </div>
        </div>

        {critical && (
          <Alert className="mt-6 rounded-2xl border-red-200 bg-red-50/90 text-red-950 shadow-sm">
            <AlertTriangle className="text-red-600" />
            <AlertTitle className="font-extrabold">Profit is not final</AlertTitle>
            <AlertDescription>{critical.message} Estimated contribution may currently be overstated.</AlertDescription>
          </Alert>
        )}

        <BusinessContext result={result} />
        <ReturnsRecovery result={result} />
        <CloseControl result={result} unlocked={unlocked} />

        <section aria-label="Headline metrics" className="mt-6">
          <MarginReceipt result={result} english={english} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SnapshotNoticeCard href="#quality" tone="amber" icon={AlertTriangle} value={formatInr(result.stillAtRiskPaise)} label={english ? "is still at risk" : "अभी risk में है"} detail={english ? `${result.needsReviewCount} payment/data item(s) need review` : `${result.needsReviewCount} payment/data item review करें`} />
            <SnapshotNoticeCard href="#actions" tone="red" icon={PackageSearch} value={String(result.lossMakingSkus)} label={english ? "products are losing money" : "products loss कर रहे हैं"} detail={english ? "Fix these before scaling" : "Scale से पहले इन्हें fix करें"} />
          </div>
        </section>

        <section className="liquid-panel mt-4 flex flex-col gap-3 rounded-[22px] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${result.qualityScore >= 90 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><FileSearch className="size-5" /></span><div><p className="text-sm font-extrabold text-slate-900">{result.needsReviewCount} {english ? "data or payment item(s) need review" : "data या payment items review करने हैं"}</p><p className="mt-0.5 text-xs text-slate-500">{result.qualityStatus} • {result.qualityScore}/100</p></div></div><a href="#quality" className="inline-flex min-h-10 items-center text-xs font-extrabold text-blue-700 hover:underline">{english ? "See what is missing" : "क्या missing है देखें"}<ChevronRight className="ml-1 size-4" /></a>
        </section>

        <UnifiedActionInbox result={result} />

        <section id="actions" className="liquid-panel mt-7 overflow-hidden rounded-[26px]">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-blue-600">{t("actions")}</p><h2 className="mt-2 text-xl font-extrabold tracking-[-.025em] text-slate-950">{english ? "All product details" : "सब products की detail"}</h2><p className="mt-1 text-sm text-slate-500">{english ? "Use filters when you want to inspect every SKU." : "हर SKU inspect करने के लिए filter use करें।"}</p></div>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="max-w-full overflow-x-auto">
              <TabsList className="h-auto min-w-max justify-start bg-slate-100 p-1">
                {filters.map((item) => <TabsTrigger key={item} value={item} className="px-3 py-2 text-xs">{item}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </div>
          <div id="sku-table" className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500"><tr>{["SKU", "Primary problem", "Orders", "Confirmed", "Provisional", "Per delivered", "Return/RTO", "Money impact", "Action", "Confidence"].map((head) => <th scope="col" key={head} className="px-4 py-4 first:pl-6 last:pr-6">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((sku) => <SkuRow key={skuKey(sku)} sku={sku} result={result} />)}
              </tbody>
            </table>
            {!visible.length && <div className="px-6 py-12 text-center text-sm text-slate-500">No SKU matches this filter.</div>}
          </div>
          {!unlocked && filtered.length > 3 && <div className="border-t border-slate-200 p-5 sm:p-6"><UnlockReport analysisId={result.id} onUnlocked={() => setUnlocked(true)} /></div>}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <ProfitBridge result={result} />
          <DataQuality result={result} />
        </section>

        {result.settlementReconciliation && <SettlementTruth result={result} />}

        {(result.periods.length > 1 || result.bankCreditPaise !== undefined) && <PeriodComparison result={result} />}

        {unlocked ? (
          <section className="liquid-panel mt-6 rounded-[24px] p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><SlidersHorizontal className="size-5" /></span><div><h2 className="text-lg font-extrabold text-slate-950">Decision simulators</h2><p className="mt-1 text-sm text-slate-500">Deterministic what-if scenarios based on observed economics, not a forecast guarantee.</p></div></div>
            <div className="mt-6"><Select value={selectedSkuKey} onValueChange={setSelectedSkuKey}><SelectTrigger className="w-full max-w-sm"><SelectValue placeholder="Select SKU" /></SelectTrigger><SelectContent>{result.skus.map((sku) => <SelectItem key={skuKey(sku)} value={skuKey(sku)}>{channelLabel(sku.channelId)} • {sku.sku}</SelectItem>)}</SelectContent></Select></div>
            {selectedSkuKey && <Simulators sku={result.skus.find((item) => skuKey(item) === selectedSkuKey)!} />}
          </section>
        ) : (
          <section className="mt-6"><UnlockReport analysisId={result.id} onUnlocked={() => setUnlocked(true)} /></section>
        )}

        <section className="liquid-panel mt-6 overflow-hidden rounded-[24px]">
          <div className="border-b border-slate-200 p-5 sm:p-6"><h2 className="text-lg font-extrabold text-slate-950">Orders & settlement review</h2><p className="mt-1 text-sm text-slate-500">Sub-order-level evidence. No amount is treated as a black box.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500"><tr>{["Sub-order", "SKU", "Outcome", "State", "Settlement", "Contribution", "Evidence"].map((head) => <th key={head} className="px-4 py-4 first:pl-6">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{result.orders.slice(0, unlocked ? 100 : 6).map((order) => <tr key={order.subOrderId}><td className="px-4 py-3 pl-6 font-mono text-xs font-bold text-slate-800">{order.subOrderId}</td><td className="px-4 py-3 text-xs font-bold text-slate-700">{order.sku}</td><td className="px-4 py-3 capitalize text-slate-600">{order.outcome}</td><td className="px-4 py-3"><StateBadge state={order.state} /></td><td className="px-4 py-3 tabular-nums text-slate-700">{formatInr(order.settlementPaise)}</td><td className="px-4 py-3"><AuditDialog trigger={formatInr(order.contributionPaise)} title={`${order.subOrderId} contribution`} description="Normalized source rows and seller-entered costs." lines={order.audit} /></td><td className="px-4 py-3 text-xs text-slate-500">{order.sources.length} source row(s)</td></tr>)}</tbody></table>
          </div>
          {!unlocked && result.orders.length > 6 && <div className="border-t border-slate-200 p-4 text-center text-xs font-semibold text-slate-500"><LockKeyhole className="mr-1.5 inline size-3.5" />Full order drilldown is included in the Action Report.</div>}
        </section>

        <details className="liquid-panel mt-6 rounded-[24px] p-5 text-sm sm:p-6">
          <summary className="cursor-pointer font-extrabold text-slate-900">Methodology & assumptions</summary>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">{result.assumptions.map((assumption) => <li key={assumption} className="flex gap-2"><span aria-hidden="true">•</span>{assumption}</li>)}</ul>
          <p className="mt-4 text-xs text-slate-500">Parser {result.parserVersion} • Calculation engine {result.engineVersion} • {result.sourceFingerprints.length} anonymous file fingerprint(s)</p>
        </details>
      </div>
      <nav className="glass-nav fixed inset-x-2 bottom-2 z-30 grid grid-cols-4 rounded-2xl px-2 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Dashboard navigation">
        <MobileNav href="/" icon={Home} label="Home" />
        <MobileNav href="/analyze" icon={Upload} label="Analyze" />
        <MobileNav href="#actions" icon={Layers3} label="SKUs" />
        <MobileNav href="#quality" icon={Bell} label="Alerts" />
      </nav>
    </div>
  );
}

function MarginReceipt({ result, english }: { result: AnalysisResult; english: boolean }) {
  const confirmed = result.orders.filter((order) => order.state === "confirmed");
  const paymentReceived = confirmed.reduce((sum, order) => sum + (order.settlementPaise ?? 0), 0);
  const knownCosts = confirmed.reduce((sum, order) => sum + (order.productCostPaise ?? 0) + (order.packagingCostPaise ?? 0) + (order.variableCostPaise ?? 0) + (order.adCostPaise ?? 0), 0);
  const audit = confirmed.flatMap((order) => order.audit);
  return (
    <div className="receipt-panel rounded-[28px] p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-blue-800"><span className="liquid-icon grid size-11 place-items-center rounded-2xl"><ReceiptText className="size-5" /></span><div><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-blue-600">{english ? "Resolved orders only" : "सिर्फ resolved orders"}</p><h2 className="mt-1 text-xl font-black">{english ? "Margin receipt" : "Margin की receipt"}</h2></div></div>
        <span className="liquid-pill self-start rounded-full px-3 py-2 text-xs font-extrabold text-emerald-800"><Check className="mr-1.5 inline size-3.5" />{english ? "Source-backed" : "Source-backed"}</span>
      </div>
      <div className="receipt-row mt-4 overflow-hidden rounded-[22px] px-4 sm:px-6">
        <DashboardReceiptLine icon={WalletCards} operator="plus" label={english ? "Payment received" : "Payment मिला"} value={formatInr(paymentReceived)} tone="blue" auditTitle="Confirmed settlement received" auditDescription="Settlement evidence from confirmed sub-orders only." audit={audit.filter((line) => line.key === "settlement")} />
        <DashboardReceiptLine icon={PackageSearch} operator="minus" label={english ? "Known costs" : "Known costs"} value={formatInr(-knownCosts)} tone="red" auditTitle="Known costs on confirmed orders" auditDescription="Product, packaging, seller-entered variable and allocated ad costs for confirmed sub-orders." audit={audit.filter((line) => ["product_cost", "packaging", "variable_cost", "ads"].includes(line.key))} />
        <DashboardReceiptLine icon={BadgeIndianRupee} operator="equals" label={english ? "You keep" : "आपके पास बचा"} value={formatInr(result.confirmedContributionPaise)} tone="green" final auditTitle="Confirmed Contribution" auditDescription="Confirmed settlement minus known costs, using resolved sub-orders only." audit={audit.filter((line) => line.key === "contribution")}>
          <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-[11px] font-extrabold text-emerald-800"><Check className="size-3.5" />Confirmed Contribution</span>
        </DashboardReceiptLine>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{english ? "Pending and incomplete rows are kept outside this confirmed receipt and shown as Still at Risk." : "Pending और incomplete rows इस confirmed receipt से अलग हैं; वे Still at Risk में दिखते हैं।"}</p>
    </div>
  );
}

function DashboardReceiptLine({ icon: Icon, operator, label, value, tone, final = false, auditTitle, auditDescription, audit, children }: { icon: typeof WalletCards; operator: "plus" | "minus" | "equals"; label: string; value: string; tone: "blue" | "red" | "green"; final?: boolean; auditTitle: string; auditDescription: string; audit: AuditLine[]; children?: ReactNode }) {
  const OperatorIcon = operator === "plus" ? Plus : operator === "minus" ? Minus : Equal;
  const colors = tone === "red" ? "text-red-700 bg-red-100/80" : tone === "green" ? "text-emerald-800 bg-emerald-100/80" : "text-blue-800 bg-blue-100/80";
  const valueColor = tone === "red" ? "[&_button]:text-red-700" : tone === "green" ? "[&_button]:text-emerald-800" : "[&_button]:text-slate-950";
  return <div className={`grid grid-cols-[auto_auto_1fr] items-center gap-3 py-5 sm:grid-cols-[auto_auto_1fr_auto] ${final ? "border-t-2 border-blue-200/90" : "border-b border-blue-100/90"}`}><span className={`grid size-11 place-items-center rounded-2xl ${colors}`}><Icon className="size-5" /></span><span className="grid size-8 place-items-center rounded-full border border-blue-200 bg-blue-50 text-slate-700"><OperatorIcon className="size-4" /></span><div><p className="font-extrabold text-slate-900">{label}</p>{children}</div><div className={`col-start-3 text-left [&_button]:text-2xl [&_button]:font-black [&_button]:tracking-[-.035em] sm:col-start-auto sm:text-right sm:[&_button]:text-3xl ${valueColor}`}><AuditDialog trigger={value} title={auditTitle} description={auditDescription} lines={audit} /><p className="mt-1 text-[10px] font-bold text-slate-500">{final ? "Confirmed • tap for Why?" : "Tap for Why?"}</p></div></div>;
}

function SnapshotNoticeCard({ href, tone, icon: Icon, value, label, detail }: { href: string; tone: "amber" | "red"; icon: typeof AlertTriangle; value: string; label: string; detail: string }) {
  const classes = tone === "amber" ? "border-amber-300/80 bg-amber-100/75 text-amber-800" : "border-red-300/80 bg-red-100/70 text-red-700";
  return <a href={href} className={`rounded-[22px] border p-4 shadow-sm transition hover:-translate-y-0.5 sm:p-5 ${classes}`}><div className="flex items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm ${tone === "amber" ? "bg-amber-500" : "bg-red-500"}`}><Icon className="size-5" /></span><div><p className="text-xl font-black tracking-[-.02em]"><span className="tabular-nums">{value}</span> <span className="text-sm">{label}</span></p><p className="mt-1 text-xs font-semibold text-slate-600">{detail}</p></div><ChevronRight className="ml-auto size-5 shrink-0" /></div></a>;
}

function skuKey(sku: Pick<SkuEconomics, "channelId" | "channelAccountId" | "sku">): string {
  return `${sku.channelId ?? "unknown"}::${sku.channelAccountId ?? "default"}::${sku.sku}`;
}

function SkuRow({ sku, result }: { sku: SkuEconomics; result: AnalysisResult }) {
  const amount = sku.confirmedContributionPaise + sku.provisionalContributionPaise;
  const tone = amount < 0 ? "text-red-700" : "text-emerald-700";
  const related = result.orders.filter((order) => order.sku === sku.sku && (order.channelId ?? "unknown") === (sku.channelId ?? "unknown") && (order.channelAccountId ?? "") === (sku.channelAccountId ?? ""));
  return <tr><td className="px-4 py-4 pl-6"><p className="font-extrabold text-slate-900">{sku.sku}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-blue-600">{channelLabel(sku.channelId)}</p></td><td className="max-w-[240px] px-4 py-4"><p className="font-semibold text-slate-700">{sku.primaryProblem}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{sku.reason}</p></td><td className="px-4 py-4 tabular-nums text-slate-600">{sku.sampleSize}</td><td className="px-4 py-4"><AuditDialog trigger={formatInr(sku.confirmedContributionPaise)} title={`${sku.sku} confirmed contribution`} description="Confirmed sub-order contribution sum." lines={related.filter((order) => order.state === "confirmed").flatMap((order) => order.audit)} /></td><td className="px-4 py-4"><AuditDialog trigger={formatInr(sku.provisionalContributionPaise)} title={`${sku.sku} provisional contribution`} description="Only unresolved/pending sub-order contribution. This can change across periods." lines={related.filter((order) => order.state === "provisional").flatMap((order) => order.audit)} /></td><td className={`px-4 py-4 font-bold tabular-nums ${tone}`}><AuditDialog trigger={formatInr(sku.contributionPerDeliveredPaise)} title={`${sku.sku} contribution per delivered order`} description={`Calculated contribution divided by ${sku.delivered} delivered order(s).`} /></td><td className="px-4 py-4 tabular-nums text-slate-600">{sku.returnRtoRate === undefined ? "—" : `${(sku.returnRtoRate * 100).toFixed(1)}%`}</td><td className="px-4 py-4 font-bold tabular-nums text-red-700"><AuditDialog trigger={sku.moneyImpactPaise ? formatInr(sku.moneyImpactPaise) : "—"} title={`${sku.sku} money impact`} description="Absolute contribution currently below zero. Positive SKUs show no loss impact." lines={related.flatMap((order) => order.audit)} /></td><td className="px-4 py-4"><span className={`action-pill ${actionTone(sku.action)}`}>{sku.action}</span></td><td className="px-4 py-4 pr-6 text-slate-600">{sku.confidence}</td></tr>;
}

function ProfitBridge({ result }: { result: AnalysisResult }) {
  const rows = [
    ["Settlement received", result.bridge.settlementPaise, "bg-blue-600", "settlement"],
    ["Product cost", -result.bridge.productCostPaise, "bg-slate-400", "product_cost"],
    ["Packaging", -result.bridge.packagingPaise, "bg-slate-400", "packaging"],
    ["Variable costs", -result.bridge.variableCostPaise, "bg-slate-400", "variable_cost"],
    ["Ads", -result.bridge.adsPaise, "bg-amber-500", "ads"],
    ["Contribution", result.bridge.contributionPaise, "bg-emerald-600", "contribution"],
  ] as const;
  const max = Math.max(1, ...rows.map(([, amount]) => Math.abs(amount)));
  const audit = bridgeAudit(result);
  return <section className="liquid-panel rounded-[24px] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-600">Profit Bridge</p><h2 className="mt-2 text-lg font-extrabold text-slate-950">From settlement to contribution</h2></div><BarChart3 className="size-5 text-slate-400" /></div><div className="mt-6 space-y-4">{rows.map(([label, amount, color, key]) => <div key={label}><div className="flex justify-between text-xs"><span className="font-bold text-slate-600">{label}</span><AuditDialog trigger={formatInr(amount)} title={`${label} breakdown`} description="Normalized analysis bridge component." lines={audit.filter((line) => line.key === key)} /></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, (Math.abs(amount) / max) * 100)}%` }} /></div></div>)}</div></section>;
}

function DataQuality({ result }: { result: AnalysisResult }) {
  return <section id="quality" className="liquid-panel rounded-[24px] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-600">Data quality</p><h2 className="mt-2 text-lg font-extrabold text-slate-950">{result.qualityStatus}</h2></div><div className="text-right"><p className="text-2xl font-black tabular-nums text-slate-950">{result.qualityScore}</p><p className="text-[10px] font-bold uppercase text-slate-400">out of 100</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${result.qualityScore >= 90 ? "bg-emerald-600" : result.qualityScore >= 70 ? "bg-amber-500" : "bg-red-600"}`} style={{ width: `${result.qualityScore}%` }} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{result.findings.length ? result.findings.slice(0, 6).map((finding) => <div key={finding.code} className={`rounded-xl border p-3 ${finding.severity === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs font-extrabold text-slate-900">{finding.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{finding.message}</p></div>) : <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">No material data-quality issue detected in supplied evidence.</div>}</div></section>;
}

function SettlementTruth({ result }: { result: AnalysisResult }) {
  const reconciliation = result.settlementReconciliation;
  if (!reconciliation) return null;
  const exceptionCount = reconciliation.shortCount
    + reconciliation.excessCount
    + reconciliation.missingCount
    + reconciliation.ambiguousCount
    + reconciliation.failedCount
    + reconciliation.incompleteCount;
  const confidenceTone = reconciliation.confidence === "Confirmed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : reconciliation.confidence === "Provisional"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <section className="liquid-panel mt-6 rounded-[24px] p-5 sm:p-6" aria-labelledby="settlement-truth-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-600">Money chain</p>
          <h2 id="settlement-truth-title" className="mt-2 text-lg font-extrabold text-slate-950">Payout → bank truth</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Only explicit payout batches and supplied bank evidence are compared. Similar amounts are never guessed into a match.</p>
        </div>
        <span className={`self-start rounded-full border px-3 py-1.5 text-[11px] font-extrabold ${confidenceTone}`}>{reconciliation.confidence}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">Final payout expected</p><p className="mt-2 text-xl font-black tabular-nums text-slate-950">{formatInr(reconciliation.expectedBankPaise)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">Bank matched</p><p className="mt-2 text-xl font-black tabular-nums text-slate-950">{formatInr(reconciliation.actualMatchedBankPaise)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">Matched difference</p><p className={`mt-2 text-xl font-black tabular-nums ${reconciliation.differencePaise === 0 ? "text-emerald-700" : "text-amber-700"}`}>{formatInr(reconciliation.differencePaise)}</p></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{reconciliation.matchedCount} matched</span>
        {reconciliation.pendingCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{reconciliation.pendingCount} pending</span>}
        {exceptionCount > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{exceptionCount} need review</span>}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">Why?</p>
        <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
          {reconciliation.why.slice(0, 5).map((reason) => <li key={reason} className="flex gap-2"><span aria-hidden="true" className="font-black text-blue-600">•</span><span>{reason}</span></li>)}
        </ul>
      </div>
    </section>
  );
}

function PeriodComparison({ result }: { result: AnalysisResult }) {
  const max = Math.max(1, ...result.periods.map((period) => Math.abs(period.confirmedContributionPaise + period.provisionalContributionPaise)));
  return <section className="mt-6 liquid-panel rounded-[24px] p-5 sm:p-6"><div><p className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-600">Period comparison</p><h2 className="mt-2 text-lg font-extrabold text-slate-950">Contribution trend</h2><p className="mt-1 text-sm text-slate-500">Each sub-order is assigned to its latest supplied event month; cross-period rows remain flagged.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.periods.map((period) => { const total = period.confirmedContributionPaise + period.provisionalContributionPaise; return <div key={period.period} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-extrabold text-slate-800">{period.period}</p><p className="mt-1 text-[11px] text-slate-500">{period.orders} orders</p></div><AuditDialog trigger={formatInr(total)} title={`${period.period} contribution`} description="Confirmed plus provisional contribution assigned to this latest-event month." /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${total < 0 ? "bg-red-600" : "bg-emerald-600"}`} style={{ width: `${Math.max(4, Math.abs(total) / max * 100)}%` }} /></div><p className="mt-2 text-[11px] text-amber-700">At risk {formatInr(Math.abs(period.provisionalContributionPaise))}</p></div>; })}</div>{result.bankCreditMismatchPaise !== undefined && <div className={`mt-5 rounded-xl border p-4 text-sm ${Math.abs(result.bankCreditMismatchPaise) <= 100 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><span className="font-extrabold">Bank-credit comparison:</span> entered {formatInr(result.bankCreditPaise)} versus bank-reconcilable payout evidence {formatInr(result.bankReconcilableSettlementPaise)}; difference {formatInr(result.bankCreditMismatchPaise)}.</div>}</section>;
}

function Simulators({ sku }: { sku: SkuEconomics }) {
  const [priceChange, setPriceChange] = useState(0);
  const [failureRate, setFailureRate] = useState(Math.round((sku.returnRtoRate ?? 0) * 100));
  const [adChange, setAdChange] = useState(0);
  const current = sku.confirmedContributionPaise + sku.provisionalContributionPaise;
  const perOrder = sku.orders ? current / sku.orders : 0;
  const priceImpact = Math.round((sku.breakEvenPricePaise ?? 0) * (priceChange / 100) * Math.max(1, sku.delivered));
  const safeRate = (sku.maxSafeFailureRate ?? sku.returnRtoRate ?? 0) * 100;
  const failureImpact = Math.round((safeRate - failureRate) * Math.abs(perOrder) * Math.max(1, sku.orders) / 100);
  const estimatedAdBase = sku.maxAcos && sku.maxAcos > 0 ? Math.abs(current) / sku.maxAcos : Math.abs(current) * 0.25;
  const adImpact = -Math.round(estimatedAdBase * (adChange / 100));
  return <div className="mt-6 grid gap-4 lg:grid-cols-3"><SimulatorCard title="Price change" value={`${priceChange >= 0 ? "+" : ""}${priceChange}%`} min={-20} max={30} valueNumber={priceChange} onChange={setPriceChange} result={current + priceImpact} note={`Break-even price: ${formatInr(sku.breakEvenPricePaise)}`} /><SimulatorCard title="Return/RTO rate" value={`${failureRate}%`} min={0} max={60} valueNumber={failureRate} onChange={setFailureRate} result={current + failureImpact} note={sku.maxSafeFailureRate === undefined ? "Safe threshold: insufficient data" : `Safe threshold: ${(sku.maxSafeFailureRate * 100).toFixed(1)}%`} /><SimulatorCard title="Ad spend change" value={`${adChange >= 0 ? "+" : ""}${adChange}%`} min={-100} max={100} valueNumber={adChange} onChange={setAdChange} result={current + adImpact} note={sku.maxAcos === undefined ? "Max ACoS: insufficient data" : `Max ACoS: ${(sku.maxAcos * 100).toFixed(1)}%`} /></div>;
}

function SimulatorCard({ title, value, min, max, valueNumber, onChange, result, note }: { title: string; value: string; min: number; max: number; valueNumber: number; onChange: (value: number) => void; result: number; note: string }) {
  return <div className="liquid-soft rounded-2xl p-4"><div className="flex justify-between"><p className="text-sm font-extrabold text-slate-900">{title}</p><span className="text-sm font-black tabular-nums text-blue-700">{value}</span></div><Slider aria-label={title} className="mt-5" min={min} max={max} step={1} value={[valueNumber]} onValueChange={(values) => onChange(values[0])} /><div className="mt-5 rounded-lg bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">Estimated contribution</p><p className={`mt-1 text-xl font-black tabular-nums ${result < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatInr(Math.round(result))}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></div></div>;
}

function AuditDialog({ trigger, title, description, lines }: { trigger: string; title: string; description: string; lines?: AuditLine[] }) {
  const sources = [...new Map((lines ?? []).flatMap((line) => line.sources).map((source) => [`${source.sourceFingerprint}:${source.sheetName}:${source.rowNumber}`, source])).values()];
  return <Dialog><DialogTrigger asChild><button type="button" aria-label={`Why? ${title}: ${trigger}`} className="inline-flex min-h-6 min-w-6 items-center gap-1 rounded text-xs font-extrabold tabular-nums text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{trigger}<CircleHelp className="size-3.5" /></button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{lines?.length ? <div className="mt-2 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-sm"><tbody className="divide-y divide-slate-100">{dedupeAudit(lines).map((line, index) => <tr key={`${line.key}-${index}`}><td className="px-4 py-3 text-slate-600">{line.operation === "subtract" ? "minus " : line.operation === "equals" ? "equals " : ""}{line.label}</td><td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-900">{line.known === false ? "Unknown" : formatInr(line.operation === "subtract" ? -line.amountPaise : line.amountPaise)}</td></tr>)}</tbody></table></div> : null}{sources.length > 0 && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">Source references</p><ul className="mt-2 space-y-1.5 text-xs text-slate-600">{sources.slice(0, 20).map((source) => <li key={`${source.sourceFingerprint}:${source.sheetName}:${source.rowNumber}`}><span className="font-semibold text-slate-800">{source.fileName}</span> • {source.sheetName} • row {source.rowNumber} • {source.parserVersion}</li>)}</ul>{sources.length > 20 && <p className="mt-2 text-[11px] text-slate-500">+ {sources.length - 20} more source rows in export</p>}</div>}<p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">Seller-entered costs have no marketplace source row; they remain separately labeled in the calculation.</p></DialogContent></Dialog>;
}

function StateBadge({ state }: { state: "confirmed" | "provisional" | "incomplete" }) {
  const classes = state === "confirmed" ? "bg-emerald-50 text-emerald-700" : state === "provisional" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${classes}`}>{state}</span>;
}

function MobileNav({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) {
  return <Link href={href} className="flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-bold text-slate-500"><Icon className="size-4.5" />{label}</Link>;
}

function matchesFilter(sku: SkuEconomics, filter: Filter) {
  const total = sku.confirmedContributionPaise + sku.provisionalContributionPaise;
  if (filter === "All") return true;
  if (filter === "Urgent") return ["Pause", "Add Cost", "Review Settlement", "Review Return/RTO"].includes(sku.action);
  if (filter === "Losing Money") return total < 0;
  if (filter === "Reprice" || filter === "Reduce Ads" || filter === "Scale") return sku.action === filter;
  if (filter === "Data Missing") return sku.incompleteOrders > 0;
  if (filter === "Settlement Review") return sku.action === "Review Settlement";
  return true;
}

function actionTone(action: SkuEconomics["action"]) {
  if (action === "Scale" || action === "Maintain") return "action-green";
  if (["Reprice", "Reduce Ads", "Review Return/RTO", "Insufficient Data"].includes(action)) return "action-amber";
  return "action-red";
}

function bridgeAudit(result: AnalysisResult): AuditLine[] {
  const sources = result.orders.flatMap((order) => order.sources);
  return [
    { key: "settlement", label: "Settlement received", amountPaise: result.bridge.settlementPaise, operation: "add", sources },
    { key: "product_cost", label: "Product cost", amountPaise: result.bridge.productCostPaise, operation: "subtract", sources: [] },
    { key: "packaging", label: "Packaging", amountPaise: result.bridge.packagingPaise, operation: "subtract", sources: [] },
    { key: "variable_cost", label: "Other variable cost", amountPaise: result.bridge.variableCostPaise, operation: "subtract", sources: [] },
    { key: "ads", label: "Allocated ads", amountPaise: result.bridge.adsPaise, operation: "subtract", sources: [] },
    { key: "contribution", label: "Confirmed contribution", amountPaise: result.confirmedContributionPaise, operation: "equals", sources },
  ];
}

function dedupeAudit(lines: AuditLine[]) {
  if (lines.length <= 8) return lines;
  const sums = new Map<AuditLine["key"], AuditLine>();
  for (const line of lines) {
    const current = sums.get(line.key);
    sums.set(line.key, current ? { ...current, amountPaise: current.amountPaise + line.amountPaise, known: current.known !== false && line.known !== false } : { ...line });
  }
  return [...sums.values()];
}
