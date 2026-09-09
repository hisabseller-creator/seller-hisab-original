import { parseFinancialTimestamp } from "../dates";
import { assertPaise, sumPaise } from "../money";
import type { MoneyPaise, SourceReference } from "../types";
import type { SalesChannelId } from "../channels/catalog";
import type { SettlementEvidence } from "./evidence";

export type SettlementBatchStatus =
  | "pending"
  | "released"
  | "paid"
  | "failed"
  | "cancelled"
  | "unknown";

export type SettlementBatchEvidence = {
  id: string;
  channelId: SalesChannelId;
  channelAccountId?: string;
  externalBatchId: string;
  expectedAmountPaise?: MoneyPaise;
  currency?: string;
  status: SettlementBatchStatus;
  issuedAt?: string;
  expectedBankBy?: string;
  referenceKeys?: string[];
  source: SourceReference;
};

export type BankTransactionEvidence = {
  id: string;
  amountPaise: MoneyPaise;
  currency: string;
  direction: "credit" | "debit";
  bookedAt?: string;
  reference?: string;
  source?: SourceReference;
};

export type SettlementBatchMatchStatus =
  | "matched"
  | "short"
  | "excess"
  | "missing"
  | "pending"
  | "ambiguous"
  | "failed"
  | "incomplete";

export type SettlementBatchReconciliation = {
  batchId: string;
  channelId: SalesChannelId;
  channelAccountId?: string;
  externalBatchId: string;
  marketplaceStatus: SettlementBatchStatus;
  expectedBankBy?: string;
  status: SettlementBatchMatchStatus;
  confidence: "Confirmed" | "Provisional" | "Incomplete";
  expectedBankPaise?: MoneyPaise;
  actualBankPaise?: MoneyPaise;
  differencePaise?: MoneyPaise;
  currency?: string;
  bankTransactionIds: string[];
  settlementEvidenceIds: string[];
  why: string[];
};

export type SettlementReconciliationSummary = {
  confidence: "Confirmed" | "Provisional" | "Incomplete";
  expectedBankPaise: MoneyPaise;
  actualMatchedBankPaise: MoneyPaise;
  differencePaise: MoneyPaise;
  matchedCount: number;
  shortCount: number;
  excessCount: number;
  missingCount: number;
  pendingCount: number;
  ambiguousCount: number;
  failedCount: number;
  incompleteCount: number;
  unbatchedReleasedEvidenceCount: number;
  batches: SettlementBatchReconciliation[];
  why: string[];
};

export type SettlementReconciliationInput = {
  evidence?: SettlementEvidence[];
  batches?: SettlementBatchEvidence[];
  bankTransactions?: BankTransactionEvidence[];
  bankEvidenceCompleteThrough?: string;
  amountTolerancePaise?: MoneyPaise;
  dateWindowDays?: number;
};

