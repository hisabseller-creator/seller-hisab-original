import { assertPaise, sumPaise } from "./money";
import type {
  MoneyPaise,
  OrderEconomics,
  ReturnCauseCategory,
  ReturnRecoveryAction,
  ReturnRecoverySummary,
  ReturnSkuRisk,
  SkuEconomics,
} from "./types";
import type { SettlementReconciliationSummary } from "./settlements/reconciliation";

const CAUSE_PATTERNS: Array<[ReturnCauseCategory, RegExp]> = [
  // Prefer specific phrases before broad terms like “size” or “damaged”.
  ["packaging", /\b(packaging|package damaged|box damaged|poor packing|packing issue)\b/i],
  ["wrong_item", /\b(wrong item|wrong product|incorrect item|different item|wrong color|wrong colour|wrong size)\b/i],
  ["size_fit", /\b(size|fit|fitting|too small|too large|tight|loose)\b/i],
  ["quality_damage", /\b(defect|defective|damag|broken|quality|torn|stain|leak|not working|faulty)\b/i],
  ["not_as_described", /\b(not as described|description mismatch|image mismatch|different from image|expectation|material issue)\b/i],
  ["delivery_issue", /\b(address|delivery|delayed|late|courier|shipment|attempt|undeliver|customer unavailable|not reachable|doorstep)\b/i],
  ["buyer_refusal", /\b(refused|rejected|not accepted|customer denied|customer reject|cod reject|changed mind|no longer needed|not required)\b/i],
];

const CAUSE_LABELS: Record<ReturnCauseCategory, string> = {
  size_fit: "Size / fit",
  quality_damage: "Quality / damage",
  wrong_item: "Wrong item / variant",
  not_as_described: "Listing expectation mismatch",
  packaging: "Packaging",
  delivery_issue: "Delivery / address",
  buyer_refusal: "Buyer refusal / changed mind",
  rto: "RTO / delivery failure",
  other: "Other",
  unknown: "Reason not supplied",
};

export function returnCauseLabel(cause: ReturnCauseCategory): string {
  return CAUSE_LABELS[cause];
}

export function classifyReturnCause(order: Pick<OrderEconomics, "outcome" | "rawStatuses">): ReturnCauseCategory {
  const text = order.rawStatuses.join(" | ");
  for (const [cause, pattern] of CAUSE_PATTERNS) {
    if (pattern.test(text)) return cause;
  }
  if (order.outcome === "rto") return "rto";
  if (/\breturn|refund|rto\b/i.test(text)) return "other";
  return "unknown";
}

export function classifyReturnLifecycle(order: Pick<OrderEconomics, "outcome" | "rawStatuses">): "none" | "open" | "completed" | "rto" {
  const text = order.rawStatuses.join(" | ").toLowerCase();
  const hasOpenSignal = /return|refund|rto/.test(text) && /initiated|requested|approved|pickup|picked|in transit|shipped|processing|pending|open/.test(text);
  const hasClosedSignal = /return complete|return completed|return delivered|returned|refund complete|refunded|closed|received back/.test(text);
  if (hasOpenSignal && !hasClosedSignal) return "open";
  if (order.outcome === "rto") return "rto";
  if (order.outcome === "return" || hasClosedSignal) return "completed";
  return "none";
}

