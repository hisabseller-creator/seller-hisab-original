"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Database, Loader2, MessageCircleQuestion, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProPlanLock } from "./pro-plan-lock";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type BenchmarkMetric = {
  id: string;
  label: string;
  currentValue?: number;
  status: "available" | "insufficient-cohort" | "missing-current-data";
  cohortMedian?: number;
  cohortSizeBand?: string;
  comparison?: "better" | "near" | "worse";
};

type BenchmarkSummary = {
  contributeEnabled: boolean;
  publicationEnabled: boolean;
  canManageParticipation: boolean;
  privacyThreshold: number;
  privacyNote: string;
  metrics: BenchmarkMetric[];
};

type Dashboard = {
  role: string;
  evidenceDomains: number;
  openActionCount: number;
  connectedConnectorCount: number;
  benchmark: BenchmarkSummary;
  suggestedQuestions: string[];
};

type Answer = {
  intent: string;
  title: string;
  answer: string;
  confidenceBps: number;
  confidenceLabel: "High" | "Medium" | "Low";
  evidence: Array<{ id: string; label: string; value: string; detail?: string; href?: string }>;
  dataGaps: string[];
  governedActions: Array<{ actionId?: string; label: string; detail: string; href: string; approvalRequired?: boolean; approvalStatus?: string }>;
  boundary: string;
};

function metricValue(metric: BenchmarkMetric): string {
  if (metric.currentValue === undefined) return "—";
  return `${metric.currentValue.toFixed(1)}%`;
}

function comparisonText(metric: BenchmarkMetric): string {
  if (metric.status === "available") return `Cohort median ${metric.cohortMedian?.toFixed(1)}% • ${metric.comparison ?? "near"} • ${metric.cohortSizeBand ?? "privacy-qualified cohort"}`;
  if (metric.status === "insufficient-cohort") return "Cohort hidden until the privacy threshold is met.";
  return "Your current business does not have enough evidence for this metric.";
}

