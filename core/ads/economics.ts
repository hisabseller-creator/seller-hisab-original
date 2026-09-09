import {
  actualAcosBps as ratioAcosBps,
  actualRoas as ratioRoas,
  breakEvenRoasFromMarginBps,
  sustainableAdSpendPaise as weightedPaise,
} from "../finance/formulas";
import { assertPaise, sumPaise } from "../money";
import type { MoneyPaise } from "../types";

export type AdsEconomicsRow = {
  id: string;
  channelId: string;
  reportDate: string;
  campaignName: string;
  campaignId?: string;
  adGroupName?: string;
  sku?: string;
  spendPaise: MoneyPaise;
  attributedSalesPaise?: MoneyPaise;
  attributedOrders?: number;
  clicks?: number;
  impressions?: number;
};

export type AdsEconomicsPreferences = {
  preAdMarginBps?: number;
  returnLossBps?: number;
};

export type AdsCampaignEconomics = {
  key: string;
  channelId: string;
  campaignName: string;
  spendPaise: MoneyPaise;
  attributedSalesPaise: MoneyPaise;
  salesCoverageComplete: boolean;
  actualAcosBps?: number;
  actualRoas?: number;
  modeledContributionAfterAdsPaise?: MoneyPaise;
  sustainableSpendPaise?: MoneyPaise;
  overshootPaise?: MoneyPaise;
  attributedOrders?: number;
  clicks?: number;
  impressions?: number;
  action: "Set margin baseline" | "Add attributed sales" | "Review or reduce spend" | "Watch margin" | "Review scale opportunity" | "Maintain";
  reason: string;
};

export type AdsEconomicsSummary = {
  rowCount: number;
  totalSpendPaise: MoneyPaise;
  totalAttributedSalesPaise: MoneyPaise;
  spendWithoutSalesPaise: MoneyPaise;
  salesCoverageComplete: boolean;
  actualAcosBps?: number;
  actualRoas?: number;
  preAdMarginBps?: number;
  returnLossBps: number;
  effectiveMarginBps?: number;
  maxAcosBps?: number;
  breakEvenRoas?: number;
  modeledPreAdContributionPaise?: MoneyPaise;
  modeledReturnLossPaise?: MoneyPaise;
  modeledContributionAfterAdsPaise?: MoneyPaise;
  spendAtRiskPaise: MoneyPaise;
  campaigns: AdsCampaignEconomics[];
  channelSummaries: Array<{ channelId: string; spendPaise: MoneyPaise; attributedSalesPaise: MoneyPaise; actualAcosBps?: number; actualRoas?: number }>;
};

function sumOptional(values: Array<number | undefined>): number | undefined {
  if (values.some((value) => value === undefined)) return undefined;
  return values.reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
}

function campaignAction(input: {
  salesCoverageComplete: boolean;
  preAdMarginBps?: number;
  effectiveMarginBps?: number;
  actualAcosBps?: number;
  modeledContributionAfterAdsPaise?: number;
  attributedSalesPaise: number;
  attributedOrders?: number;
}): Pick<AdsCampaignEconomics, "action" | "reason"> {
  if (!input.salesCoverageComplete) return { action: "Add attributed sales", reason: "Spend is present but attributed sales are missing on at least one row, so ACoS/ROAS is incomplete." };
  if (!input.preAdMarginBps || input.effectiveMarginBps === undefined) return { action: "Set margin baseline", reason: "Actual spend efficiency is visible, but profit-after-ads needs an explicit pre-ad contribution margin." };
  if ((input.modeledContributionAfterAdsPaise ?? 0) < 0) return { action: "Review or reduce spend", reason: "Modeled return-adjusted contribution after ads is negative at the current margin assumptions." };
  if (input.actualAcosBps !== undefined && input.actualAcosBps >= input.effectiveMarginBps * 0.9) return { action: "Watch margin", reason: "Actual ACoS is close to the maximum sustainable ACoS under the current margin assumptions." };
  if (input.actualAcosBps !== undefined && input.actualAcosBps <= input.effectiveMarginBps * 0.7 && input.attributedSalesPaise >= 100_000 && (input.attributedOrders ?? 0) >= 3) {
    return { action: "Review scale opportunity", reason: "Campaign is materially below the break-even ACoS with enough observed attributed sales/orders to justify a human scale review." };
  }
  return { action: "Maintain", reason: "Current campaign efficiency is inside the supplied sustainable margin boundary." };
}

