"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminUserRecord = {
  id: string;
  name: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  activeSessions: number;
  lastLoginAt: string | null;
  trackedLogins: number;
  lastAuthMethod: string | null;
  subscription: null | {
    provider: string;
    plan: string;
    status: string;
    currentPeriodEnd: number | null;
    updatedAt: string;
    active: boolean;
  };
  purchases: {
    hasActivePurchase: boolean;
    activeActionReports: number;
    activeActionReportPaidPaise: number;
    lastActionReportAt: string | null;
  };
};

type AdminUsersPayload = {
  users?: AdminUserRecord[];
  stats?: {
    totalRegistered: number;
    activeSessions: number;
    usersWithTrackedLogin: number;
    usersWithActivePurchase: number;
  };
  trackingNote?: string;
  privacy?: string;
  error?: string;
};

export function AdminUserManager() {
  const [payload, setPayload] = useState<AdminUsersPayload>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() as AdminUsersPayload }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error ?? "Users could not be loaded.");
        setPayload(body);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Users could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const users = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = payload.users ?? [];
    if (!query) return rows;
    return rows.filter((user) => [user.name, user.city, user.email, user.phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)));
  }, [payload.users, search]);

  const stats = payload.stats ?? { totalRegistered: 0, activeSessions: 0, usersWithTrackedLogin: 0, usersWithActivePurchase: 0 };

  return (
    <div className="space-y-5">
      <section className="liquid-panel rounded-[26px] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="liquid-button grid size-11 shrink-0 place-items-center rounded-2xl"><UserRound className="size-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">Accounts & billing</p>
              <h1 className="mt-1 text-xl font-black tracking-[-.03em] text-slate-950 sm:text-2xl">Users, logins & active purchases</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Registered account identity, recent authentication activity, active sessions and paid access in one place.</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-xl bg-white/70" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Registered users" value={stats.totalRegistered} />
          <Stat label="Active sessions" value={stats.activeSessions} />
          <Stat label="Users with sign-in activity" value={stats.usersWithTrackedLogin} />
          <Stat label="Users with active purchase" value={stats.usersWithActivePurchase} />
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="data-entry h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, mobile, email or city" />
        </div>
      </section>

      {payload.trackingNote && <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-950">{payload.trackingNote}</div>}

      <section className="space-y-3">
        {loading && !(payload.users?.length) ? (
          <div className="liquid-panel grid min-h-40 place-items-center rounded-[24px]"><Loader2 className="size-6 animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <div className="liquid-panel rounded-[24px] p-6 text-sm text-slate-600">No matching users found.</div>
        ) : users.map((user) => <UserCard key={user.id} user={user} />)}
      </section>

      {payload.privacy && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs leading-5 text-emerald-950"><ShieldCheck className="mr-1.5 inline size-4" />{payload.privacy}</div>}
    </div>
  );
}

function UserCard({ user }: { user: AdminUserRecord }) {
  const subscription = user.subscription;
  return (
    <article className="liquid-panel rounded-[24px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black text-slate-950">{user.name || "Unnamed user"}</h2>
            {user.purchases.hasActivePurchase && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-emerald-800">Paid access</span>}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{[formatPhone(user.phone), user.email, user.city].filter(Boolean).join(" • ") || "No public profile details"}</p>
        </div>
        <div className="text-right text-xs text-slate-500"><p>Joined {formatDate(user.createdAt)}</p><p className="mt-1">Last login {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "not tracked yet"}</p></div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Tracked sign-ins" value={String(user.trackedLogins)} helper={authMethodLabel(user.lastAuthMethod)} />
        <Metric label="Active sessions" value={String(user.activeSessions)} helper="Unexpired SellerHisab sessions" />
        <Metric label="Subscription" value={subscription ? `${capitalize(subscription.plan)} · ${capitalize(subscription.status)}` : "None"} helper={subscription?.currentPeriodEnd ? `Through ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN")}` : subscription?.provider ?? "No active recurring plan"} />
        <Metric label="Action reports" value={String(user.purchases.activeActionReports)} helper={user.purchases.activeActionReportPaidPaise > 0 ? `${formatRupees(user.purchases.activeActionReportPaidPaise)} linked paid access` : "No active one-time report"} />
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="data-entry-card rounded-2xl p-4"><p className="text-2xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white/70 p-4"><p className="text-[10px] font-black uppercase tracking-[.1em] text-slate-500">{label}</p><p className="mt-2 text-sm font-black text-slate-950">{value}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</p></div>;
}

function formatPhone(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone ?? "";
}
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-IN"); }
function formatDateTime(value: string) { return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
function formatRupees(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100); }
function capitalize(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value; }
function authMethodLabel(method: string | null) {
  if (method === "msg91_otp") return "Last: mobile OTP";
  if (method === "password_phone") return "Last: mobile + password";
  if (method === "password_email") return "Last: email + password";
  return "Tracking starts with this release";
}
