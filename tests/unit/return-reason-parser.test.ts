import { describe, expect, it } from "vitest";
import { parseTabularSource } from "@/core/parsers/tabular";

describe("F4 return reason ingestion", () => {
  it("keeps a recognized return reason in normalized source status for root-cause analysis", () => {
    const report = parseTabularSource({
      fileName: "meesho-payments.csv",
      sheetName: "CSV",
      fingerprint: "fp-return-reason",
      rows: [
        ["Sub Order Number", "Supplier SKU", "Status", "Net Settlement Amount", "Return Reason"],
        ["SO-1", "SKU-1", "Returned", "-100", "Package damaged"],
      ],
    });

    expect(report.events).toHaveLength(1);
    expect(report.events[0]?.outcome).toBe("return");
    expect(report.events[0]?.rawStatus).toContain("reason: Package damaged");
  });
});
