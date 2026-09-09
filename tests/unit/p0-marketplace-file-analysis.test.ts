import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { analyze } from "@/core/analyze";
import { parseBrowserFiles } from "@/core/parsers/files";
import { parseTabularSource } from "@/core/parsers/tabular";

function mergeReports(reports: ReturnType<typeof parseTabularSource>[]) {
  return {
    events: reports.flatMap((report) => report.events),
    settlementEvidence: reports.flatMap((report) => report.settlementEvidence ?? []),
    settlementBatches: reports.flatMap((report) => report.settlementBatches ?? []),
    parserIssues: reports.flatMap((report) => report.issues),
    sourceFingerprints: reports.map((report) => report.sourceFingerprint),
  };
}

describe("P0 marketplace file analysis", () => {
  it("calculates Amazon contribution from Orders + Settlement Flat File V2 without treating order revenue as payout", () => {
    const order = parseTabularSource({
      fileName: "amazon-orders.csv",
      sheetName: "CSV",
      fingerprint: "a-orders",
      rows: [
        ["amazon-order-id", "purchase-date", "order-status", "sku", "quantity-purchased", "item-price", "currency"],
        ["403-1", "2026-09-01", "Shipped", "SKU-A", "1", "499", "INR"],
      ],
    });
    const settlement = parseTabularSource({
      fileName: "amazon-settlement.txt",
      sheetName: "CSV",
      fingerprint: "a-settle",
      rows: [
        ["settlement-id", "settlement-end-date", "deposit-date", "total-amount", "currency", "transaction-type", "order-id", "sku", "amount-type", "amount-description", "amount", "posted-date"],
        ["SET-1", "2026-09-07", "2026-09-09", "401", "INR", "Order", "403-1", "SKU-A", "ItemPrice", "Principal", "499", "2026-09-02"],
        ["SET-1", "2026-09-07", "2026-09-09", "401", "INR", "Order", "403-1", "SKU-A", "ItemFees", "Commission", "-98", "2026-09-02"],
      ],
    });
    const merged = mergeReports([order, settlement]);
    const result = analyze({
      ...merged,
      costs: [{ sku: "SKU-A", productCostPaise: 25000, packagingCostPaise: 1000 }],
    });
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({ settlementPaise: 40100, state: "provisional", contributionPaise: 14100 });
    expect(result.bridge.settlementPaise).toBe(40100);
  });

  it("allocates released Shopify Payments Net across Shopify order lines by observed line sales", () => {
    const orders = parseTabularSource({
      fileName: "orders_export.csv",
      sheetName: "CSV",
      fingerprint: "s-orders",
      rows: [
        ["Name", "Id", "Financial Status", "Fulfillment Status", "Currency", "Created at", "Lineitem quantity", "Lineitem price", "Lineitem SKU"],
        ["#1001", "5001", "paid", "fulfilled", "INR", "2026-09-03", "1", "600", "SKU-A"],
        ["", "", "", "", "", "", "1", "400", "SKU-B"],
      ],
    });
    const payments = parseTabularSource({
      fileName: "shopify-payments.csv",
      sheetName: "CSV",
      fingerprint: "s-payments",
      rows: [
        ["Transaction Date", "Type", "Order", "Payout Status", "Payout Date", "Amount", "Fee", "Net", "Currency"],
        ["2026-09-03", "charge", "#1001", "paid", "2026-09-05", "1000", "30", "970", "INR"],
      ],
    });
    const merged = mergeReports([orders, payments]);
    const result = analyze({
      ...merged,
      costs: [
        { sku: "SKU-A", productCostPaise: 20000, packagingCostPaise: 1000 },
        { sku: "SKU-B", productCostPaise: 10000, packagingCostPaise: 1000 },
      ],
    });
    expect(result.orders).toHaveLength(2);
    expect(result.orders.map((order) => order.settlementPaise)).toEqual([58200, 38800]);
    expect(result.orders.every((order) => order.state === "confirmed")).toBe(true);
    expect(result.bridge.settlementPaise).toBe(97000);
  });

  it("confirms Flipkart delivered order contribution from Orders + settlement export", () => {
    const orders = parseTabularSource({
      fileName: "flipkart-orders.csv",
      sheetName: "CSV",
      fingerprint: "f-orders",
      rows: [
        ["Order ID", "Order Item Id", "Seller SKU", "Order State", "Quantity", "Selling Price", "Order Date"],
        ["OD-1", "OI-1", "SKU-F", "Delivered", "1", "699", "2026-09-01"],
      ],
    });
    const settlement = parseTabularSource({
      fileName: "flipkart-settlement.csv",
      sheetName: "CSV",
      fingerprint: "f-settle",
      rows: [
        ["Order ID", "Order Item Id", "Seller SKU", "Settlement Status", "Net Settlement Amount", "Settlement Date"],
        ["OD-1", "OI-1", "SKU-F", "Settled", "560", "2026-09-07"],
      ],
    });
    const merged = mergeReports([orders, settlement]);
    const result = analyze({
      ...merged,
      costs: [{ sku: "SKU-F", productCostPaise: 30000, packagingCostPaise: 1000 }],
    });
    expect(result.orders[0]).toMatchObject({ state: "confirmed", settlementPaise: 56000, contributionPaise: 25000 });
    expect(result.confirmedContributionPaise).toBe(25000);
  });

  it("treats Flipkart Selling Price as per-item when quantity is greater than one", () => {
    const orders = parseTabularSource({
      fileName: "flipkart-orders.csv",
      sheetName: "CSV",
      fingerprint: "f-orders-qty",
      rows: [
        ["Order ID", "Order Item Id", "Seller SKU", "Order State", "Quantity", "Selling Price", "Order Date"],
        ["OD-2", "OI-2", "SKU-Q", "Delivered", "2", "350", "2026-09-01"],
      ],
    });
    expect(orders.events[0]?.salePaise).toBe(70000);
  });

  it("retains evidence-only Flipkart XLSX settlement sheets", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Order ID", "Net Settlement Amount", "Settlement Status", "Settlement Date"],
      ["OD-XLSX-1", "420", "Settled", "2026-09-07"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Settlement");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const bundle = await parseBrowserFiles([{ name: "flipkart-settlement.xlsx", buffer: bytes }]);
    expect(bundle.reports).toHaveLength(1);
    expect(bundle.reports[0]?.settlementEvidence).toHaveLength(1);
    expect(bundle.reports[0]?.settlementEvidence?.[0]?.amountPaise).toBe(42000);
  });

});
