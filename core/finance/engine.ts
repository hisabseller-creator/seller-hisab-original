import { allocatePaise, assertPaise, sumPaise } from "../money";
import { contributionPaise as computeContributionPaise } from "./formulas";
import type {
  AnalysisInput,
  AuditLine,
  MoneyPaise,
  OrderEconomics,
  ReconciledOrder,
} from "../types";

const COSTED_OUTCOMES = new Set(["delivered"]);
const PACKAGED_OUTCOMES = new Set(["delivered", "return", "rto", "exchange"]);
const FINAL_OUTCOMES = new Set(["delivered", "return", "rto", "cancelled"]);

export function calculateOrderEconomics(
  orders: ReconciledOrder[],
  input: AnalysisInput,
): OrderEconomics[] {
  const costs = new Map(input.costs.map((record) => [record.sku.trim(), record]));
  const adAllocations = allocateAds(orders, input);

  return orders.map((order, index) => {
    const cost = costs.get(order.sku);
    const reasons: string[] = [];
    // Released settlement against a still-pending order is real financial evidence.
    // Keep the row provisional because the outcome can still change, but do not
    // overstate contribution by pretending product/packaging cost is zero.
    const pendingWithSettlement = order.outcome === "pending" && order.hasSettlementEvidence;
    const isCosted = COSTED_OUTCOMES.has(order.outcome) || pendingWithSettlement;
    const isPackaged = PACKAGED_OUTCOMES.has(order.outcome) || pendingWithSettlement;
    const productCostPaise = isCosted
      ? multiply(cost?.productCostPaise, order.quantity)
      : 0;
    const packagingUnit = cost?.packagingCostPaise ?? input.defaultPackagingPaise;
    const packagingCostPaise = isPackaged ? multiply(packagingUnit, order.quantity) : 0;
    const variableCostPaise = isPackaged ? multiply(cost?.variableCostPaise ?? 0, order.quantity) : 0;
    const adCostPaise = adAllocations.spend[index] ?? 0;
    const attributableAdSalesPaise = adAllocations.sales[index] ?? 0;

    if (isCosted && productCostPaise === undefined) reasons.push("Product cost missing");
    if (isPackaged && packagingCostPaise === undefined) reasons.push("Packaging cost missing");
    if (!order.hasSettlementEvidence) reasons.push("Settlement evidence missing");
    if (order.skuAmbiguous) reasons.push("Multiple SKUs map to this sub-order; cost/ad allocation is not defensible");
    if (adAllocations.unallocatedSpendPaise > 0) reasons.push("Known ad spend could not be defensibly allocated to an order");
    if (order.outcome === "unknown") reasons.push("Order status is not recognized");
    if (order.outcome === "pending" || order.outcome === "exchange") {
      reasons.push("Outcome can still change");
    }

    const hasRequiredCosts = productCostPaise !== undefined && packagingCostPaise !== undefined;
    const canCalculate = hasRequiredCosts && order.settlementPaise !== undefined && !order.skuAmbiguous && adAllocations.unallocatedSpendPaise === 0;
    const state = !canCalculate || order.outcome === "unknown"
      ? "incomplete"
      : FINAL_OUTCOMES.has(order.outcome)
        ? "confirmed"
        : "provisional";

    const contributionPaise = canCalculate
      ? computeContributionPaise({
          settlementPaise: order.settlementPaise ?? 0,
          productCostPaise,
          packagingCostPaise,
          variableCostPaise,
          adCostPaise,
        })
      : undefined;
    const returnRtoLossPaise =
      order.outcome === "return" || order.outcome === "rto"
        ? assertPaise(
            Math.max(0, -(order.settlementPaise ?? 0)) +
              (packagingCostPaise ?? 0) +
              (variableCostPaise ?? 0),
          )
        : 0;

    return {
      ...order,
      state,
      contributionPaise,
      productCostPaise,
      packagingCostPaise,
      variableCostPaise,
      adCostPaise,
      attributableAdSalesPaise,
      returnRtoLossPaise,
      reasons,
      audit: buildAudit({
        order,
        contributionPaise,
        productCostPaise,
        packagingCostPaise,
        variableCostPaise,
        adCostPaise,
        returnRtoLossPaise,
      }),
    };
  });
}

