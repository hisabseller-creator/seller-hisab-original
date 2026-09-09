import { parseFinancialTimestamp } from "../dates";
import { assertPaise, sumPaise } from "../money";
import type { MoneyPaise } from "../types";

export type CashBankTransaction = {
  id: string;
  amountPaise: MoneyPaise;
  direction: "credit" | "debit";
  currency: string;
  bookedAt: string;
  reference?: string;
  description?: string;
};

export type ExpectedPayout = {
  id: string;
  channelAccountId?: string;
  channelLabel?: string;
  externalReference?: string;
  referenceKeys?: string[];
  expectedAmountPaise: MoneyPaise;
  sourceCoverageComplete?: boolean;
  currency: string;
  occurredAt?: string;
  expectedBankBy?: string;
};

export type CashMatchStatus = "matched" | "short" | "excess" | "missing" | "pending" | "ambiguous";

export type CashPayoutMatch = {
  expectedId: string;
  channelAccountId?: string;
  channelLabel?: string;
  externalReference?: string;
  status: CashMatchStatus;
  expectedPaise: MoneyPaise;
  actualPaise?: MoneyPaise;
  differencePaise?: MoneyPaise;
  currency: string;
  expectedBankBy?: string;
  occurredAt?: string;
  bankTransactionId?: string;
  matchMethod?: "reference" | "amount-date";
  why: string;
};

export type CashReconciliationSummary = {
  matches: CashPayoutMatch[];
  unmatchedCredits: CashBankTransaction[];
  matchedPayoutPaise: MoneyPaise;
  atRiskPayoutPaise: MoneyPaise;
  pendingPayoutPaise: MoneyPaise;
  unmatchedCreditPaise: MoneyPaise;
};

