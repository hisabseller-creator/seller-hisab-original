import { scopedOrderKey } from "../canonical/scope";
import { sumPaise } from "../money";
import type { NormalizedEvent, OrderOutcome, ParserIssue, ReconciledOrder } from "../types";

const OUTCOME_PRIORITY: Record<OrderOutcome, number> = {
  return: 7,
  rto: 6,
  exchange: 5,
  cancelled: 4,
  delivered: 3,
  pending: 2,
  unknown: 1,
};

export function reconcileEvents(events: NormalizedEvent[]): {
  orders: ReconciledOrder[];
  issues: ParserIssue[];
} {
  const grouped = new Map<string, NormalizedEvent[]>();
  const issues: ParserIssue[] = [];
  const globalEventKeys = new Map<string, NormalizedEvent>();

  for (const event of events) {
    const duplicateKey = [
      event.channelId ?? "unknown",
      event.channelAccountId ?? "default",
      event.kind,
      event.subOrderId,
      event.sku,
      event.outcome,
      event.salePaise ?? "",
      event.settlementPaise ?? "",
      event.eventDate ?? "",
    ].join("|");
    const prior = globalEventKeys.get(duplicateKey);
    if (prior) {
      issues.push({
        code: "duplicate_event",
        severity: "warning",
        message: `Duplicate event for sub-order ${event.subOrderId} was ignored to prevent double counting.`,
        source: event.source,
      });
      continue;
    }
    globalEventKeys.set(duplicateKey, event);
    const groupKey = scopedOrderKey(event);
    const list = grouped.get(groupKey) ?? [];
    list.push(event);
    grouped.set(groupKey, list);
  }

  const orders = [...grouped.values()].map((group): ReconciledOrder => {
    const subOrderId = group[0].subOrderId;
    const sorted = [...group].sort((a, b) => {
      const date = (b.eventDate ?? "").localeCompare(a.eventDate ?? "");
      return date || OUTCOME_PRIORITY[b.outcome] - OUTCOME_PRIORITY[a.outcome];
    });
    const outcome = sorted.reduce<OrderOutcome>(
      (best, event) =>
        OUTCOME_PRIORITY[event.outcome] > OUTCOME_PRIORITY[best] ? event.outcome : best,
      "unknown",
    );
    const sku = group[0].sku;
    const skuAmbiguous = group.some((event) => event.sku !== sku);
    if (skuAmbiguous) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `Sub-order ${subOrderId} maps to more than one SKU. Its profit is incomplete.`,
        source: group[0].source,
      });
    }
    const settlements = group
      .filter((event) => event.kind !== "order")
      .map((event) => event.settlementPaise);
    const hasSettlementEvidence = settlements.some((value) => value !== undefined);
    const orderSale = sorted.find((event) => event.kind === "order" && event.salePaise !== undefined)?.salePaise;
    const paymentSale = sorted.find((event) => event.salePaise !== undefined)?.salePaise;
    const eventDates = [...new Set(group.map((event) => event.eventDate).filter((date): date is string => Boolean(date)))];
    const periods = new Set(eventDates.map((date) => date.slice(0, 7)));

    return {
      channelId: group[0].channelId,
      channelAccountId: group[0].channelAccountId,
      currency: sorted.find((event) => event.currency)?.currency,
      subOrderId,
      orderId: sorted.find((event) => event.orderId)?.orderId,
      sku,
      skuAmbiguous,
      outcome,
      rawStatuses: [...new Set(group.map((event) => event.rawStatus).filter(Boolean))],
      quantity: Math.max(...group.map((event) => event.quantity || 1)),
      salePaise: orderSale ?? paymentSale,
      settlementPaise: hasSettlementEvidence ? sumPaise(settlements) : undefined,
      sources: group.map((event) => event.source),
      eventDates,
      crossPeriod: periods.size > 1,
      hasOrderEvidence: group.some((event) => event.kind === "order"),
      hasSettlementEvidence,
      duplicateEvents: 0,
    };
  });

  return { orders, issues };
}
