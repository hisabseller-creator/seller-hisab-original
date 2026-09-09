import { allocatePaise, assertPaise, sumPaise } from "../money";
import type { ParserIssue, ReconciledOrder, SourceReference } from "../types";
import type { SalesChannelId } from "../channels/catalog";

export type SettlementEvidenceFinality = "released" | "provisional";
export type SettlementCashStage = "marketplace-financial" | "payout";

export type SettlementEvidence = {
  id: string;
  channelId: SalesChannelId;
  channelAccountId?: string;
  orderId: string;
  orderItemId?: string;
  batchId?: string;
  amountPaise: number;
  currency?: string;
  occurredAt?: string;
  finality: SettlementEvidenceFinality;
  cashStage: SettlementCashStage;
  semantic: string;
  source: SourceReference;
};

function orderKey(channelId: SalesChannelId | undefined, channelAccountId: string | undefined, orderId: string | undefined): string | undefined {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!channelId || !normalizedOrderId) return undefined;
  return `${channelId}::${channelAccountId?.trim() || "default"}::${normalizedOrderId}`;
}

export function normalizeOrderId(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  const gid = raw.match(/\/([^/]+)$/)?.[1];
  return (gid ?? raw).replace(/^#/, "").trim();
}

/**
 * Applies order-level settlement evidence after line-level order reconciliation.
 *
 * Marketplace financial APIs often settle at order/transaction grain rather than SKU line grain.
 * SellerHisab allocates a released order-level amount across known order lines by observed line sales.
 * If line sales are unavailable, the allocation is equal and explicitly surfaced as a warning.
 *
 * Existing line-level settlement evidence always wins; overlapping evidence is not double counted.
 */
export function applyOrderSettlementEvidence(
  orders: ReconciledOrder[],
  evidence: SettlementEvidence[] = [],
): { orders: ReconciledOrder[]; issues: ParserIssue[] } {
  if (!evidence.length) return { orders, issues: [] };

  const issues: ParserIssue[] = [];
  const evidenceById = new Map<string, { item: SettlementEvidence; signature: string }>();
  const conflictingEvidenceIds = new Set<string>();
  for (const item of evidence) {
    const signature = JSON.stringify([
      item.channelId,
      item.channelAccountId?.trim() || "default",
      normalizeOrderId(item.orderId),
      item.orderItemId ?? "",
      item.batchId ?? "",
      item.amountPaise,
      item.currency?.trim().toUpperCase() ?? "",
      item.finality,
      item.cashStage,
      item.semantic,
    ]);
    const existing = evidenceById.get(item.id);
    if (!existing) {
      evidenceById.set(item.id, { item, signature });
      continue;
    }
    if (existing.signature === signature) {
      issues.push({
        code: "duplicate_event",
        severity: "warning",
        message: `Duplicate settlement evidence ${item.id} was deduplicated before financial roll-up.`,
        source: item.source,
      });
      continue;
    }
    conflictingEvidenceIds.add(item.id);
    issues.push({
      code: "duplicate_event",
      severity: "critical",
      message: `Settlement evidence ID ${item.id} has conflicting financial values and was excluded rather than guessed.`,
      source: item.source,
    });
  }
  const usableEvidence = [...evidenceById.values()]
    .filter(({ item }) => !conflictingEvidenceIds.has(item.id))
    .map(({ item }) => item);

  const groups = new Map<string, number[]>();
  orders.forEach((order, index) => {
    const key = orderKey(order.channelId, order.channelAccountId, order.orderId);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });

  const releasedByOrder = new Map<string, SettlementEvidence[]>();
  for (const item of usableEvidence) {
    if (item.finality !== "released") continue;
    const key = orderKey(item.channelId, item.channelAccountId, item.orderId);
    if (!key) continue;
    releasedByOrder.set(key, [...(releasedByOrder.get(key) ?? []), item]);
  }

  const output = orders.map((order) => ({ ...order, sources: [...order.sources] }));

  for (const [key, items] of releasedByOrder) {
    const indices = groups.get(key) ?? [];
    if (!indices.length) {
      issues.push({
        code: "settlement_unmatched",
        severity: "warning",
        message: `Released settlement evidence for order ${items[0]?.orderId ?? "unknown"} could not be matched to an imported order.`,
        source: items[0]?.source,
      });
      continue;
    }

    if (indices.some((index) => output[index].hasSettlementEvidence)) {
      issues.push({
        code: "settlement_overlap",
        severity: "warning",
        message: `Order ${items[0]?.orderId ?? "unknown"} already has line-level settlement evidence, so order-level financial evidence was not added again.`,
        source: items[0]?.source,
      });
      continue;
    }

    const currencySet = new Set(items.map((item) => item.currency).filter(Boolean));
    const orderCurrencySet = new Set(indices.map((index) => output[index].currency).filter(Boolean));
    if (currencySet.size > 1 || orderCurrencySet.size > 1 || (currencySet.size === 1 && orderCurrencySet.size === 1 && [...currencySet][0] !== [...orderCurrencySet][0])) {
      issues.push({
        code: "settlement_currency_mismatch",
        severity: "critical",
        message: `Settlement evidence for order ${items[0]?.orderId ?? "unknown"} has a currency mismatch and was not applied.`,
        source: items[0]?.source,
      });
      continue;
    }

    const cashStages = new Set(items.map((item) => item.cashStage));
    if (cashStages.size > 1) {
      issues.push({
        code: "settlement_overlap",
        severity: "critical",
        message: `Settlement evidence for order ${items[0]?.orderId ?? "unknown"} mixes payout and marketplace-financial stages, so it was not combined automatically.`,
        source: items[0]?.source,
      });
      continue;
    }

    const total = sumPaise(items.map((item) => item.amountPaise));
    const weights = indices.map((index) => Math.max(0, output[index].salePaise ?? 0));
    const hasObservedSales = weights.some((weight) => weight > 0);
    const allocations = allocatePaise(total, weights);

    if (indices.length > 1 && !hasObservedSales) {
      issues.push({
        code: "settlement_allocation_estimated",
        severity: "warning",
        message: `Order ${items[0]?.orderId ?? "unknown"} settlement was split equally because line sales were unavailable.`,
        source: items[0]?.source,
      });
    }

    indices.forEach((orderIndex, allocationIndex) => {
      const order = output[orderIndex];
      const allocated = allocations[allocationIndex] ?? 0;
      output[orderIndex] = {
        ...order,
        settlementPaise: assertPaise(allocated),
        hasSettlementEvidence: true,
        settlementCashStage: items[0]?.cashStage,
        settlementFinality: "released",
        settlementEvidenceIds: items.map((item) => item.id),
        settlementBatchIds: [...new Set(items.map((item) => item.batchId).filter((id): id is string => Boolean(id)))],
        settlementWhy: [
          items[0]?.cashStage === "marketplace-financial"
            ? "Released marketplace financial evidence is linked to this order; bank receipt still requires payout/bank evidence."
            : "Released payout evidence is linked to this order.",
        ],
        currency: order.currency ?? items.find((item) => item.currency)?.currency,
        sources: [...order.sources, ...items.map((item) => item.source)],
        eventDates: [
          ...new Set([
            ...order.eventDates,
            ...items.map((item) => item.occurredAt).filter((date): date is string => Boolean(date)),
          ]),
        ],
      };
    });
  }

  return { orders: output, issues };
}
