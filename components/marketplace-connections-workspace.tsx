"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Cable,
  CircleCheck,
  Clock3,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { AuthScreen, type AuthUser } from "@/components/auth-screen";
import { Brand } from "@/components/brand";
import { PlanSubscribeButton } from "@/components/dashboard/plan-subscribe-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_CONNECTORS = ["amazon-in-v1", "flipkart-v1", "shopify-v1", "woocommerce-v1"] as const;
type ApiConnectorId = (typeof API_CONNECTORS)[number];

type ApiPlatform = {
  id: string;
  connectorId: ApiConnectorId | null;
  channelId: string;
  label: string;
  authMode: string;
  activationState: "runtime-available" | "configuration-required" | "partner-approval-required";
  dataDomains: string[];
  incrementalSync: boolean;
  providerNotifications: boolean;
  pollingBackstop: boolean;
  defaultSyncIntervalMinutes: number;
  minimumSyncIntervalMinutes: number;
  maximumSyncIntervalMinutes: number;
  connectRequiresPlan: null;
  syncRequiresPlan: "pro";
  note: string;
  apiConfigured: boolean;
  connectAvailable: boolean;
};

type ConnectionItem = {
  connectorId: string;
  channelId: string;
  label: string;
  priority: string;
  accountStatus: "not-connected" | "connected" | "degraded" | "disabled";
  apiConfigured: boolean;
  authorization: string;
  orders: string;
  settlements: string;
  externalAccountDisplayName?: string | null;
  enabledCapabilities: string[];
  grantedScopes: string[];
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
  retryJob: {
    status: string;
    triggerKind?: string | null;
    nextAttemptAt: string | null;
    attemptCount: number;
    maxAttempts: number;
  } | null;
  syncEntitled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number | null;
  nextAutoSyncAt: string | null;
  dataRevision: number;
  reportRevision: number;
  reportFresh: boolean;
  lastDataChangeAt: string | null;
  lastReportRefreshAt: string | null;
  freshness: { state: "never-synced" | "fresh" | "aging" | "stale"; ageMinutes: number | null };
  syncRequiresPlan: "pro";
};

type ConnectedReport = {
  reportKey: "connected-summary";
  connectorId: ApiConnectorId;
  connectionId: string;
  dataRevision: number;
  generatedAt: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  ledgerRecordCount: number;
  orderLinkedRecordCount: number;
  breakdown: Array<{ semantic: string; currency: string; rowCount: number; amountPaise: number }>;
  latestSync: {
    status: string | null;
    orderCount: number;
    financialRecordCount: number;
    issueCount: number;
    completedAt: string | null;
  };
  disclaimer: string;
};

type ConnectionsPayload = {
  connections?: ConnectionItem[];
  apiPlatforms?: ApiPlatform[];
  syncEntitled?: boolean;
  connectionRequiresPlan?: null;
  syncRequiresPlan?: "pro";
  error?: string;
};

const INTERVALS = [15, 30, 60, 180, 360, 720, 1440] as const;

function isApiConnectorId(value: string): value is ApiConnectorId {
  return (API_CONNECTORS as readonly string[]).includes(value);
}

function formatMoment(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN");
}

function formatInterval(minutes: number | null | undefined): string {
  if (!minutes) return "30 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) return `${minutes / 1440} day`;
  return `${minutes / 60} hr`;
}

function formatMoney(paise: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(paise / 100);
  } catch {
    return `${currency || "INR"} ${(paise / 100).toFixed(2)}`;
  }
}

