"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Clock3,
  Cable,
  CircleCheck,
  CircleDashed,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  History,
  LayoutDashboard,
  Landmark,
  Loader2,
  Megaphone,
  MessageCircleQuestion,
  LogOut,
  PackageOpen,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  UserX,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "./brand";
import { AuthScreen, type AuthUser } from "./auth-screen";
import { formatIndiaMobile } from "@/core/auth/phone";
import { mergeSavedCosts, syncableSavedCosts } from "@/core/account/saved-costs";
import { clearLocalData, localDb, type SavedCost } from "@/core/storage/local-db";
import { formatInr } from "@/core/money";
import type { AnalysisResult } from "@/core/types";
import { PlanSubscribeButton } from "@/components/dashboard/plan-subscribe-button";
import { PlanTierIcon } from "@/components/plan-tier-icon";
import { ProPlanLock } from "./pro-plan-lock";
import { displayRupees, usePricing } from "./use-pricing";
import { CashWorkspaceView } from "./cash-workspace";
import { AdsWorkspaceView } from "./ads-workspace";
import { InventoryWorkspaceView } from "./inventory-workspace";
import { WorkspaceView } from "./workspace-view";
import { AskSellerHisabView } from "./ask-sellerhisab-view";

type User = AuthUser;
type HistoryItem = {
  id: string;
  label: string;
  parserVersion: string;
  engineVersion: string;
  createdAt: string;
  summary: {
    confirmedContributionPaise: number;
    provisionalContributionPaise: number;
    stillAtRiskPaise: number;
    lossMakingSkus: number;
    qualityScore: number;
    qualityStatus: string;
    skuCount: number;
    orderCount: number;
  };
};
type AccountAlert = { id: string; type: string; message: string; status: string; createdAt: string };
type SellerProfile = { id: string; name: string; createdAt: string };

export function AccountWorkspace({ view }: { view: "overview" | "connections" | "history" | "costs" | "ads" | "inventory" | "cash" | "workspace" | "ask" | "settings" | "billing" }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [costs, setCosts] = useState<SavedCost[]>([]);
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisResult | null>(null);
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as { user?: User | null } }))
      .then(({ response, payload }) => { if (active) setUser(response.ok ? payload.user ?? null : null); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const db = localDb();
    db.costs.toArray().then(setCosts).catch(() => setCosts([]));
    if (user) {
      fetch("/api/account/analyses", { cache: "no-store" }).then(async (response) => await response.json() as { analyses?: HistoryItem[] }).then((payload) => setHistory(payload.analyses ?? [])).catch(() => setHistory([]));
      fetch("/api/account/alerts", { cache: "no-store" }).then(async (response) => await response.json() as { alerts?: AccountAlert[] }).then((payload) => setAlerts(payload.alerts ?? [])).catch(() => setAlerts([]));
      Promise.all([
        db.costs.toArray(),
        fetch("/api/account/costs", { cache: "no-store" })
          .then(async (response) => response.ok ? await response.json() as { costs?: SavedCost[] } : { costs: [] })
          .then((payload) => payload.costs ?? []),
      ]).then(async ([localCosts, remoteCosts]) => {
        const merged = mergeSavedCosts(localCosts, remoteCosts);
        setCosts(merged);
        if (merged.length) await db.costs.bulkPut(merged);
      }).catch(() => undefined);
    }
    const saveId = new URLSearchParams(window.location.search).get("save");
    if (saveId) db.analyses.get(saveId).then((saved) => setLocalAnalysis(saved?.result ?? null));
  }, [user]);

  if (user === undefined) return <div className="app-wallpaper grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (!user) return <AuthScreen onSignedIn={(signedInUser) => {
    setUser(signedInUser);
    const returnTo = getSafeReturnTo();
    if (returnTo) window.location.assign(returnTo);
  }} />;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function saveAnalysis() {
    if (!localAnalysis) return;
    setLoading(true);
    const response = await fetch("/api/account/analyses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: localAnalysis.id,
        label: `Analysis ${new Date(localAnalysis.createdAt).toLocaleDateString("en-IN")}`,
        createdAt: localAnalysis.createdAt,
        parserVersion: localAnalysis.parserVersion,
        engineVersion: localAnalysis.engineVersion,
        summary: {
          confirmedContributionPaise: localAnalysis.confirmedContributionPaise,
          provisionalContributionPaise: localAnalysis.provisionalContributionPaise,
          stillAtRiskPaise: localAnalysis.stillAtRiskPaise,
          lossMakingSkus: localAnalysis.lossMakingSkus,
          needsReviewCount: localAnalysis.needsReviewCount,
          qualityScore: localAnalysis.qualityScore,
          qualityStatus: localAnalysis.qualityStatus,
          skuCount: localAnalysis.skus.length,
          orderCount: localAnalysis.orders.length,
          missingCostCount: localAnalysis.findings.filter((finding) => finding.code === "missing-product-cost" || finding.code === "missing-packaging").reduce((sum, finding) => sum + finding.count, 0),
        },
      }),
    });
    const entitlementToken = localStorage.getItem(`smg-entitlement:${localAnalysis.id}`);
    if (entitlementToken) {
      await fetch("/api/entitlements/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId: localAnalysis.id, token: entitlementToken }),
      }).catch(() => undefined);
    }
    setLoading(false);
    if (!response.ok) { const payload = await response.json() as { error?: string }; toast.error(payload.error ?? "Analysis could not be saved."); return; }
    try {
      const accountCosts = syncableSavedCosts(await localDb().costs.toArray());
      if (accountCosts.length) {
        await fetch("/api/account/costs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ costs: accountCosts }),
        });
      }
    } catch {
      // Analysis history is already saved; a later analysis can retry cost sync.
    }
    toast.success("Derived analysis summary saved. Raw report was not uploaded.");
    window.history.replaceState({}, "", "/app");
    setLocalAnalysis(null);
    const updated = await fetch("/api/account/analyses").then((item) => item.json()) as { analyses?: HistoryItem[] };
    setHistory(updated.analyses ?? []);
    const updatedAlerts = await fetch("/api/account/alerts").then((item) => item.json()) as { alerts?: AccountAlert[] };
    setAlerts(updatedAlerts.alerts ?? []);
  }

  return (
    <div className="app-wallpaper min-h-screen md:grid md:grid-cols-[245px_1fr]">
      <aside className="glass-nav m-3 hidden min-h-[calc(100vh-1.5rem)] rounded-[24px] p-5 md:block">
        <Brand />
        <nav className="mt-9 space-y-1" aria-label="Account navigation">
          <AccountLink href="/app" icon={LayoutDashboard} label="Overview" />
          <AccountLink href="/app/connections" icon={Cable} label="Connections" />
          <AccountLink href="/app/history" icon={History} label="History" />
          <AccountLink href="/app/costs" icon={Database} label="Saved costs" />
          <AccountLink href="/app/ads" icon={Megaphone} label="Ads & Marketing" />
          <AccountLink href="/app/inventory" icon={PackageOpen} label="Inventory" />
          <AccountLink href="/app/cash" icon={Landmark} label="Bank & Cash" />
          <AccountLink href="/app/workspace" icon={UsersRound} label="Workspace" />
          <AccountLink href="/app/ask" icon={MessageCircleQuestion} label="Ask SellerHisab" />
          <AccountLink href="/app/billing" icon={CreditCard} label="Billing" />
          <AccountLink href="/app/settings" icon={Settings} label="Settings" />
          {user.isAdmin && <AccountLink href="/admin" icon={ShieldCheck} label="Website admin" />}
        </nav>
        <div className="mt-8 border-t border-slate-200 pt-5"><p className="truncate text-xs font-bold text-slate-700">{user.email ?? formatIndiaMobile(user.phone)}</p><Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-slate-500" onClick={logout}><LogOut className="mr-2 size-4" />Sign out</Button></div>
      </aside>
      <div>
        <header className="glass-nav mx-3 mt-3 flex h-16 items-center justify-between rounded-[20px] px-4 sm:px-6 md:hidden"><Brand compact /><p className="truncate text-xs font-bold text-slate-600">{user.email ?? formatIndiaMobile(user.phone)}</p><Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="size-4" /></Button></header>
        <main className="mx-auto max-w-6xl px-4 py-7 pb-24 sm:px-6 lg:px-10 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><span>Account</span><ChevronRight className="size-3" /><span className="capitalize text-slate-900">{view}</span></div>{user.isAdmin && <Button asChild variant="outline" size="sm" className="rounded-xl bg-white/70"><Link href="/admin"><ShieldCheck className="mr-1.5 size-4" />Website Admin</Link></Button>}</div>
          {localAnalysis && <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-slate-950">Current analysis is ready to save</p><p className="mt-1 text-xs leading-5 text-slate-600">Only derived summary totals are sent. Raw files, order IDs and SKU rows stay local.</p></div><Button onClick={saveAnalysis} disabled={loading} className="bg-blue-600 font-bold">{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save summary</Button></div>}
          {view === "overview" && <Overview user={user} history={history} costs={costs} alerts={alerts} />}
          {view === "connections" && <ConnectionsView />}
          {view === "history" && <HistoryView history={history} />}
          {view === "costs" && <CostsView costs={costs} />}
          {view === "ads" && <AdsWorkspaceView />}
          {view === "inventory" && <InventoryWorkspaceView />}
          {view === "cash" && <CashWorkspaceView />}
          {view === "workspace" && <WorkspaceView />}
          {view === "ask" && <AskSellerHisabView />}
          {view === "settings" && <SettingsView onCleared={() => setCosts([])} />}
          {view === "billing" && <BillingView user={user} />}
        </main>
        <nav className="glass-nav fixed inset-x-2 bottom-2 z-30 grid grid-cols-5 rounded-2xl pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Account mobile navigation">
          <MobileAccountLink href="/app" icon={LayoutDashboard} label="Home" />
          <MobileAccountLink href="/app/history" icon={History} label="History" />
          <MobileAccountLink href="/app/cash" icon={Landmark} label="Cash" />
          <MobileAccountLink href="/app/ask" icon={MessageCircleQuestion} label="Ask" />
          <MobileAccountLink href="/app/settings" icon={Settings} label="More" />
        </nav>
      </div>
    </div>
  );
}