export function buildAdsEconomicsSummary(rows: AdsEconomicsRow[], preferences: AdsEconomicsPreferences): AdsEconomicsSummary {
  const preAdMarginBps = Number.isInteger(preferences.preAdMarginBps) && Number(preferences.preAdMarginBps) > 0 && Number(preferences.preAdMarginBps) <= 10_000
    ? Number(preferences.preAdMarginBps)
    : undefined;
  const returnLossBps = Number.isInteger(preferences.returnLossBps) && Number(preferences.returnLossBps) >= 0 && Number(preferences.returnLossBps) <= 10_000
    ? Number(preferences.returnLossBps)
    : 0;
  const effectiveMarginBps = preAdMarginBps === undefined ? undefined : Math.max(0, preAdMarginBps - returnLossBps);

  const totalSpendPaise = sumPaise(rows.map((row) => row.spendPaise));
  const completeSales = sumOptional(rows.map((row) => row.attributedSalesPaise));
  const totalAttributedSalesPaise = assertPaise(rows.reduce((sum, row) => sum + Number(row.attributedSalesPaise ?? 0), 0));
  const spendWithoutSalesPaise = sumPaise(rows.filter((row) => row.attributedSalesPaise === undefined).map((row) => row.spendPaise));
  const salesCoverageComplete = completeSales !== undefined;
  const actualAcosBps = salesCoverageComplete ? ratioAcosBps(totalSpendPaise, totalAttributedSalesPaise) : undefined;
  const actualRoas = salesCoverageComplete ? ratioRoas(totalSpendPaise, totalAttributedSalesPaise) : undefined;

  const campaignMap = new Map<string, AdsEconomicsRow[]>();
  for (const row of rows) {
    const key = `${row.channelId}::${row.campaignId ?? row.campaignName}`;
    const group = campaignMap.get(key) ?? [];
    group.push(row);
    campaignMap.set(key, group);
  }

  const campaigns: AdsCampaignEconomics[] = [...campaignMap.entries()].map(([key, group]) => {
    const spendPaise = sumPaise(group.map((row) => row.spendPaise));
    const campaignSalesOptional = sumOptional(group.map((row) => row.attributedSalesPaise));
    const attributedSalesPaise = assertPaise(group.reduce((sum, row) => sum + Number(row.attributedSalesPaise ?? 0), 0));
    const campaignCoverage = campaignSalesOptional !== undefined;
    const campaignAcos = campaignCoverage ? ratioAcosBps(spendPaise, attributedSalesPaise) : undefined;
    const campaignRoas = campaignCoverage ? ratioRoas(spendPaise, attributedSalesPaise) : undefined;
    const sustainableSpendPaise = campaignCoverage && effectiveMarginBps !== undefined ? weightedPaise(attributedSalesPaise, effectiveMarginBps) : undefined;
    const modeledContributionAfterAdsPaise = sustainableSpendPaise === undefined ? undefined : assertPaise(sustainableSpendPaise - spendPaise);
    const overshootPaise = sustainableSpendPaise === undefined ? undefined : assertPaise(Math.max(0, spendPaise - sustainableSpendPaise));
    const attributedOrders = group.some((row) => row.attributedOrders === undefined) ? undefined : group.reduce((sum, row) => sum + Number(row.attributedOrders ?? 0), 0);
    const clicks = group.some((row) => row.clicks === undefined) ? undefined : group.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
    const impressions = group.some((row) => row.impressions === undefined) ? undefined : group.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    const action = campaignAction({
      salesCoverageComplete: campaignCoverage,
      preAdMarginBps,
      effectiveMarginBps,
      actualAcosBps: campaignAcos,
      modeledContributionAfterAdsPaise,
      attributedSalesPaise,
      attributedOrders,
    });
    return {
      key,
      channelId: group[0]?.channelId ?? "unknown",
      campaignName: group[0]?.campaignName ?? "Unknown campaign",
      spendPaise,
      attributedSalesPaise,
      salesCoverageComplete: campaignCoverage,
      actualAcosBps: campaignAcos,
      actualRoas: campaignRoas,
      modeledContributionAfterAdsPaise,
      sustainableSpendPaise,
      overshootPaise,
      attributedOrders,
      clicks,
      impressions,
      ...action,
    };
  }).sort((a, b) => Number(b.overshootPaise ?? 0) - Number(a.overshootPaise ?? 0) || b.spendPaise - a.spendPaise || a.campaignName.localeCompare(b.campaignName));

  const channelMap = new Map<string, AdsEconomicsRow[]>();
  for (const row of rows) {
    const group = channelMap.get(row.channelId) ?? [];
    group.push(row);
    channelMap.set(row.channelId, group);
  }
  const channelSummaries = [...channelMap.entries()].map(([channelId, group]) => {
    const spendPaise = sumPaise(group.map((row) => row.spendPaise));
    const salesOptional = sumOptional(group.map((row) => row.attributedSalesPaise));
    const attributedSalesPaise = assertPaise(group.reduce((sum, row) => sum + Number(row.attributedSalesPaise ?? 0), 0));
    return {
      channelId,
      spendPaise,
      attributedSalesPaise,
      actualAcosBps: salesOptional === undefined ? undefined : ratioAcosBps(spendPaise, attributedSalesPaise),
      actualRoas: salesOptional === undefined ? undefined : ratioRoas(spendPaise, attributedSalesPaise),
    };
  }).sort((a, b) => b.spendPaise - a.spendPaise);

  const modeledPreAdContributionPaise = salesCoverageComplete && preAdMarginBps !== undefined ? weightedPaise(totalAttributedSalesPaise, preAdMarginBps) : undefined;
  const modeledReturnLossPaise = salesCoverageComplete && preAdMarginBps !== undefined ? weightedPaise(totalAttributedSalesPaise, Math.min(returnLossBps, preAdMarginBps)) : undefined;
  const modeledContributionAfterAdsPaise = salesCoverageComplete && effectiveMarginBps !== undefined
    ? assertPaise(weightedPaise(totalAttributedSalesPaise, effectiveMarginBps) - totalSpendPaise)
    : undefined;
  const spendAtRiskPaise = sumPaise(campaigns.map((campaign) => campaign.overshootPaise ?? 0));

  return {
    rowCount: rows.length,
    totalSpendPaise,
    totalAttributedSalesPaise,
    spendWithoutSalesPaise,
    salesCoverageComplete,
    actualAcosBps,
    actualRoas,
    preAdMarginBps,
    returnLossBps,
    effectiveMarginBps,
    maxAcosBps: effectiveMarginBps,
    breakEvenRoas: breakEvenRoasFromMarginBps(effectiveMarginBps),
    modeledPreAdContributionPaise,
    modeledReturnLossPaise,
    modeledContributionAfterAdsPaise,
    spendAtRiskPaise,
    campaigns,
    channelSummaries,
  };
}
