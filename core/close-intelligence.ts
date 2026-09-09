import { channelLabel } from "./channels/catalog";
import { assertPaise, sumPaise } from "./money";
import { buildReturnRecoverySummary } from "./returns-intelligence";
import type { AnalysisResult, MoneyPaise, SourceReference } from "./types";
import type { SettlementBatchReconciliation } from "./settlements/reconciliation";

export type CloseReadiness = "Ready" | "Review" | "Blocked";
export type CloseChecklistStatus = "pass" | "review" | "block";

export type CloseChecklistItem = {
  id: string;
  label: string;
  status: CloseChecklistStatus;
  count: number;
  detail: string;
};

export type ClaimCandidate = {
  id: string;
  channelId: SettlementBatchReconciliation["channelId"];
  channelAccountId?: string;
  externalBatchId: string;
  status: Extract<SettlementBatchReconciliation["status"], "short" | "missing" | "failed">;
  expectedBankPaise?: MoneyPaise;
  actualBankPaise?: MoneyPaise;
  recoverablePaise: MoneyPaise;
  expectedBankBy?: string;
  currency?: string;
  confidence: "High";
  settlementEvidenceIds: string[];
  bankTransactionIds: string[];
  sourceReferences: SourceReference[];
  why: string[];
};

export type CloseEvidenceRow = {
  key: string;
  channel: string;
  subOrderId: string;
  orderId?: string;
  sku: string;
  state: string;
  outcome: string;
  fileName: string;
  sheetName: string;
  rowNumber: number;
  sourceFingerprint: string;
  parserVersion: string;
};

export type ClosePackSummary = {
  readiness: CloseReadiness;
  readinessReason: string;
  closePeriodLabel: string;
  observedSalesPaise: MoneyPaise;
  settlementPaise: MoneyPaise;
  confirmedContributionPaise: MoneyPaise;
  provisionalContributionPaise: MoneyPaise;
  stillAtRiskPaise: MoneyPaise;
  observedReturnRtoLossPaise: MoneyPaise;
  openReturnExposurePaise: MoneyPaise;
  deterministicRecoveryPaise: MoneyPaise;
  reviewOnlySettlementExposurePaise: MoneyPaise;
  claimCandidates: ClaimCandidate[];
  checklist: CloseChecklistItem[];
  evidenceRows: CloseEvidenceRow[];
  channelRows: Array<{
    channel: string;
    channelAccountId?: string;
    orders: number;
    skus: number;
    confirmedContributionPaise: MoneyPaise;
    provisionalContributionPaise: MoneyPaise;
    stillAtRiskPaise: MoneyPaise;
    settlementPaise: MoneyPaise;
  }>;
  unresolvedCount: number;
};

