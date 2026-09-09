import { scopedSkuKey } from "../canonical/scope";
import * as formulas from "../finance/formulas";
import { assertPaise, sumPaise } from "../money";
import type { MoneyPaise, OrderEconomics, SkuEconomics } from "../types";

export function buildSkuEconomics(
  orders: OrderEconomics[],
  minimumSampleSize = 5,
): SkuEconomics[] {
  const grouped = new Map<string, OrderEconomics[]>();
  for (const order of orders) {
    const key = scopedSkuKey(order);
    const list = grouped.get(key) ?? [];
    list.push(order);
    grouped.set(key, list);
  }

  return [...grouped.values()]
    .map((group) => buildSku(group[0].sku, group, minimumSampleSize))
    .sort((a, b) => {
      const priority = actionPriority(a.action) - actionPriority(b.action);
      return priority || b.moneyImpactPaise - a.moneyImpactPaise || a.sku.localeCompare(b.sku);
    });
}

function buildSku(sku: string, group: OrderEconomics[], minimumSampleSize: number): SkuEconomics {
  const confirmed = group.filter((order) => order.state === "confirmed");
  const provisional = group.filter((order) => order.state === "provisional");
  const delivered = group.filter((order) => order.outcome === "delivered");
  const failures = group.filter((order) => order.outcome === "return" || order.outcome === "rto");
  const incompleteOrders = group.filter((order) => order.state === "incomplete").length;
  const confirmedContributionPaise = sumPaise(confirmed.map((order) => order.contributionPaise));
  const provisionalContributionPaise = sumPaise(provisional.map((order) => order.contributionPaise));
  const salePaise = sumPaise(group.map((order) => order.salePaise));
  const adPaise = sumPaise(group.map((order) => order.adCostPaise));
  const directAttributableSalesPaise = sumPaise(group.map((order) => order.attributableAdSalesPaise));
  const attributableSalesPaise = directAttributableSalesPaise > 0 ? directAttributableSalesPaise : salePaise;
  const preAdContributionPaise = assertPaise(
    confirmedContributionPaise + provisionalContributionPaise + adPaise,
  );
  const contributionPerDeliveredPaise = delivered.length
    ? Math.round((confirmedContributionPaise + provisionalContributionPaise) / delivered.length)
    : undefined;
  const contributionMarginPct = formulas.contributionMarginPct(
    confirmedContributionPaise + provisionalContributionPaise,
    salePaise,
  );
  const returnRtoRate = delivered.length + failures.length > 0
    ? failures.length / (delivered.length + failures.length)
    : undefined;
  const deliveredSalePaise = sumPaise(delivered.map((order) => order.salePaise));
  const deliveredSettlementPaise = sumPaise(delivered.map((order) => order.settlementPaise));
  const observedRetainedRate = formulas.observedRetainedRate(deliveredSettlementPaise, deliveredSalePaise);
  const averageBaseCost = delivered.length
    ? sumPaise(
        delivered.map((order) =>
          sumPaise([
            order.productCostPaise,
            order.packagingCostPaise,
            order.variableCostPaise,
            order.adCostPaise,
          ]),
        ),
      ) / delivered.length
    : undefined;
  const averageFailureLoss = failures.length
    ? sumPaise(failures.map((order) => order.returnRtoLossPaise)) / failures.length
    : undefined;
  const averageSuccessContribution = delivered.length
    ? sumPaise(delivered.map((order) => order.contributionPaise)) / delivered.length
    : undefined;
  const expectedFailureLoss = formulas.expectedFailureLossPerOrder(averageFailureLoss, returnRtoRate);
  const breakEvenPricePaise = averageBaseCost !== undefined
    ? formulas.breakEvenPricePaise({
        baseCostPerOrder: averageBaseCost,
        expectedFailureLossPerOrder: expectedFailureLoss,
        retainedRate: observedRetainedRate,
      })
    : undefined;
  const maxSafeFailureRate = formulas.maxSafeFailureRate(averageSuccessContribution, averageFailureLoss);
  const breakEvenRoas = adPaise > 0 ? formulas.breakEvenRoas(preAdContributionPaise, attributableSalesPaise) : undefined;
  const maxAcos = adPaise > 0 ? formulas.maxAcosRatio(preAdContributionPaise, attributableSalesPaise) : undefined;

  const sampleSize = group.length;
  const confidence = incompleteOrders > 0 || sampleSize < minimumSampleSize
    ? "Low"
    : sampleSize >= minimumSampleSize * 4
      ? "High"
      : "Medium";
  const decision = chooseAction({
    group,
    sampleSize,
    minimumSampleSize,
    confirmedContributionPaise,
    provisionalContributionPaise,
    incompleteOrders,
    contributionMarginPct,
    contributionPerDeliveredPaise,
    returnRtoRate,
    maxSafeFailureRate,
    adPaise,
    preAdContributionPaise,
    breakEvenPricePaise,
  });

  return {
    channelId: group[0].channelId,
    channelAccountId: group[0].channelAccountId,
    sku,
    orders: group.length,
    delivered: delivered.length,
    failures: failures.length,
    sampleSize,
    confirmedContributionPaise,
    provisionalContributionPaise,
    incompleteOrders,
    contributionPerDeliveredPaise,
    contributionMarginPct,
    returnRtoRate,
    breakEvenPricePaise,
    maxSafeFailureRate,
    breakEvenRoas,
    maxAcos,
    moneyImpactPaise: Math.abs(Math.min(0, confirmedContributionPaise + provisionalContributionPaise)),
    action: decision.action,
    primaryProblem: decision.primaryProblem,
    reason: decision.reason,
    confidence,
  };
}

