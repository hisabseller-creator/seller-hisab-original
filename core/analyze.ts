import { buildSkuEconomics } from "./decision-engine";
import { evaluateQuality } from "./data-quality";
import { calculateOrderEconomics } from "./finance/engine";
import { bankReconcilableSettlementPaise as calculateBankReconcilableSettlementPaise } from "./finance/formulas";
import { assertPaise, sumPaise } from "./money";
import { reconcileEvents } from "./reconciliation";
import { buildReturnRecoverySummary } from "./returns-intelligence";
import { applyOrderSettlementEvidence } from "./settlements/evidence";
import { reconcileSettlementChain } from "./settlements/reconciliation";
import {
  CANONICAL_ANALYSIS_VERSION,
  ENGINE_VERSION,
  PARSER_VERSION,
  type AnalysisInput,
  type AnalysisResult,
  type ChannelAnalysisSummary,
} from "./types";

export function analyze(input: AnalysisInput): AnalysisResult {
  const reconciliation = reconcileEvents(input.events);
  const settlements = applyOrderSettlementEvidence(reconciliation.orders, input.settlementEvidence);
  const parserIssues = [...(input.parserIssues ?? []), ...reconciliation.issues, ...settlements.issues];
  const orders = calculateOrderEconomics(settlements.orders, input);
  const skus = buildSkuEconomics(orders, input.minimumSampleSize ?? 5);
  const quality = evaluateQuality(orders, parserIssues, input);
  const confirmedContributionPaise = sumPaise(
    orders.filter((order) => order.state === "confirmed").map((order) => order.contributionPaise),
  );
  const provisionalContributionPaise = sumPaise(
    orders.filter((order) => order.state === "provisional").map((order) => order.contributionPaise),
  );
  const incompleteExposure = sumPaise(
    orders
      .filter((order) => order.state === "incomplete")
      .map((order) => Math.max(0, order.settlementPaise ?? order.salePaise ?? 0)),
  );
  const stillAtRiskPaise = assertPaise(Math.abs(provisionalContributionPaise) + incompleteExposure);
  const totalContribution = assertPaise(confirmedContributionPaise + provisionalContributionPaise);
  const settlementTotalPaise = sumPaise(orders.map((order) => order.settlementPaise));
  const settlementReconciliation = input.settlementBatches?.length || input.bankTransactions?.length
    ? reconcileSettlementChain({
        evidence: input.settlementEvidence,
        batches: input.settlementBatches,
        bankTransactions: input.bankTransactions,
        bankEvidenceCompleteThrough: input.bankEvidenceCompleteThrough,
      })
    : undefined;
  const orderAttributedBankReconcilablePaise = calculateBankReconcilableSettlementPaise(orders);
  const bankReconcilableSettlementPaise = settlementReconciliation && (input.settlementBatches?.length ?? 0) > 0
    ? settlementReconciliation.expectedBankPaise
    : orderAttributedBankReconcilablePaise;
  const bankCreditMismatchPaise = input.bankCreditPaise === undefined
    ? undefined
    : assertPaise(input.bankCreditPaise - bankReconcilableSettlementPaise);
  const returnRecovery = buildReturnRecoverySummary(orders, skus, settlementReconciliation);
  const settlementReviewCount = settlementReconciliation
    ? settlementReconciliation.shortCount
      + settlementReconciliation.excessCount
      + settlementReconciliation.missingCount
      + settlementReconciliation.ambiguousCount
      + settlementReconciliation.failedCount
      + settlementReconciliation.incompleteCount
    : 0;
  const estimatedNetProfitPaise =
    input.monthlyFixedOverheadPaise !== undefined &&
    orders.length > 0 &&
    orders.every((order) => order.state !== "incomplete")
      ? assertPaise(totalContribution - input.monthlyFixedOverheadPaise)
      : undefined;
  const channels = buildChannels(orders);
  const scopedChannelCount = new Set(
    channels.filter((channel) => channel.channelId !== "unknown").map((channel) => channel.channelId),
  ).size;
  const analysisScope = scopedChannelCount === 0
    ? "unscoped"
    : scopedChannelCount === 1
      ? "single-channel"
      : "multi-channel";

  return {
    canonicalAnalysisVersion: CANONICAL_ANALYSIS_VERSION,
    analysisScope,
    channels,
    id: createAnalysisId(),
    createdAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
    engineVersion: ENGINE_VERSION,
    sourceFingerprints: input.sourceFingerprints ?? [],
    confirmedContributionPaise,
    provisionalContributionPaise,
    stillAtRiskPaise,
    estimatedNetProfitPaise,
    bankCreditPaise: input.bankCreditPaise,
    bankCreditMismatchPaise,
    bankReconcilableSettlementPaise,
    settlementReconciliation,
    returnRecovery,
    lossMakingSkus: skus.filter(
      (sku) => sku.confirmedContributionPaise + sku.provisionalContributionPaise < 0,
    ).length,
    needsReviewCount: orders.filter((order) => order.state !== "confirmed").length + settlementReviewCount,
    qualityScore: quality.score,
    qualityStatus: quality.status,
    findings: quality.findings,
    orders,
    skus,
    topActions: skus.filter((sku) => sku.action !== "Maintain").slice(0, 3),
    periods: buildPeriods(orders),
    bridge: {
      settlementPaise: settlementTotalPaise,
      productCostPaise: sumPaise(orders.map((order) => order.productCostPaise)),
      packagingPaise: sumPaise(orders.map((order) => order.packagingCostPaise)),
      variableCostPaise: sumPaise(orders.map((order) => order.variableCostPaise)),
      adsPaise: sumPaise(orders.map((order) => order.adCostPaise)),
      contributionPaise: totalContribution,
    },
    assumptions: [
      "Settlement/financial amounts are source-backed marketplace cash flow; platform deductions already reflected there are not subtracted again. Marketplace financial events are not treated as proof of bank credit until payout/bank evidence exists.",
      "Payout-to-bank matching is deterministic: explicit payout/reference IDs first, otherwise a unique exact amount + currency match inside the allowed date window. Similar amounts are never guessed into a match.",
      "Product cost is expensed on delivered units. Return/RTO inventory recovery condition is unknown, so observed return/RTO loss includes source-backed negative settlement plus known packaging/variable handling cost, without inventing product damage cost.",
      "Open return/RTO amounts are exposure, not booked loss. Recoverable payout is limited to deterministic short/missing/failed payout evidence; avoidable historical return/RTO leakage is a prevention signal, and ambiguous settlement evidence remains review exposure rather than a claimed recovery.",
      input.adCosts?.length
        ? "Recognized SKU-level Ads spend is allocated only to defensible matching SKUs; known unmatched spend keeps contribution incomplete rather than being silently dropped. Supplied attributable ad sales drive ROAS/ACoS where present."
        : input.manualAdSpendPaise
          ? "Manual ad spend is allocated by observed sales share and is therefore estimated at SKU level."
          : "No ad spend was supplied; contribution excludes ads.",
      "Confirmed does not mean audited net profit. Taxes and fixed overhead are excluded unless explicitly supplied.",
    ],
  };
}

