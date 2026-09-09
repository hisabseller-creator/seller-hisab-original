import { describe, expect, it } from "vitest";
import { analyze } from "@/core/analyze";
import { classifyReturnCause, classifyReturnLifecycle } from "@/core/returns-intelligence";
import type { AnalysisInput, NormalizedEvent } from "@/core/types";

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    eventId: "evt-1",
    kind: "payment",
    channelId: "meesho",
    subOrderId: "SO-1",
    orderId: "O-1",
    sku: "SKU-1",
    rawStatus: "Delivered",
    outcome: "delivered",
    quantity: 1,
    salePaise: 50_000,
    settlementPaise: 40_000,
    source: {
      fileName: "report.csv",
      channelId: "meesho",
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: "fp",
    },
    ...overrides,
  };
}

function input(events: NormalizedEvent[]): AnalysisInput {
  return {
    events,
    costs: [{ sku: "SKU-1", productCostPaise: 20_000, packagingCostPaise: 1_000, variableCostPaise: 500 }],
    minimumSampleSize: 1,
  };
}

describe("F4 returns, RTO and recovery intelligence", () => {
  it("normalizes return lifecycle and causes without inventing a reason", () => {
    expect(classifyReturnLifecycle({ outcome: "unknown", rawStatuses: ["Return initiated / reason: size too small"] })).toBe("open");
    expect(classifyReturnCause({ outcome: "unknown", rawStatuses: ["Return initiated / reason: size too small"] })).toBe("size_fit");
    expect(classifyReturnCause({ outcome: "return", rawStatuses: ["Returned / reason: package damaged"] })).toBe("packaging");
    expect(classifyReturnCause({ outcome: "return", rawStatuses: ["Returned / reason: wrong size"] })).toBe("wrong_item");
    expect(classifyReturnCause({ outcome: "return", rawStatuses: ["Returned"] })).toBe("other");
  });

  it("keeps open return exposure separate from booked return loss", () => {
    const result = analyze(input([
      event(),
      event({
        eventId: "evt-open",
        subOrderId: "SO-2",
        orderId: "O-2",
        rawStatus: "Return initiated / reason: package damaged",
        outcome: "pending",
        settlementPaise: 36_000,
        source: { ...event().source, rowNumber: 3 },
      }),
    ]));

    const summary = result.returnRecovery!;
    expect(summary.openReturnCount).toBe(1);
    expect(summary.openReturnExposurePaise).toBe(51_500);
    expect(summary.observedReturnRtoLossPaise).toBe(0);
    expect(summary.actions.some((action) => action.kind === "Review Open Returns")).toBe(true);
  });

  it("includes known variable handling cost in observed RTO loss", () => {
    const result = analyze(input([
      event(),
      event({
        eventId: "evt-rto",
        subOrderId: "SO-2",
        orderId: "O-2",
        rawStatus: "RTO completed / reason: customer refused COD",
        outcome: "rto",
        settlementPaise: -8_000,
        source: { ...event().source, rowNumber: 3 },
      }),
    ]));

    expect(result.orders.find((order) => order.subOrderId === "SO-2")?.returnRtoLossPaise).toBe(9_500);
    const summary = result.returnRecovery!;
    expect(summary.observedReturnRtoLossPaise).toBe(9_500);
    expect(summary.topCauses[0]?.cause).toBe("buyer_refusal");
  });

  it("turns deterministic short and missing payout evidence into recovery opportunity", () => {
    const result = analyze({
      ...input([event()]),
      settlementBatches: [
        {
          id: "batch-1",
          channelId: "meesho",
          externalBatchId: "PAY-1",
          expectedAmountPaise: 40_000,
          currency: "INR",
          status: "paid",
          expectedBankBy: "2026-09-01T00:00:00.000Z",
          referenceKeys: ["PAY-1"],
          source: { ...event().source, rowNumber: 4 },
        },
      ],
      bankTransactions: [
        {
          id: "bank-1",
          amountPaise: 35_000,
          currency: "INR",
          direction: "credit",
          reference: "PAY-1",
          bookedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      bankEvidenceCompleteThrough: "2026-09-02T00:00:00.000Z",
    });

    expect(result.settlementReconciliation?.shortCount).toBe(1);
    const summary = result.returnRecovery!;
    expect(summary.settlementRecoverablePaise).toBe(5_000);
    expect(summary.potentialRecoveryPaise).toBe(5_000);
    expect(summary.actions[0]?.kind).toBe("Recover Settlement");
  });
});