function chooseAction(values: {
  group: OrderEconomics[];
  sampleSize: number;
  minimumSampleSize: number;
  confirmedContributionPaise: MoneyPaise;
  provisionalContributionPaise: MoneyPaise;
  incompleteOrders: number;
  contributionMarginPct?: number;
  contributionPerDeliveredPaise?: number;
  returnRtoRate?: number;
  maxSafeFailureRate?: number;
  adPaise: MoneyPaise;
  preAdContributionPaise: MoneyPaise;
  breakEvenPricePaise?: MoneyPaise;
}): Pick<SkuEconomics, "action" | "primaryProblem" | "reason"> {
  const total = values.confirmedContributionPaise + values.provisionalContributionPaise;
  if (values.incompleteOrders > 0) {
    const costMissing = values.group.some((order) => order.reasons.some((reason) => reason.includes("cost missing")));
    const settlementMissing = values.group.some((order) => !order.hasSettlementEvidence);
    return costMissing
      ? {
          action: "Add Cost",
          primaryProblem: `${values.incompleteOrders} order(s) have missing cost data`,
          reason: "Contribution is intentionally not trusted until required product and packaging costs are supplied.",
        }
      : settlementMissing
        ? {
            action: "Review Settlement",
            primaryProblem: "Order and settlement evidence do not fully match",
            reason: "At least one sub-order has no matching settlement evidence, so its outcome remains incomplete.",
          }
        : {
            action: "Insufficient Data",
            primaryProblem: "Critical evidence is incomplete",
            reason: "The parser will not guess an unknown status or monetary field.",
          };
  }
  if (values.returnRtoRate !== undefined && values.maxSafeFailureRate !== undefined && values.returnRtoRate > values.maxSafeFailureRate) {
    return {
      action: "Review Return/RTO",
      primaryProblem: "Return/RTO rate is above break-even",
      reason: `Observed failure rate is ${(values.returnRtoRate * 100).toFixed(1)}%; calculated safe limit is ${(values.maxSafeFailureRate * 100).toFixed(1)}%.`,
    };
  }
  if (total < 0 && values.adPaise > 0 && values.preAdContributionPaise > 0) {
    return {
      action: "Reduce Ads",
      primaryProblem: "Ads turn pre-ad contribution into a loss",
      reason: `Before allocated ads this SKU had ₹${(values.preAdContributionPaise / 100).toFixed(0)} available; current allocated ads exceed the sustainable level.`,
    };
  }
  if (total < 0) {
    const sampleWarning = values.sampleSize < values.minimumSampleSize
      ? ` Sample is only ${values.sampleSize}; collect more evidence before pausing.`
      : "";
    return values.breakEvenPricePaise !== undefined
      ? {
          action: "Reprice",
          primaryProblem: `SKU loses ₹${Math.abs(total / 100).toFixed(0)}`,
          reason: `Observed economics imply an approximate break-even selling price of ₹${(values.breakEvenPricePaise / 100).toFixed(0)}.${sampleWarning}`,
        }
      : {
          action: "Pause",
          primaryProblem: `SKU loses ₹${Math.abs(total / 100).toFixed(0)}`,
          reason: `There is no supportable break-even price from the available observations.${sampleWarning}`,
        };
  }
  if (
    values.sampleSize >= values.minimumSampleSize &&
    (values.contributionMarginPct ?? 0) >= 15 &&
    (values.returnRtoRate ?? 0) <= 0.2
  ) {
    return {
      action: "Scale",
      primaryProblem: "Healthy contribution with controlled failures",
      reason: `Contribution margin is ${(values.contributionMarginPct ?? 0).toFixed(1)}% across ${values.sampleSize} observed orders.`,
    };
  }
  return {
    action: "Maintain",
    primaryProblem: values.sampleSize < values.minimumSampleSize ? "Sample is still small" : "Economics are stable",
    reason: values.sampleSize < values.minimumSampleSize
      ? `Only ${values.sampleSize} observed orders; avoid a strong scale or pause decision yet.`
      : `Average delivered-order contribution is ₹${((values.contributionPerDeliveredPaise ?? 0) / 100).toFixed(0)}.`,
  };
}

function actionPriority(action: SkuEconomics["action"]): number {
  return {
    "Add Cost": 0,
    "Review Settlement": 1,
    "Review Return/RTO": 2,
    "Reduce Ads": 3,
    Reprice: 4,
    Pause: 5,
    "Insufficient Data": 6,
    Scale: 7,
    Maintain: 8,
  }[action];
}
