export type AskSellerHisabIntent = "priority" | "ads" | "inventory" | "cash" | "connections" | "benchmark" | "data-gaps" | "unsupported";

export const ASK_SELLERHISAB_MIN_COHORT = 20;

export type BenchmarkMetricResult = {
  id: string;
  label: string;
  direction: "lower-is-better" | "higher-is-better";
  unit: "percent" | "ratio";
  currentValue?: number;
  status: "available" | "insufficient-cohort" | "missing-current-data";
  cohortMedian?: number;
  cohortSizeBand?: string;
  comparison?: "better" | "near" | "worse";
};

function normalizedQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[?!.,:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function classifyAskSellerHisabQuestion(question: string): AskSellerHisabIntent {
  const text = normalizedQuestion(question);
  if (!text) return "unsupported";

  if (hasAny(text, ["benchmark", "compare", "comparison", "industry", "cohort", "dusre seller", "other seller", "market average", "बेंचमार्क", "तुलना"])) return "benchmark";
  if (hasAny(text, ["missing data", "data missing", "data gap", "incomplete", "coverage", "kya missing", "क्या missing", "क्या कमी", "डेटा कमी", "data kya chahiye"])) return "data-gaps";
  if (hasAny(text, ["ad ", "ads", "acos", "roas", "campaign", "marketing", "spend", "विज्ञापन", "ऐड", "कैम्पेन"])) return "ads";
  if (hasAny(text, ["inventory", "stock", "reorder", "stockout", "overstock", "sku stock", "स्टॉक", "इन्वेंटरी", "रीऑर्डर"])) return "inventory";
  if (hasAny(text, ["cash", "bank", "payout", "settlement", "money at risk", "payment risk", "कैश", "बैंक", "पेआउट", "सेटलमेंट"])) return "cash";
  if (hasAny(text, ["connection", "connector", "sync", "amazon api", "flipkart api", "shopify", "woocommerce", "कनेक्शन", "सिंक"])) return "connections";
  if (hasAny(text, ["what should i do", "what to do", "priority", "priorities", "today", "next action", "next step", "kya karu", "kya karna", "क्या करूँ", "क्या करु", "आज क्या", "पहले क्या"])) return "priority";

  return "unsupported";
}

export function median(values: number[]): number | undefined {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return undefined;
  const middle = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[middle];
  return (valid[middle - 1] + valid[middle]) / 2;
}

export function cohortSizeBand(count: number): string | undefined {
  if (count < ASK_SELLERHISAB_MIN_COHORT) return undefined;
  if (count < 50) return "20–49 opted-in businesses";
  if (count < 100) return "50–99 opted-in businesses";
  if (count < 250) return "100–249 opted-in businesses";
  return "250+ opted-in businesses";
}

export function buildBenchmarkMetric(input: {
  id: string;
  label: string;
  direction: BenchmarkMetricResult["direction"];
  unit: BenchmarkMetricResult["unit"];
  currentValue?: number;
  cohortValues: number[];
  minCohort?: number;
}): BenchmarkMetricResult {
  if (input.currentValue === undefined || !Number.isFinite(input.currentValue)) {
    return { id: input.id, label: input.label, direction: input.direction, unit: input.unit, status: "missing-current-data" };
  }
  const minCohort = input.minCohort ?? ASK_SELLERHISAB_MIN_COHORT;
  const valid = input.cohortValues.filter((value) => Number.isFinite(value));
  if (valid.length < minCohort) {
    return { id: input.id, label: input.label, direction: input.direction, unit: input.unit, currentValue: input.currentValue, status: "insufficient-cohort" };
  }
  const cohortMedian = median(valid);
  if (cohortMedian === undefined) {
    return { id: input.id, label: input.label, direction: input.direction, unit: input.unit, currentValue: input.currentValue, status: "insufficient-cohort" };
  }
  const tolerance = Math.max(Math.abs(cohortMedian) * 0.05, input.unit === "percent" ? 0.5 : 0.05);
  const delta = input.currentValue - cohortMedian;
  let comparison: BenchmarkMetricResult["comparison"] = "near";
  if (Math.abs(delta) > tolerance) {
    const currentHigher = delta > 0;
    const higherIsBetter = input.direction === "higher-is-better";
    comparison = currentHigher === higherIsBetter ? "better" : "worse";
  }
  return {
    id: input.id,
    label: input.label,
    direction: input.direction,
    unit: input.unit,
    currentValue: input.currentValue,
    status: "available",
    cohortMedian,
    cohortSizeBand: cohortSizeBand(valid.length),
    comparison,
  };
}
