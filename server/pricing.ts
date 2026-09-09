import { runtimeEnv } from "./runtime";

export const DEFAULT_PRICING = {
  actionReportPaise: 4_900,
  starterMonthlyPaise: 9_900,
  proMonthlyPaise: 19_900,
};

export function getPricing() {
  const env = runtimeEnv();
  return {
    actionReportPaise: safePrice(env.PRICE_ACTION_REPORT_PAISE, DEFAULT_PRICING.actionReportPaise),
    starterMonthlyPaise: safePrice(env.PRICE_STARTER_PAISE, DEFAULT_PRICING.starterMonthlyPaise),
    proMonthlyPaise: safePrice(env.PRICE_PRO_PAISE, DEFAULT_PRICING.proMonthlyPaise),
  };
}

function safePrice(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 100 ? parsed : fallback;
}