function buildChannels(orders: AnalysisResult["orders"]): ChannelAnalysisSummary[] {
  const grouped = new Map<string, AnalysisResult["orders"]>();

  for (const order of orders) {
    const channelId = order.channelId ?? "unknown";
    const account = order.channelAccountId?.trim() || "default";
    const key = `${channelId}::${account}`;
    grouped.set(key, [...(grouped.get(key) ?? []), order]);
  }

  return [...grouped.values()]
    .map((group): ChannelAnalysisSummary => {
      const confirmedContributionPaise = sumPaise(
        group.filter((order) => order.state === "confirmed").map((order) => order.contributionPaise),
      );
      const provisionalContributionPaise = sumPaise(
        group.filter((order) => order.state === "provisional").map((order) => order.contributionPaise),
      );
      const incompleteExposure = sumPaise(
        group
          .filter((order) => order.state === "incomplete")
          .map((order) => Math.max(0, order.settlementPaise ?? order.salePaise ?? 0)),
      );

      return {
        channelId: group[0].channelId ?? "unknown",
        channelAccountId: group[0].channelAccountId,
        orders: group.length,
        skus: new Set(group.map((order) => order.sku)).size,
        confirmedContributionPaise,
        provisionalContributionPaise,
        stillAtRiskPaise: assertPaise(Math.abs(provisionalContributionPaise) + incompleteExposure),
        settlementPaise: sumPaise(group.map((order) => order.settlementPaise)),
      };
    })
    .sort((a, b) => {
      const aTotal = a.confirmedContributionPaise + a.provisionalContributionPaise;
      const bTotal = b.confirmedContributionPaise + b.provisionalContributionPaise;
      return bTotal - aTotal || a.channelId.localeCompare(b.channelId);
    });
}

function buildPeriods(orders: AnalysisResult["orders"]): AnalysisResult["periods"] {
  const periods = new Map<string, AnalysisResult["orders"]>();
  for (const order of orders) {
    const period = [...order.eventDates].sort().at(-1)?.slice(0, 7) ?? "Undated";
    periods.set(period, [...(periods.get(period) ?? []), order]);
  }
  return [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => ({
    period,
    orders: group.length,
    confirmedContributionPaise: sumPaise(group.filter((order) => order.state === "confirmed").map((order) => order.contributionPaise)),
    provisionalContributionPaise: sumPaise(group.filter((order) => order.state === "provisional").map((order) => order.contributionPaise)),
  }));
}

function createAnalysisId(): string {
  const values = crypto.getRandomValues(new Uint8Array(16));
  const random = [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `ana_${random}`;
}

