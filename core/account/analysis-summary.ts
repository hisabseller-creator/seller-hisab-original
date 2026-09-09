import { buildReturnRecoverySummary } from "../returns-intelligence";
import type { AnalysisResult } from "../types";

export type SavedAnalysisPayload = {
  id: string;
  label: string;
  createdAt: string;
  parserVersion: string;
  engineVersion: string;
  summary: {
    confirmedContributionPaise: number;
    provisionalContributionPaise: number;
    stillAtRiskPaise: number;
    lossMakingSkus: number;
    needsReviewCount: number;
    qualityScore: number;
    qualityStatus: string;
    skuCount: number;
    orderCount: number;
    missingCostCount: number;
    returnRtoCount: number;
    observedReturnRtoLossPaise: number;
    openReturnExposurePaise: number;
    potentialRecoveryPaise: number;
  };
};

export function buildSavedAnalysisPayload(result: AnalysisResult): SavedAnalysisPayload {
  const returnRecovery = result.returnRecovery ?? buildReturnRecoverySummary(result.orders, result.skus, result.settlementReconciliation);
  return {
    id: result.id,
    label: `Analysis ${new Date(result.createdAt).toLocaleDateString("en-IN")}`,
    createdAt: result.createdAt,
    parserVersion: result.parserVersion,
    engineVersion: result.engineVersion,
    summary: {
      confirmedContributionPaise: result.confirmedContributionPaise,
      provisionalContributionPaise: result.provisionalContributionPaise,
      stillAtRiskPaise: result.stillAtRiskPaise,
      lossMakingSkus: result.lossMakingSkus,
      needsReviewCount: result.needsReviewCount,
      qualityScore: result.qualityScore,
      qualityStatus: result.qualityStatus,
      skuCount: result.skus.length,
      orderCount: result.orders.length,
      missingCostCount: result.findings
        .filter((finding) => finding.code === "missing-product-cost" || finding.code === "missing-packaging")
        .reduce((sum, finding) => sum + finding.count, 0),
      returnRtoCount: returnRecovery.returnCount + returnRecovery.rtoCount,
      observedReturnRtoLossPaise: returnRecovery.observedReturnRtoLossPaise,
      openReturnExposurePaise: returnRecovery.openReturnExposurePaise,
      potentialRecoveryPaise: returnRecovery.potentialRecoveryPaise,
    },
  };
}
