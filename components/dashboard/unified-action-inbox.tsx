"use client";

import { AlertTriangle, BadgeIndianRupee, ChevronRight, Target } from "lucide-react";
import { buildUnifiedActionInbox, type ActionInboxItem } from "@/core/action-inbox";
import { channelLabel } from "@/core/channels/catalog";
import { formatInr } from "@/core/money";
import type { AnalysisResult } from "@/core/types";
import { useLanguage } from "../providers";

export function UnifiedActionInbox({ result }: { result: AnalysisResult }) {
  const actions = buildUnifiedActionInbox(result);
  const { language } = useLanguage();
  const english = language === "english";
  const top = actions.slice(0, 3);

  return (
    <section className="navy-frost mt-7 rounded-[26px] p-4 sm:p-5" aria-labelledby="unified-action-inbox">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg"><Target className="size-5" /></span><div><p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-blue-200">{english ? "One ranked action inbox" : "एक ranked action inbox"}</p><h2 id="unified-action-inbox" className="mt-1 text-xl font-black tracking-[-.025em] text-white">{english ? "Do these first" : "सबसे पहले ये करें"}</h2></div></div>
        <span className="text-xs font-bold text-blue-100">{actions.length} supported action(s)</span>
      </div>
      <div className="mt-4 space-y-2">
        {top.length ? top.map((action, index) => <ActionCard key={action.id} action={action} position={index} />) : <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-semibold text-blue-50">No urgent supported action is available from the current evidence.</div>}
      </div>
      {actions.length > 3 && <a href="#actions" className="mt-3 inline-flex items-center text-xs font-extrabold text-blue-100 hover:text-white">See product details and all evidence<ChevronRight className="ml-1 size-4" /></a>}
    </section>
  );
}

function ActionCard({ action, position }: { action: ActionInboxItem; position: number }) {
  return (
    <article className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-blue-700">{position + 1}</span><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-blue-200">{action.category}</span><span className="text-[10px] font-bold text-blue-100">{action.urgency}</span>{action.blocksClose && <span className="inline-flex items-center gap-1 rounded-full bg-red-500/25 px-2 py-0.5 text-[10px] font-extrabold text-red-100"><AlertTriangle className="size-3" />blocks close</span>}</div><p className="mt-1 text-sm font-extrabold text-white">{action.title}</p><p className="mt-1 text-xs leading-5 text-blue-100">{action.detail}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.08em] text-blue-200">{action.actionLabel}{action.channelId ? ` • ${channelLabel(action.channelId)}` : ""}{action.sku ? ` • ${action.sku}` : ""}</p></div></div>
      <div className="mt-3 shrink-0 sm:mt-0 sm:text-right"><p className="text-[10px] font-bold uppercase text-blue-200">Money impact</p><p className="mt-1 flex items-center gap-1 font-black tabular-nums text-white sm:justify-end"><BadgeIndianRupee className="size-4" />{formatInr(action.moneyImpactPaise)}</p><p className="mt-1 text-[10px] font-semibold text-blue-200">{action.confidence} confidence • {action.effort} effort</p></div>
    </article>
  );
}
