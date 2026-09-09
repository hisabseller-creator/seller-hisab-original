import { assertPaise } from "../money";
import type { MoneyPaise } from "../types";

export type InventoryEconomicsRow = {
  id: string;
  channelId: string;
  snapshotDate: string;
  sku: string;
  masterSku?: string;
  productName?: string;
  availableUnits: number;
  inboundUnits?: number;
  unitsSold30d?: number;
  leadTimeDays?: number;
  unitCostPaise?: MoneyPaise;
  contributionMarginBps?: number;
  location?: string;
};

export type InventoryPreferences = {
  defaultLeadTimeDays: number;
  safetyDays: number;
  targetCoverDays: number;
  overstockDays: number;
};

export type InventoryPositionStatus =
  | "Stockout"
  | "Reorder now"
  | "Overstock review"
  | "No recent sales"
  | "Add sales history"
  | "Healthy";

export type InventoryPositionEconomics = InventoryEconomicsRow & {
  effectiveLeadTimeDays: number;
  leadTimeSource: "report" | "default";
  dailyVelocity?: number;
  daysCover?: number;
  projectedStockoutDate?: string;
  reorderThresholdUnits?: number;
  targetStockUnits?: number;
  suggestedReorderUnits?: number;
  inventoryValuePaise?: MoneyPaise;
  suggestedReorderInvestmentPaise?: MoneyPaise;
  status: InventoryPositionStatus;
  reason: string;
};

export type InventoryAllocationSuggestion = {
  masterSku: string;
  fromChannelId: string;
  fromSku: string;
  toChannelId: string;
  toSku: string;
  suggestedTransferUnits: number;
  destinationMarginBps: number;
  sourceMarginBps: number;
  reason: string;
};

export type InventoryEconomicsSummary = {
  rowCount: number;
  totalAvailableUnits: number;
  totalInboundUnits: number;
  knownInventoryValuePaise: MoneyPaise;
  costCoverageRows: number;
  stockoutCount: number;
  reorderNowCount: number;
  overstockCount: number;
  missingSalesHistoryCount: number;
  totalSuggestedReorderUnits: number;
  preferences: InventoryPreferences;
  positions: InventoryPositionEconomics[];
  allocationSuggestions: InventoryAllocationSuggestion[];
  channelSummaries: Array<{
    channelId: string;
    rowCount: number;
    availableUnits: number;
    inboundUnits: number;
    stockoutCount: number;
    reorderNowCount: number;
    overstockCount: number;
  }>;
};

export const DEFAULT_INVENTORY_PREFERENCES: InventoryPreferences = {
  defaultLeadTimeDays: 14,
  safetyDays: 7,
  targetCoverDays: 30,
  overstockDays: 120,
};

function safeUnits(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function addDays(iso: string, days: number): string | undefined {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.floor(days)));
  return date.toISOString();
}