function normalizedReference(value: string | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function timestamp(value: string | undefined): number | undefined {
  return parseFinancialTimestamp(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function dateDistanceDays(left: string | undefined, right: string | undefined): number | undefined {
  const a = timestamp(left);
  const b = timestamp(right);
  if (a === undefined || b === undefined) return undefined;
  return Math.abs(a - b) / 86_400_000;
}

function hasReferenceMatch(transaction: CashBankTransaction, expected: ExpectedPayout): boolean {
  const haystacks = [transaction.reference, transaction.description]
    .map(normalizedReference)
    .filter((value) => value.length >= 5);
  const needles = [expected.externalReference, ...(expected.referenceKeys ?? [])]
    .map(normalizedReference)
    .filter((value) => value.length >= 5);
  return needles.some((needle) => haystacks.some((haystack) => haystack.includes(needle) || needle.includes(haystack)));
}

function dueTimestamp(expected: ExpectedPayout): number | undefined {
  return timestamp(expected.expectedBankBy) ?? timestamp(expected.occurredAt);
}

export function reconcileCashPayouts(input: {
  expectedPayouts: ExpectedPayout[];
  bankTransactions: CashBankTransaction[];
  now?: string;
  dateWindowDays?: number;
  pendingGraceDays?: number;
  bankCoverage?: { start?: string; end?: string };
}): CashReconciliationSummary {
  const dateWindowDays = Math.max(0, input.dateWindowDays ?? 10);
  const pendingGraceDays = Math.max(0, input.pendingGraceDays ?? 3);
  const nowMs = timestamp(input.now ?? new Date().toISOString()) ?? Date.now();
  const credits = input.bankTransactions.filter((item) => item.direction === "credit" && item.amountPaise >= 0);
  const consumed = new Set<string>();
  const matches: CashPayoutMatch[] = [];

  for (const expected of input.expectedPayouts) {
    if (expected.sourceCoverageComplete === false) {
      matches.push({expectedId:expected.id,channelAccountId:expected.channelAccountId,status:"pending",expectedPaise:expected.expectedAmountPaise,currency:expected.currency,why:"Marketplace source coverage is incomplete. No confirmed bank match or recovery claim can be inferred."});
      continue;
    }
    const available = credits.filter((item) => !consumed.has(item.id) && item.currency.toUpperCase() === expected.currency.toUpperCase());
    const referenceCandidates = available.filter((item) => hasReferenceMatch(item, expected));

    if (referenceCandidates.length === 1) {
      const bank = referenceCandidates[0];
      consumed.add(bank.id);
      const difference = assertPaise(bank.amountPaise - expected.expectedAmountPaise);
      const status: CashMatchStatus = difference === 0 ? "matched" : difference < 0 ? "short" : "excess";
      matches.push({
        expectedId: expected.id,
        channelAccountId: expected.channelAccountId,
        channelLabel: expected.channelLabel,
        externalReference: expected.externalReference,
        status,
        expectedPaise: expected.expectedAmountPaise,
        actualPaise: bank.amountPaise,
        differencePaise: difference,
        currency: expected.currency,
        expectedBankBy: expected.expectedBankBy,
        occurredAt: expected.occurredAt,
        bankTransactionId: bank.id,
        matchMethod: "reference",
        why: status === "matched"
          ? "Marketplace payout reference and bank credit match exactly."
          : status === "short"
            ? "Reference matches, but the credited amount is lower than the expected payout."
            : "Reference matches, but the credited amount is higher than the expected payout.",
      });
      continue;
    }

    if (referenceCandidates.length > 1) {
      matches.push({
        expectedId: expected.id,
        channelAccountId: expected.channelAccountId,
        channelLabel: expected.channelLabel,
        externalReference: expected.externalReference,
        status: "ambiguous",
        expectedPaise: expected.expectedAmountPaise,
        currency: expected.currency,
        expectedBankBy: expected.expectedBankBy,
        occurredAt: expected.occurredAt,
        why: "More than one bank credit contains the same payout reference. SellerHisab did not choose one automatically.",
      });
      continue;
    }

    const amountCandidates = available.filter((item) => {
      if (item.amountPaise !== expected.expectedAmountPaise) return false;
      const distance = dateDistanceDays(item.bookedAt, expected.expectedBankBy ?? expected.occurredAt);
      return distance !== undefined && distance <= dateWindowDays;
    });

    if (amountCandidates.length === 1) {
      const bank = amountCandidates[0];
      consumed.add(bank.id);
      matches.push({
        expectedId: expected.id,
        channelAccountId: expected.channelAccountId,
        channelLabel: expected.channelLabel,
        externalReference: expected.externalReference,
        status: "matched",
        expectedPaise: expected.expectedAmountPaise,
        actualPaise: bank.amountPaise,
        differencePaise: assertPaise(0),
        currency: expected.currency,
        expectedBankBy: expected.expectedBankBy,
        occurredAt: expected.occurredAt,
        bankTransactionId: bank.id,
        matchMethod: "amount-date",
        why: "A unique exact amount and currency bank credit was found inside the reconciliation date window.",
      });
      continue;
    }

    if (amountCandidates.length > 1) {
      matches.push({
        expectedId: expected.id,
        channelAccountId: expected.channelAccountId,
        channelLabel: expected.channelLabel,
        externalReference: expected.externalReference,
        status: "ambiguous",
        expectedPaise: expected.expectedAmountPaise,
        currency: expected.currency,
        expectedBankBy: expected.expectedBankBy,
        occurredAt: expected.occurredAt,
        why: "Multiple same-amount bank credits are plausible. A payout reference is required before SellerHisab can confirm the match.",
      });
      continue;
    }

    const due = dueTimestamp(expected);
    const coverageStartMs = timestamp(input.bankCoverage?.start);
    const coverageEndMs = timestamp(input.bankCoverage?.end);
    const coverageIncludesDue = due !== undefined
      && coverageStartMs !== undefined
      && coverageEndMs !== undefined
      && coverageStartMs <= due
      && coverageEndMs >= due;
    const insideGrace = due !== undefined && nowMs - due < pendingGraceDays * 86_400_000;
    const pending = insideGrace || !coverageIncludesDue;
    matches.push({
      expectedId: expected.id,
      channelAccountId: expected.channelAccountId,
      channelLabel: expected.channelLabel,
      externalReference: expected.externalReference,
      status: pending ? "pending" : "missing",
      expectedPaise: expected.expectedAmountPaise,
      currency: expected.currency,
      expectedBankBy: expected.expectedBankBy,
      occurredAt: expected.occurredAt,
      why: pending
        ? insideGrace
          ? "No bank credit is matched yet, but the payout is still inside the configured grace period."
          : "SellerHisab cannot call this payout missing because the imported bank coverage does not prove the payout due date was observed."
        : "No unique bank credit could be matched to this expected payout inside bank coverage that includes the payout due date.",
    });
  }

  const unmatchedCredits = credits.filter((item) => !consumed.has(item.id));
  const matchedPayoutPaise = sumPaise(matches.filter((item) => item.status === "matched" || item.status === "short" || item.status === "excess").map((item) => item.actualPaise));
  const atRiskPayoutPaise = sumPaise(matches.map((item) => {
    if (item.status === "missing" || item.status === "ambiguous") return item.expectedPaise;
    if (item.status === "short") return assertPaise(Math.max(0, -Number(item.differencePaise ?? 0)));
    return undefined;
  }));
  const pendingPayoutPaise = sumPaise(matches.filter((item) => item.status === "pending").map((item) => item.expectedPaise));
  const unmatchedCreditPaise = sumPaise(unmatchedCredits.map((item) => item.amountPaise));

  return { matches, unmatchedCredits, matchedPayoutPaise, atRiskPayoutPaise, pendingPayoutPaise, unmatchedCreditPaise };
}

export type CashForecastWeek = {
  week: number;
  openingBalancePaise: MoneyPaise;
  plannedOutflowPaise: MoneyPaise;
  closingBalancePaise: MoneyPaise;
};

export function buildKnownCommitmentForecast(input: {
  currentBalancePaise?: MoneyPaise;
  weeklyFixedOutflowPaise?: MoneyPaise;
  weeks?: number;
}): CashForecastWeek[] {
  if (input.currentBalancePaise === undefined || input.weeklyFixedOutflowPaise === undefined) return [];
  const weeks = Math.min(13, Math.max(1, input.weeks ?? 13));
  const output: CashForecastWeek[] = [];
  let opening = input.currentBalancePaise;
  for (let week = 1; week <= weeks; week += 1) {
    const closing = assertPaise(opening - input.weeklyFixedOutflowPaise);
    output.push({ week, openingBalancePaise: opening, plannedOutflowPaise: input.weeklyFixedOutflowPaise, closingBalancePaise: closing });
    opening = closing;
  }
  return output;
}
