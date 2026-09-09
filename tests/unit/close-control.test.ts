import { describe, expect, it } from "vitest";
import { analyze } from "@/core/analyze";
import { buildClosePackSummary } from "@/core/close-intelligence";
import { buildUnifiedActionInbox } from "@/core/action-inbox";
import type { AnalysisInput, NormalizedEvent } from "@/core/types";

function baseEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
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
    eventDate: "2026-09-01T00:00:00.000Z",
    source: {
      fileName: "payments.csv",
      channelId: "meesho",
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: "fp-payments",
    },
    ...overrides,
  };
}

function baseInput(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    events: [baseEvent()],
    costs: [{ sku: "SKU-1", productCostPaise: 20_000, packagingCostPaise: 1_000 }],
    minimumSampleSize: 1,
    ...overrides,
  };
}

describe("F5 monthly close, claim evidence and unified action inbox", () => {
  it("turns a reference-linked short payout into a deterministic claim and top recovery action", () => {
    const result = analyze(baseInput({
      settlementBatches: [{
        id: "batch-1",
        channelId: "meesho",
        externalBatchId: "PAY-1",
        expectedAmountPaise: 40_000,
        currency: "INR",
        status: "paid",
        expectedBankBy: "2026-09-02T00:00:00.000Z",
        referenceKeys: ["PAY-1"],
        source: { ...baseEvent().source, rowNumber: 4 },
      }],
      bankTransactions: [{
        id: "bank-1",
        amountPaise: 35_000,
        currency: "INR",
        direction: "credit",
        reference: "PAY-1",
        bookedAt: "2026-09-02T00:00:00.000Z",
      }],
      bankEvidenceCompleteThrough: "2026-09-03T00:00:00.000Z",
    }));

    const close = buildClosePackSummary(result);
    expect(close.claimCandidates).toHaveLength(1);
    expect(close.claimCandidates[0]).toMatchObject({ status: "short", recoverablePaise: 5_000, confidence: "High" });
    expect(close.deterministicRecoveryPaise).toBe(5_000);

    const inbox = buildUnifiedActionInbox(result);
    expect(inbox[0]).toMatchObject({ category: "Recovery", moneyImpactPaise: 5_000, urgency: "Critical", blocksClose: true });
  });

  it("never promotes ambiguous payout evidence into a recovery claim", () => {
    const result = analyze(baseInput({
      settlementBatches: [{
        id: "batch-1",
        channelId: "meesho",
        externalBatchId: "PAY-1",
        expectedAmountPaise: 40_000,
        currency: "INR",
        status: "paid",
        source: { ...baseEvent().source, rowNumber: 4 },
      }],
      bankTransactions: [
        { id: "bank-1", amountPaise: 40_000, currency: "INR", direction: "credit", bookedAt: "2026-09-02T00:00:00.000Z" },
        { id: "bank-2", amountPaise: 40_000, currency: "INR", direction: "credit", bookedAt: "2026-09-02T00:00:00.000Z" },
      ],
    }));

    expect(result.settlementReconciliation?.ambiguousCount).toBe(1);
    const close = buildClosePackSummary(result);
    expect(close.claimCandidates).toHaveLength(0);
    expect(close.deterministicRecoveryPaise).toBe(0);
    expect(close.reviewOnlySettlementExposurePaise).toBe(40_000);
  });

  it("blocks close when required cost data is missing instead of presenting a clean CA pack", () => {
    const result = analyze(baseInput({ costs: [] }));
    const close = buildClosePackSummary(result);
    expect(close.readiness).toBe("Blocked");
    expect(close.checklist.find((item) => item.id === "required-costs")?.status).toBe("block");
    expect(buildUnifiedActionInbox(result).some((item) => item.actionLabel === "Add Cost" && item.blocksClose)).toBe(true);
  });

  it("keeps file-sheet-row provenance in the close evidence index", () => {
    const result = analyze(baseInput());
    const close = buildClosePackSummary(result);
    expect(close.evidenceRows[0]).toMatchObject({
      fileName: "payments.csv",
      sheetName: "CSV",
      rowNumber: 2,
      sourceFingerprint: "fp-payments",
    });
  });
});
