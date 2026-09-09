import { describe, expect, it } from "vitest";
import { calculateTool } from "@/core/calculators";

describe("seller calculators", () => {
  it("calculates contribution without floating-point display drift", () => {
    const result = calculateTool("margin", { sale: "649", settlement: "548", product: "305", packaging: "14", ads: "20" });
    expect(result.value).toBe("209.00");
    expect(result.secondaryValue).toBe("32.2% margin");
    expect(result.formula).toBe("Settlement − product cost − packaging − ads");
  });

  it("subtracts other variable cost when supplied, matching the finance engine definition of contribution", () => {
    const result = calculateTool("margin", { sale: "649", settlement: "548", product: "305", packaging: "14", variable: "10", ads: "20" });
    expect(result.value).toBe("199.00");
    expect(result.formula).toBe("Settlement − product cost − packaging − other variable cost − ads");
  });

  it("renders a loss with a leading minus and never a floating-point artefact", () => {
    const result = calculateTool("margin", { sale: "100", settlement: "10.10", product: "22.60", packaging: "0", ads: "0" });
    expect(result.value).toBe("-12.50");
    expect(result.secondaryValue).toBe("-12.5% margin");
  });

  it("converts an observed RTO rate into money loss", () => {
    const result = calculateTool("failure", { orders: "100", rate: "18", loss: "85" });
    expect(result.value).toBe("1530.00");
    expect(result.secondaryValue).toBe("18 failed orders");
  });

  it("keeps fractional failure rates deterministic in integer paise", () => {
    expect(calculateTool("failure", { orders: "100", rate: "18.5", loss: "85" }).value).toBe("1572.50");
  });

  it("calculates break-even price from retained settlement rate", () => {
    const result = calculateTool("break-even", { product: "305", packaging: "14", variable: "10", ads: "20", rate: "18", loss: "85", retained: "84" });
    expect(result.value).toBe("433.69");
    expect(result.secondaryValue).toBe("₹364.30 required economics");
  });

  it("refuses a break-even price without a positive retained rate", () => {
    expect(calculateTool("break-even", { product: "305", retained: "0" }).status).toBe("insufficient");
    expect(calculateTool("break-even", { product: "305" }).status).toBe("insufficient");
  });

  it("keeps ROAS and ACoS mathematically reciprocal", () => {
    const roas = calculateTool("roas", { sale: "48000", preAd: "12000" });
    const acos = calculateTool("acos", { sale: "48000", preAd: "12000" });
    expect(roas.value).toBe("4.00");
    expect(roas.secondaryValue).toBe("25.0% Max ACoS");
    expect(acos.value).toBe("25.0");
    expect(acos.secondaryValue).toBe("4.00x break-even ROAS");
  });

  it("marks ad calculators insufficient without positive sales and pre-ad contribution", () => {
    expect(calculateTool("roas", { sale: "0", preAd: "12000" }).status).toBe("insufficient");
    expect(calculateTool("acos", { sale: "48000", preAd: "" }).status).toBe("insufficient");
  });

  it("reports the settlement gap with its direction", () => {
    expect(calculateTool("gap", { expected: "48500", received: "46850" })).toMatchObject({ value: "1650.00", secondaryValue: "Received amount is lower" });
    expect(calculateTool("gap", { expected: "100", received: "100" }).secondaryValue).toBe("Totals match");
    expect(calculateTool("gap", { expected: "100", received: "120.25" })).toMatchObject({ value: "-20.25", secondaryValue: "Received amount is higher" });
  });

  it("treats malformed, negative or missing input as zero instead of guessing", () => {
    expect(calculateTool("margin", { settlement: "abc", product: "-5" }).value).toBe("0.00");
    expect(calculateTool("margin", { settlement: "₹1,000.005" }).value).toBe("1000.01");
  });

  it("never increases contribution when an expense is added", () => {
    const before = Number(calculateTool("margin", { settlement: "500", product: "100", packaging: "10", ads: "0" }).value);
    const after = Number(calculateTool("margin", { settlement: "500", product: "100", packaging: "10", ads: "50" }).value);
    expect(after).toBeLessThanOrEqual(before);
  });
});
