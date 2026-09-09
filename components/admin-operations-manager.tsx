"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type BillingReport = {
  paidWithoutEntitlement: unknown[];
  entitlementWithoutPaidPayment: unknown[];
  retryableWebhookEvents: Array<{ providerEventId: string; eventType: string; attemptCount: number; lastErrorCode: string | null }>;
  terminalWebhookEvents: Array<{ providerEventId: string; eventType: string; attemptCount: number; lastErrorCode: string | null }>;
  staleSubscriptions: unknown[];
};
type ConnectorJob = { id: string; connectorId: string; status: string; attemptCount: number; maxAttempts: number; nextAttemptAt: string | null; lastErrorCode: string | null; lastErrorMessage: string | null; updatedAt: string };

export function AdminOperationsManager() {
  const [billing, setBilling] = useState<BillingReport | null>(null);
  const [jobs, setJobs] = useState<ConnectorJob[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [billingResponse, connectorResponse] = await Promise.all([
      fetch("/api/admin/operations/billing/reconcile", { cache: "no-store" }),
      fetch("/api/admin/operations/connectors/retry", { cache: "no-store" }),
    ]);
    const billingPayload = await billingResponse.json() as { report?: BillingReport; error?: string };
    const connectorPayload = await connectorResponse.json() as { jobs?: ConnectorJob[]; error?: string };
    if (!billingResponse.ok || !billingPayload.report) throw new Error(billingPayload.error ?? "Billing operations report failed.");
    if (!connectorResponse.ok) throw new Error(connectorPayload.error ?? "Connector operations report failed.");
    setBilling(billingPayload.report); setJobs(connectorPayload.jobs ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => toast.error(error instanceof Error ? error.message : "Operations report failed."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function reconcileBilling() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/operations/billing/reconcile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 40 }) });
      const payload = await response.json() as { report?: BillingReport; result?: Record<string, number>; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error ?? "Billing reconciliation failed.");
      setBilling(payload.report); toast.success(`Billing reconciliation finished. ${payload.result?.errors ?? 0} provider check error(s).`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Billing reconciliation failed."); }
    finally { setBusy(false); }
  }

  async function retryConnectors() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/operations/connectors/retry", { method: "POST" });
      const payload = await response.json() as { jobs?: ConnectorJob[]; result?: { attempted: number; completed: number }; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Connector retry processing failed.");
      setJobs(payload.jobs ?? []); toast.success(`Connector retry pass: ${payload.result?.completed ?? 0}/${payload.result?.attempted ?? 0} completed.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Connector retry processing failed."); }
    finally { setBusy(false); }
  }

  if (!billing) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  const billingRisk = billing.paidWithoutEntitlement.length + billing.entitlementWithoutPaidPayment.length + billing.retryableWebhookEvents.length + billing.terminalWebhookEvents.length + billing.staleSubscriptions.length;
  return <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.13em] text-blue-600">Production operations</p><h1 className="mt-2 text-2xl font-extrabold tracking-[-.035em] text-slate-950">Billing & connector health</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Privacy-safe operator controls for paid-but-locked mismatches, webhook retries and durable connector jobs. No provider secret is returned to this screen.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 size-4" />Refresh</Button></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Paid, no entitlement" value={billing.paidWithoutEntitlement.length} risk /><Metric label="Entitlement mismatch" value={billing.entitlementWithoutPaidPayment.length} risk /><Metric label="Retry webhooks" value={billing.retryableWebhookEvents.length} risk /><Metric label="Terminal webhooks" value={billing.terminalWebhookEvents.length} risk /><Metric label="Stale subscriptions" value={billing.staleSubscriptions.length} risk /></div>
    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={reconcileBilling} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Reconcile recent Razorpay state</Button><span className={`rounded-full px-3 py-2 text-xs font-extrabold ${billingRisk ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{billingRisk ? `${billingRisk} billing item(s) need review` : "No current billing mismatch in the bounded report"}</span></div>
    <div className="mt-8 flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-slate-950">Connector retry ledger</h2><p className="mt-1 text-xs text-slate-500">Due retries are also processed by the configured Cloudflare cron. Dead-letter jobs require a fresh seller/admin retry after root-cause review.</p></div><Button variant="outline" onClick={retryConnectors} disabled={busy}>Process due retries</Button></div>
    <div className="mt-4 space-y-2">{jobs.length ? jobs.map((job) => <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold text-slate-900">{job.connectorId} <span className="font-medium text-slate-400">• {job.id}</span></p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${job.status === "dead_letter" || job.status === "terminal_failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{job.status.replace("_", " ")}</span></div><p className="mt-2 text-xs text-slate-600">Attempt {job.attemptCount}/{job.maxAttempts}{job.nextAttemptAt ? ` • next ${new Date(job.nextAttemptAt).toLocaleString("en-IN")}` : ""}{job.lastErrorCode ? ` • ${job.lastErrorCode}` : ""}</p>{job.lastErrorMessage && <p className="mt-1 text-xs text-slate-500">{job.lastErrorMessage}</p>}</div>) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><ShieldCheck className="mr-2 inline size-4" />No queued/failed connector jobs.</div>}</div>
  </section>;
}
function Metric({ label, value, risk }: { label: string; value: number; risk?: boolean }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${risk && value ? "text-red-700" : "text-slate-950"}`}>{value}</p></div>; }
