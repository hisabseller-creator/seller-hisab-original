"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSavedAnalysisPayload } from "@/core/account/analysis-summary";
import { syncableSavedCosts } from "@/core/account/saved-costs";
import { localDb } from "@/core/storage/local-db";
import type { AnalysisResult } from "@/core/types";
import { useAccountStatus } from "../providers";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AnalysisAccountSave({ result }: { result: AnalysisResult }) {
  const { user, loading } = useAccountStatus();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const attemptedKey = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    const key = `${user.id}:${result.id}`;
    if (attemptedKey.current === key) return;
    attemptedKey.current = key;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void saveAccountData(result)
        .then((warning) => {
          setSaveState("saved");
          setMessage(warning ?? "");
        })
        .catch((error: unknown) => {
          setSaveState("error");
          setMessage(error instanceof Error ? error.message : "Analysis summary could not be saved.");
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, result, user]);

  async function retry() {
    setSaveState("saving");
    setMessage("");
    try {
      const warning = await saveAccountData(result);
      setSaveState("saved");
      setMessage(warning ?? "");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Analysis summary could not be saved.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto -mt-10 mb-16 max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="liquid-panel flex items-center gap-3 rounded-[24px] p-5 sm:p-6">
          <Loader2 className="size-5 animate-spin text-blue-600" />
          <p className="text-sm font-bold text-slate-600">Checking account save status…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const returnTo = `/analyze?resume=${encodeURIComponent(result.id)}`;
    return (
      <div className="mx-auto -mt-10 mb-16 max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="liquid-panel rounded-[24px] p-5 sm:flex sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-blue-700">
              <Save className="size-4" />
              <p className="text-xs font-extrabold uppercase tracking-[.12em]">Optional account</p>
            </div>
            <h2 className="mt-2 font-extrabold text-slate-950">Keep this result and your saved SKU costs</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Sign in only when you want history, reusable SKU costs and purchases tied to your account. Only the SKU + cost inputs you chose to save are synced; raw marketplace report rows stay on this device.
            </p>
          </div>
          <Button asChild className="mt-4 bg-blue-600 font-bold sm:mt-0">
            <Link href={`/app?returnTo=${encodeURIComponent(returnTo)}`}>Login / Register & save</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto -mt-10 mb-16 max-w-[1440px] px-4 sm:px-6 lg:px-10">
      <div className={`rounded-[24px] border p-5 sm:flex sm:items-center sm:justify-between sm:p-6 ${saveState === "error" ? "border-amber-200 bg-amber-50/85" : "border-emerald-200 bg-emerald-50/85"}`}>
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            {saveState === "saving" ? <Loader2 className="size-5 animate-spin text-blue-600" /> : saveState === "error" ? <ShieldCheck className="size-5 text-amber-700" /> : <CheckCircle2 className="size-5 text-emerald-700" />}
            <h2 className="font-extrabold text-slate-950">
              {saveState === "saving" ? "Saving to My Account…" : saveState === "error" ? "Result is safe locally, but account save needs retry" : "Saved to My Account"}
            </h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {saveState === "error"
              ? message
              : message || "Derived analysis totals and reusable SKU costs are saved to your account. Raw marketplace files and report rows remain local."}
          </p>
        </div>
        {saveState === "error" ? (
          <Button variant="outline" className="mt-4 rounded-xl bg-white sm:mt-0" onClick={retry}>
            <RefreshCw className="mr-2 size-4" />Retry save
          </Button>
        ) : (
          <Button asChild variant="outline" className="mt-4 rounded-xl bg-white sm:mt-0">
            <Link href="/app/history">View history</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

async function saveAccountData(result: AnalysisResult): Promise<string | undefined> {
  const response = await fetch("/api/account/analyses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildSavedAnalysisPayload(result)),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? "Analysis summary could not be saved.");
  }

  const entitlementToken = localStorage.getItem(`smg-entitlement:${result.id}`);
  if (entitlementToken) {
    await fetch("/api/entitlements/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysisId: result.id, token: entitlementToken }),
    }).catch(() => undefined);
  }

  try {
    const costs = syncableSavedCosts(await localDb().costs.toArray());
    if (costs.length) {
      const costResponse = await fetch("/api/account/costs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ costs }),
      });
      if (!costResponse.ok) return "Analysis history is saved. SKU costs remain safe on this device and will retry syncing on a later analysis.";
    }
  } catch {
    return "Analysis history is saved. SKU costs remain safe on this device and will retry syncing on a later analysis.";
  }

  return undefined;
}