function connectionTone(item: ConnectionItem): string {
  if (item.accountStatus === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (item.accountStatus === "degraded") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function connectionLabel(item: ConnectionItem): string {
  if (item.accountStatus === "connected") return "Connected";
  if (item.accountStatus === "degraded") return "Needs attention";
  if (item.apiConfigured) return "Ready to connect";
  return "SellerHisab setup pending";
}

function freshnessLabel(item: ConnectionItem): string {
  if (item.freshness.state === "never-synced") return "Never synced";
  if (item.freshness.state === "fresh") return "Fresh";
  if (item.freshness.state === "aging") return "Aging";
  return "Stale";
}

export function MarketplaceConnectionsWorkspace() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [platforms, setPlatforms] = useState<ApiPlatform[]>([]);
  const [syncEntitled, setSyncEntitled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyConnector, setBusyConnector] = useState<string | null>(null);
  const [shopifyShop, setShopifyShop] = useState("");
  const [wooStoreUrl, setWooStoreUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [reports, setReports] = useState<Record<string, ConnectedReport | undefined>>({});
  const [reportBusy, setReportBusy] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const payload = await response.json() as { user?: AuthUser | null };
    setUser(response.ok ? payload.user ?? null : null);
  }, []);

  const refreshConnections = useCallback(async () => {
    const response = await fetch("/api/account/connections", { cache: "no-store" });
    const payload = await response.json() as ConnectionsPayload;
    if (response.status === 401) { setUser(null); return; }
    if (!response.ok) throw new Error(payload.error ?? "Connection status could not be loaded.");
    setConnections(payload.connections ?? []);
    setPlatforms(payload.apiPlatforms ?? []);
    setSyncEntitled(Boolean(payload.syncEntitled));
    setLoadError(null);
  }, []);

  useEffect(() => { void refreshAuth(); }, [refreshAuth]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    refreshConnections().catch((error) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Connection status could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, refreshConnections]);

  const hasActiveJob = useMemo(() => connections.some((item) => item.retryJob && ["queued", "processing", "retryable_failed"].includes(item.retryJob.status)), [connections]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshConnections().catch(() => undefined);
    }, hasActiveJob ? 5000 : 15000);
    return () => window.clearInterval(timer);
  }, [user, hasActiveJob, refreshConnections]);

  async function startOAuth(item: ConnectionItem) {
    if (!isApiConnectorId(item.connectorId)) return;
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId, shop: item.connectorId === "shopify-v1" ? shopifyShop : undefined }),
      });
      const payload = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error ?? "Marketplace authorization could not start.");
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Marketplace authorization could not start.");
      setBusyConnector(null);
    }
  }

  async function authorizeWooCommerce() {
    setBusyConnector("woocommerce-v1");
    try {
      const response = await fetch("/api/account/connections/woocommerce/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeUrl: wooStoreUrl }),
      });
      const payload = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error ?? "WooCommerce authorization could not start.");
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "WooCommerce authorization could not start.");
      setBusyConnector(null);
    }
  }

  async function connectWooCommerceWithKeys() {
    setBusyConnector("woocommerce-v1");
    try {
      const response = await fetch("/api/account/connections/woocommerce/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeUrl: wooStoreUrl, consumerKey: wooConsumerKey, consumerSecret: wooConsumerSecret }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "WooCommerce connection failed.");
      setWooConsumerSecret("");
      toast.success("WooCommerce read-only API connected.");
      await refreshConnections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "WooCommerce connection failed.");
    } finally {
      setBusyConnector(null);
    }
  }

  async function syncNow(item: ConnectionItem) {
    if (!isApiConnectorId(item.connectorId)) return;
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId, days: 30 }),
      });
      const payload = await response.json() as { jobId?: string; error?: string; requiredPlan?: string };
      if (response.status === 402) {
        setSyncEntitled(false);
        toast.info("Connection stays active. Upgrade to Pro to sync and refresh connected reports.");
        return;
      }
      if (!response.ok && response.status !== 202) throw new Error(payload.error ?? "Sync could not start.");
      toast.success("Sync queued. This page will update automatically.");
      await refreshConnections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync could not start.");
    } finally {
      setBusyConnector(null);
    }
  }

  async function setAutoSync(item: ConnectionItem, enabled: boolean, intervalMinutes = item.syncIntervalMinutes ?? 30) {
    if (!isApiConnectorId(item.connectorId)) return;
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/auto-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId, enabled, intervalMinutes }),
      });
      const payload = await response.json() as { error?: string; requiredPlan?: string };
      if (response.status === 402) {
        setSyncEntitled(false);
        toast.info("Automatic API sync is a Pro feature. Your marketplace remains connected.");
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Live sync setting could not be updated.");
      toast.success(enabled ? `Live sync enabled every ${formatInterval(intervalMinutes)}.` : "Live sync paused. Marketplace connection stays saved.");
      await refreshConnections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Live sync setting could not be updated.");
    } finally {
      setBusyConnector(null);
    }
  }

  async function loadReport(item: ConnectionItem) {
    if (!isApiConnectorId(item.connectorId)) return;
    setReportBusy(item.connectorId);
    try {
      const response = await fetch(`/api/account/connections/report?connectorId=${encodeURIComponent(item.connectorId)}`, { cache: "no-store" });
      const payload = await response.json() as { report?: ConnectedReport; error?: string; requiredPlan?: string };
      if (response.status === 402) {
        setSyncEntitled(false);
        toast.info("Connected-data reports require Pro. Your API connection remains saved.");
        return;
      }
      if (!response.ok || !payload.report) throw new Error(payload.error ?? "Connected report could not be loaded.");
      setReports((current) => ({ ...current, [item.connectorId]: payload.report }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connected report could not be loaded.");
    } finally {
      setReportBusy(null);
    }
  }

  async function disconnect(item: ConnectionItem) {
    if (!isApiConnectorId(item.connectorId)) return;
    setBusyConnector(item.connectorId);
    try {
      const response = await fetch("/api/account/connections/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: item.connectorId }),
      });
      const payload = await response.json() as { disconnected?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Marketplace could not be disconnected.");
      setReports((current) => { const next = { ...current }; delete next[item.connectorId]; return next; });
      toast.success(`${item.label} disconnected. Stored API credentials were removed.`);
      await refreshConnections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Marketplace could not be disconnected.");
    } finally {
      setBusyConnector(null);
    }
  }

  if (user === undefined) return <div className="app-wallpaper grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-blue-600" /></div>;
  if (!user) return <AuthScreen onSignedIn={(signedInUser) => setUser(signedInUser)} />;

  const apiConnections = connections.filter((item) => isApiConnectorId(item.connectorId));
  const meeshoPlatform = platforms.find((platform) => platform.id === "meesho-api-v1");

  return (
    <div className="app-wallpaper min-h-screen px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="glass-nav flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-4 py-3 sm:px-5">
          <Brand />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link href="/app"><ArrowLeft className="mr-1.5 size-4" />Account</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/app/billing">Billing</Link></Button>
          </div>
        </header>

        <section className="mt-6 rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-blue-600">Unified API Platform</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.045em] text-slate-950">Marketplace Connections</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Connect your seller account without buying a plan. Pro is required only when SellerHisab syncs marketplace data or refreshes connected-data reports.</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${syncEntitled ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
              <span className="font-extrabold">API sync:</span> {syncEntitled ? "Pro active" : "Upgrade required for sync"}
            </div>
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p><span className="font-extrabold">Credential rule:</span> SellerHisab never asks for marketplace passwords. OAuth tokens or read-only API credentials are encrypted at rest and removed on disconnect.</p></div>
        </section>

        {loading ? <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="size-6 animate-spin text-blue-600" /></div> : loadError ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"><AlertTriangle className="mb-2 size-5" />{loadError}<Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void refreshConnections()}>Retry</Button></div> : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {apiConnections.map((item) => {
              const connected = item.accountStatus === "connected" || item.accountStatus === "degraded";
              const busy = busyConnector === item.connectorId;
              const report = reports[item.connectorId];
              return (
                <article key={item.connectorId} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${connected ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{connected ? <CircleCheck className="size-5" /> : <Cable className="size-5" />}</span><div className="min-w-0"><h2 className="truncate text-lg font-black text-slate-950">{item.label}</h2><p className="mt-0.5 truncate text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">{item.connectorId}</p></div></div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${connectionTone(item)}`}>{connectionLabel(item)}</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase text-slate-400">Orders</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{item.orders}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-extrabold uppercase text-slate-400">Money / settlement</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{item.settlements}</p></div></div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{item.authorization}</p>

                  {!connected && item.connectorId === "shopify-v1" && item.apiConfigured && <div className="mt-4"><Label htmlFor="shopify-domain" className="text-xs font-extrabold">Shopify store domain</Label><Input id="shopify-domain" className="mt-2" value={shopifyShop} onChange={(event) => setShopifyShop(event.target.value)} placeholder="your-store.myshopify.com" /></div>}
                  {!connected && item.connectorId === "woocommerce-v1" && item.apiConfigured && <div className="mt-4 grid gap-2"><Label htmlFor="woo-store" className="text-xs font-extrabold">WooCommerce store</Label><Input id="woo-store" value={wooStoreUrl} onChange={(event) => setWooStoreUrl(event.target.value)} placeholder="https://store.example.com" inputMode="url" /><details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-extrabold text-slate-700">Advanced: use existing Read API keys</summary><div className="mt-3 grid gap-2"><Input value={wooConsumerKey} onChange={(event) => setWooConsumerKey(event.target.value)} placeholder="ck_..." autoComplete="off" /><Input type="password" value={wooConsumerSecret} onChange={(event) => setWooConsumerSecret(event.target.value)} placeholder="cs_..." autoComplete="new-password" /><Button type="button" variant="outline" onClick={() => void connectWooCommerceWithKeys()} disabled={busy || wooConsumerKey.trim().length < 20 || wooConsumerSecret.trim().length < 20}>Connect read-only keys</Button></div></details></div>}

                  {!connected && !item.apiConfigured && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><span className="font-extrabold">Connection option is built, not hidden.</span> SellerHisab&apos;s provider app credentials/approval still need production configuration before authorization can start.</div>}

                  {!connected && item.apiConfigured && <div className="mt-4 flex flex-wrap gap-2">{item.connectorId === "woocommerce-v1" ? <Button type="button" onClick={() => void authorizeWooCommerce()} disabled={busy || wooStoreUrl.trim().length < 8} className="bg-blue-600 font-bold hover:bg-blue-700">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Authorize read-only API</Button> : <Button type="button" onClick={() => void startOAuth(item)} disabled={busy || (item.connectorId === "shopify-v1" && shopifyShop.trim().length < 3)} className="bg-blue-600 font-bold hover:bg-blue-700">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}Connect {item.label}</Button>}<span className="self-center text-[11px] font-bold text-emerald-700">Connect is free</span></div>}

                  {connected && <>
                    {item.externalAccountDisplayName && <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Connected account: {item.externalAccountDisplayName}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Freshness" value={freshnessLabel(item)} /><Metric label="Last sync" value={item.lastSuccessAt ? formatMoment(item.lastSuccessAt) : "Never"} /><Metric label="Data rev" value={String(item.dataRevision)} /><Metric label="Report" value={item.reportFresh ? "Current" : "Refreshing"} /></div>

                    {item.retryJob && ["queued", "processing", "retryable_failed"].includes(item.retryJob.status) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><RefreshCw className="mr-2 inline size-4" /><span className="font-extrabold">{item.retryJob.status === "retryable_failed" ? "Retry scheduled" : "Sync running"}</span>{item.retryJob.triggerKind ? ` • ${item.retryJob.triggerKind}` : ""}{item.retryJob.nextAttemptAt ? ` • next ${formatMoment(item.retryJob.nextAttemptAt)}` : ""}</div>}

                    {syncEntitled ? <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-slate-950">Live sync</p><p className="mt-1 text-xs text-slate-600">Incremental background refresh with durable retries. Provider notifications are used where supported.</p></div><Button type="button" variant={item.autoSyncEnabled ? "default" : "outline"} onClick={() => void setAutoSync(item, !item.autoSyncEnabled)} disabled={busy}>{item.autoSyncEnabled ? "Live sync ON" : "Enable live sync"}</Button></div><div className="mt-3 flex flex-wrap items-center gap-2"><Label htmlFor={`interval-${item.connectorId}`} className="text-xs font-bold">Frequency</Label><select id={`interval-${item.connectorId}`} value={item.syncIntervalMinutes ?? 30} onChange={(event) => void setAutoSync(item, true, Number(event.target.value))} disabled={busy} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">{INTERVALS.map((minutes) => <option key={minutes} value={minutes}>{formatInterval(minutes)}</option>)}</select><span className="text-[11px] text-slate-500">Next: {item.autoSyncEnabled ? formatMoment(item.nextAutoSyncAt) : "paused"}</span></div></div> : <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-extrabold text-blue-950">Connection saved. Sync needs Pro.</p><p className="mt-1 text-xs leading-5 text-blue-800">Your marketplace can stay connected for free. Upgrade only when you want API data sync, automatic updates and connected reports.</p><div className="mt-3 max-w-xs"><PlanSubscribeButton compact plan="pro" userEmail={user.email} userPhone={user.phone} onActive={async () => { await refreshAuth(); await refreshConnections(); }} buttonLabel="Upgrade to Pro for sync" /></div></div>}

                    <div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => void syncNow(item)} disabled={busy || !syncEntitled} className="bg-blue-600 font-bold hover:bg-blue-700">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Sync latest 30 days</Button><Button type="button" variant="outline" onClick={() => void loadReport(item)} disabled={reportBusy === item.connectorId || !syncEntitled}>{reportBusy === item.connectorId ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Database className="mr-2 size-4" />}Open connected report</Button><Button type="button" variant="outline" onClick={() => void disconnect(item)} disabled={busy} className="text-red-700"><Unplug className="mr-2 size-4" />Disconnect</Button></div>

                    {item.lastError && <p className="mt-3 text-xs font-semibold text-red-700">{item.lastError}</p>}
                    {report && <ConnectedReportCard report={report} />}
                  </>}
                </article>
              );
            })}

            {meeshoPlatform && <article className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Cable className="size-5" /></span><div><h2 className="text-lg font-black text-slate-950">Meesho API</h2><p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-slate-400">Future provider slot</p></div></div><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-900">Awaiting official access</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{meeshoPlatform.note}</p><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Architecture" value="Ready" /><Metric label="Fake connect" value="Blocked" /></div><p className="mt-4 text-xs leading-5 text-slate-500">When official/approved access is available, Meesho can be added through the same adapter, encrypted credential, durable sync, revision and report pipeline without redesigning the platform.</p><Button asChild variant="outline" className="mt-4"><Link href="/analyze">Use Meesho file analysis now</Link></Button></article>}
          </div>
        )}

        <footer className="mt-8 pb-6 text-center text-xs leading-5 text-slate-500">Connection authorization is separate from paid data processing. SellerHisab does not label connected marketplace observations as profit without seller costs and validated money evidence.</footer>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-extrabold text-slate-800">{value}</p></div>;
}

function ConnectedReportCard({ report }: { report: ConnectedReport }) {
  return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-950">Saved connected-data report</p><p className="mt-1 text-[11px] text-slate-500">Revision {report.dataRevision} • generated {formatMoment(report.generatedAt)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-slate-600">{report.ledgerRecordCount} ledger rows</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Order-linked" value={String(report.orderLinkedRecordCount)} /><Metric label="Orders synced" value={String(report.latestSync.orderCount)} /><Metric label="Finance rows" value={String(report.latestSync.financialRecordCount)} /><Metric label="Coverage" value={report.coverageStart && report.coverageEnd ? `${new Date(report.coverageStart).toLocaleDateString("en-IN")}–${new Date(report.coverageEnd).toLocaleDateString("en-IN")}` : "—"} /></div>{report.breakdown.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[520px] text-xs"><thead className="bg-slate-50 text-left text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-400"><tr><th className="px-3 py-2">Observation</th><th className="px-3 py-2">Rows</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{report.breakdown.slice(0, 20).map((row) => <tr key={`${row.semantic}:${row.currency}`}><td className="px-3 py-2 font-semibold text-slate-700">{row.semantic.replace(/^api-observation:/, "")}</td><td className="px-3 py-2 text-slate-500">{row.rowCount}</td><td className="px-3 py-2 text-right font-bold text-slate-800">{formatMoney(row.amountPaise, row.currency)}</td></tr>)}</tbody></table></div>}<p className="mt-3 text-[11px] leading-5 text-slate-500">{report.disclaimer}</p></div>;
}
