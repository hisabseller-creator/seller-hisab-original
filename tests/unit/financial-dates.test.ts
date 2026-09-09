import { describe, expect, it } from "vitest";
import { parseFinancialDate, parseFinancialTimestamp } from "@/core/dates";

describe("financial date parsing", () => {
  it("treats slash dates as Indian DD/MM and never host-locale MM/DD", () => {
    expect(parseFinancialDate("04/09/2026")).toBe("2026-09-04T00:00:00.000Z");
    expect(parseFinancialDate("13/02/2026")).toBe("2026-02-13T00:00:00.000Z");
    expect(parseFinancialDate("04/09/2026", { numericDateOrder: "mdy" })).toBe("2026-04-09T00:00:00.000Z");
  });

  it("validates leap dates and rejects impossible dates", () => {
    expect(parseFinancialDate("29/02/2024")).toBe("2024-02-29T00:00:00.000Z");
    expect(parseFinancialDate("29/02/2025")).toBeUndefined();
    expect(parseFinancialDate("31/04/2026")).toBeUndefined();
  });

  it("supports Excel serials intentionally", () => {
    expect(parseFinancialDate(25569)).toBe("1970-01-01T00:00:00.000Z");
    expect(parseFinancialDate(45292)).toBe("2024-01-01T00:00:00.000Z");
  });

  it("accepts explicit ISO offsets and requires opt-in for timezone-less timestamps", () => {
    expect(parseFinancialDate("2026-09-04T00:30:00+05:30")).toBe("2026-09-03T19:00:00.000Z");
    expect(parseFinancialDate("2026-09-04T00:30:00")).toBeUndefined();
    expect(parseFinancialDate("2026-09-04T00:30:00", { assumeUtcForTimezoneLessIso: true })).toBe("2026-09-04T00:30:00.000Z");
  });

  it("keeps cross-month boundaries deterministic", () => {
    const left = parseFinancialTimestamp("31/08/2026 23:59:59");
    const right = parseFinancialTimestamp("01/09/2026 00:00:01");
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect((right ?? 0) - (left ?? 0)).toBe(2000);
  });

  it("fails closed for free-form host-locale strings", () => {
    expect(parseFinancialDate("09.04.2026")).toBeUndefined();
    expect(parseFinancialDate("next Friday")).toBeUndefined();
  });
});
