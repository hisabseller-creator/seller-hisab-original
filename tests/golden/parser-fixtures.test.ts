import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBrowserFiles } from "@/core/parsers/files";

const fixtureRoot = path.resolve("tests/fixtures");
async function fixture(name: string) {
  const bytes = await fs.readFile(path.join(fixtureRoot, name));
  return { name, buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

describe("golden parser fixtures", () => {
  it.each([
    ["payments-basic.csv", 4],
    ["payments-basic.xlsx", 4],
    ["payments-reordered.csv", 1],
    ["payments-quoted-commas.csv", 1],
    ["payments-large-10050.csv", 10_050],
  ])("normalizes %s to expected event count", async (name, count) => {
    const result = await parseBrowserFiles([await fixture(name)]);
    expect(result.reports.flatMap((report) => report.events)).toHaveLength(count);
    expect(result.issues.filter((issue) => issue.severity === "critical")).toHaveLength(0);
  }, 20_000);

  it("parses a safe ZIP containing payments and orders", async () => {
    const result = await parseBrowserFiles([await fixture("valid-reports.zip")]);
    expect(result.reports.filter((report) => report.events.length)).toHaveLength(2);
    expect(result.reports.flatMap((report) => report.events)).toHaveLength(8);
  });

  it("recognizes SKU-level Ads spend and attributable sales", async () => {
    const result = await parseBrowserFiles([await fixture("ads-basic.csv")]);
    const ads = result.reports.flatMap((report) => report.adCosts);
    expect(result.reports[0].reportType).toBe("ads");
    expect(result.reports[0].channelId).toBe("meesho");
    expect(result.reports[0].connectorId).toBe("meesho-file-v1");
    expect(ads).toHaveLength(2);
    expect(ads.reduce((sum, row) => sum + row.spendPaise, 0)).toBe(21_000);
    expect(ads.reduce((sum, row) => sum + (row.attributableSalesPaise ?? 0), 0)).toBe(119_800);
  });

  it("rejects impossible money but retains a row with a date warning", async () => {
    const result = await parseBrowserFiles([await fixture("payments-invalid-values.csv")]);
    expect(result.reports.flatMap((report) => report.events)).toHaveLength(1);
    expect(result.issues.some((issue) => issue.code === "invalid_value" && issue.severity === "critical")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "invalid_date" && issue.severity === "warning")).toBe(true);
  });

  it("rejects path traversal and compression bombs", async () => {
    const unsafe = await parseBrowserFiles([await fixture("unsafe-path.zip")]);
    expect(unsafe.issues.some((issue) => issue.code === "unsafe_archive" && issue.severity === "critical")).toBe(true);
    const bomb = await parseBrowserFiles([await fixture("compression-bomb.zip")]);
    expect(bomb.issues.some((issue) => issue.code === "unsafe_archive" && issue.severity === "critical")).toBe(true);
  });

  it("fails closed on an unknown format", async () => {
    const result = await parseBrowserFiles([await fixture("unknown-format.csv")]);
    expect(result.reports.flatMap((report) => report.events)).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "unknown_format" && issue.severity === "critical")).toBe(true);
  });

  it("detects duplicate file uploads", async () => {
    const file = await fixture("payments-basic.csv");
    const result = await parseBrowserFiles([file, { ...file, buffer: file.buffer.slice(0) }]);
    expect(result.reports.flatMap((report) => report.events)).toHaveLength(4);
    expect(result.issues.some((issue) => issue.code === "duplicate_file")).toBe(true);
  });
});