export function buildReturnRecoverySummary(
  orders: OrderEconomics[],
  skus: SkuEconomics[],
  settlement?: SettlementReconciliationSummary,
): ReturnRecoverySummary {
  const returnOrders = orders.filter((order) => order.outcome === "return");
  const rtoOrders = orders.filter((order) => order.outcome === "rto");
  const openOrders = orders.filter((order) => classifyReturnLifecycle(order) === "open");
  const completedFailureOrders = [...returnOrders, ...rtoOrders];
  const delivered = orders.filter((order) => order.outcome === "delivered").length;
  const failureDenominator = delivered + completedFailureOrders.length;
  const observedLossPaise = sumPaise(completedFailureOrders.map((order) => order.returnRtoLossPaise));
  const openReturnExposurePaise = sumPaise(openOrders.map(openReturnExposure));
  const settlementRecovery = settlementRecoveryExposure(settlement);
  const causeMap = new Map<ReturnCauseCategory, { count: number; lossPaise: number; openExposurePaise: number }>();

  for (const order of [...completedFailureOrders, ...openOrders]) {
    const cause = classifyReturnCause(order);
    const current = causeMap.get(cause) ?? { count: 0, lossPaise: 0, openExposurePaise: 0 };
    const isOpen = classifyReturnLifecycle(order) === "open";
    current.count += 1;
    current.lossPaise = assertPaise(current.lossPaise + (isOpen ? 0 : (order.returnRtoLossPaise ?? 0)));
    current.openExposurePaise = assertPaise(current.openExposurePaise + (isOpen ? openReturnExposure(order) : 0));
    causeMap.set(cause, current);
  }

  const channelGroups = new Map<string, OrderEconomics[]>();
  for (const order of orders) {
    const key = `${order.channelId ?? "unknown"}::${order.channelAccountId ?? "default"}`;
    channelGroups.set(key, [...(channelGroups.get(key) ?? []), order]);
  }
  const channels: ReturnRecoverySummary["channels"] = [...channelGroups.values()]
    .map((group) => {
      const channelId: ReturnRecoverySummary["channels"][number]["channelId"] = group[0]?.channelId ?? "unknown";
      const failures = group.filter((order) => order.outcome === "return" || order.outcome === "rto");
      const deliveredCount = group.filter((order) => order.outcome === "delivered").length;
      const open = group.filter((order) => classifyReturnLifecycle(order) === "open");
      const denominator = deliveredCount + failures.length;
      return {
        channelId,
        channelAccountId: group[0]?.channelAccountId,
        delivered: deliveredCount,
        returns: failures.filter((order) => order.outcome === "return").length,
        rto: failures.filter((order) => order.outcome === "rto").length,
        openReturns: open.length,
        returnRtoRate: denominator ? failures.length / denominator : undefined,
        observedLossPaise: sumPaise(failures.map((order) => order.returnRtoLossPaise)),
        openExposurePaise: sumPaise(open.map(openReturnExposure)),
      };
    })
    .sort((a, b) => (b.observedLossPaise + b.openExposurePaise) - (a.observedLossPaise + a.openExposurePaise));

  const skuRisks = buildSkuRisks(orders, skus);
  const actions = buildActions(skuRisks, settlement, causeMap, openOrders.length);
  const avoidableReturnRtoLossPaise = sumPaise(skuRisks.map((sku) => sku.avoidableLossPaise));
  // “Recovery” is reserved for money supported by payout evidence. Historical avoidable return/RTO
  // leakage remains a prevention signal and is never relabelled as recoverable cash.
  const potentialRecoveryPaise = settlementRecovery.recoverablePaise;

  return {
    returnCount: returnOrders.length,
    rtoCount: rtoOrders.length,
    openReturnCount: openOrders.length,
    returnRtoRate: failureDenominator ? completedFailureOrders.length / failureDenominator : undefined,
    observedReturnRtoLossPaise: observedLossPaise,
    openReturnExposurePaise,
    avoidableReturnRtoLossPaise,
    settlementRecoverablePaise: settlementRecovery.recoverablePaise,
    settlementReviewExposurePaise: settlementRecovery.reviewExposurePaise,
    potentialRecoveryPaise,
    topCauses: [...causeMap.entries()]
      .map(([cause, values]) => ({ cause, label: returnCauseLabel(cause), ...values }))
      .sort((a, b) => (b.lossPaise + b.openExposurePaise) - (a.lossPaise + a.openExposurePaise) || b.count - a.count)
      .slice(0, 6),
    channels,
    skuRisks: skuRisks.slice(0, 12),
    actions: actions.slice(0, 8),
  };
}

