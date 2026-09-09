import type { CostRecord } from "../types";

export type PersistedCost = CostRecord & { updatedAt: string };

export function mergeSavedCosts(local: PersistedCost[], remote: PersistedCost[]): PersistedCost[] {
  const merged = new Map<string, PersistedCost>();
  for (const item of [...local, ...remote]) {
    const sku = item.sku.trim();
    if (!sku) continue;
    const candidate = { ...item, sku };
    const current = merged.get(sku);
    if (!current || timestamp(candidate.updatedAt) >= timestamp(current.updatedAt)) merged.set(sku, candidate);
  }
  return [...merged.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function syncableSavedCosts(costs: PersistedCost[]): Array<Required<Pick<CostRecord, "sku" | "productCostPaise">> & Pick<CostRecord, "packagingCostPaise" | "variableCostPaise"> & { updatedAt: string }> {
  return costs
    .filter((cost): cost is PersistedCost & { productCostPaise: number } => Number.isSafeInteger(cost.productCostPaise) && (cost.productCostPaise ?? -1) >= 0 && Boolean(cost.sku.trim()))
    .map((cost) => ({
      sku: cost.sku.trim(),
      productCostPaise: cost.productCostPaise,
      packagingCostPaise: cost.packagingCostPaise,
      variableCostPaise: cost.variableCostPaise,
      updatedAt: cost.updatedAt,
    }));
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