function Overview({ user, history, costs, alerts }: { user: User; history: HistoryItem[]; costs: SavedCost[]; alerts: AccountAlert[] }) {
  return <div className="mt-6"><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Welcome back</h1><p className="mt-2 text-sm text-slate-500">{user.email ?? formatIndiaMobile(user.phone)}</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><SummaryCard icon={History} label="Saved analyses" value={String(history.length)} /><SummaryCard icon={Database} label="Saved SKU costs" value={String(costs.length)} /><SummaryCard icon={Bell} label="Open alerts" value={String(alerts.length)} /></div>{alerts.length > 0 && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-extrabold text-amber-950">Needs your attention</h2><ul className="mt-3 space-y-2">{alerts.slice(0, 5).map((alert) => <li key={alert.id} className="flex gap-2 text-sm leading-6 text-amber-900"><Bell className="mt-1 size-4 shrink-0" />{alert.message}</li>)}</ul></div>}<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-slate-950">Your saved SellerHisab data</h2><p className="mt-2 text-sm leading-6 text-slate-600">Use the normal SellerHisab website for Profit Check, calculators, pricing, blog and other features. This account area only keeps your saved analyses, costs, purchases and settings together.</p><div className="mt-5 flex flex-wrap gap-2"><Button asChild className="bg-blue-600 font-bold"><Link href="/">Back to SellerHisab</Link></Button><Button asChild variant="outline"><Link href="/app/history"><History className="mr-2 size-4" />Saved history</Link></Button></div></div></div>;
}


type ConnectorHealthItem = {
  connectorId: string;
  channelId: string;
  label: string;
  priority: string;
  runtimeStatus: "live" | "partial" | "mapper-ready" | "planned";
  accountStatus: "not-connected" | "connected" | "degraded" | "disabled";
  orders: string;
  settlements: string;
  authorization: string;
  enabledCapabilities: string[];
  grantedScopes: string[];
  apiConfigured: boolean;
  connectionMode: string | null;
  externalAccountDisplayName: string | null;
  lastSuccessAt?: string;
  lastError?: string;
  latestSync: {
    status: string;
    coverageStart: string | null;
    coverageEnd: string | null;
    orderCount: number;
    financialRecordCount: number;
    issueCount: number;
    completedAt: string | null;
    errorCode: string | null;
  } | null;
  retryJob?: { status: string; nextAttemptAt: string | null; attemptCount: number; maxAttempts: number } | null;
};

function ConnectionsView() {
  const [connections, setConnections] = useState<ConnectorHealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyConnector, setBusyConnector] = useState<string | null>(null);
  const [shop, setShop] = useState("");
  const [wooStoreUrl, setWooStoreUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account/connections", { cache: "no-store" });
    const payload = await response.json() as { connections?: ConnectorHealthItem[]; error?: string; requiredPlan?: string };
    if (response.status === 402) {
      setPlanLocked(true);
      setLoadError(false);
      setConnections([]);
      return;
    }
    if (!response.ok) throw new Error(payload.error ?? "Connection health could not be loaded.");
    setPlanLocked(false);
    setLoadError(false);
    setConnections(payload.connections ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      refresh()
        .catch(() => { if (active) { setConnections([]); setLoadError(true); } })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    const status = params.get("status");
    if (message) {
      if (status === "connected") toast.success(message);
      else toast.error(message);
      window.history.replaceState({}, "", window.location.pathname);
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>setLoadError(true));},15000);return ()=>window.clearInterval(timer);},[refresh]);

  async function authorizeWooCommerce(){
   setBusyConnector('woocommerce-v1');
   try{const response=await fetch('/api/account/connections/woocommerce/authorize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeUrl:wooStoreUrl})});const payload=await response.json() as {authorizationUrl?:string;error?:string};if(!response.ok||!payload.authorizationUrl)throw Error(payload.error||'Authorization failed.');window.location.assign(payload.authorizationUrl);}
   catch(error){toast.error(error instanceof Error?error.message:'Authorization failed.');setBusyConnector(null);}
  }

  async function connect(item: ConnectorHealthItem) {
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId, shop: item.connectorId === "shopify-v1" ? shop : undefined }),
      });
      const payload = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error ?? "Marketplace authorization could not be started.");
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Marketplace authorization could not be started.");
      setBusyConnector(null);
    }
  }

  async function connectWooCommerce(item: ConnectorHealthItem) {
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/woocommerce/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeUrl: wooStoreUrl, consumerKey: wooConsumerKey, consumerSecret: wooConsumerSecret }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "WooCommerce connection failed.");
      setWooConsumerSecret("");
      toast.success("WooCommerce read-only API connected.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "WooCommerce connection failed.");
    } finally {
      setBusyConnector(null);
    }
  }

  async function sync(item: ConnectorHealthItem) {
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId, days: 30 }),
      });
      const payload = await response.json() as { jobId?: string; status?: string; summary?: { orderCount: number; financialRecordCount: number; warning?: string }; error?: string };
      if (response.status === 202 && payload.jobId) { toast.info(`${item.label}: sync queued. Connection health shows progress; you can leave this page.`); await refresh(); return; }
      if (!response.ok || !payload.summary) throw new Error(payload.error ?? "Marketplace sync failed.");
      const summary = payload.summary;
      toast.success(`${item.label}: ${summary.orderCount} order rows and ${summary.financialRecordCount} finance records synced.`);
      if (summary.warning) toast.warning(summary.warning);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Marketplace sync failed.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyConnector(null);
    }
  }

  async function disconnect(item: ConnectorHealthItem) {
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId }),
      });
      const payload = await response.json() as { disconnected?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Marketplace could not be disconnected.");
      toast.success(`${item.label} disconnected. Stored API tokens were removed.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Marketplace could not be disconnected.");
    } finally {
      setBusyConnector(null);
    }
  }

  const statusLabel = (item: ConnectorHealthItem) => {
    if (item.accountStatus === "connected") return "API connected";
    if (item.accountStatus === "degraded") return "API needs attention";
    if (item.connectorId === "meesho-file-v1") return "File-first";
    if (item.apiConfigured) return "Ready to connect";
    if (item.connectorId === "woocommerce-v1") return "Connector setup unavailable";
    return "Files live • API setup pending";
  };

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Marketplace connections</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Files remain available on the normal Analyze page. Where official access is configured, connect your own seller account for read-only order and finance sync.
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/analyze">Analyze a file</Link></Button>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        <span className="font-extrabold">Credential rule:</span> Never paste a marketplace password into SellerHisab. Official OAuth/API tokens are encrypted at rest, requested with read-only scopes, and removed when you disconnect.
      </div>

      {loading ? (
        <div className="mt-6 grid place-items-center rounded-2xl border border-slate-200 bg-white py-16"><Loader2 className="size-5 animate-spin text-blue-600" /></div>
      ) : planLocked ? (
        <div className="mt-6"><ProPlanLock title="Official marketplace connections are a Pro feature" description="Connect and sync supported marketplace accounts only after Pro is active. File analysis remains available without exposing marketplace passwords." secondaryHref="/analyze" secondaryLabel="Analyze a file" /></div>
      ) : loadError ? (
        <EmptyState title="Connection health temporarily unavailable" text="Your plan is fine, but connection status could not be loaded right now. Refresh and try again; file analysis remains available." />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {connections.map((item) => {
            const connected = item.accountStatus === "connected";
            const attention = item.accountStatus === "degraded";
            const fileBased = item.connectorId === "meesho-file-v1" || (!connected && !attention && item.enabledCapabilities.length > 0);
            const apiConnector = item.connectorId !== "meesho-file-v1";
            const busy = busyConnector === item.connectorId;
            const iconTone = connected
              ? "bg-emerald-50 text-emerald-700"
              : attention
                ? "bg-red-50 text-red-700"
                : fileBased
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-500";
            const badgeTone = connected
              ? "bg-emerald-50 text-emerald-700"
              : attention
                ? "bg-red-50 text-red-700"
                : item.apiConfigured
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600";
            return (
              <article key={item.connectorId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`grid size-10 place-items-center rounded-xl ${iconTone}`}>
                      {connected ? <CircleCheck className="size-5" /> : <CircleDashed className="size-5" />}
                    </span>
                    <div>
                      <h2 className="font-extrabold text-slate-950">{item.label}</h2>
                      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[.08em] text-slate-400">{item.priority} • {item.connectorId}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${badgeTone}`}>{statusLabel(item)}</span>
                </div>

                {item.externalAccountDisplayName && <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Connected account: {item.externalAccountDisplayName}</p>}

                <div className="mt-5 grid gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase text-slate-400">Orders</p><p className="mt-1 font-bold leading-5 text-slate-700">{item.orders}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase text-slate-400">Money / settlement</p><p className="mt-1 font-bold leading-5 text-slate-700">{item.settlements}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase text-slate-400">Connection requirement</p><p className="mt-1 leading-5 text-slate-600">{item.authorization}</p></div>
                </div>

                {item.latestSync && (
                  <div className="mt-4 rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-extrabold text-slate-800">Latest API sync</span><span className="font-bold uppercase text-slate-500">{item.latestSync.status}</span></div>
                    <p className="mt-2">{item.latestSync.orderCount} order rows • {item.latestSync.financialRecordCount} finance records • {item.latestSync.issueCount} parser issues</p>
                    {item.latestSync.completedAt && <p className="mt-1 text-slate-400">Completed {new Date(item.latestSync.completedAt).toLocaleString("en-IN")}</p>}
                  </div>
                )}

                {item.enabledCapabilities.length > 0 && <p className="mt-4 text-xs leading-5 text-slate-500"><span className="font-extrabold text-slate-700">Enabled now:</span> {item.enabledCapabilities.join(", ")}</p>}
                {item.grantedScopes.length > 0 && <p className="mt-1 text-xs leading-5 text-slate-500"><span className="font-extrabold text-slate-700">Granted scopes:</span> {item.grantedScopes.join(", ")}</p>}
                {item.lastSuccessAt && <p className="mt-2 text-xs text-emerald-700">Last successful sync: {new Date(item.lastSuccessAt).toLocaleString("en-IN")}</p>}
                {item.lastError && <p className="mt-2 text-xs font-semibold text-red-700">{item.lastError}</p>}

                {item.connectorId === "shopify-v1" && !connected && item.apiConfigured && (
                  <div className="mt-4">
                    <Input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="your-store.myshopify.com" aria-label="Shopify store domain" />
                  </div>
                )}
                {item.connectorId === "woocommerce-v1" && !connected && item.apiConfigured && (
                  <div className="mt-4 grid gap-2">
                    <Input value={wooStoreUrl} onChange={(event) => setWooStoreUrl(event.target.value)} placeholder="https://store.example.com" aria-label="WooCommerce store URL" inputMode="url" />
                    <Input value={wooConsumerKey} onChange={(event) => setWooConsumerKey(event.target.value)} placeholder="ck_... (Read permission)" aria-label="WooCommerce consumer key" autoComplete="off" />
                    <Input type="password" value={wooConsumerSecret} onChange={(event) => setWooConsumerSecret(event.target.value)} placeholder="cs_..." aria-label="WooCommerce consumer secret" autoComplete="new-password" />
                    <p className="text-[11px] leading-5 text-slate-500">Generate a WooCommerce REST API key with <span className="font-extrabold">Read</span> permission. SellerHisab does not ask for your WordPress password and never puts the secret in a URL.</p>
                  </div>
                )}

                {item.retryJob && ["queued", "processing", "retryable_failed", "dead_letter"].includes(item.retryJob.status) && <p className={`mt-3 text-xs font-semibold ${item.retryJob.status === "dead_letter" ? "text-red-700" : "text-amber-700"}`}>{item.retryJob.status === "dead_letter" ? `Automatic retry stopped after ${item.retryJob.attemptCount} attempt(s). Reconnect or contact support.` : item.retryJob.status === "retryable_failed" ? `Sync retry is scheduled${item.retryJob.nextAttemptAt ? ` after ${new Date(item.retryJob.nextAttemptAt).toLocaleString("en-IN")}` : ""} (${item.retryJob.attemptCount}/${item.retryJob.maxAttempts}).` : "Sync is durably queued/processing."}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {apiConnector && item.connectorId !== "woocommerce-v1" && !connected && !attention && item.apiConfigured && <Button onClick={() => connect(item)} disabled={busy || (item.connectorId === "shopify-v1" && shop.trim().length < 3)} className="bg-blue-600 font-bold">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Connect official API</Button>}
                  {apiConnector && item.connectorId !== "woocommerce-v1" && attention && item.apiConfigured && <Button onClick={() => connect(item)} disabled={busy || (item.connectorId === "shopify-v1" && shop.trim().length < 3)} variant="outline">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Reconnect</Button>}
                  {item.connectorId === "woocommerce-v1" && !connected && item.apiConfigured && <Button onClick={authorizeWooCommerce} disabled={busy || wooStoreUrl.trim().length < 8}>Authorize read-only access</Button>}
                  {item.connectorId === "woocommerce-v1" && !connected && !attention && item.apiConfigured && <Button onClick={() => connectWooCommerce(item)} disabled={busy || wooStoreUrl.trim().length < 8 || wooConsumerKey.trim().length < 20 || wooConsumerSecret.trim().length < 20} className="bg-blue-600 font-bold">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Connect using advanced API keys</Button>}
                  {item.connectorId === "woocommerce-v1" && attention && item.apiConfigured && <Button onClick={() => connectWooCommerce(item)} disabled={busy || wooStoreUrl.trim().length < 8 || wooConsumerKey.trim().length < 20 || wooConsumerSecret.trim().length < 20} variant="outline">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Reconnect with Read key</Button>}
                  {apiConnector && (connected || attention) && item.apiConfigured && <Button onClick={() => sync(item)} disabled={busy} className="bg-blue-600 font-bold">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Sync last 30 days</Button>}
                  {apiConnector && (connected || attention) && <Button onClick={() => disconnect(item)} disabled={busy} variant="outline" className="text-red-700"><LogOut className="mr-2 size-4" />Disconnect</Button>}
                  {apiConnector && item.connectorId !== "woocommerce-v1" && !item.apiConfigured && !connected && !attention && <Button asChild variant="outline"><Link href="/analyze">Use file analysis</Link></Button>}
                  {item.connectorId === "meesho-file-v1" && <Button asChild variant="outline"><Link href="/analyze">Analyze Meesho files</Link></Button>}
                </div>

                {apiConnector && item.connectorId !== "woocommerce-v1" && !item.apiConfigured && <p className="mt-3 text-xs leading-5 text-amber-700">Official API buttons will unlock only after SellerHisab&apos;s marketplace app credentials are configured. File analysis is already live.</p>}
                {item.connectorId === "woocommerce-v1" && !item.apiConfigured && <p className="mt-3 text-xs leading-5 text-amber-700">WooCommerce connection requires SellerHisab connector encryption to be configured. WooCommerce file analysis is not claimed in F11.</p>}
              </article>
            );
          })}
        </div>
      )}

      {!loading && connections.length === 0 && <EmptyState title="Connection health unavailable" text="Try again after refreshing. File analysis remains separate and local." />}
    </div>
  );
}