function dedupeSources(sources: SourceReference[]): SourceReference[] {
  const seen = new Set<string>();
  const result: SourceReference[] = [];
  for (const source of sources) {
    const key = `${source.sourceFingerprint}::${source.sheetName}::${source.rowNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function sourcesForBatch(result: AnalysisResult, batch: SettlementBatchReconciliation): SourceReference[] {
  return dedupeSources(
    result.orders
      .filter((order) =>
        (order.settlementBatchIds ?? []).includes(batch.externalBatchId) ||
        (order.settlementEvidenceIds ?? []).some((id) => batch.settlementEvidenceIds.includes(id)),
      )
      .flatMap((order) => order.sources),
  );
}

function recoverableForBatch(batch: SettlementBatchReconciliation): MoneyPaise {
  if (batch.status === "short") return assertPaise(Math.max(0, -(batch.differencePaise ?? 0)));
  if (batch.status === "missing" || batch.status === "failed") {
    return assertPaise(Math.max(0, batch.expectedBankPaise ?? 0));
  }
  return 0;
}

function buildClaims(result: AnalysisResult): ClaimCandidate[] {
  const batches = result.settlementReconciliation?.batches ?? [];
  return batches
    .filter((batch): batch is SettlementBatchReconciliation & { status: "short" | "missing" | "failed" } =>
      batch.status === "short" || batch.status === "missing" || batch.status === "failed",
    )
    .map((batch) => ({
      id: `claim:${batch.batchId}`,
      channelId: batch.channelId,
      channelAccountId: batch.channelAccountId,
      externalBatchId: batch.externalBatchId,
      status: batch.status,
      expectedBankPaise: batch.expectedBankPaise,
      actualBankPaise: batch.actualBankPaise,
      recoverablePaise: recoverableForBatch(batch),
      expectedBankBy: batch.expectedBankBy,
      currency: batch.currency,
      confidence: "High" as const,
      settlementEvidenceIds: [...batch.settlementEvidenceIds],
      bankTransactionIds: [...batch.bankTransactionIds],
      sourceReferences: sourcesForBatch(result, batch),
      why: [...batch.why],
    }))
    .filter((claim) => claim.recoverablePaise > 0)
    .sort((a, b) => b.recoverablePaise - a.recoverablePaise || a.externalBatchId.localeCompare(b.externalBatchId));
}

function periodLabel(result: AnalysisResult): string {
  const periods = result.periods.map((period) => period.period).filter(Boolean).sort();
  if (!periods.length) return "Supplied analysis period";
  if (periods.length === 1) return periods[0];
  return `${periods[0]} to ${periods[periods.length - 1]}`;
}

export function buildClosePackSummary(result: AnalysisResult): ClosePackSummary {
  const returns = result.returnRecovery ?? buildReturnRecoverySummary(result.orders, result.skus, result.settlementReconciliation);
  const claims = buildClaims(result);
  const missingCostCount = result.findings
    .filter((finding) => finding.code === "missing-product-cost" || finding.code === "missing-packaging")
    .reduce((sum, finding) => sum + finding.count, 0);
  const incompleteOrders = result.orders.filter((order) => order.state === "incomplete").length;
  const missingSettlementEvidence = result.orders.filter((order) => !order.hasSettlementEvidence).length;
  const missingOrderEvidence = result.orders.filter((order) => !order.hasOrderEvidence).length;
  const criticalFindings = result.findings.filter((finding) => finding.severity === "critical").reduce((sum, finding) => sum + finding.count, 0);
  const settlement = result.settlementReconciliation;
  const settlementReviewCount = settlement
    ? settlement.ambiguousCount + settlement.incompleteCount + settlement.pendingCount + settlement.excessCount
    : 0;

  const checklist: CloseChecklistItem[] = [
    {
      id: "required-costs",
      label: "Required product and packaging costs",
      status: missingCostCount > 0 ? "block" : "pass",
      count: missingCostCount,
      detail: missingCostCount > 0
        ? `${missingCostCount} order(s) still lack a required cost. Close numbers would be overstated.`
        : "Required costs are present for the calculated rows.",
    },
    {
      id: "order-settlement-linkage",
      label: "Order ↔ settlement evidence",
      status: incompleteOrders > 0 || missingSettlementEvidence > 0 ? "review" : "pass",
      count: Math.max(incompleteOrders, missingSettlementEvidence),
      detail: incompleteOrders > 0 || missingSettlementEvidence > 0
        ? `${incompleteOrders} incomplete order(s); ${missingSettlementEvidence} order(s) have no settlement evidence.`
        : "Calculated orders have supportable settlement evidence.",
    },
    {
      id: "payout-bank",
      label: "Payout ↔ bank reconciliation",
      status: claims.length > 0 || settlementReviewCount > 0 || !settlement ? "review" : "pass",
      count: claims.length + settlementReviewCount,
      detail: !settlement
        ? "No complete payout-to-bank reconciliation was supplied for this analysis."
        : claims.length > 0
          ? `${claims.length} deterministic recovery candidate(s) should be resolved before treating cash close as clean.`
          : settlementReviewCount > 0
            ? `${settlementReviewCount} payout item(s) remain pending, ambiguous, excess or incomplete.`
            : "Supplied payout batches reconcile to bank evidence without an unresolved exception.",
    },
    {
      id: "returns",
      label: "Returns / RTO finality",
      status: returns.openReturnCount > 0 ? "review" : "pass",
      count: returns.openReturnCount,
      detail: returns.openReturnCount > 0
        ? `${returns.openReturnCount} open return/RTO flow(s) remain exposure, not booked loss.`
        : "No open return/RTO exposure is present in the supplied data.",
    },
    {
      id: "source-lineage",
      label: "Source lineage",
      status: missingOrderEvidence > 0 || criticalFindings > 0 ? "review" : "pass",
      count: missingOrderEvidence + criticalFindings,
      detail: missingOrderEvidence > 0 || criticalFindings > 0
        ? `${missingOrderEvidence} row(s) lack order evidence and ${criticalFindings} critical data-quality finding(s) remain.`
        : "Normalized rows retain file/sheet/row source references.",
    },
  ];

  const blocked = checklist.some((item) => item.status === "block") || criticalFindings > 0;
  const review = checklist.some((item) => item.status === "review") || result.qualityStatus !== "Reliable";
  const readiness: CloseReadiness = blocked ? "Blocked" : review ? "Review" : "Ready";
  const readinessReason = readiness === "Blocked"
    ? "Required financial inputs are missing or critical data-quality issues remain."
    : readiness === "Review"
      ? "Core calculations are available, but payout/return/source exceptions still need review before a clean monthly close."
      : "The supplied analysis has no blocking close exception. Review with your accountant before filing or posting entries.";

  const evidenceRows: CloseEvidenceRow[] = [];
  const evidenceSeen = new Set<string>();
  for (const order of result.orders) {
    for (const source of order.sources) {
      const key = `${order.channelId ?? "unknown"}::${order.subOrderId}::${source.sourceFingerprint}::${source.sheetName}::${source.rowNumber}`;
      if (evidenceSeen.has(key)) continue;
      evidenceSeen.add(key);
      evidenceRows.push({
        key,
        channel: channelLabel(order.channelId),
        subOrderId: order.subOrderId,
        orderId: order.orderId,
        sku: order.sku,
        state: order.state,
        outcome: order.outcome,
        fileName: source.fileName,
        sheetName: source.sheetName,
        rowNumber: source.rowNumber,
        sourceFingerprint: source.sourceFingerprint,
        parserVersion: source.parserVersion,
      });
    }
  }

  const deterministicRecoveryPaise = sumPaise(claims.map((claim) => claim.recoverablePaise));
  const reviewOnlySettlementExposurePaise = returns.settlementReviewExposurePaise;
  const unresolvedCount = checklist.reduce((sum, item) => sum + (item.status === "pass" ? 0 : item.count || 1), 0);

  return {
    readiness,
    readinessReason,
    closePeriodLabel: periodLabel(result),
    observedSalesPaise: sumPaise(result.orders.map((order) => order.salePaise)),
    settlementPaise: result.bridge.settlementPaise,
    confirmedContributionPaise: result.confirmedContributionPaise,
    provisionalContributionPaise: result.provisionalContributionPaise,
    stillAtRiskPaise: result.stillAtRiskPaise,
    observedReturnRtoLossPaise: returns.observedReturnRtoLossPaise,
    openReturnExposurePaise: returns.openReturnExposurePaise,
    deterministicRecoveryPaise,
    reviewOnlySettlementExposurePaise,
    claimCandidates: claims,
    checklist,
    evidenceRows,
    channelRows: result.channels.map((channel) => ({
      channel: channelLabel(channel.channelId),
      channelAccountId: channel.channelAccountId,
      orders: channel.orders,
      skus: channel.skus,
      confirmedContributionPaise: channel.confirmedContributionPaise,
      provisionalContributionPaise: channel.provisionalContributionPaise,
      stillAtRiskPaise: channel.stillAtRiskPaise,
      settlementPaise: channel.settlementPaise,
    })),
    unresolvedCount,
  };
}