function normalizeReference(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeCurrency(value: string | undefined): string | undefined {
  const currency = value?.trim().toUpperCase();
  return currency || undefined;
}

function signedBankAmount(transaction: BankTransactionEvidence): MoneyPaise {
  const magnitude = Math.abs(transaction.amountPaise);
  return assertPaise(transaction.direction === "debit" ? -magnitude : magnitude);
}

function dateDistanceDays(left: string | undefined, right: string | undefined): number | undefined {
  if (!left || !right) return undefined;
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return undefined;
  return Math.abs(leftMs - rightMs) / 86_400_000;
}

function batchKey(channelId: SalesChannelId, channelAccountId: string | undefined, externalBatchId: string): string {
  return `${channelId}::${channelAccountId?.trim() || "default"}::${externalBatchId.trim()}`;
}

function batchReferenceKeys(batch: SettlementBatchEvidence): Set<string> {
  return new Set(
    [batch.externalBatchId, ...(batch.referenceKeys ?? [])]
      .map(normalizeReference)
      .filter(Boolean),
  );
}

function confidenceForStatus(
  status: SettlementBatchMatchStatus,
  batch: SettlementBatchEvidence,
): SettlementBatchReconciliation["confidence"] {
  if (status === "matched") return isTerminalBatch(batch) ? "Confirmed" : "Provisional";
  if (status === "pending") return "Provisional";
  return "Incomplete";
}

function isTerminalBatch(batch: SettlementBatchEvidence): boolean {
  return batch.status === "paid" || batch.status === "released";
}

function timestamp(value: string | undefined): number | undefined {
  return parseFinancialTimestamp(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function bankCoverageReaches(completeThrough: string | undefined, expectedBankBy: string | undefined): boolean | undefined {
  const coverage = timestamp(completeThrough);
  const due = timestamp(expectedBankBy);
  if (coverage === undefined || due === undefined) return undefined;
  return coverage >= due;
}

function bankTransactionSignature(transaction: BankTransactionEvidence): string {
  return JSON.stringify([
    transaction.amountPaise,
    normalizeCurrency(transaction.currency) ?? "",
    transaction.direction,
    transaction.bookedAt ?? "",
    normalizeReference(transaction.reference),
  ]);
}

function mergeBatchGroup(group: SettlementBatchEvidence[]): { batch?: SettlementBatchEvidence; conflict?: string } {
  const first = group[0];
  if (!first) return { conflict: "Payout batch group is empty." };
  if (group.length === 1) return { batch: first };

  const amounts = new Set(group.map((item) => item.expectedAmountPaise).filter((value): value is MoneyPaise => value !== undefined));
  const currencies = new Set(group.map((item) => normalizeCurrency(item.currency)).filter((value): value is string => Boolean(value)));
  const statuses = new Set(group.map((item) => item.status));
  const dueDates = new Set(group.map((item) => item.expectedBankBy).filter((value): value is string => Boolean(value)));
  if (amounts.size > 1 || currencies.size > 1 || statuses.size > 1 || dueDates.size > 1) {
    return { conflict: "Duplicate payout batch ID has conflicting amount, currency, status or expected-bank date; SellerHisab excluded it rather than choosing one version." };
  }

  return {
    batch: {
      ...first,
      expectedAmountPaise: amounts.size === 1 ? [...amounts][0] : first.expectedAmountPaise,
      currency: currencies.size === 1 ? [...currencies][0] : first.currency,
      expectedBankBy: dueDates.size === 1 ? [...dueDates][0] : first.expectedBankBy,
      referenceKeys: [...new Set(group.flatMap((item) => [item.externalBatchId, ...(item.referenceKeys ?? [])]).filter(Boolean))],
    },
  };
}

/**
 * Deterministic settlement-batch to bank reconciliation.
 *
 * Matching order:
 * 1. Exact normalized bank reference against explicit marketplace reference keys.
 * 2. Otherwise, unique exact amount + currency candidate inside the configured date window.
 *
 * Amount differences are classified as short/excess only when the bank transaction is
 * reference-linked. SellerHisab does not infer a short payment from a merely similar amount.
 */
export function reconcileSettlementChain(input: SettlementReconciliationInput): SettlementReconciliationSummary {
  const evidence = input.evidence ?? [];
  const batches = input.batches ?? [];
  const rawBankTransactions = input.bankTransactions ?? [];
  const tolerance = Math.max(0, input.amountTolerancePaise ?? 0);
  const dateWindowDays = Math.max(0, input.dateWindowDays ?? 10);

  const bankById = new Map<string, { transaction: BankTransactionEvidence; signature: string }>();
  const conflictingBankIds = new Set<string>();
  let duplicateBankRows = 0;
  for (const transaction of rawBankTransactions) {
    const signature = bankTransactionSignature(transaction);
    const existing = bankById.get(transaction.id);
    if (!existing) {
      bankById.set(transaction.id, { transaction, signature });
      continue;
    }
    if (existing.signature === signature) {
      duplicateBankRows += 1;
    } else {
      conflictingBankIds.add(transaction.id);
    }
  }
  const bankTransactions = [...bankById.values()]
    .filter(({ transaction }) => !conflictingBankIds.has(transaction.id))
    .map(({ transaction }) => transaction);

  const evidenceByBatch = new Map<string, SettlementEvidence[]>();
  for (const item of evidence) {
    if (!item.batchId) continue;
    const key = batchKey(item.channelId, item.channelAccountId, item.batchId);
    evidenceByBatch.set(key, [...(evidenceByBatch.get(key) ?? []), item]);
  }

  const consumedBankIds = new Set<string>();
  const reconciliations: SettlementBatchReconciliation[] = [];
  const batchGroups = new Map<string, SettlementBatchEvidence[]>();
  for (const batch of batches) {
    const key = batchKey(batch.channelId, batch.channelAccountId, batch.externalBatchId);
    batchGroups.set(key, [...(batchGroups.get(key) ?? []), batch]);
  }
  let conflictingBatchGroups = 0;
  let duplicateBatchRows = 0;

  for (const [key, group] of batchGroups) {
    const merged = mergeBatchGroup(group);
    const first = group[0];
    const lineEvidence = evidenceByBatch.get(key) ?? [];
    if (!merged.batch && first) {
      conflictingBatchGroups += 1;
      reconciliations.push({
        batchId: first.id,
        channelId: first.channelId,
        channelAccountId: first.channelAccountId,
        externalBatchId: first.externalBatchId,
        marketplaceStatus: first.status,
        expectedBankBy: first.expectedBankBy,
        status: "incomplete",
        confidence: "Incomplete",
        currency: normalizeCurrency(first.currency),
        bankTransactionIds: [],
        settlementEvidenceIds: lineEvidence.map((item) => item.id),
        why: [merged.conflict ?? "Duplicate payout batch evidence conflicts and cannot be reconciled safely."],
      });
      continue;
    }
    if (!merged.batch) continue;
    const batch = merged.batch;
    if (group.length > 1) duplicateBatchRows += group.length - 1;
    const why: string[] = [];
    if (group.length > 1) why.push(`${group.length} identical payout-batch representations were deduplicated before reconciliation.`);
    const currency = normalizeCurrency(batch.currency);
    const expected = batch.expectedAmountPaise;

    if (expected === undefined || !currency) {
      why.push("Marketplace batch is missing an explicit expected bank amount or currency, so bank reconciliation stays incomplete.");
      reconciliations.push({
        batchId: batch.id,
        channelId: batch.channelId,
        channelAccountId: batch.channelAccountId,
        externalBatchId: batch.externalBatchId,
        marketplaceStatus: batch.status,
        expectedBankBy: batch.expectedBankBy,
        status: "incomplete",
        confidence: "Incomplete",
        expectedBankPaise: expected,
        currency,
        bankTransactionIds: [],
        settlementEvidenceIds: lineEvidence.map((item) => item.id),
        why,
      });
      continue;
    }

    if (batch.status === "failed" || batch.status === "cancelled") {
      why.push(`Marketplace payout batch is ${batch.status}; it is not expected to reconcile as a successful bank movement.`);
      reconciliations.push({
        batchId: batch.id,
        channelId: batch.channelId,
        channelAccountId: batch.channelAccountId,
        externalBatchId: batch.externalBatchId,
        marketplaceStatus: batch.status,
        expectedBankBy: batch.expectedBankBy,
        status: "failed",
        confidence: "Incomplete",
        expectedBankPaise: expected,
        currency,
        bankTransactionIds: [],
        settlementEvidenceIds: lineEvidence.map((item) => item.id),
        why,
      });
      continue;
    }

    if (batch.status === "pending" || batch.status === "unknown") {
      why.push("Marketplace payout is not final yet, so absence of a bank transaction is not treated as missing payment.");
    }

    const availableBank = bankTransactions.filter((transaction) => !consumedBankIds.has(transaction.id));
    const sameCurrency = availableBank.filter((transaction) => normalizeCurrency(transaction.currency) === currency);
    const refs = batchReferenceKeys(batch);
    const referenceMatches = sameCurrency.filter((transaction) => {
      const reference = normalizeReference(transaction.reference);
      return Boolean(reference) && refs.has(reference);
    });

    let selected: BankTransactionEvidence | undefined;
    let ambiguous = false;
    let selectedByReference = false;

    if (referenceMatches.length === 1) {
      selected = referenceMatches[0];
      selectedByReference = true;
      why.push("Bank transaction matched an explicit marketplace payout/reference ID.");
    } else if (referenceMatches.length > 1) {
      ambiguous = true;
      why.push("More than one bank transaction has the same explicit payout reference; SellerHisab will not choose one automatically.");
    } else {
      const exactAmountMatches = sameCurrency.filter((transaction) => {
        const actual = signedBankAmount(transaction);
        if (Math.abs(actual - expected) > tolerance) return false;
        if (batch.issuedAt && !transaction.bookedAt) return false;
        const distance = dateDistanceDays(batch.issuedAt, transaction.bookedAt);
        return distance === undefined || distance <= dateWindowDays;
      });
      if (exactAmountMatches.length === 1) {
        selected = exactAmountMatches[0];
        why.push(
          batch.issuedAt
            ? "Bank transaction matched uniquely by exact amount, currency and the allowed payout-date window."
            : "Bank transaction matched uniquely by exact amount and currency; marketplace payout date was unavailable for an additional date-window check.",
        );
      } else if (exactAmountMatches.length > 1) {
        ambiguous = true;
        why.push("Multiple bank transactions fit the same amount/currency/date rule; SellerHisab will not guess which one belongs to this payout.");
      }
    }

    if (ambiguous) {
      reconciliations.push({
        batchId: batch.id,
        channelId: batch.channelId,
        channelAccountId: batch.channelAccountId,
        externalBatchId: batch.externalBatchId,
        marketplaceStatus: batch.status,
        expectedBankBy: batch.expectedBankBy,
        status: "ambiguous",
        confidence: "Incomplete",
        expectedBankPaise: expected,
        currency,
        bankTransactionIds: [],
        settlementEvidenceIds: lineEvidence.map((item) => item.id),
        why,
      });
      continue;
    }

    if (!selected) {
      let status: SettlementBatchMatchStatus;
      if (!isTerminalBatch(batch)) {
        status = "pending";
        why.push("No bank transaction is expected to be final while the marketplace payout remains pending.");
      } else {
        const coverageReachesDueDate = bankCoverageReaches(input.bankEvidenceCompleteThrough, batch.expectedBankBy);
        if (coverageReachesDueDate === true) {
          status = "missing";
          why.push("Marketplace payout is final, its explicit expected-bank date is covered by the supplied bank evidence, and no bank transaction matched. This is a deterministic missing-payment exception.");
        } else if (coverageReachesDueDate === false) {
          status = "pending";
          why.push("Marketplace payout is final, but supplied bank evidence does not yet cover its explicit expected-bank date, so SellerHisab does not call it missing.");
        } else {
          status = "incomplete";
          why.push("Marketplace payout is final, but a complete bank-evidence-through date and explicit expected-bank date were not both supplied. SellerHisab will not label the payment missing without that coverage proof.");
        }
      }
      reconciliations.push({
        batchId: batch.id,
        channelId: batch.channelId,
        channelAccountId: batch.channelAccountId,
        externalBatchId: batch.externalBatchId,
        marketplaceStatus: batch.status,
        expectedBankBy: batch.expectedBankBy,
        status,
        confidence: confidenceForStatus(status, batch),
        expectedBankPaise: expected,
        currency,
        bankTransactionIds: [],
        settlementEvidenceIds: lineEvidence.map((item) => item.id),
        why,
      });
      continue;
    }

    consumedBankIds.add(selected.id);
    const actual = signedBankAmount(selected);
    const difference = assertPaise(actual - expected);
    const expectedMagnitude = Math.abs(expected);
    const actualMagnitude = Math.abs(actual);
    const directionMatches = Math.sign(actual || 1) === Math.sign(expected || 1);

    let status: SettlementBatchMatchStatus;
    if (!directionMatches) {
      status = "incomplete";
      why.push("Matched bank movement has the opposite cash direction from the marketplace payout.");
    } else if (Math.abs(difference) <= tolerance) {
      status = "matched";
      why.push("Expected marketplace payout and actual bank movement match within the configured tolerance.");
    } else if (selectedByReference && actualMagnitude < expectedMagnitude) {
      status = "short";
      why.push("Reference-linked bank credit is lower than the marketplace payout amount; this is a deterministic short-payment exception.");
    } else if (selectedByReference && actualMagnitude > expectedMagnitude) {
      status = "excess";
      why.push("Reference-linked bank movement is higher than the marketplace payout amount; review for combined credits or adjustments.");
    } else {
      status = "incomplete";
      why.push("Amount differs without an explicit reference link, so SellerHisab does not label it short/excess automatically.");
    }

    if (lineEvidence.length) {
      const releasedLineTotal = sumPaise(
        lineEvidence
          .filter((item) => item.finality === "released")
          .map((item) => item.amountPaise),
      );
      if (releasedLineTotal !== expected) {
        why.push("Order-attributed settlement lines do not equal the full payout batch amount; non-order adjustments may exist and the batch amount remains authoritative for bank reconciliation.");
      }
    }

    reconciliations.push({
      batchId: batch.id,
      channelId: batch.channelId,
      channelAccountId: batch.channelAccountId,
      externalBatchId: batch.externalBatchId,
      marketplaceStatus: batch.status,
      expectedBankBy: batch.expectedBankBy,
      status,
      confidence: confidenceForStatus(status, batch),
      expectedBankPaise: expected,
      actualBankPaise: actual,
      differencePaise: difference,
      currency,
      bankTransactionIds: [selected.id],
      settlementEvidenceIds: lineEvidence.map((item) => item.id),
      why,
    });
  }

  const terminalReconciliations = reconciliations.filter(
    (item) => item.marketplaceStatus === "paid" || item.marketplaceStatus === "released",
  );
  const expectedBankPaise = sumPaise(terminalReconciliations.map((item) => item.expectedBankPaise));
  const actualMatchedBankPaise = sumPaise(terminalReconciliations.map((item) => item.actualBankPaise));
  const differencePaise = assertPaise(actualMatchedBankPaise - expectedBankPaise);
  const count = (status: SettlementBatchMatchStatus) => reconciliations.filter((item) => item.status === status).length;
  const unbatchedReleasedEvidenceCount = evidence.filter((item) => item.finality === "released" && !item.batchId).length;

  const shortCount = count("short");
  const excessCount = count("excess");
  const missingCount = count("missing");
  const ambiguousCount = count("ambiguous");
  const failedCount = count("failed");
  const incompleteCount = count("incomplete");
  const pendingCount = count("pending");
  const matchedCount = count("matched");
  const hasIncomplete = reconciliations.some((item) => item.confidence === "Incomplete") || conflictingBankIds.size > 0 || conflictingBatchGroups > 0;
  const hasProvisional = reconciliations.some((item) => item.confidence === "Provisional");
  const confidence: SettlementReconciliationSummary["confidence"] = hasIncomplete
    ? "Incomplete"
    : hasProvisional || unbatchedReleasedEvidenceCount > 0
      ? "Provisional"
      : reconciliations.length > 0 && reconciliations.every((item) => item.confidence === "Confirmed")
        ? "Confirmed"
        : "Incomplete";

  const summaryWhy: string[] = [];
  if (duplicateBatchRows) summaryWhy.push(`${duplicateBatchRows} duplicate payout-batch row(s) were deduplicated by scoped batch ID.`);
  if (conflictingBatchGroups) summaryWhy.push(`${conflictingBatchGroups} duplicate payout-batch ID group(s) conflict and were excluded from expected-bank totals.`);
  if (duplicateBankRows) summaryWhy.push(`${duplicateBankRows} exact duplicate bank row(s) were deduplicated by bank evidence ID.`);
  if (conflictingBankIds.size) summaryWhy.push(`${conflictingBankIds.size} bank evidence ID(s) have conflicting values and were excluded from automatic matching.`);
  if (matchedCount) summaryWhy.push(`${matchedCount} payout batch(es) matched to bank evidence.`);
  if (shortCount) summaryWhy.push(`${shortCount} reference-linked payout batch(es) are short.`);
  if (excessCount) summaryWhy.push(`${excessCount} reference-linked payout batch(es) exceed the expected amount.`);
  if (missingCount) summaryWhy.push(`${missingCount} released/paid payout batch(es) have no matched bank evidence.`);
  if (ambiguousCount) summaryWhy.push(`${ambiguousCount} payout batch(es) have ambiguous bank candidates.`);
  if (failedCount) summaryWhy.push(`${failedCount} payout batch(es) are failed/cancelled and excluded from expected bank receipts.`);
  if (incompleteCount) summaryWhy.push(`${incompleteCount} payout batch(es) lack enough evidence for a deterministic bank conclusion.`);
  if (pendingCount) summaryWhy.push(`${pendingCount} payout batch(es) are still pending or not yet covered by complete bank evidence.`);
  if (unbatchedReleasedEvidenceCount) summaryWhy.push(`${unbatchedReleasedEvidenceCount} released settlement line(s) are not linked to a payout batch yet.`);
  if (!summaryWhy.length) summaryWhy.push("No complete payout-to-bank chain was supplied for reconciliation.");

  return {
    confidence,
    expectedBankPaise,
    actualMatchedBankPaise,
    differencePaise,
    matchedCount,
    shortCount,
    excessCount,
    missingCount,
    pendingCount,
    ambiguousCount,
    failedCount,
    incompleteCount,
    unbatchedReleasedEvidenceCount,
    batches: reconciliations,
    why: summaryWhy,
  };
}
