import type { MoneyPaise } from "./types";

const MAX_SAFE_PAISE = Number.MAX_SAFE_INTEGER;

export function assertPaise(value: number, label = "amount"): MoneyPaise {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE_PAISE) {
    throw new Error(`${label} is outside the supported monetary range.`);
  }
  return value;
}

export function parseMoneyToPaise(value: unknown): MoneyPaise | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    const scaled = value * 100;
    const rounded = Math.round(scaled);
    // Numeric and string inputs follow the same two-decimal rule. The tiny
    // epsilon only absorbs binary floating-point representation noise.
    if (Math.abs(scaled - rounded) > 1e-7) return undefined;
    return assertPaise(rounded);
  }

  const text = String(value)
    .trim()
    .replace(/[₹,$\s]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  if (!text || !/^-?\d+(\.\d{1,2})?$/.test(text)) return undefined;

  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const paise = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(paise)) return undefined;
  return assertPaise(negative ? -paise : paise);
}

export function paiseToDecimal(paise: MoneyPaise): number {
  return paise / 100;
}

export function formatInr(paise: MoneyPaise | undefined, compact = false): string {
  if (paise === undefined) return "—";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(rupees);
}

export function sumPaise(values: Array<MoneyPaise | undefined>): MoneyPaise {
  return assertPaise(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
}

export function allocatePaise(total: MoneyPaise, weights: number[]): MoneyPaise[] {
  if (!weights.length) return [];
  const safeWeights = weights.map((weight) => Math.max(0, weight));
  const denominator = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const effectiveWeights = denominator === 0 ? safeWeights.map(() => 1) : safeWeights;
  const effectiveDenominator = effectiveWeights.reduce((sum, weight) => sum + weight, 0);

  const exact = effectiveWeights.map((weight) => (total * weight) / effectiveDenominator);
  const allocations = exact.map((value) => Math.trunc(value));
  let remainder = total - allocations.reduce((sum, value) => sum + value, 0);
  const ranked = exact
    .map((value, index) => ({ index, fraction: Math.abs(value - Math.trunc(value)) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; remainder !== 0; i += 1) {
    const target = ranked[i % ranked.length].index;
    const step = remainder > 0 ? 1 : -1;
    allocations[target] += step;
    remainder -= step;
  }
  return allocations.map((value) => assertPaise(value));
}

export function neutralizeFormula(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
