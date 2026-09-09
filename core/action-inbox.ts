import { buildClosePackSummary } from "./close-intelligence";
import { scopedSkuKey } from "./canonical/scope";
import { buildReturnRecoverySummary } from "./returns-intelligence";
import type { AnalysisResult, SkuEconomics } from "./types";

export type ActionInboxItem = {
  id: string;
  category: "Recovery" | "Returns" | "Product" | "Data" | "Close";
  title: string;
  detail: string;
  actionLabel: string;
  channelId?: SkuEconomics["channelId"];
  sku?: string;
  moneyImpactPaise: number;
  confidence: "High" | "Medium" | "Low";
  urgency: "Critical" | "High" | "Normal";
  effort: "Low" | "Medium" | "High";
  blocksClose: boolean;
  score: number;
};

const confidenceWeight = { High: 1, Medium: 0.7, Low: 0.4 } as const;
const urgencyWeight = { Critical: 1, High: 0.75, Normal: 0.45 } as const;
const effortWeight = { Low: 1, Medium: 1.5, High: 2.25 } as const;

function scored(item: Omit<ActionInboxItem, "score">): ActionInboxItem {
  const impactRupees = item.moneyImpactPaise / 100;
  const evidenceValue = impactRupees > 0 ? impactRupees : item.blocksClose ? 100 : 1;
  const score = Math.round(
    evidenceValue * confidenceWeight[item.confidence] * urgencyWeight[item.urgency] / effortWeight[item.effort],
  );
  return { ...item, score };
}

function skuUrgency(sku: SkuEconomics): ActionInboxItem["urgency"] {
  if (sku.action === "Add Cost" || sku.action === "Review Settlement" || sku.action === "Pause") return "High";
  return "Normal";
}

function skuEffort(sku: SkuEconomics): ActionInboxItem["effort"] {
  if (sku.action === "Add Cost" || sku.action === "Reduce Ads") return "Low";
  if (sku.action === "Review Settlement" || sku.action === "Review Return/RTO" || sku.action === "Reprice") return "Medium";
  return "High";
}

export function buildUnifiedActionInbox(result: AnalysisResult): ActionInboxItem[] {
  const close = buildClosePackSummary(result);
  const returns = result.returnRecovery ?? buildReturnRecoverySummary(result.orders, result.skus, result.settlementReconciliation);
  const items: ActionInboxItem[] = [];

  for (const claim of close.claimCandidates) {
    items.push(scored({
      id: claim.id,
      category: "Recovery",
      title: `${claim.externalBatchId}: ${claim.status === "short" ? "short payout" : claim.status === "missing" ? "missing payout" : "failed payout"}`,
      detail: claim.why[0] ?? "Prepare the payout evidence before raising a recovery request.",
      actionLabel: "Prepare recovery evidence",
      channelId: claim.channelId,
      moneyImpactPaise: claim.recoverablePaise,
      confidence: "High",
      urgency: "Critical",
      effort: "Medium",
      blocksClose: true,
    }));
  }

  for (const action of returns.actions) {
    if (action.kind === "Recover Settlement") continue;
    items.push(scored({
      id: `return:${action.id}`,
      category: "Returns",
      title: action.title,
      detail: action.detail,
      actionLabel: action.kind,
      channelId: action.channelId,
      sku: action.sku,
      moneyImpactPaise: action.moneyImpactPaise,
      confidence: action.confidence,
      urgency: action.urgency,
      effort: action.kind === "Add Return Data" ? "Low" : "Medium",
      blocksClose: action.kind === "Review Open Returns",
    }));
  }

  for (const sku of result.skus.filter((item) => item.action !== "Maintain")) {
    if (sku.action === "Review Settlement" && close.claimCandidates.some((claim) => claim.channelId === sku.channelId)) continue;
    items.push(scored({
      id: `sku:${scopedSkuKey(sku)}`,
      category: sku.action === "Add Cost" || sku.action === "Insufficient Data" ? "Data" : "Product",
      title: `${sku.sku}: ${sku.action}`,
      detail: `${sku.primaryProblem}. ${sku.reason}`,
      actionLabel: sku.action,
      channelId: sku.channelId,
      sku: sku.sku,
      moneyImpactPaise: sku.moneyImpactPaise,
      confidence: sku.confidence,
      urgency: skuUrgency(sku),
      effort: skuEffort(sku),
      blocksClose: sku.action === "Add Cost" || sku.action === "Insufficient Data",
    }));
  }

  for (const item of close.checklist.filter((entry) => entry.status !== "pass")) {
    const duplicate = items.some((existing) =>
      (item.id === "required-costs" && existing.actionLabel === "Add Cost") ||
      (item.id === "payout-bank" && existing.category === "Recovery") ||
      (item.id === "returns" && existing.actionLabel === "Review Open Returns"),
    );
    if (duplicate) continue;
    items.push(scored({
      id: `close:${item.id}`,
      category: "Close",
      title: item.label,
      detail: item.detail,
      actionLabel: item.status === "block" ? "Fix close blocker" : "Review before close",
      moneyImpactPaise: 0,
      confidence: "High",
      urgency: item.status === "block" ? "Critical" : "High",
      effort: "Low",
      blocksClose: item.status === "block",
    }));
  }

  const urgencyRank = { Critical: 0, High: 1, Normal: 2 } as const;
  return items.sort((a, b) => {
    if (a.blocksClose !== b.blocksClose) return a.blocksClose ? -1 : 1;
    const urgency = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    return urgency || b.score - a.score || b.moneyImpactPaise - a.moneyImpactPaise || a.title.localeCompare(b.title);
  });
}