function HistoryView({ history }: { history: HistoryItem[] }) {
  return <div className="mt-6"><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Analysis history</h1><p className="mt-2 text-sm text-slate-500">Only explicitly saved derived summaries. Raw rows are not stored.</p><div className="mt-6 space-y-3">{history.length ? history.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-slate-900">{item.label}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-IN")} • {item.summary.orderCount} orders • {item.summary.skuCount} SKUs</p></div><div className="grid grid-cols-3 gap-4 text-right"><Mini label="Confirmed" value={formatInr(item.summary.confirmedContributionPaise)} /><Mini label="At risk" value={formatInr(item.summary.stillAtRiskPaise)} /><Mini label="Quality" value={`${item.summary.qualityScore}/100`} /></div></div></article>) : <EmptyState title="No saved analyses" text="Analyze a report, see the result, then choose Save this analysis." />}</div></div>;
}

function CostsView({ costs }: { costs: SavedCost[] }) {
  return <div className="mt-6"><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Saved SKU costs</h1><p className="mt-2 text-sm text-slate-500">This list is stored on this browser device.</p><div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{costs.length ? <><div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-left text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-500"><tr>{["SKU", "Product cost", "Packaging", "Other variable", "Updated"].map((head) => <th key={head} className="px-5 py-4">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{costs.map((cost) => <tr key={cost.sku}><td className="px-5 py-4 font-extrabold text-slate-900">{cost.sku}</td><td className="px-5 py-4 tabular-nums">{formatInr(cost.productCostPaise)}</td><td className="px-5 py-4 tabular-nums">{formatInr(cost.packagingCostPaise)}</td><td className="px-5 py-4 tabular-nums">{formatInr(cost.variableCostPaise)}</td><td className="px-5 py-4 text-xs text-slate-500">{new Date(cost.updatedAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div><div className="divide-y divide-slate-100 sm:hidden">{costs.map((cost) => <article key={cost.sku} className="p-4"><p className="break-all text-sm font-extrabold text-slate-900">{cost.sku}</p><div className="mt-3 grid grid-cols-2 gap-3"><Mini label="Product" value={formatInr(cost.productCostPaise)} /><Mini label="Packaging" value={formatInr(cost.packagingCostPaise)} /><Mini label="Other" value={formatInr(cost.variableCostPaise)} /><Mini label="Updated" value={new Date(cost.updatedAt).toLocaleDateString("en-IN")} /></div></article>)}</div></> : <EmptyState title="No saved costs" text="Select Reuse costs on this device during analysis." />}</div></div>;
}

function SettingsView({ onCleared }: { onCleared: () => void }) {
  const [deletePhrase, setDeletePhrase] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  async function downloadAccountData() {
    setAccountBusy(true); setAccountMessage("");
    try {
      const response = await fetch("/api/account/data", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Account export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sellerhisab-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setAccountMessage("Account export downloaded. Connector secrets are intentionally excluded.");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Account export failed.");
    } finally { setAccountBusy(false); }
  }

  async function deleteAccount() {
    setAccountBusy(true); setAccountMessage("");
    try {
      const response = await fetch("/api/account/data", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: deletePhrase }) });
      const payload = await response.json() as { ok?: boolean; receiptId?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Account deletion failed.");
      await clearLocalData().catch(() => undefined);
      window.location.assign(`/?accountDeleted=${encodeURIComponent(payload.receiptId ?? "completed")}`);
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Account deletion failed.");
      setAccountBusy(false);
    }
  }

  return <div className="mt-6"><h1 className="text-2xl font-extrabold tracking-[-.035em] text-slate-950">Privacy & settings</h1>
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-extrabold text-slate-950">Local browser data</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Local analysis snapshots and approved product mappings use IndexedDB on this device. Signed-in SKU costs may also have an account copy. Clearing Local Data removes only this browser copy; it does not delete account history, purchases or account-saved costs.</p><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="mt-5"><Trash2 className="mr-2 size-4" />Clear Local Data</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear all local data?</AlertDialogTitle><AlertDialogDescription>Saved SKU costs, local analysis snapshots, approved product mappings and entitlement tokens on this device will be removed. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={async () => { await clearLocalData(); onCleared(); toast.success("Local browser data cleared."); }} className="bg-red-600 hover:bg-red-700">Clear data</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:hidden"><h2 className="font-extrabold text-slate-950">More account tools</h2><div className="mt-4 grid grid-cols-2 gap-2"><Button asChild variant="outline"><Link href="/app/connections">Connections</Link></Button><Button asChild variant="outline"><Link href="/app/costs">Saved costs</Link></Button><Button asChild variant="outline"><Link href="/app/ads">Ads</Link></Button><Button asChild variant="outline"><Link href="/app/inventory">Inventory</Link></Button><Button asChild variant="outline"><Link href="/app/workspace">Workspace</Link></Button><Button asChild variant="outline"><Link href="/app/billing">Billing</Link></Button></div></div>
    <ProfilesManager />
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-extrabold text-slate-950">Your account data</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Download the server-side data associated with your account and owner workspaces. Raw normal-analysis files and connector secrets are not in the export because SellerHisab does not expose them from account storage.</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={downloadAccountData} disabled={accountBusy}>{accountBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Download account data</Button></div>{accountMessage && <p role="status" className="mt-3 text-xs font-semibold text-slate-600">{accountMessage}</p>}</div>
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-extrabold text-red-950">Delete SellerHisab account</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-red-900">Deletion removes your sessions, saved analyses/costs and sole-owner workspace operational data, including stored connector credentials and normalized Bank/Ads/Inventory data. Payment, billing and dispute/audit records may be retained in pseudonymized form where required. If your owner workspace has other members, deletion is blocked until you remove them.</p><Label htmlFor="delete-account-confirmation" className="mt-4 block text-xs font-extrabold text-red-950">Type DELETE MY SELLERHISAB ACCOUNT</Label><Input id="delete-account-confirmation" className="mt-2 max-w-md bg-white" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} autoComplete="off" /><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="mt-4" disabled={accountBusy || deletePhrase !== "DELETE MY SELLERHISAB ACCOUNT"}><UserX className="mr-2 size-4" />Delete account</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Permanently delete your SellerHisab account?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Active Razorpay subscriptions must be cancelled successfully before deletion proceeds. Download your data first if you need a copy.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep account</AlertDialogCancel><AlertDialogAction onClick={deleteAccount} className="bg-red-600 hover:bg-red-700">Delete permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-extrabold text-slate-950">What account stores</h2><ul className="mt-3 space-y-2 text-sm text-slate-600"><li>• Verified mobile number and/or email plus session metadata</li><li>• Payment/entitlement and subscription metadata</li><li>• Derived analysis summaries and reusable SKU cost inputs</li><li>• Normalized bank, Ads and Inventory rows you explicitly save; their raw files remain local to the browser</li><li>• Encrypted official marketplace API credentials and normalized connector ledger rows only when you connect/sync an account; never marketplace passwords</li><li>• Ask SellerHisab audit stores the classified intent and a one-way question hash, not the free-form question text</li><li>• Benchmark contribution is opt-in and publication is privacy-gated; never SKU, campaign, order or bank-row details</li><li>• Normal analysis does not send raw marketplace files, customer addresses or customer phone numbers to account storage</li></ul></div>
  </div>;
}

