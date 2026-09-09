import type { AnalysisInput, OrderEconomics, ParserIssue, QualityFinding } from "../types";
import { bankReconcilableSettlementPaise } from "../finance/formulas";
import { formatInr } from "../money";

export function evaluateQuality(
  orders: OrderEconomics[],
  parserIssues: ParserIssue[],
  input?: AnalysisInput,
): {
  score: number;
  status: "Reliable" | "Mostly Reliable" | "Needs Attention" | "Incomplete";
  findings: QualityFinding[];
} {
  const findings: QualityFinding[] = [];
  const missingProduct = orders.filter((order) => order.reasons.includes("Product cost missing")).length;
  const missingPackaging = orders.filter((order) => order.reasons.includes("Packaging cost missing")).length;
  const noSettlement = orders.filter((order) => !order.hasSettlementEvidence).length;
  const settlementWithoutOrder = orders.filter(
    (order) => order.hasSettlementEvidence && !order.hasOrderEvidence,
  ).length;
  const unknownStatuses = orders.filter((order) => order.outcome === "unknown").length;
  const provisional = orders.filter((order) => order.state === "provisional").length;
  const crossPeriod = orders.filter((order) => order.crossPeriod).length;
  const duplicates = parserIssues.filter(
    (issue) => issue.code === "duplicate_event" || issue.code === "duplicate_file",
  ).length;
  const criticalParser = parserIssues.filter((issue) => issue.severity === "critical").length;
  const knownSkus = new Set(orders.map((order) => order.sku));
  const unusedCosts = input?.costs.filter((cost) => !knownSkus.has(cost.sku)).length ?? 0;
  const unmatchedAds = input?.adCosts?.filter((record) => record.sku && !knownSkus.has(record.sku)).length ?? 0;
  const estimatedAds = parserIssues.filter((issue) => issue.code === "ad_allocation_estimated").length + ((input?.manualAdSpendPaise ?? 0) > 0 ? 1 : 0);
  const bankReconcilableSettlement = bankReconcilableSettlementPaise(orders);
  const bankMismatch = input?.bankCreditPaise === undefined ? 0 : input.bankCreditPaise - bankReconcilableSettlement;

  addFinding(findings, missingProduct, "missing-product-cost", "critical", "Product cost missing", `${missingProduct} order(s) cannot be trusted until SKU cost is added.`);
  addFinding(findings, missingPackaging, "missing-packaging", "critical", "Packaging cost missing", `${missingPackaging} shipped order(s) have no packaging cost.`);
  addFinding(findings, noSettlement, "orders-without-settlement", "warning", "Settlement still unmatched", `${noSettlement} order(s) have no settlement evidence in the supplied periods.`);
  addFinding(findings, settlementWithoutOrder, "settlement-without-order", "warning", "Order report would improve matching", `${settlementWithoutOrder} settled sub-order(s) were found only in payment reports.`);
  addFinding(findings, unknownStatuses, "unknown-status", "critical", "Unknown order status", `${unknownStatuses} order(s) were left incomplete instead of guessing their outcome.`);
  addFinding(findings, provisional, "provisional-outcome", "warning", "Money is still at risk", `${provisional} order(s) may change because the available evidence is not final.`);
  addFinding(findings, crossPeriod, "cross-period-events", "info", "Cross-period events matched", `${crossPeriod} sub-order(s) have evidence in more than one month and were reconciled by stable identifier.`);
  addFinding(findings, duplicates, "duplicates", "warning", "Duplicate evidence removed", `${duplicates} duplicate event(s) were ignored to prevent double counting.`);
  addFinding(findings, criticalParser, "parser-errors", "critical", "Some source rows were rejected", `${criticalParser} critical parser issue(s) need review.`);
  addFinding(findings, unusedCosts, "unused-cost-skus", "info", "Some cost-sheet SKUs were not found", `${unusedCosts} cost record(s) did not match any supplied order SKU.`);
  addFinding(findings, unmatchedAds, "unmatched-ad-skus", "warning", "Some ad spend could not be allocated", `${unmatchedAds} Ads SKU record(s) did not match supplied orders; contribution remains incomplete instead of dropping that known spend.`);
  addFinding(findings, estimatedAds, "estimated-ad-allocation", "warning", "SKU ad cost is estimated", "Total/manual ad spend was allocated using observed sales share.");
  addFinding(findings, Math.abs(bankMismatch) > 100 ? 1 : 0, "bank-credit-mismatch", "warning", "Bank credit does not match settlements", `${formatInr(bankMismatch)} difference between entered bank credit and supplied net settlements. Check period coverage and unmatched credits.`);

  const orderCount = Math.max(1, orders.length);
  const criticalWeight = ((missingProduct + missingPackaging + unknownStatuses) / orderCount) * 55;
  const warningWeight = ((noSettlement + provisional) / orderCount) * 25 + Math.min(8, (settlementWithoutOrder / orderCount) * 8) + Math.min(7, estimatedAds * 3 + unmatchedAds * 2 + (Math.abs(bankMismatch) > 100 ? 3 : 0));
  const parserWeight = Math.min(20, criticalParser * 5 + duplicates);
  const score = Math.max(0, Math.round(100 - criticalWeight - warningWeight - parserWeight));
  const status = criticalParser > 0 || score < 45
    ? "Incomplete"
    : score < 70
      ? "Needs Attention"
      : score < 90
        ? "Mostly Reliable"
        : "Reliable";
  return { score, status, findings };
}

function addFinding(
  findings: QualityFinding[],
  count: number,
  code: string,
  severity: QualityFinding["severity"],
  title: string,
  message: string,
) {
  if (count > 0) findings.push({ code, severity, count, title, message });
}
