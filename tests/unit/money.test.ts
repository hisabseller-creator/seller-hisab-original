import { describe, expect, it } from "vitest";
import { allocatePaise, neutralizeFormula, parseMoneyToPaise, sumPaise } from "@/core/money";

describe("money arithmetic", () => {
  it("parses rupees into integer paise without floating point drift", () => {
    expect(parseMoneyToPaise("₹1,234.56")).toBe(123_456);
    expect(parseMoneyToPaise("(20.10)")).toBe(-2_010);
    expect(parseMoneyToPaise("12.3456")).toBeUndefined();
    expect(parseMoneyToPaise(12.3456)).toBeUndefined();
    expect(parseMoneyToPaise(1234.56)).toBe(123_456);
    expect(parseMoneyToPaise("not money")).toBeUndefined();
  });

  it("allocates every paise and preserves the exact total", () => {
    const allocation = allocatePaise(101, [1, 1, 1]);
    expect(allocation).toEqual([34, 34, 33]);
    expect(sumPaise(allocation)).toBe(101);
  });

  it("neutralizes spreadsheet formula injection", () => {
    expect(neutralizeFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(neutralizeFormula("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(neutralizeFormula("safe-sku")).toBe("safe-sku");
  });
});
