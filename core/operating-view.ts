import { parseFinancialTimestamp } from "./dates";
import { scopedSkuKey } from "./canonical/scope";
import type { AnalysisResult, SkuEconomics } from "./types";

export type ApprovedProductMapping = {
  id: string;
  name: string;
  aliasKeys: string[];
  approvedAt: string;
  updatedAt: string;
};

export type OperatingProductChannel = {
  key: string;
  channelId: SkuEconomics["channelId"];
  channelAccountId?: string;
  sku: string;
  orders: number;
  confirmedContributionPaise: number;
  provisionalContributionPaise: number;
  failures: number;
  delivered: number;
  action: SkuEconomics["action"];
  confidence: SkuEconomics["confidence"];
};

export type OperatingProduct = {
  id: string;
  mappingId?: string;
  name: string;
  mapped: boolean;
  channels: OperatingProductChannel[];
  orders: number;
  confirmedContributionPaise: number;
  provisionalContributionPaise: number;
  failures: number;
  delivered: number;
  returnRtoRate?: number;
  moneyImpactPaise: number;
  action: SkuEconomics["action"];
  confidence: SkuEconomics["confidence"];
};

export type ProductMappingSuggestion = {
  id: string;
  sku: string;
  aliasKeys: string[];
  channels: Array<{ channelId: SkuEconomics["channelId"]; channelAccountId?: string }>;
  reason: string;
};

export type OperatingAction = {
  id: string;
  kind: "sku" | "settlement";
  title: string;
  detail: string;
  action: SkuEconomics["action"];
  channelId?: SkuEconomics["channelId"];
  sku?: string;
  moneyImpactPaise: number;
  confidence: "High" | "Medium" | "Low";
  urgency: "Critical" | "High" | "Normal";
};

export type OwnerOperatingView = {
  generatedAt: string;
  dataAgeDays: number;
  analysisId: string;
  today: {
    observedSalesPaise: number;
    orders: number;
    channels: number;
    returnRtoCount: number;
    confirmedContributionPaise: number;
    stillAtRiskPaise: number;
    needsReviewCount: number;
    confirmedContributionDeltaPaise?: number;
    orderDelta?: number;
    stillAtRiskDeltaPaise?: number;
  };
  money: {
    confirmedContributionPaise: number;
    provisionalContributionPaise: number;
    stillAtRiskPaise: number;
    confidence: AnalysisResult["qualityStatus"];
    expectedBankPaise?: number;
    actualMatchedBankPaise?: number;
    bankDifferencePaise?: number;
    settlementConfidence?: "Confirmed" | "Provisional" | "Incomplete";
    settlementWhy: string[];
  };
  products: OperatingProduct[];
  mappingSuggestions: ProductMappingSuggestion[];
  mappingConflictCount: number;
  actions: OperatingAction[];
};

const actionRank: Record<SkuEconomics["action"], number> = {
  "Add Cost": 0,
  "Review Settlement": 1,
  "Review Return/RTO": 2,
  "Reduce Ads": 3,
  Reprice: 4,
  Pause: 5,
  "Insufficient Data": 6,
  Scale: 7,
  Maintain: 8,
};

const confidenceRank: Record<SkuEconomics["confidence"], number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

function lowestConfidence(items: SkuEconomics[]): SkuEconomics["confidence"] {
  return items.reduce<SkuEconomics["confidence"]>(
    (lowest, item) => confidenceRank[item.confidence] < confidenceRank[lowest] ? item.confidence : lowest,
    "High",
  );
}

function chooseProductAction(items: SkuEconomics[]): SkuEconomics {
  return [...items].sort((a, b) => {
    const priority = actionRank[a.action] - actionRank[b.action];
    return priority || b.moneyImpactPaise - a.moneyImpactPaise || a.sku.localeCompare(b.sku);
  })[0];
}