function allocateAds(orders: ReconciledOrder[], input: AnalysisInput): { spend: MoneyPaise[]; sales: MoneyPaise[]; unallocatedSpendPaise: MoneyPaise } {
  const spend = orders.map(() => 0);
  const sales = orders.map(() => 0);
  const allocatableOrders = orders.map((order, index) => order.skuAmbiguous ? -1 : index).filter((index) => index >= 0);
  let unallocatedSpendPaise: MoneyPaise = 0;
  const addAllocation = (indices: number[], total: MoneyPaise, target: MoneyPaise[], trackUnallocated = false) => {
    if (total === 0) return;
    if (!indices.length) {
      if (trackUnallocated) unallocatedSpendPaise = assertPaise(unallocatedSpendPaise + total);
      return;
    }
    const values = allocatePaise(total, indices.map((index) => Math.max(0, orders[index].salePaise ?? orders[index].settlementPaise ?? 0)));
    indices.forEach((orderIndex, valueIndex) => {
      target[orderIndex] = assertPaise(target[orderIndex] + values[valueIndex]);
    });
  };
  let globalSpend = input.manualAdSpendPaise ?? 0;
  let globalSales = 0;
  for (const record of input.adCosts ?? []) {
    if (record.sku) {
      const recordChannel = record.source?.channelId;
      const recordAccount = record.source?.channelAccountId;
      const indices = orders
        .map((order, index) => {
          if (order.skuAmbiguous || order.sku !== record.sku) return -1;
          if (recordChannel && order.channelId !== recordChannel) return -1;
          if (recordAccount && order.channelAccountId !== recordAccount) return -1;
          return index;
        })
        .filter((index) => index >= 0);
      addAllocation(indices, record.spendPaise, spend, true);
      addAllocation(indices, record.attributableSalesPaise ?? 0, sales);
    } else {
      globalSpend = assertPaise(globalSpend + record.spendPaise);
      globalSales = assertPaise(globalSales + (record.attributableSalesPaise ?? 0));
    }
  }
  addAllocation(allocatableOrders, globalSpend, spend, true);
  addAllocation(allocatableOrders, globalSales, sales);
  return { spend, sales, unallocatedSpendPaise };
}

function multiply(value: MoneyPaise | undefined, quantity: number): MoneyPaise | undefined {
  return value === undefined ? undefined : assertPaise(value * quantity);
}

function buildAudit(values: {
  order: ReconciledOrder;
  contributionPaise?: MoneyPaise;
  productCostPaise?: MoneyPaise;
  packagingCostPaise?: MoneyPaise;
  variableCostPaise?: MoneyPaise;
  adCostPaise?: MoneyPaise;
  returnRtoLossPaise?: MoneyPaise;
}): AuditLine[] {
  const sources = values.order.sources;
  return [
    {
      key: "settlement",
      label: "Settlement received / attributable",
      amountPaise: values.order.settlementPaise ?? 0,
      known: values.order.settlementPaise !== undefined,
      operation: "add",
      sources,
    },
    {
      key: "product_cost",
      label: "Product cost",
      amountPaise: values.productCostPaise ?? 0,
      known: values.productCostPaise !== undefined,
      operation: "subtract",
      sources: [],
    },
    {
      key: "packaging",
      label: "Packaging",
      amountPaise: values.packagingCostPaise ?? 0,
      known: values.packagingCostPaise !== undefined,
      operation: "subtract",
      sources: [],
    },
    {
      key: "variable_cost",
      label: "Other variable costs",
      amountPaise: values.variableCostPaise ?? 0,
      known: values.variableCostPaise !== undefined,
      operation: "subtract",
      sources: [],
    },
    {
      key: "ads",
      label: "Allocated ads",
      amountPaise: values.adCostPaise ?? 0,
      known: values.adCostPaise !== undefined,
      operation: "subtract",
      sources: [],
    },
    {
      key: "return_rto_loss",
      label: "Observed return/RTO cash + handling loss (already represented above)",
      amountPaise: values.returnRtoLossPaise ?? 0,
      known: values.returnRtoLossPaise !== undefined,
      operation: "add",
      sources,
    },
    {
      key: "contribution",
      label: "Contribution",
      amountPaise: values.contributionPaise ?? 0,
      known: values.contributionPaise !== undefined,
      operation: "equals",
      sources,
    },
  ];
}

export function sumCalculatedContribution(orders: OrderEconomics[]): MoneyPaise {
  return sumPaise(orders.map((order) => order.contributionPaise));
}