function ProfilesManager() {
  const [profiles, setProfiles] = useState<SellerProfile[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const refresh = useCallback(() => fetch("/api/account/profiles", { cache: "no-store" }).then(async (response) => await response.json() as { profiles?: SellerProfile[] }).then((payload) => setProfiles(payload.profiles ?? [])).catch(() => setProfiles([])), []);
  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);
  async function create() {
    const response = await fetch("/api/account/profiles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setMessage(payload.error ?? "Profile could not be created."); return; }
    setName(""); setMessage(""); await refresh();
  }
  async function remove(id: string) { await fetch("/api/account/profiles", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); await refresh(); }
  return <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-extrabold text-slate-950">Seller profiles</h2><p className="mt-2 text-sm leading-6 text-slate-600">Organize seller profiles without sharing marketplace passwords. Official read-only account connections are available only through configured and approved connector routes.</p><div className="mt-4 flex max-w-lg gap-2"><Input aria-label="Seller profile name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Main Catalog" maxLength={60} /><Button onClick={create} disabled={name.trim().length < 2}><Plus className="mr-1.5 size-4" />Add</Button></div>{message && <p role="alert" className="mt-3 text-xs font-semibold text-amber-700">{message}</p>}<div className="mt-4 space-y-2">{profiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><div><p className="text-sm font-extrabold text-slate-800">{profile.name}</p><p className="mt-1 text-[11px] text-slate-500">Created {new Date(profile.createdAt).toLocaleDateString("en-IN")}</p></div><Button variant="ghost" size="sm" onClick={() => remove(profile.id)} className="text-red-700">Remove</Button></div>)}</div></div>;
}

type BillingSubscription = {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd?: boolean;
  providerVerifiedAt?: string | null;
  open?: boolean;
  needsAttention?: boolean;
  createdAt: string;
  updatedAt: string;
};

type BillingTrial = {
  plan: string;
  status: string;
  autoPayStatus: string;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: number;
  active: boolean;
  convertedAt: string | null;
  failedAt: string | null;
};

type BillingPaymentEvent = {
  providerPaymentId: string;
  eventType: string;
  amountPaise: number | null;
  currency: string | null;
  status: string;
  occurredAt: string;
};

type LatestActionReportPayment = {
  amountPaise: number;
  currency: string;
  status: string;
  providerStatus: string | null;
  providerVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BillingStatusPayload = {
  activePlan?: string;
  subscription?: BillingSubscription | null;
  trial?: BillingTrial | null;
  billingActivity?: {
    recurringPayments?: BillingPaymentEvent[];
    recurringPaymentCount?: number;
    latestActionReport?: LatestActionReportPayment | null;
  };
};

function BillingView({ user }: { user: User }) {
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [trial, setTrial] = useState<BillingTrial | null>(null);
  const [activePlan, setActivePlan] = useState<string>("free");
  const [trialOffers, setTrialOffers] = useState<{ starter: { enabled: boolean; days: number }; pro: { enabled: boolean; days: number } }>({ starter: { enabled: false, days: 3 }, pro: { enabled: false, days: 3 } });
  const [billingActivity, setBillingActivity] = useState<{ recurringPayments: BillingPaymentEvent[]; recurringPaymentCount: number; latestActionReport: LatestActionReportPayment | null }>({ recurringPayments: [], recurringPaymentCount: 0, latestActionReport: null });
  const [billingMessage, setBillingMessage] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pricing = usePricing();

  const refresh = useCallback(() => Promise.all([
    fetch("/api/billing/status", { cache: "no-store" }).then(async (response) => await response.json() as BillingStatusPayload),
    fetch("/api/config/trials", { cache: "no-store" }).then(async (response) => response.ok ? await response.json() as { starter?: { enabled: boolean; days: number }; pro?: { enabled: boolean; days: number } } : {}),
  ]).then(([billing, offers]) => {
    setSubscription(billing.subscription ?? null);
    setTrial(billing.trial ?? null);
    setActivePlan(billing.activePlan ?? "free");
    setBillingActivity({
      recurringPayments: billing.billingActivity?.recurringPayments ?? [],
      recurringPaymentCount: billing.billingActivity?.recurringPaymentCount ?? 0,
      latestActionReport: billing.billingActivity?.latestActionReport ?? null,
    });
    setTrialOffers({ starter: offers.starter ?? { enabled: false, days: 3 }, pro: offers.pro ?? { enabled: false, days: 3 } });
  }).catch(() => {
    setSubscription(null);
    setTrial(null);
    setActivePlan("free");
    setBillingActivity({ recurringPayments: [], recurringPaymentCount: 0, latestActionReport: null });
  }), []);

  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);

  const active = activePlan === "starter" || activePlan === "pro";
  const subscriptionOpen = Boolean(subscription?.open ?? (subscription && !["cancelled", "completed", "expired"].includes(subscription.status)));
  const openWithoutAccess = subscriptionOpen && !active;
  const trialActive = Boolean(trial?.active && active);
  const currentPlanName = activePlan === "pro"
    ? "Pro"
    : activePlan === "starter"
      ? "Starter"
      : subscriptionOpen && subscription?.plan === "pro"
        ? "Pro"
        : subscriptionOpen && subscription?.plan === "starter"
          ? "Starter"
          : "Free";
  const trialDaysLeft = trialActive && trial ? daysUntil(trial.trialEndsAt) : 0;
  const paidDaysLeft = active && !trialActive && subscription?.currentPeriodEnd ? daysUntil(subscription.currentPeriodEnd) : 0;
  const currentMonthlyPaise = activePlan === "pro" ? pricing.proMonthlyPaise : pricing.starterMonthlyPaise;
  const pendingMonthlyPaise = subscription?.plan === "pro" ? pricing.proMonthlyPaise : pricing.starterMonthlyPaise;
  const latestRecurringPayment = billingActivity.recurringPayments[0] ?? null;
  const accessStart = trialActive
    ? trial?.trialStartedAt ?? subscription?.createdAt ?? null
    : latestRecurringPayment?.occurredAt ?? subscription?.createdAt ?? null;
  const accessEnd = trialActive && trial
    ? trial.trialEndsAt - 1
    : subscription?.currentPeriodEnd ?? null;

  async function cancelAtPeriodEnd() {
    setBillingMessage("");
    const response = await fetch("/api/billing/subscription/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ atPeriodEnd: true }) });
    const payload = await response.json() as { error?: string; cancelAtPeriodEnd?: boolean; status?: string };
    if (!response.ok) { setBillingMessage(payload.error ?? "We couldn't cancel this billing setup. Please try again."); return; }
    setBillingMessage(
      payload.cancelAtPeriodEnd
        ? "Cancellation scheduled. Your plan will stay active until the current period ends."
        : "Pending checkout cancelled. You can choose another plan now.",
    );
    setManageOpen(false);
    await refresh();
  }

  const starterTrialDays = !active && trialOffers.starter.enabled && !trial ? trialOffers.starter.days : 0;
  const proTrialDays = !active && trialOffers.pro.enabled && !trial ? trialOffers.pro.days : 0;
  const trialRetrying = trial?.status === "payment_retry" || trial?.autoPayStatus === "retrying";
  const trialFailed = Boolean(trial?.failedAt || trial?.status === "payment_failed");

  const openStatusLabel = subscription?.status === "created"
    ? "Checkout pending"
    : subscription?.status === "authenticated"
      ? "Checkout approved"
      : subscription?.status === "pending"
        ? "Payment pending"
        : subscription?.status === "paused"
          ? "Checkout paused"
          : subscription?.status === "halted"
            ? "Payment issue"
            : subscription?.status === "payment_review"
              ? "Payment needs review"
              : "Checkout pending";
  const statusLabel = trialActive
    ? "Trial Active"
    : active && subscription?.cancelAtPeriodEnd
      ? "Cancels at period end"
      : active
        ? "Plan Active"
        : openWithoutAccess
          ? openStatusLabel
          : trialRetrying
            ? "Payment retrying"
            : trialFailed
              ? "Payment failed"
              : "Free plan";
  const statusTone = trialActive || active
    ? "bg-emerald-100 text-emerald-800"
    : subscription?.status === "halted" || subscription?.status === "payment_review" || trialFailed
      ? "bg-red-100 text-red-800"
      : openWithoutAccess || trialRetrying
        ? "bg-amber-100 text-amber-800"
        : "bg-blue-100 text-blue-800";

  const nextBillingDate = trialActive && trial
    ? trial.trialEndsAt
    : active && subscription?.currentPeriodEnd
      ? subscription.currentPeriodEnd
      : null;
  const autoPayText = trialActive
    ? "AutoPay authorised"
    : active && subscription?.cancelAtPeriodEnd
      ? "AutoPay stops after current period"
      : active
        ? "AutoPay enabled"
        : openWithoutAccess
          ? openStatusLabel
          : trialRetrying
            ? "AutoPay payment retrying"
            : trialFailed
              ? "AutoPay payment failed"
              : "No AutoPay";

  const lastPaymentText = latestRecurringPayment?.amountPaise
    ? `${displayRupees(latestRecurringPayment.amountPaise)} • ${formatBillingDate(latestRecurringPayment.occurredAt)}`
    : trialActive
      ? "No recurring payment yet (trial)"
      : billingActivity.latestActionReport?.status === "paid"
        ? `${displayRupees(billingActivity.latestActionReport.amountPaise)} Action Report • ${formatBillingDate(billingActivity.latestActionReport.updatedAt)}`
        : "No verified payment yet";

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-black tracking-[-.045em] text-slate-950">Billing</h1>
      <p className="mt-1.5 text-sm text-slate-600">Manage your plan, track access and keep billing status clear.</p>

      <section id="billing-current-plan" className="mt-5 scroll-mt-24 overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black tracking-[-.045em] text-slate-950">{currentPlanName}</h2>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${statusTone}`}><span className="size-2 rounded-full bg-current opacity-80" />{statusLabel}</span>
            </div>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              {activePlan === "starter"
                ? "Save analyses, costs and history while tracking profit consistently."
                : activePlan === "pro"
                  ? "Full business control across finance, ads, inventory, connections and workspace tools."
                  : openWithoutAccess
                    ? `Checkout pending • ${subscription?.plan === "pro" ? "Pro" : "Starter"} • ${displayRupees(pendingMonthlyPaise)}/month`
                    : "Use the free profit check anytime. Upgrade when you need saved history or deeper business tools."}
            </p>

            {billingMessage && <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">{billingMessage}</p>}
            {trialRetrying && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">Your payment is still being retried. We'll update your access automatically when it succeeds.</p>}
            {trialFailed && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-900">Your payment could not be completed. Choose a plan below to try checkout again.</p>}

            {active && subscriptionOpen && !subscription?.cancelAtPeriodEnd && (
              <div className="mt-4">
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setManageOpen((value) => !value)}>{manageOpen ? "Close plan controls" : "Manage billing"}</Button>
                {manageOpen && <div className="mt-3 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs leading-5 text-slate-600">{trialActive ? "Cancelling now will also stop AutoPay for this trial." : "Your plan stays active until the current paid period ends."}</p><Button type="button" variant="outline" size="sm" className="mt-3 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={cancelAtPeriodEnd}>{trialActive ? "Cancel trial & AutoPay" : "Cancel at period end"}</Button></div>}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
            {trialActive && trial ? (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <BillingStat icon={Clock3} label={`Trial: ${trial.trialDays} days total`} value={`${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left`} valueClass="text-emerald-700" />
                <BillingStat icon={CalendarDays} label="Access valid until" value={formatBillingDate(trial.trialEndsAt - 1)} />
                <BillingStat icon={CreditCard} label="Next charge" value={`${displayRupees(currentMonthlyPaise)}/month`} detail={`AutoPay starts on ${formatBillingDate(trial.trialEndsAt)}`} />
              </div>
            ) : active ? (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <BillingStat icon={Clock3} label="Current paid period" value={subscription?.currentPeriodEnd ? `${paidDaysLeft} ${paidDaysLeft === 1 ? "day" : "days"} left` : "Active"} valueClass="text-emerald-700" />
                <BillingStat icon={CalendarDays} label="Access valid until" value={subscription?.currentPeriodEnd ? formatBillingDate(subscription.currentPeriodEnd) : "Provider-confirmed active"} />
                <BillingStat icon={CreditCard} label={subscription?.cancelAtPeriodEnd ? "Next charge" : "Next renewal"} value={subscription?.cancelAtPeriodEnd ? "No next charge scheduled" : `${displayRupees(currentMonthlyPaise)}/month`} detail={subscription?.currentPeriodEnd ? (subscription.cancelAtPeriodEnd ? `Access remains until ${formatBillingDate(subscription.currentPeriodEnd)}` : `Expected on ${formatBillingDate(subscription.currentPeriodEnd)}`) : undefined} />
              </div>
            ) : openWithoutAccess ? (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <BillingStat icon={Clock3} label="Access" value="Not active yet" valueClass="text-amber-700" />
                <BillingStat icon={CalendarDays} label="Checkout" value={openStatusLabel} />
                <BillingStat icon={CreditCard} label="Next step" value="Choose a plan" detail="Any plan below opens checkout." />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <BillingStat icon={Clock3} label="Access" value="Free plan" />
                <BillingStat icon={CalendarDays} label="Expiry" value="No expiry" />
                <BillingStat icon={CreditCard} label="Next charge" value="₹0" detail="No recurring plan is active." />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6">
        <h2 className="text-xl font-black tracking-[-.035em] text-slate-950">Choose a plan</h2>
        <p className="mt-1 text-sm text-slate-500">Upgrade anytime. More insights. Better control.</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <article className="flex min-h-full flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><PlanTierIcon plan="action_report" /></div>
          <h3 className="mt-4 text-lg font-black text-slate-950">Action Report</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">One-time deep analysis unlock</p>
          <p className="mt-4 text-4xl font-black tracking-[-.05em] text-slate-950">{displayRupees(pricing.actionReportPaise)}<span className="ml-1 text-xs font-semibold tracking-normal text-slate-500">one-time</span></p>
          <div className="my-4 h-px bg-slate-100" />
          <BillingFeatureList items={["1 detailed report", "Full SKU action board", "Break-even & return insights", "PDF/Excel export"]} />
          <Button asChild variant="outline" className="mt-auto w-full rounded-xl"><Link href="/analyze">Analyze first</Link></Button>
        </article>

        <article className={`relative flex min-h-full flex-col rounded-[22px] border bg-white p-5 shadow-sm ${activePlan === "starter" ? "border-blue-500 ring-1 ring-blue-100" : "border-slate-200"}`}>
          {activePlan === "starter" && <span className="absolute right-4 top-0 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-[.08em] text-white">Current plan</span>}
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><PlanTierIcon plan="starter" /></div>
          <h3 className="mt-4 text-lg font-black text-slate-950">Starter</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">Save, track and grow consistently</p>
          <p className="mt-4 text-4xl font-black tracking-[-.05em] text-slate-950">{displayRupees(pricing.starterMonthlyPaise)}<span className="ml-1 text-xs font-semibold tracking-normal text-slate-500">/month</span></p>
          <div className="my-4 h-px bg-slate-100" />
          <BillingFeatureList items={["Saved analyses", "Saved costs", "Profit history", "Alerts & recurring review"]} />
          {activePlan === "starter" && <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-extrabold text-blue-700">{trialActive ? `Trial active • ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left` : subscription?.currentPeriodEnd ? `${paidDaysLeft} ${paidDaysLeft === 1 ? "day" : "days"} left in current period` : "Current plan"}</div>}
          {activePlan === "starter" ? <Button type="button" className="mt-3 min-h-11 h-auto w-full whitespace-normal rounded-xl bg-blue-600 px-3 py-2.5 text-center font-bold leading-5 hover:bg-blue-700" onClick={() => { setManageOpen(true); document.getElementById("billing-current-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Manage Plan</Button> : activePlan === "pro" ? <Button className="mt-auto min-h-11 h-auto w-full whitespace-normal rounded-xl px-3 py-2.5 text-center leading-5" disabled>Included in Pro</Button> : <PlanSubscribeButton plan="starter" trialDays={starterTrialDays} userEmail={user.email} userPhone={user.phone} onActive={refresh} buttonLabel="Choose Starter" />}
        </article>

        <article className={`relative flex min-h-full flex-col rounded-[22px] border bg-white p-5 shadow-sm ${activePlan === "pro" ? "border-blue-500 ring-1 ring-blue-100" : "border-slate-200"}`}>
          {activePlan === "pro" && <span className="absolute right-4 top-0 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-[.08em] text-white">Current plan</span>}
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><PlanTierIcon plan="pro" /></div>
          <h3 className="mt-4 text-lg font-black text-slate-950">Pro</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">Full business control</p>
          <p className="mt-4 text-4xl font-black tracking-[-.05em] text-slate-950">{displayRupees(pricing.proMonthlyPaise)}<span className="ml-1 text-xs font-semibold tracking-normal text-slate-500">/month</span></p>
          <div className="my-4 h-px bg-slate-100" />
          <BillingFeatureList items={["Everything in Starter", "Bank & cash view", "Ads + inventory", "Connections", "Workspace & Ask SellerHisab"]} />
          {activePlan === "pro" && <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-extrabold text-blue-700">{trialActive ? `Trial active • ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left` : subscription?.currentPeriodEnd ? `${paidDaysLeft} ${paidDaysLeft === 1 ? "day" : "days"} left in current period` : "Current plan"}</div>}
          {activePlan === "pro" ? <Button type="button" className="mt-3 min-h-11 h-auto w-full whitespace-normal rounded-xl bg-blue-600 px-3 py-2.5 text-center font-bold leading-5 hover:bg-blue-700" onClick={() => { setManageOpen(true); document.getElementById("billing-current-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Manage Plan</Button> : activePlan === "starter" ? <Button className="mt-auto min-h-11 h-auto w-full whitespace-normal rounded-xl px-3 py-2.5 text-center leading-5" disabled>Cancel Starter before switching</Button> : <PlanSubscribeButton plan="pro" trialDays={proTrialDays} userEmail={user.email} userPhone={user.phone} onActive={refresh} buttonLabel="Choose Pro" />}
        </article>
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-black tracking-[-.035em] text-slate-950">Plan activity</h2><p className="mt-1 text-xs text-slate-500">Live account billing state from SellerHisab and provider-verified events.</p></div>
          <button type="button" className="text-xs font-extrabold text-blue-700 hover:text-blue-800" onClick={() => setHistoryOpen((value) => !value)}>{historyOpen ? "Hide payment history" : "View payment history"}</button>
        </div>

        <div className="mt-3 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <BillingActivityRow icon={CalendarDays} label="Current access period" value={active && accessEnd ? `${accessStart ? formatBillingDate(accessStart) : "Current"} – ${formatBillingDate(accessEnd)}` : "Free access"} meta={trialActive ? `${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left` : active && subscription?.currentPeriodEnd ? `${paidDaysLeft} ${paidDaysLeft === 1 ? "day" : "days"} left` : undefined} metaTone="text-emerald-700" />
          <BillingActivityRow icon={Clock3} label={trialActive ? "Trial ends / Next billing date" : active ? "Next billing date" : "Billing date"} value={nextBillingDate ? formatBillingDate(nextBillingDate) : "No recurring billing"} />
          <BillingActivityRow icon={CreditCard} label="Payment method / AutoPay" value={active ? `${displayRupees(currentMonthlyPaise)}/month • ${autoPayText}` : autoPayText} />
          <BillingActivityRow icon={ReceiptText} label="Last payment" value={lastPaymentText} />
          <BillingActivityRow icon={History} label="Billing history" value={billingActivity.recurringPaymentCount > 0 ? `${billingActivity.recurringPaymentCount} recurring payment event${billingActivity.recurringPaymentCount === 1 ? "" : "s"} recorded` : billingActivity.latestActionReport?.status === "paid" ? "Action Report purchase recorded" : "No paid billing history yet"} />
        </div>

        {historyOpen && (
          <div className="mt-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-extrabold text-slate-900">Recent verified billing events</p>
            {billingActivity.recurringPayments.length > 0 ? <div className="mt-3 space-y-2">{billingActivity.recurringPayments.map((item) => <div key={item.providerPaymentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><div><p className="font-extrabold text-slate-800">{item.eventType.replaceAll(".", " ")}</p><p className="mt-0.5 text-slate-500">{formatBillingDate(item.occurredAt)} • {item.status}</p></div><p className="font-black text-slate-900">{item.amountPaise ? displayRupees(item.amountPaise) : "—"}</p></div>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">No recurring charge has been recorded yet. Trial authorisation can be active before the first monthly charge.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function BillingStat({ icon: Icon, label, value, detail, valueClass = "text-slate-950" }: { icon: typeof History; label: string; value: string; detail?: string; valueClass?: string }) {
  return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm"><Icon className="size-4" /></span><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-0.5 text-sm font-black ${valueClass}`}>{value}</p>{detail && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{detail}</p>}</div></div>;
}

function BillingFeatureList({ items }: { items: string[] }) {
  return <ul className="mb-5 flex-1 space-y-2.5">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-slate-700"><CircleCheck className="mt-0.5 size-4 shrink-0 fill-blue-600 text-white" />{item}</li>)}</ul>;
}

function BillingActivityRow({ icon: Icon, label, value, meta, metaTone = "text-slate-600" }: { icon: typeof History; label: string; value: string; meta?: string; metaTone?: string }) {
  return <div className="grid gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1.1fr_1fr_auto] sm:items-center"><div className="flex items-center gap-3"><Icon className="size-4 shrink-0 text-slate-500" /><p className="text-xs font-bold text-slate-700">{label}</p></div><p className="text-xs font-semibold text-slate-800 sm:text-right">{value}</p>{meta ? <p className={`text-xs font-extrabold sm:min-w-[72px] sm:text-right ${metaTone}`}>{meta}</p> : <span className="hidden sm:block sm:min-w-[72px]" />}</div>;
}

function formatBillingDate(value: number | string) {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function daysUntil(value: number) {
  return Math.max(0, Math.ceil((value - Date.now()) / 86_400_000));
}

function AccountLink({ href, icon: Icon, label }: { href: string; icon: typeof History; label: string }) { const pathname = usePathname(); const active = pathname === href; return <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="size-4.5" />{label}</Link>; }
function MobileAccountLink({ href, icon: Icon, label }: { href: string; icon: typeof History; label: string }) { const pathname = usePathname(); const active = pathname === href; return <Link href={href} className={`flex min-w-[68px] flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-bold ${active ? "text-blue-700" : "text-slate-500"}`}><Icon className="size-4" />{label}</Link>; }
function SummaryCard({ icon: Icon, label, value }: { icon: typeof History; label: string; value: string }) { return <div className="liquid-panel rounded-[22px] p-5"><span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon className="size-4" /></span><p className="mt-4 text-2xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>; }

function getSafeReturnTo() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("returnTo")?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function Mini({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-xs font-extrabold tabular-nums text-slate-800">{value}</p></div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="grid place-items-center px-5 py-16 text-center"><PackageOpen className="size-8 text-slate-300" /><p className="mt-4 text-sm font-extrabold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p></div>; }

