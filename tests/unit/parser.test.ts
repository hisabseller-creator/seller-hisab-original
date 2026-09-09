import { describe, expect, it } from "vitest";
import { mapHeaders, normalizeHeader } from "@/core/parsers/aliases";
import { classifyOutcome, parseTabularSource } from "@/core/parsers/tabular";

describe("header normalization and parser detection", () => {
  it("normalizes harmless punctuation and reordering", () => {
    expect(normalizeHeader("  Sub_Order Number\n")).toBe("sub order number");
    const mapped = mapHeaders(["Extra", "Net Settlement Amount", "Supplier SKU", "Sub-Order Number", "Order Status"]);
    expect(mapped.mapping).toMatchObject({ settlementAmount: 1, sku: 2, subOrderId: 3, status: 4 });
  });

  it("classifies final and provisional statuses transparently", () => {
    expect(classifyOutcome("Customer Return Delivered")).toBe("return");
    expect(classifyOutcome("RTO")).toBe("rto");
    expect(classifyOutcome("In Transit")).toBe("pending");
    expect(classifyOutcome("Brand New Status")).toBe("unknown");
  });

  it("fails closed when a required monetary mapping is unknown", () => {
    const report = parseTabularSource({ fileName: "new.csv", sheetName: "CSV", fingerprint: "abc", rows: [["Sub Order Number", "Supplier SKU", "Mystery Money"], ["SO-1", "SKU-1", "500"]] });
    expect(report.events).toHaveLength(0);
    expect(report.issues[0].severity).toBe("critical");
    expect(report.issues[0].message).toContain("cannot safely calculate profit");
  });

  it("allows column reordering and ignores irrelevant columns", () => {
    const report = parseTabularSource({ fileName: "payments.csv", sheetName: "CSV", fingerprint: "abc", rows: [["Extra", "Net Settlement Amount", "Supplier SKU", "Sub Order Number", "Order Status", "Selling Price"], ["ignore", "401.25", "SKU-1", "SO-1", "Delivered", "499"]] });
    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({ subOrderId: "SO-1", sku: "SKU-1", settlementPaise: 40_125, salePaise: 49_900 });
    expect(report.ignoredColumns).toContain("extra");
  });
});
