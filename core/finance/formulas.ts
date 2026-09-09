import { assertPaise, sumPaise } from "../money";
import type { SettlementCashStage } from "../settlements/evidence";
import type { MoneyPaise } from "../types";

/**
 * Authoritative SellerHisab financial primitives.
 *
 * The seller calculators, the order finance engine, the SKU decision engine and
 * the Ads economics engine MUST derive shared financial concepts from this
 * module so the same concept can never be computed two different ways.
 *
 * Unit conventions:
 * - `*Paise` values are integer paise (`MoneyPaise`). Never binary floating rupees.
 * - `*Bps` values are integer basis points (`BPS_SCALE` = 100%).
 * - Dimensionless ratios/rates (ROAS, failure rate, retained rate) are plain
 *   numbers because they are not money; callers round only for display.
 * - `undefined` means "not supportable from the supplied evidence". Callers must
 *   surface that as incomplete rather than substituting a default.
 */
export const FINANCE_FORMULA_VERSION = "finance-formulas-v1.0.0";

export const BPS_SCALE = 10_000;

/**
 * Observed retained-settlement rate (settlement / sale) is clamped so a single
 * odd order cannot produce an absurd break-even price. Mirrors the historical
 * decision-engine bounds.
 */
export const RETAINED_RATE_FLOOR = 0.05;
export const RETAINED_RATE_CEILING = 1.2;

export type BasisPoints = number;

export type ContributionInput = {
  settlementPaise: MoneyPaise;
  productCostPaise?: MoneyPaise;
  packagingCostPaise?: MoneyPaise;
  variableCostPaise?: MoneyPaise;
  adCostPaise?: MoneyPaise;
};

/** Contribution = settlement − product cost − packaging − other variable cost − allocated ads. */
export function contributionPaise(input: ContributionInput): MoneyPaise {
  return assertPaise(
    input.settlementPaise
      - (input.productCostPaise ?? 0)
      - (input.packagingCostPaise ?? 0)
      - (input.variableCostPaise ?? 0)
      - (input.adCostPaise ?? 0),
  );
}

/** Contribution margin as a percentage of observed sale value; undefined without positive sales. */
export function contributionMarginPct(contribution: number, sale: number): number | undefined {
  return sale > 0 ? (contribution / sale) * 100 : undefined;
}

/** Contribution margin in integer basis points; undefined without positive sales. */
export function contributionMarginBps(contribution: MoneyPaise, sale: MoneyPaise): BasisPoints | undefined {
  return sale > 0 ? Math.round((contribution * BPS_SCALE) / sale) : undefined;
}

/** Clamped settlement ÷ sale ratio observed on successful orders; undefined without positive sales. */
export function observedRetainedRate(settlement: number, sale: number): number | undefined {
  if (!(sale > 0)) return undefined;
  return Math.max(RETAINED_RATE_FLOOR, Math.min(RETAINED_RATE_CEILING, settlement / sale));
}

/** Expected failure loss spread over every order = loss per failure × failure rate. Zero when either input is unknown. */
export function expectedFailureLossPerOrder(lossPerFailure: number | undefined, failureRate: number | undefined): number {
  return lossPerFailure !== undefined && failureRate !== undefined ? lossPerFailure * failureRate : 0;
}

/**
 * Break-even selling price = (base cost per order + expected failure loss per order) ÷ retained rate.
 * Undefined when the retained rate is unknown or non-positive.
 */
export function breakEvenPricePaise(input: {
  baseCostPerOrder: number;
  expectedFailureLossPerOrder: number;
  retainedRate: number | undefined;
}): MoneyPaise | undefined {
  if (input.retainedRate === undefined || !(input.retainedRate > 0)) return undefined;
  return assertPaise(Math.max(0, Math.round((input.baseCostPerOrder + input.expectedFailureLossPerOrder) / input.retainedRate)));
}

/**
 * Maximum failure (return/RTO) rate at which observed success contribution still covers observed failure loss:
 * success ÷ (success + loss). Undefined unless both are positive observations.
 */
export function maxSafeFailureRate(successContribution: number | undefined, failureLoss: number | undefined): number | undefined {
  if (successContribution === undefined || failureLoss === undefined) return undefined;
  if (!(successContribution > 0) || !(failureLoss > 0)) return undefined;
  return successContribution / (successContribution + failureLoss);
}

/** Break-even ROAS = attributable ad sales ÷ pre-ad contribution. Undefined without positive inputs. */
export function breakEvenRoas(preAdContribution: number, attributableSales: number): number | undefined {
  return preAdContribution > 0 && attributableSales > 0 ? attributableSales / preAdContribution : undefined;
}

/** Maximum sustainable ACoS as a ratio = pre-ad contribution ÷ attributable ad sales (reciprocal of break-even ROAS). */
export function maxAcosRatio(preAdContribution: number, attributableSales: number): number | undefined {
  return preAdContribution > 0 && attributableSales > 0 ? preAdContribution / attributableSales : undefined;
}

/** Actual ACoS in basis points = spend ÷ attributed sales. Zero spend with zero sales is 0; spend without sales is unknown. */
export function actualAcosBps(spendPaise: MoneyPaise, salesPaise: MoneyPaise): BasisPoints | undefined {
  if (salesPaise <= 0) return spendPaise === 0 ? 0 : undefined;
  return Math.round((spendPaise * BPS_SCALE) / salesPaise);
}

/** Actual ROAS = attributed sales ÷ spend. Undefined without positive spend. */
export function actualRoas(spendPaise: MoneyPaise, salesPaise: MoneyPaise): number | undefined {
  if (spendPaise <= 0) return undefined;
  return salesPaise / spendPaise;
}

/** Break-even ROAS implied by a contribution margin in basis points = 1 ÷ margin. */
export function breakEvenRoasFromMarginBps(marginBps: BasisPoints | undefined): number | undefined {
  return marginBps !== undefined && marginBps > 0 ? BPS_SCALE / marginBps : undefined;
}

/** Ad spend that a margin (bps) on attributed sales can sustain before contribution after ads turns negative. */
export function sustainableAdSpendPaise(attributedSalesPaise: MoneyPaise, marginBps: BasisPoints): MoneyPaise {
  return assertPaise(Math.round((attributedSalesPaise * marginBps) / BPS_SCALE));
}

/** Expected return/RTO money loss = orders × failure rate × loss per failure, in integer paise. */
export function failureLossPaise(input: { orders: number; failureRateBps: BasisPoints; lossPerFailurePaise: MoneyPaise }): MoneyPaise {
  return assertPaise(Math.round((input.orders * input.lossPerFailurePaise * input.failureRateBps) / BPS_SCALE));
}

/** Settlement gap = expected settlement − received amount. Positive means the seller received less than expected. */
export function settlementGapPaise(expectedPaise: MoneyPaise, receivedPaise: MoneyPaise): MoneyPaise {
  return assertPaise(expectedPaise - receivedPaise);
}

/**
 * Marketplace-financial evidence ("released" in the marketplace ledger) is NOT proof of a bank credit.
 * Only settlement attributed at payout stage, or line-level settlement with no explicit stage, is
 * allowed to be compared against bank credit. SALES != SETTLEMENT != BANK CASH.
 */
export function bankReconcilableSettlementPaise(
  orders: ReadonlyArray<{ settlementPaise?: MoneyPaise; settlementCashStage?: SettlementCashStage }>,
): MoneyPaise {
  return sumPaise(
    orders
      .filter((order) => order.settlementCashStage !== "marketplace-financial")
      .map((order) => order.settlementPaise),
  );
}