function positionEconomics(row: InventoryEconomicsRow, preferences: InventoryPreferences): InventoryPositionEconomics {
  const availableUnits = safeUnits(row.availableUnits);
  const inboundUnits = safeUnits(row.inboundUnits);
  const effectiveLeadTimeDays = row.leadTimeDays ?? preferences.defaultLeadTimeDays;
  const leadTimeSource: "report" | "default" = row.leadTimeDays === undefined ? "default" : "report";
  const inventoryValuePaise = row.unitCostPaise === undefined ? undefined : assertPaise(availableUnits * row.unitCostPaise);

  if (row.unitsSold30d === undefined) {
    return {
      ...row,
      availableUnits,
      inboundUnits,
      effectiveLeadTimeDays,
      leadTimeSource,
      inventoryValuePaise,
      status: "Add sales history",
      reason: "Available stock is known, but 30-day unit sales are missing. SellerHisab will not invent sales velocity or a reorder quantity.",
    };
  }

  const sold30d = safeUnits(row.unitsSold30d);
  if (sold30d === 0) {
    return {
      ...row,
      availableUnits,
      inboundUnits,
      unitsSold30d: 0,
      effectiveLeadTimeDays,
      leadTimeSource,
      dailyVelocity: 0,
      inventoryValuePaise,
      suggestedReorderUnits: 0,
      status: availableUnits > 0 ? "No recent sales" : "Healthy",
      reason: availableUnits > 0
        ? "No units were reported sold in the last 30 days. Review this stock before buying more; SellerHisab does not label it dead stock from one month alone."
        : "No available stock and no reported sales in the last 30 days.",
    };
  }

  const dailyVelocity = sold30d / 30;
  const daysCover = availableUnits / dailyVelocity;
  const reorderWindowDays = effectiveLeadTimeDays + preferences.safetyDays;
  const reorderThresholdUnits = Math.ceil(dailyVelocity * reorderWindowDays);
  const targetStockUnits = Math.ceil(dailyVelocity * (reorderWindowDays + preferences.targetCoverDays));
  const suggestedReorderUnits = Math.max(0, targetStockUnits - availableUnits - inboundUnits);
  const suggestedReorderInvestmentPaise = row.unitCostPaise === undefined
    ? undefined
    : assertPaise(suggestedReorderUnits * row.unitCostPaise);
  const projectedStockoutDate = addDays(row.snapshotDate, daysCover);

  let status: InventoryPositionStatus = "Healthy";
  let reason = `About ${daysCover.toFixed(1)} days of cover at the reported 30-day sales velocity.`;
  if (availableUnits <= 0) {
    status = "Stockout";
    reason = `Available stock is zero while the last 30 days show ${sold30d} unit(s) sold. Replenishment needs review now.`;
  } else if (daysCover <= reorderWindowDays) {
    status = "Reorder now";
    reason = `${daysCover.toFixed(1)} days of cover is at or below the ${reorderWindowDays}-day lead-time + safety window.`;
  } else if (daysCover >= preferences.overstockDays) {
    status = "Overstock review";
    reason = `${daysCover.toFixed(1)} days of cover is above the ${preferences.overstockDays}-day overstock review threshold.`;
  }

  return {
    ...row,
    availableUnits,
    inboundUnits,
    unitsSold30d: sold30d,
    effectiveLeadTimeDays,
    leadTimeSource,
    dailyVelocity,
    daysCover,
    projectedStockoutDate,
    reorderThresholdUnits,
    targetStockUnits,
    suggestedReorderUnits,
    inventoryValuePaise,
    suggestedReorderInvestmentPaise,
    status,
    reason,
  };
}

function allocationSuggestions(positions: InventoryPositionEconomics[], preferences: InventoryPreferences): InventoryAllocationSuggestion[] {
  const groups = new Map<string, InventoryPositionEconomics[]>();
  for (const position of positions) {
    const masterSku = position.masterSku?.trim();
    if (!masterSku || position.contributionMarginBps === undefined || position.daysCover === undefined || !position.dailyVelocity) continue;
    const list = groups.get(masterSku) ?? [];
    list.push(position);
    groups.set(masterSku, list);
  }

  const output: InventoryAllocationSuggestion[] = [];
  for (const [masterSku, group] of groups) {
    if (new Set(group.map((item) => item.channelId)).size < 2) continue;
    const destinations = group
      .filter((item) => item.status === "Stockout" || item.status === "Reorder now")
      .sort((a, b) => Number(b.contributionMarginBps ?? 0) - Number(a.contributionMarginBps ?? 0));
    for (const destination of destinations) {
      const donor = group
        .filter((item) => item.channelId !== destination.channelId && item.daysCover !== undefined && item.daysCover > preferences.targetCoverDays + item.effectiveLeadTimeDays + preferences.safetyDays)
        .filter((item) => Number(destination.contributionMarginBps ?? 0) >= Number(item.contributionMarginBps ?? 0) + 500)
        .map((item) => {
          const requiredDonorUnits = Math.ceil((item.dailyVelocity ?? 0) * (preferences.targetCoverDays + item.effectiveLeadTimeDays + preferences.safetyDays));
          return { item, surplusUnits: Math.max(0, item.availableUnits - requiredDonorUnits) };
        })
        .filter((item) => item.surplusUnits > 0)
        .sort((a, b) => b.surplusUnits - a.surplusUnits)[0];
      if (!donor) continue;
      const needed = destination.suggestedReorderUnits ?? 0;
      const transfer = Math.min(needed, donor.surplusUnits);
      if (transfer <= 0) continue;
      output.push({
        masterSku,
        fromChannelId: donor.item.channelId,
        fromSku: donor.item.sku,
        toChannelId: destination.channelId,
        toSku: destination.sku,
        suggestedTransferUnits: transfer,
        destinationMarginBps: destination.contributionMarginBps ?? 0,
        sourceMarginBps: donor.item.contributionMarginBps ?? 0,
        reason: `The destination channel is inside its reorder window and has at least 5 percentage points more explicit contribution margin. The source channel remains above its target cover after the suggested transfer.`,
      });
    }
  }
  return output.slice(0, 50);
}