export function AskSellerHisabView() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [question, setQuestion] = useState("What should I do today?");
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account/ask", { cache: "no-store" });
    const payload = await response.json() as { dashboard?: Dashboard; error?: string; requiredPlan?: string };
    if (response.status === 402) {
      setPlanLocked(true);
      setLoadError(null);
      setDashboard(null);
      return;
    }
    if (!response.ok || !payload.dashboard) throw new Error(payload.error ?? "Ask SellerHisab could not be loaded.");
    setPlanLocked(false);
    setLoadError(null);
    setDashboard(payload.dashboard);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void refresh()
        .catch((error) => { if (active) { const message = error instanceof Error ? error.message : "Ask SellerHisab could not be loaded."; setLoadError(message); toast.error(message); } })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);

  async function ask(nextQuestion?: string) {
    const prompt = (nextQuestion ?? question).trim();
    if (prompt.length < 3) return;
    if (nextQuestion) setQuestion(nextQuestion);
    setBusy(true);
    try {
      const response = await fetch("/api/account/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ask", question: prompt }),
      });
      const payload = await response.json() as { answer?: Answer; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? "SellerHisab could not answer from the saved evidence.");
      setAnswer(payload.answer);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ask SellerHisab failed.");
    } finally {
      setBusy(false);
    }
  }

  async function updateBenchmarkParticipation(contributeEnabled: boolean) {
    if (!dashboard?.benchmark.canManageParticipation) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "benchmark_participation", contributeEnabled }),
      });
      const payload = await response.json() as { benchmark?: BenchmarkSummary; error?: string };
      if (!response.ok || !payload.benchmark) throw new Error(payload.error ?? "Benchmark preference could not be updated.");
      setDashboard((current) => current ? { ...current, benchmark: payload.benchmark! } : current);
      toast.success(contributeEnabled ? "Anonymous aggregate benchmark contribution enabled." : "Benchmark contribution disabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Benchmark preference could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (planLocked) return <div className="mt-6 space-y-5"><div><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Ask SellerHisab</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Evidence-first business Q&amp;A stays governed by your saved SellerHisab evidence and workspace permissions.</p></div><ProPlanLock title="Ask SellerHisab requires Pro" description="Upgrade to Pro to ask evidence-bound business questions and use privacy-gated benchmark controls. SellerHisab will not invent answers while this feature is locked." /></div>;
  if (!dashboard) return <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">{loadError ?? "Ask SellerHisab could not be loaded."}</div>;

  return <div className="mt-6 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><Sparkles className="size-5 text-violet-600" /><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Ask SellerHisab</h1></div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Evidence-first business Q&amp;A. Answers come from your saved SellerHisab data, expose missing inputs and keep approval-controlled actions inside the Professional Workspace.</p></div>
      <span className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-extrabold text-violet-800">Governed Evidence Engine v1</span>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={Database} label="Evidence domains" value={`${dashboard.evidenceDomains}/4`} detail="Ads • Inventory • Cash • Connections" />
      <SummaryCard icon={ShieldCheck} label="Open governed actions" value={String(dashboard.openActionCount)} detail="Approval rules remain enforced" />
      <SummaryCard icon={CheckCircle2} label="Active connectors" value={String(dashboard.connectedConnectorCount)} detail="Stored connection state" />
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><MessageCircleQuestion className="size-5 text-blue-600" /><div><h2 className="font-extrabold text-slate-950">Ask a business question</h2><p className="text-xs text-slate-500">F12 supports operational questions about priorities, ads, inventory, cash, connections, missing data and benchmarks. Unsupported questions are not guessed.</p></div></div>
      <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} className="mt-4 min-h-24 bg-white" placeholder="Example: Which ads need attention?" />
      <div className="mt-3 flex flex-wrap gap-2">{dashboard.suggestedQuestions.map((item) => <Button key={item} type="button" variant="outline" size="sm" disabled={busy} onClick={() => void ask(item)}>{item}</Button>)}</div>
      <Button className="mt-4 bg-blue-600 font-bold" disabled={busy || question.trim().length < 3} onClick={() => void ask()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}Ask from evidence</Button>
    </section>

    {answer && <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-violet-600">{answer.intent.replaceAll("-", " ")}</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.025em] text-slate-950">{answer.title}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${answer.confidenceLabel === "High" ? "bg-emerald-100 text-emerald-700" : answer.confidenceLabel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{answer.confidenceLabel} confidence • {(answer.confidenceBps / 100).toFixed(0)}%</span></div>
      <p className="mt-4 text-sm leading-6 text-slate-700">{answer.answer}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{answer.evidence.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">{item.label}</p><p className="mt-1 text-lg font-extrabold text-slate-950">{item.value}</p>{item.detail && <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>}{item.href && <Link className="mt-2 inline-block text-xs font-bold text-blue-700" href={item.href}>Open evidence →</Link>}</div>)}</div>

      {answer.dataGaps.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-extrabold text-amber-950">Data gaps</p><ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900">{answer.dataGaps.map((gap) => <li key={gap}>• {gap}</li>)}</ul></div>}

      {answer.governedActions.length > 0 && <div className="mt-5"><p className="text-sm font-extrabold text-slate-950">Governed next actions</p><div className="mt-2 space-y-2">{answer.governedActions.map((action, index) => <div key={action.actionId ?? `${action.label}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div><p className="text-sm font-extrabold text-slate-900">{action.label}</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{action.detail}</p>{action.approvalRequired && <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-amber-700">Approval: {(action.approvalStatus ?? "not requested").replaceAll("_", " ")}</p>}</div><Button asChild size="sm" variant="outline"><Link href={action.href}>Open workspace</Link></Button></div>)}</div></div>}

      <div className="mt-5 rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-200"><span className="font-extrabold text-white">Boundary:</span> {answer.boundary}</div>
    </section>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><BarChart3 className="size-5 text-emerald-600" /><div><h2 className="font-extrabold text-slate-950">Privacy-qualified benchmarks</h2><p className="text-xs text-slate-500">No fabricated “industry average”. Publication stays off until cohort comparability and privacy gates are both satisfied.</p></div></div>{dashboard.benchmark.canManageParticipation && <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Switch checked={dashboard.benchmark.contributeEnabled} disabled={busy} onCheckedChange={(checked) => void updateBenchmarkParticipation(checked)} /><span className="text-xs font-bold text-slate-700">Contribute anonymous aggregates</span></div>}</div>
      <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-500">{dashboard.benchmark.privacyNote}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{dashboard.benchmark.metrics.map((metric) => <div key={metric.id} className="rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">{metric.label}</p><p className="mt-1 text-xl font-extrabold text-slate-950">{metricValue(metric)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{dashboard.benchmark.publicationEnabled ? comparisonText(metric) : "Cross-seller median publication is currently disabled."}</p></div>)}</div>
      {!dashboard.benchmark.canManageParticipation && <p className="mt-4 text-xs text-slate-500">Only an Owner or Admin can change benchmark participation for this workspace.</p>}
    </section>
  </div>;
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Database; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-slate-500"><Icon className="size-4" /><p className="text-[10px] font-extrabold uppercase tracking-[.08em]">{label}</p></div><p className="mt-2 text-2xl font-extrabold tracking-[-.03em] text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