function openReturnExposure(order: OrderEconomics): MoneyPaise {
  const cashOrSale = Math.max(0, order.salePaise ?? order.settlementPaise ?? 0);
  return assertPaise(cashOrSale + (order.packagingCostPaise ?? 0) + (order.variableCostPaise ?? 0));
}

function buildSkuRisks(orders: OrderEconomics[], skus: SkuEconomics[]): ReturnSkuRisk[] {
  return skus.map((sku) => {
    const group = orders.filter((order) => order.channelId === sku.channelId && order.channelAccountId === sku.channelAccountId && order.sku === sku.sku);
    const failures = group.filter((order) => order.outcome === "return" || order.outcome === "rto");
    const open = group.filter((order) => classifyReturnLifecycle(order) === "open");
    const observedLossPaise = sumPaise(failures.map((order) => order.returnRtoLossPaise));
    const openExposurePaise = sumPaise(open.map(openReturnExposure));
    const causeCounts = new Map<ReturnCauseCategory, number>();
    group
      .filter((order) => classifyReturnLifecycle(order) !== "none")
      .forEach((order) => {
        const cause = classifyReturnCause(order);
        causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + 1);
      });
    const topCause = [...causeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
    const rate = sku.returnRtoRate;
    const safe = sku.maxSafeFailureRate;
    const excessRatio = rate !== undefined && safe !== undefined && rate > 0 && rate > safe
      ? Math.min(1, (rate - safe) / rate)
      : 0;
    const avoidableLossPaise = assertPaise(Math.round(observedLossPaise * excessRatio));
    const severity: ReturnSkuRisk["severity"] = openExposurePaise > 0 || avoidableLossPaise >= 5_000_00 || (rate ?? 0) >= 0.35
      ? "Critical"
      : observedLossPaise > 0 || (rate ?? 0) >= 0.2
        ? "High"
        : "Normal";
    return {
      channelId: sku.channelId,
      channelAccountId: sku.channelAccountId,
      sku: sku.sku,
      delivered: sku.delivered,
      returns: failures.filter((order) => order.outcome === "return").length,
      rto: failures.filter((order) => order.outcome === "rto").length,
      openReturns: open.length,
      returnRtoRate: rate,
      safeFailureRate: safe,
      observedLossPaise,
      openExposurePaise,
      avoidableLossPaise,
      topCause,
      topCauseLabel: returnCauseLabel(topCause),
      severity,
      confidence: sku.confidence,
    };
  }).sort((a, b) => (b.avoidableLossPaise + b.openExposurePaise + b.observedLossPaise) - (a.avoidableLossPaise + a.openExposurePaise + a.observedLossPaise));
}

function settlementRecoveryExposure(settlement?: SettlementReconciliationSummary): { recoverablePaise: MoneyPaise; reviewExposurePaise: MoneyPaise } {
  if (!settlement) return { recoverablePaise: 0, reviewExposurePaise: 0 };
  let recoverablePaise = 0;
  let reviewExposurePaise = 0;
  for (const batch of settlement.batches) {
    if (batch.status === "short") {
      recoverablePaise += Math.max(0, -(batch.differencePaise ?? 0));
    } else if (batch.status === "missing" || batch.status === "failed") {
      recoverablePaise += Math.max(0, batch.expectedBankPaise ?? 0);
    } else if (batch.status === "ambiguous" || batch.status === "incomplete") {
      reviewExposurePaise += Math.max(0, batch.expectedBankPaise ?? 0);
    }
  }
  return { recoverablePaise: assertPaise(recoverablePaise), reviewExposurePaise: assertPaise(reviewExposurePaise) };
}