export function buildInventoryEconomicsSummary(rows: InventoryEconomicsRow[], preferencesInput?: Partial<InventoryPreferences>): InventoryEconomicsSummary {
  const preferences: InventoryPreferences = {
    defaultLeadTimeDays: preferencesInput?.defaultLeadTimeDays ?? DEFAULT_INVENTORY_PREFERENCES.defaultLeadTimeDays,
    safetyDays: preferencesInput?.safetyDays ?? DEFAULT_INVENTORY_PREFERENCES.safetyDays,
    targetCoverDays: preferencesInput?.targetCoverDays ?? DEFAULT_INVENTORY_PREFERENCES.targetCoverDays,
    overstockDays: preferencesInput?.overstockDays ?? DEFAULT_INVENTORY_PREFERENCES.overstockDays,
  };
  const positions = rows.map((row) => positionEconomics(row, preferences));
  const channelMap = new Map<string, InventoryEconomicsSummary["channelSummaries"][number]>();
  let knownInventoryValuePaise = 0;
  let costCoverageRows = 0;
  let totalAvailableUnits = 0;
  let totalInboundUnits = 0;
  let stockoutCount = 0;
  let reorderNowCount = 0;
  let overstockCount = 0;
  let missingSalesHistoryCount = 0;
  let totalSuggestedReorderUnits = 0;

  for (const position of positions) {
    totalAvailableUnits += position.availableUnits;
    totalInboundUnits += position.inboundUnits ?? 0;
    if (position.inventoryValuePaise !== undefined) {
      knownInventoryValuePaise += position.inventoryValuePaise;
      costCoverageRows += 1;
    }
    if (position.status === "Stockout") stockoutCount += 1;
    if (position.status === "Reorder now") reorderNowCount += 1;
    if (position.status === "Overstock review" || position.status === "No recent sales") overstockCount += 1;
    if (position.status === "Add sales history") missingSalesHistoryCount += 1;
    totalSuggestedReorderUnits += position.suggestedReorderUnits ?? 0;

    const current = channelMap.get(position.channelId) ?? { channelId: position.channelId, rowCount: 0, availableUnits: 0, inboundUnits: 0, stockoutCount: 0, reorderNowCount: 0, overstockCount: 0 };
    current.rowCount += 1;
    current.availableUnits += position.availableUnits;
    current.inboundUnits += position.inboundUnits ?? 0;
    if (position.status === "Stockout") current.stockoutCount += 1;
    if (position.status === "Reorder now") current.reorderNowCount += 1;
    if (position.status === "Overstock review" || position.status === "No recent sales") current.overstockCount += 1;
    channelMap.set(position.channelId, current);
  }

  const statusOrder: Record<InventoryPositionStatus, number> = {
    Stockout: 0,
    "Reorder now": 1,
    "Add sales history": 2,
    "Overstock review": 3,
    "No recent sales": 4,
    Healthy: 5,
  };
  positions.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.daysCover ?? Number.POSITIVE_INFINITY) - (b.daysCover ?? Number.POSITIVE_INFINITY) || a.sku.localeCompare(b.sku));

  return {
    rowCount: positions.length,
    totalAvailableUnits,
    totalInboundUnits,
    knownInventoryValuePaise: assertPaise(knownInventoryValuePaise),
    costCoverageRows,
    stockoutCount,
    reorderNowCount,
    overstockCount,
    missingSalesHistoryCount,
    totalSuggestedReorderUnits,
    preferences,
    positions,
    allocationSuggestions: allocationSuggestions(positions, preferences),
    channelSummaries: [...channelMap.values()].sort((a, b) => a.channelId.localeCompare(b.channelId)),
  };
}
