"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type TrialSetting = { enabled: boolean; days: number };
type TrialSettings = { starter: TrialSetting; pro: TrialSetting };
type TrialRecord = {
  id: string;
  userId: string;
  name: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: number;
  status: string;
  autoPayStatus: string;
  providerLastStatus: string | null;
  convertedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  active: boolean;
  converted: boolean;
  paymentRetrying: boolean;
  paymentFailed: boolean;
  endedUnpaid: boolean;
};
type Payload = {
  settings?: TrialSettings;
  trials?: TrialRecord[];
  stats?: { totalStarted: number; active: number; converted: number; paymentRetrying: number; paymentFailed: number; endedUnpaid: number; cancelled: number };
  rules?: { oneTrialPerAccount: boolean; autoPayRequired: boolean; minDays: number; maxDays: number };
  privacy?: string;
  error?: string;
};

const DEFAULT_SETTINGS: TrialSettings = {
  starter: { enabled: false, days: 3 },
  pro: { enabled: false, days: 3 },
};

export function AdminBillingTrialManager() {
  const [payload, setPayload] = useState<Payload>({});
  const [settings, setSettings] = useState<TrialSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/billing-trials", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() as Payload }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error ?? "Billing trials could not be loaded.");
        setPayload(body);
        if (body.settings) setSettings(body.settings);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Billing trials could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/billing-trials", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await response.json() as Payload & { ok?: boolean };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Trial settings could not be saved.");
      if (body.settings) setSettings(body.settings);
      toast.success("Free-trial settings updated.");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trial settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const trials = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payload.trials ?? []).filter((trial) => {
      const searchMatch = !query || [trial.name, trial.city, trial.email, trial.phone, trial.plan, trial.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      if (!searchMatch) return false;
      if (statusFilter === "active") return trial.active;
      if (statusFilter === "converted") return trial.converted;
      if (statusFilter === "retrying") return trial.paymentRetrying;
      if (statusFilter === "failed") return trial.paymentFailed;
      if (statusFilter === "ended") return trial.endedUnpaid;
      if (statusFilter === "cancelled") return Boolean(trial.cancelledAt) || trial.status === "cancelled";
      return true;
    });
  }, [payload.trials, search, statusFilter]);

  const stats = payload.stats ?? { totalStarted: 0, active: 0, converted: 0, paymentRetrying: 0, paymentFailed: 0, endedUnpaid: 0, cancelled: 0 };

  return (
    <div className="space-y-5">
      <section className="liquid-panel rounded-[26px] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="liquid-button grid size-11 shrink-0 place-items-center rounded-2xl"><CreditCard className="size-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">Recurring billing</p>
              <h1 className="mt-1 text-xl font-black tracking-[-.03em] text-slate-950 sm:text-2xl">Free trials & AutoPay</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Turn Starter or Pro trials on/off, choose the trial duration, and track who activated, converted or failed at the first AutoPay charge.</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-xl bg-white/70" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <PlanTrialCard plan="Starter" value={settings.starter} onChange={(value) => setSettings((current) => ({ ...current, starter: value }))} />
          <PlanTrialCard plan="Pro" value={settings.pro} onChange={(value) => setSettings((current) => ({ ...current, pro: value }))} />
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-5 text-amber-950">
          Trial activation requires the signed-in account&apos;s verified mobile number plus an email address. Razorpay mandate/AutoPay authorisation happens at checkout; the monthly plan charge starts after the configured trial period. One free trial is allowed per SellerHisab account across Starter and Pro.
        </div>

        <Button className="liquid-button mt-5 rounded-xl font-extrabold" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save trial settings
        </Button>
      </section>

      <section className="liquid-panel rounded-[26px] p-5 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <Stat label="Trials started" value={stats.totalStarted} />
          <Stat label="Active now" value={stats.active} />
          <Stat label="AutoPay paid" value={stats.converted} />
          <Stat label="Payment retrying" value={stats.paymentRetrying} />
          <Stat label="Payment failed" value={stats.paymentFailed} />
          <Stat label="Ended unpaid" value={stats.endedUnpaid} />
          <Stat label="Cancelled" value={stats.cancelled} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="data-entry h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, mobile, email, city or plan" />
          </div>
          <select className="data-entry h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All trial users</option>
            <option value="active">Active trial</option>
            <option value="converted">AutoPay paid</option>
            <option value="retrying">Payment retrying</option>
            <option value="failed">Payment failed</option>
            <option value="ended">Ended unpaid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {loading && !(payload.trials?.length) ? (
          <div className="liquid-panel grid min-h-40 place-items-center rounded-[24px]"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
        ) : trials.length === 0 ? (
          <div className="liquid-panel rounded-[24px] p-6 text-sm text-slate-600">No matching trial users found.</div>
        ) : trials.map((trial) => <TrialCard key={trial.id} trial={trial} />)}
      </section>

      {payload.privacy && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs leading-5 text-emerald-950"><ShieldCheck className="mr-1.5 inline size-4" />{payload.privacy}</div>}
    </div>
  );
}