function buildActions(
  skuRisks: ReturnSkuRisk[],
  settlement: SettlementReconciliationSummary | undefined,
  causeMap: Map<ReturnCauseCategory, { count: number; lossPaise: number; openExposurePaise: number }>,
  openReturnCount: number,
): ReturnRecoveryAction[] {
  const actions: ReturnRecoveryAction[] = [];
  const settlementExposure = settlementRecoveryExposure(settlement);
  if (settlementExposure.recoverablePaise > 0) {
    actions.push({
      id: "recover-settlement",
      kind: "Recover Settlement",
      title: "Review short / missing payouts first",
      detail: "SellerHisab found deterministic short, missing or failed payout evidence. Open the settlement evidence before filing a claim.",
      moneyImpactPaise: settlementExposure.recoverablePaise,
      confidence: "High",
      urgency: "Critical",
    });
  }
  if (openReturnCount > 0) {
    const amount = sumPaise(skuRisks.map((sku) => sku.openExposurePaise));
    actions.push({
      id: "open-returns",
      kind: "Review Open Returns",
      title: `${openReturnCount} open return/RTO flow(s) still expose money`,
      detail: "These are exposure amounts, not booked losses. Verify pickup/receipt/refund completion before treating the outcome as final.",
      moneyImpactPaise: amount,
      confidence: "Medium",
      urgency: "High",
    });
  }
  for (const sku of skuRisks.filter((item) => item.avoidableLossPaise > 0).slice(0, 4)) {
    actions.push({
      id: `sku:${sku.channelId ?? "unknown"}:${sku.channelAccountId ?? "default"}:${sku.sku}`,
      kind: actionForCause(sku.topCause),
      title: `${sku.sku}: ${actionTitleForCause(sku.topCause)}`,
      detail: sku.safeFailureRate === undefined
        ? `${sku.topCauseLabel} is the leading observed return/RTO signal. More complete outcomes are required for a safe-rate threshold.`
        : `Observed return/RTO ${(100 * (sku.returnRtoRate ?? 0)).toFixed(1)}% vs safe limit ${(100 * sku.safeFailureRate).toFixed(1)}%.`,
      channelId: sku.channelId,
      sku: sku.sku,
      moneyImpactPaise: sku.avoidableLossPaise,
      confidence: sku.confidence,
      urgency: sku.severity === "Critical" ? "Critical" : "High",
    });
  }
  const unknown = causeMap.get("unknown")?.count ?? 0;
  if (unknown >= 2) {
    actions.push({
      id: "missing-return-reasons",
      kind: "Add Return Data",
      title: "Import return reasons before changing listings or packaging",
      detail: `${unknown} return/RTO event(s) have no supportable reason. SellerHisab will not invent a root cause.`,
      moneyImpactPaise: 0,
      confidence: "High",
      urgency: "Normal",
    });
  }
  return actions.sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency) || b.moneyImpactPaise - a.moneyImpactPaise || a.title.localeCompare(b.title));
}

function actionForCause(cause: ReturnCauseCategory): ReturnRecoveryAction["kind"] {
  if (cause === "packaging") return "Fix Packaging";
  if (cause === "quality_damage") return "QC / Supplier";
  if (cause === "size_fit" || cause === "wrong_item" || cause === "not_as_described") return "Fix Listing";
  if (cause === "rto" || cause === "delivery_issue" || cause === "buyer_refusal") return "Reduce RTO";
  return "Review Return/RTO";
}

function actionTitleForCause(cause: ReturnCauseCategory): string {
  if (cause === "packaging") return "fix packaging leakage";
  if (cause === "quality_damage") return "check QC / supplier batch";
  if (cause === "size_fit") return "fix size/fit expectation";
  if (cause === "wrong_item") return "check variant/listing mapping";
  if (cause === "not_as_described") return "fix listing expectation";
  if (cause === "rto" || cause === "delivery_issue" || cause === "buyer_refusal") return "reduce RTO drivers";
  return "review return/RTO evidence";
}

function urgencyRank(value: ReturnRecoveryAction["urgency"]): number {
  return value === "Critical" ? 0 : value === "High" ? 1 : 2;
}
