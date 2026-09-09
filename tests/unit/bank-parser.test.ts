import { describe, expect, it } from "vitest";
import { parseBankStatementFile } from "@/core/cash/bank-parser";

function buffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("F7 bank statement parser", () => {
  it("normalizes a standard debit/credit bank CSV without uploading raw bytes", async () => {
    const csv = [
      "Date,Narration,Reference No,Debit,Credit,Balance",
      "01/09/2026,SHOPIFY PAYOUT,PO-1001,,1250.50,101250.50",
      "02/09/2026,COURIER CHARGE,CUR-77,250.00,,101000.50",
      "03/09/2026,AMAZON SETTLEMENT,SET-9,,2000,103000.50",
    ].join("\n");
    const result = await parseBankStatementFile({ name: "bank.csv", buffer: buffer(csv) });
    expect(result.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({ direction: "credit", amountPaise: 125050, reference: "PO-1001" });
    expect(result.transactions[1]).toMatchObject({ direction: "debit", amountPaise: 25000 });
    expect(result.transactions[2]).toMatchObject({ direction: "credit", amountPaise: 200000 });
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(false);
  });

  it("fails closed when a statement has no trustworthy debit/credit structure", async () => {
    const result = await parseBankStatementFile({ name: "unknown.csv", buffer: buffer("Foo,Bar\nhello,100") });
    expect(result.transactions).toHaveLength(0);
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(true);
  });
});
