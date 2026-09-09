import {
  BPS_SCALE,
  breakEvenPricePaise,
  breakEvenRoas,
  contributionMarginBps,
  contributionPaise,
  failureLossPaise,
  maxAcosRatio,
  settlementGapPaise,
} from "./finance/formulas";
import { sumPaise } from "./money";
import type { MoneyPaise } from "./types";

export type CalculatorValues = Record<string, string>;
export type CalculatorMathType = "margin" | "failure" | "break-even" | "roas" | "acos" | "gap";
export type CalculatorMathOutput = {
  status: "ready" | "insufficient";
  value: string;
  secondaryValue?: string;
  formula: string;
};

const BREAK_EVEN_FORMULA = "Required cost ÷ observed retained settlement rate";
const AD_FORMULA_INSUFFICIENT = "Requires positive attributable sales and pre-ad contribution";

/**
 * Parses a non-negative decimal string into an integer scaled by 10^decimals
 * (rupees → paise with decimals = 2, percent → basis points with decimals = 2,
 * counts with decimals = 0). Digits beyond the kept precision round half-up on
 * the decimal text, so identical input always yields the identical integer.
 * Negative, empty or malformed input is treated as 0, matching previous behaviour.
 */
function scaledInteger(raw: string | undefined, decimals: number): number {
  const text = (raw ?? "").trim().replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d*)?$/.test(text)) return 0;
  const [whole, fraction = ""] = text.split(".");
  const digits = `${fraction}${"0".repeat(decimals + 1)}`.slice(0, decimals + 1);
  const kept = decimals > 0 ? Number(digits.slice(0, decimals)) : 0;
  const roundUp = Number(digits.charAt(decimals)) >= 5 ? 1 : 0;
  const value = Number(whole) * 10 ** decimals + kept + roundUp;
  return Number.isSafeInteger(value) ? value : 0;
}

function paise(values: CalculatorValues, key: string): MoneyPaise {
  return scaledInteger(values[key], 2);
}

function bps(values: CalculatorValues, key: string): number {
  return scaledInteger(values[key], 2);
}

function count(values: CalculatorValues, key: string): number {
  return scaledInteger(values[key], 0);
}

/**
 * Renders an integer scaled by 10^scale as a fixed-point decimal string with
 * `places` decimals. Rounding is half-up on magnitude and performed on integers,
 * so display never depends on binary floating-point representation.
 */
function fixed(value: number, scale: number, places: number): string {
  const sign = value < 0 ? "-" : "";
  let magnitude = Math.abs(value);
  if (scale > places) magnitude = Math.round(magnitude / 10 ** (scale - places));
  else if (scale < places) magnitude = magnitude * 10 ** (places - scale);
  const text = String(magnitude).padStart(places + 1, "0");
  const whole = text.slice(0, text.length - places);
  const fraction = text.slice(text.length - places);
  return places > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function ratioText(ratio: number, places: number): string {
  return fixed(Math.round(ratio * 10 ** places), places, places);
}

export function calculateTool(type: CalculatorMathType, values: CalculatorValues): CalculatorMathOutput {
  if (type === "margin") {
    const sale = paise(values, "sale");
    const variableCostPaise = paise(values, "variable");
    const contribution = contributionPaise({
      settlementPaise: paise(values, "settlement"),
      productCostPaise: paise(values, "product"),
      packagingCostPaise: paise(values, "packaging"),
      variableCostPaise,
      adCostPaise: paise(values, "ads"),
    });
    const marginBps = contributionMarginBps(contribution, sale) ?? 0;
    return {
      status: "ready",
      value: fixed(contribution, 2, 2),
      secondaryValue: `${fixed(marginBps, 2, 1)}% margin`,
      formula: variableCostPaise > 0
        ? "Settlement − product cost − packaging − other variable cost − ads"
        : "Settlement − product cost − packaging − ads",
    };
  }

  if (type === "failure") {
    const orders = count(values, "orders");
    const failureRateBps = bps(values, "rate");
    const loss = failureLossPaise({ orders, failureRateBps, lossPerFailurePaise: paise(values, "loss") });
    const failedOrdersHundredths = Math.round((orders * failureRateBps) / 100);
    return {
      status: "ready",
      value: fixed(loss, 2, 2),
      secondaryValue: `${fixed(failedOrdersHundredths, 2, 0)} failed orders`,
      formula: "Shipped orders × failure rate × loss per failure",
    };
  }

  if (type === "break-even") {
    const baseCostPaise = sumPaise([
      paise(values, "product"),
      paise(values, "packaging"),
      paise(values, "variable"),
      paise(values, "ads"),
    ]);
    const expectedFailureLoss = failureLossPaise({
      orders: 1,
      failureRateBps: bps(values, "rate"),
      lossPerFailurePaise: paise(values, "loss"),
    });
    const retainedBps = bps(values, "retained");
    const price = breakEvenPricePaise({
      baseCostPerOrder: baseCostPaise,
      expectedFailureLossPerOrder: expectedFailureLoss,
      retainedRate: retainedBps > 0 ? retainedBps / BPS_SCALE : undefined,
    });
    if (price === undefined) {
      return { status: "insufficient", value: "", formula: BREAK_EVEN_FORMULA };
    }
    return {
      status: "ready",
      value: fixed(price, 2, 2),
      secondaryValue: `₹${fixed(sumPaise([baseCostPaise, expectedFailureLoss]), 2, 2)} required economics`,
      formula: BREAK_EVEN_FORMULA,
    };
  }

  if (type === "roas" || type === "acos") {
    const sales = paise(values, "sale");
    const preAd = paise(values, "preAd");
    const roas = breakEvenRoas(preAd, sales);
    const acos = maxAcosRatio(preAd, sales);
    if (roas === undefined || acos === undefined) {
      return { status: "insufficient", value: "", formula: AD_FORMULA_INSUFFICIENT };
    }
    const roasValue = ratioText(roas, 2);
    const acosPercent = ratioText(acos * 100, 1);
    return type === "roas"
      ? { status: "ready", value: roasValue, secondaryValue: `${acosPercent}% Max ACoS`, formula: "Ad sales ÷ pre-ad contribution" }
      : { status: "ready", value: acosPercent, secondaryValue: `${roasValue}x break-even ROAS`, formula: "Pre-ad contribution ÷ ad sales × 100" };
  }

  const gap = settlementGapPaise(paise(values, "expected"), paise(values, "received"));
  return {
    status: "ready",
    value: fixed(gap, 2, 2),
    secondaryValue: gap === 0 ? "Totals match" : gap > 0 ? "Received amount is lower" : "Received amount is higher",
    formula: "Expected settlement − bank credit received",
  };
}
