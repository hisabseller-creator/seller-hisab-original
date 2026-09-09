import { describe, expect, it } from "vitest";
import { buildKnownCommitmentForecast, reconcileCashPayouts } from "@/core/cash/reconciliation";

describe("F7 payout to bank reconciliation", () => {
  it("prefers an explicit payout reference and classifies short credit deterministically", () => {
    const result = reconcileCashPayouts({
      now: "2026-09-20T00:00:00.000Z",
      expectedPayouts: [{
        id: "p1",
        externalReference: "SET-100",
        expectedAmountPaise: 100000,
        currency: "INR",
        occurredAt: "2026-09-10T00:00:00.000Z",
      }],
      bankTransactions: [{
        id: "b1",
        amountPaise: 95000,
        direction: "credit",
        currency: "INR",
        bookedAt: "2026-09-11T00:00:00.000Z",
        reference: "SET-100",
      }],
    });
    expect(result.matches[0]).toMatchObject({ status: "short", bankTransactionId: "b1", differencePaise: -5000, matchMethod: "reference" });
    expect(result.atRiskPayoutPaise).toBe(5000);
  });

  it("matches only a unique exact amount candidate inside the date window", () => {
    const result = reconcileCashPayouts({
      expectedPayouts: [{ id: "p1", expectedAmountPaise: 50000, currency: "INR", occurredAt: "2026-09-01T00:00:00.000Z" }],
      bankTransactions: [{ id: "b1", amountPaise: 50000, direction: "credit", currency: "INR", bookedAt: "2026-09-03T00:00:00.000Z" }],
    });
    expect(result.matches[0]).toMatchObject({ status: "matched", bankTransactionId: "b1", matchMethod: "amount-date" });
    expect(result.unmatchedCredits).toHaveLength(0);
  });

  it("does not guess when two same-amount credits are plausible", () => {
    const result = reconcileCashPayouts({
      expectedPayouts: [{ id: "p1", expectedAmountPaise: 50000, currency: "INR", occurredAt: "2026-09-01T00:00:00.000Z" }],
      bankTransactions: [
        { id: "b1", amountPaise: 50000, direction: "credit", currency: "INR", bookedAt: "2026-09-02T00:00:00.000Z" },
        { id: "b2", amountPaise: 50000, direction: "credit", currency: "INR", bookedAt: "2026-09-03T00:00:00.000Z" },
      ],
    });
    expect(result.matches[0].status).toBe("ambiguous");
    expect(result.matches[0].bankTransactionId).toBeUndefined();
    expect(result.unmatchedCredits).toHaveLength(2);
  });

  it("keeps the 13-week runway conservative and based only on user-provided known commitments", () => {
    const forecast = buildKnownCommitmentForecast({ currentBalancePaise: 1000000, weeklyFixedOutflowPaise: 100000 });
    expect(forecast).toHaveLength(13);
    expect(forecast[0].closingBalancePaise).toBe(900000);
    expect(forecast[9].closingBalancePaise).toBe(0);
    expect(forecast[12].closingBalancePaise).toBe(-300000);
  });
});