function daysBetween(now: Date, value: string): number {
  const then = parseFinancialTimestamp(value, { assumeUtcForTimezoneLessIso: true });
  if (then === undefined) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

function buildProducts(
  skus: SkuEconomics[],
  mappings: ApprovedProductMapping[],
): { products: OperatingProduct[]; suggestions: ProductMappingSuggestion[]; conflictCount: number } {
  const aliasOwners = new Map<string, ApprovedProductMapping[]>();
  for (const mapping of mappings) {
    for (const alias of mapping.aliasKeys) {
      aliasOwners.set(alias, [...(aliasOwners.get(alias) ?? []), mapping]);
    }
  }

  const conflictingAliases = new Set(
    [...aliasOwners.entries()].filter(([, owners]) => owners.length > 1).map(([alias]) => alias),
  );

  const groups = new Map<string, { mapping?: ApprovedProductMapping; items: SkuEconomics[] }>();
  const mappedAliases = new Set<string>();

  for (const sku of skus) {
    const alias = scopedSkuKey(sku);
    const owners = aliasOwners.get(alias) ?? [];
    const mapping = conflictingAliases.has(alias) || owners.length !== 1 ? undefined : owners[0];
    const groupKey = mapping ? `mapping:${mapping.id}` : `scope:${alias}`;
    const current = groups.get(groupKey) ?? { mapping, items: [] };
    current.items.push(sku);
    groups.set(groupKey, current);
    if (mapping) mappedAliases.add(alias);
  }

  const products = [...groups.entries()].map(([id, group]): OperatingProduct => {
    const lead = chooseProductAction(group.items);
    const failures = group.items.reduce((sum, item) => sum + item.failures, 0);
    const delivered = group.items.reduce((sum, item) => sum + item.delivered, 0);
    const denominator = delivered + failures;
    return {
      id,
      mappingId: group.mapping?.id,
      name: group.mapping?.name ?? lead.sku,
      mapped: Boolean(group.mapping),
      channels: group.items.map((item) => ({
        key: scopedSkuKey(item),
        channelId: item.channelId,
        channelAccountId: item.channelAccountId,
        sku: item.sku,
        orders: item.orders,
        confirmedContributionPaise: item.confirmedContributionPaise,
        provisionalContributionPaise: item.provisionalContributionPaise,
        failures: item.failures,
        delivered: item.delivered,
        action: item.action,
        confidence: item.confidence,
      })),
      orders: group.items.reduce((sum, item) => sum + item.orders, 0),
      confirmedContributionPaise: group.items.reduce((sum, item) => sum + item.confirmedContributionPaise, 0),
      provisionalContributionPaise: group.items.reduce((sum, item) => sum + item.provisionalContributionPaise, 0),
      failures,
      delivered,
      returnRtoRate: denominator > 0 ? failures / denominator : undefined,
      moneyImpactPaise: group.items.reduce((sum, item) => sum + item.moneyImpactPaise, 0),
      action: lead.action,
      confidence: lowestConfidence(group.items),
    };
  }).sort((a, b) => {
    const priority = actionRank[a.action] - actionRank[b.action];
    const aContribution = a.confirmedContributionPaise + a.provisionalContributionPaise;
    const bContribution = b.confirmedContributionPaise + b.provisionalContributionPaise;
    return priority || aContribution - bContribution || b.moneyImpactPaise - a.moneyImpactPaise;
  });

  const suggestionBuckets = new Map<string, SkuEconomics[]>();
  for (const sku of skus) {
    const alias = scopedSkuKey(sku);
    if (mappedAliases.has(alias) || conflictingAliases.has(alias)) continue;
    const normalizedSku = sku.sku.trim().toLocaleLowerCase("en-IN");
    if (!normalizedSku) continue;
    suggestionBuckets.set(normalizedSku, [...(suggestionBuckets.get(normalizedSku) ?? []), sku]);
  }

  const suggestions = [...suggestionBuckets.entries()]
    .filter(([, items]) => new Set(items.map((item) => `${item.channelId ?? "unknown"}::${item.channelAccountId ?? "default"}`)).size >= 2)
    .map(([normalizedSku, items]): ProductMappingSuggestion => ({
      id: `suggest:${normalizedSku}`,
      sku: items[0].sku,
      aliasKeys: items.map(scopedSkuKey),
      channels: items.map((item) => ({ channelId: item.channelId, channelAccountId: item.channelAccountId })),
      reason: "The exact SKU text appears in more than one channel. SellerHisab will not merge the finance until you explicitly confirm they are the same physical product.",
    }))
    .sort((a, b) => b.aliasKeys.length - a.aliasKeys.length || a.sku.localeCompare(b.sku));

  return { products, suggestions, conflictCount: conflictingAliases.size };
}

function confidenceFromSettlement(value: "Confirmed" | "Provisional" | "Incomplete"): OperatingAction["confidence"] {
  return value === "Confirmed" ? "High" : value === "Provisional" ? "Medium" : "Low";
}

function settlementActions(result: AnalysisResult): OperatingAction[] {
  const batches = result.settlementReconciliation?.batches ?? [];
  return batches
    .filter((batch) => ["short", "missing", "excess", "ambiguous", "failed", "incomplete"].includes(batch.status))
    .map((batch): OperatingAction => {
      const impact = Math.abs(batch.differencePaise ?? batch.expectedBankPaise ?? 0);
      const urgency: OperatingAction["urgency"] = batch.status === "missing" || batch.status === "short" ? "Critical" : "High";
      const label = batch.status === "missing"
        ? "Expected payout not found in supplied bank evidence"
        : batch.status === "short"
          ? "Payout is short against expected amount"
          : batch.status === "excess"
            ? "Bank credit exceeds expected payout"
            : batch.status === "ambiguous"
              ? "Payout has more than one possible bank match"
              : batch.status === "failed"
                ? "Marketplace payout failed or was cancelled"
                : "Payout chain is incomplete";
      return {
        id: `settlement:${batch.batchId}`,
        kind: "settlement",
        title: label,
        detail: `${batch.externalBatchId}: ${batch.why[0] ?? "Review the payout evidence."}`,
        action: "Review Settlement",
        channelId: batch.channelId,
        moneyImpactPaise: impact,
        confidence: confidenceFromSettlement(batch.confidence),
        urgency,
      };
    });
}

function skuActions(result: AnalysisResult): OperatingAction[] {
  return result.skus
    .filter((sku) => sku.action !== "Maintain")
    .map((sku): OperatingAction => ({
      id: `sku:${scopedSkuKey(sku)}`,
      kind: "sku",
      title: sku.action,
      detail: `${sku.primaryProblem}. ${sku.reason}`,
      action: sku.action,
      channelId: sku.channelId,
      sku: sku.sku,
      moneyImpactPaise: sku.moneyImpactPaise,
      confidence: sku.confidence,
      urgency: sku.action === "Add Cost" || sku.action === "Review Settlement" || sku.action === "Pause" ? "High" : "Normal",
    }));
}

function urgencyRank(value: OperatingAction["urgency"]): number {
  return value === "Critical" ? 0 : value === "High" ? 1 : 2;
}

export function buildOwnerOperatingView(
  result: AnalysisResult,
  previous?: AnalysisResult,
  mappings: ApprovedProductMapping[] = [],
  now = new Date(),
): OwnerOperatingView {
  const productView = buildProducts(result.skus, mappings);
  const observedSalesPaise = result.orders.reduce((sum, order) => sum + (order.salePaise ?? 0), 0);
  const returnRtoCount = result.orders.filter((order) => order.outcome === "return" || order.outcome === "rto").length;
  const reconciliation = result.settlementReconciliation;

  const actions = [...settlementActions(result), ...skuActions(result)]
    .sort((a, b) => {
      const urgency = urgencyRank(a.urgency) - urgencyRank(b.urgency);
      const action = actionRank[a.action] - actionRank[b.action];
      return urgency || b.moneyImpactPaise - a.moneyImpactPaise || action || a.title.localeCompare(b.title);
    });

  return {
    generatedAt: result.createdAt,
    dataAgeDays: daysBetween(now, result.createdAt),
    analysisId: result.id,
    today: {
      observedSalesPaise,
      orders: result.orders.length,
      channels: result.channels.length,
      returnRtoCount,
      confirmedContributionPaise: result.confirmedContributionPaise,
      stillAtRiskPaise: result.stillAtRiskPaise,
      needsReviewCount: result.needsReviewCount,
      confirmedContributionDeltaPaise: previous ? result.confirmedContributionPaise - previous.confirmedContributionPaise : undefined,
      orderDelta: previous ? result.orders.length - previous.orders.length : undefined,
      stillAtRiskDeltaPaise: previous ? result.stillAtRiskPaise - previous.stillAtRiskPaise : undefined,
    },
    money: {
      confirmedContributionPaise: result.confirmedContributionPaise,
      provisionalContributionPaise: result.provisionalContributionPaise,
      stillAtRiskPaise: result.stillAtRiskPaise,
      confidence: result.qualityStatus,
      expectedBankPaise: reconciliation?.expectedBankPaise ?? result.bankReconcilableSettlementPaise,
      actualMatchedBankPaise: reconciliation?.actualMatchedBankPaise,
      bankDifferencePaise: reconciliation?.differencePaise ?? result.bankCreditMismatchPaise,
      settlementConfidence: reconciliation?.confidence,
      settlementWhy: reconciliation?.why ?? [
        "No complete payout-to-bank chain is available in this local analysis. SellerHisab will not invent a bank receipt.",
      ],
    },
    products: productView.products,
    mappingSuggestions: productView.suggestions,
    mappingConflictCount: productView.conflictCount,
    actions,
  };
}