function PlanTrialCard({ plan, value, onChange }: { plan: string; value: TrialSetting; onChange: (value: TrialSetting) => void }) {
  return <div className="data-entry-card rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-black text-slate-950">{plan} free trial</p><p className="mt-1 text-xs leading-5 text-slate-500">{value.enabled ? `${value.days} day${value.days === 1 ? "" : "s"} free, then monthly AutoPay` : "Trial is currently off"}</p></div><Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} /></div><div className="mt-4"><Label className="text-xs font-extrabold text-slate-700">Trial days</Label><Input type="number" min={1} max={30} className="data-entry mt-2 h-11" value={value.days} onChange={(event) => onChange({ ...value, days: Math.max(1, Math.min(30, Number(event.target.value) || 1)) })} /></div></div>;
}

function TrialCard({ trial }: { trial: TrialRecord }) {
  const badge = trial.converted ? "AutoPay paid" : trial.paymentRetrying ? "Payment retrying" : trial.paymentFailed ? "Payment failed" : trial.active ? "Trial active" : trial.endedUnpaid ? "Ended unpaid" : trial.status === "cancelled" ? "Cancelled" : humanize(trial.status);
  const badgeClass = trial.converted ? "bg-emerald-100 text-emerald-800" : trial.paymentRetrying ? "bg-amber-100 text-amber-800" : trial.paymentFailed ? "bg-red-100 text-red-800" : trial.active ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700";
  return <article className="liquid-panel rounded-[24px] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-black text-slate-950">{trial.name || "Unnamed user"}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${badgeClass}`}>{badge}</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-violet-700">{humanize(trial.plan)}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">{[formatPhone(trial.phone), trial.email, trial.city].filter(Boolean).join(" • ") || "No contact details"}</p></div><div className="text-right text-xs text-slate-500"><p>{trial.trialDays}-day trial</p><p className="mt-1">Ends {new Date(trial.trialEndsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Trial status" value={badge} helper={`Provider: ${humanize(trial.providerLastStatus ?? "not confirmed")}`} /><Metric label="AutoPay" value={humanize(trial.autoPayStatus)} helper={trial.convertedAt ? `Paid ${formatDateTime(trial.convertedAt)}` : trial.failedAt ? `Failed ${formatDateTime(trial.failedAt)}` : "Waiting for first post-trial charge"} /><Metric label="Started" value={trial.trialStartedAt ? formatDateTime(trial.trialStartedAt) : "Checkout pending"} helper={`Created ${formatDateTime(trial.createdAt)}`} /><Metric label="Identity" value={formatPhone(trial.phone) || "No mobile"} helper={trial.email || "No email"} /></div></article>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="data-entry-card rounded-2xl p-4"><p className="text-2xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>; }
function Metric({ label, value, helper }: { label: string; value: string; helper: string }) { return <div className="rounded-2xl border border-slate-200 bg-white/70 p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-slate-500">{label}</p><p className="mt-2 text-sm font-black text-slate-950">{value}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</p></div>; }
function humanize(value: string) { return value ? value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()) : "—"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
function formatPhone(phone: string | null) { const digits = phone?.replace(/\D/g, "") ?? ""; return digits.length === 12 && digits.startsWith("91") ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : phone ?? ""; }
