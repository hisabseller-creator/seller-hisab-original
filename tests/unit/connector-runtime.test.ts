import { describe, expect, it } from "vitest";
import { buildSchemaFingerprint, detectTabularConnector } from "@/core/connectors/file-adapters";
import { parseTabularSource } from "@/core/parsers/tabular";

describe("P0 marketplace file connector runtime", () => {
  it("keeps Meesho file analysis live", () => {
    const source = {
      fileName: "payments.csv",
      sheetName: "CSV",
      fingerprint: "fp-meesho",
      rows: [
        ["Sub Order Number", "Supplier SKU", "Order Status", "Net Settlement Amount", "Selling Price"],
        ["SO-1", "SKU-1", "Delivered", "401.25", "499"],
      ],
    };
    const match = detectTabularConnector(source);
    expect(match).toMatchObject({ channelId: "meesho", connectorId: "meesho-file-v1", live: true });
    const report = parseTabularSource(source);
    expect(report.supportState).toBe("supported");
    expect(report.events).toHaveLength(1);
    expect(report.events[0].channelId).toBe("meesho");
    expect(report.schemaFingerprint).toMatch(/^schema_[0-9a-f]{8}_/);
  });

  it("normalizes Amazon Orders report as live order evidence", () => {
    const report = parseTabularSource({
      fileName: "amazon-orders.csv",
      sheetName: "CSV",
      fingerprint: "fp-amazon-orders",
      rows: [
        ["amazon-order-id", "purchase-date", "order-status", "sku", "quantity-purchased", "item-price", "item-promotion-discount", "currency"],
        ["403-1234567-1234567", "2026-09-01T10:00:00+05:30", "Shipped", "SKU-A", "2", "998", "50", "INR"],
      ],
    });
    expect(report).toMatchObject({
      supportState: "supported",
      channelId: "amazon-in",
      connectorId: "amazon-in-v1",
      adapterId: "amazon-orders-flat-file-v1",
      reportType: "orders",
    });
    expect(report.events[0]).toMatchObject({
      orderId: "403-1234567-1234567",
      subOrderId: "403-1234567-1234567:SKU-A",
      sku: "SKU-A",
      quantity: 2,
      salePaise: 94800,
    });
  });

  it("normalizes Amazon Settlement Flat File V2 into order settlement evidence and payout batch", () => {
    const report = parseTabularSource({
      fileName: "1234567890.txt",
      sheetName: "CSV",
      fingerprint: "fp-amazon-settlement",
      rows: [
        ["settlement-id", "settlement-start-date", "settlement-end-date", "deposit-date", "total-amount", "currency", "transaction-type", "order-id", "sku", "amount-type", "amount-description", "amount", "posted-date"],
        ["SET-1", "2026-09-01", "2026-09-07", "2026-09-09", "850", "INR", "Order", "403-1234567-1234567", "SKU-A", "ItemPrice", "Principal", "998", "2026-09-02"],
        ["SET-1", "2026-09-01", "2026-09-07", "2026-09-09", "850", "INR", "Order", "403-1234567-1234567", "SKU-A", "ItemFees", "Commission", "-148", "2026-09-02"],
      ],
    });
    expect(report).toMatchObject({ supportState: "supported", reportType: "payments", adapterId: "amazon-settlement-flat-file-v2" });
    expect(report.settlementEvidence).toHaveLength(1);
    expect(report.settlementEvidence?.[0]).toMatchObject({ orderId: "403-1234567-1234567", amountPaise: 85000, batchId: "SET-1" });
    expect(report.settlementBatches?.[0]).toMatchObject({ externalBatchId: "SET-1", expectedAmountPaise: 85000, status: "paid" });
  });

  it("normalizes Flipkart Orders report with stable Order Item ID", () => {
    const report = parseTabularSource({
      fileName: "flipkart-orders.csv",
      sheetName: "CSV",
      fingerprint: "fp-flipkart-orders",
      rows: [
        ["Order ID", "Order Item Id", "Seller SKU", "Order State", "Quantity", "Selling Price", "Order Date"],
        ["OD-1", "OI-1", "SKU-F", "Delivered", "1", "699", "2026-09-01"],
      ],
    });
    expect(report).toMatchObject({ supportState: "supported", channelId: "flipkart", adapterId: "flipkart-orders-file-v1", reportType: "orders" });
    expect(report.events[0]).toMatchObject({ subOrderId: "OI-1", orderId: "OD-1", sku: "SKU-F", salePaise: 69900, outcome: "delivered" });
  });

  it("normalizes Flipkart settlement/P&L rows as line-level settlement evidence", () => {
    const report = parseTabularSource({
      fileName: "flipkart-settlement.xlsx",
      sheetName: "Settled Transactions",
      fingerprint: "fp-flipkart-settlement",
      rows: [
        ["Order ID", "Order Item Id", "Seller SKU", "Settlement Status", "Net Settlement Amount", "Settlement Date"],
        ["OD-1", "OI-1", "SKU-F", "Settled", "560", "2026-09-07"],
      ],
    });
    expect(report).toMatchObject({ supportState: "supported", channelId: "flipkart", adapterId: "flipkart-settlement-file-v1", reportType: "payments" });
    expect(report.events[0]).toMatchObject({ subOrderId: "OI-1", orderId: "OD-1", sku: "SKU-F", settlementPaise: 56000, outcome: "delivered" });
  });

  it("normalizes the documented Shopify Orders CSV shape and uses order Name for payout matching", () => {
    const report = parseTabularSource({
      fileName: "orders_export.csv",
      sheetName: "CSV",
      fingerprint: "fp-shopify",
      rows: [
        ["Name", "Id", "Financial Status", "Fulfillment Status", "Currency", "Created at", "Lineitem quantity", "Lineitem price", "Lineitem SKU", "Lineitem discount"],
        ["#1001", "5001", "paid", "fulfilled", "INR", "2026-09-03T10:00:00+05:30", "2", "499", "SKU-S", "50"],
      ],
    });
    expect(report).toMatchObject({
      channelId: "shopify",
      supportState: "supported",
      reportType: "orders",
      adapterId: "shopify-orders-csv-v1",
    });
    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({
      orderId: "#1001",
      sku: "SKU-S",
      quantity: 2,
      salePaise: 94800,
      outcome: "delivered",
      settlementPaise: undefined,
    });
  });

  it("normalizes Shopify Payments balance transactions as order-level Net settlement evidence", () => {
    const report = parseTabularSource({
      fileName: "shopify-payments.csv",
      sheetName: "CSV",
      fingerprint: "fp-shopify-payments",
      rows: [
        ["Transaction Date", "Type", "Order", "Payout Status", "Payout Date", "Amount", "Fee", "Net", "Currency"],
        ["2026-09-03 10:00:00 +0530", "charge", "#1001", "paid", "2026-09-05", "998", "29", "969", "INR"],
      ],
    });
    expect(report).toMatchObject({ supportState: "supported", channelId: "shopify", adapterId: "shopify-payments-csv-v1", reportType: "payments" });
    expect(report.settlementEvidence?.[0]).toMatchObject({ orderId: "#1001", amountPaise: 96900, finality: "released" });
  });

  it("carries Shopify order identity into additional line-item rows", () => {
    const report = parseTabularSource({
      fileName: "orders_export.csv",
      sheetName: "CSV",
      fingerprint: "fp-shopify-2",
      rows: [
        ["Name", "Id", "Financial Status", "Fulfillment Status", "Currency", "Lineitem quantity", "Lineitem price", "Lineitem SKU"],
        ["#1001", "5001", "paid", "fulfilled", "INR", "1", "499", "SKU-A"],
        ["", "", "", "", "", "1", "299", "SKU-B"],
      ],
    });
    expect(report.events).toHaveLength(2);
    expect(new Set(report.events.map((event) => event.orderId))).toEqual(new Set(["#1001"]));
    expect(report.events.map((event) => event.sku)).toEqual(["SKU-A", "SKU-B"]);
  });

  it("fails closed on an unvalidated marketplace-looking schema", () => {
    const report = parseTabularSource({
      fileName: "amazon-random.csv",
      sheetName: "CSV",
      fingerprint: "fp-generic",
      rows: [
        ["amazon-order-id", "mystery money", "random"],
        ["O-1", "499", "x"],
      ],
    });
    expect(report.supportState).toBe("recognized-not-live");
    expect(report.events).toHaveLength(0);
    expect(report.issues[0].code).toBe("connector_not_ready");
  });

  it("normalizes harmless header formatting before schema fingerprinting", () => {
    expect(buildSchemaFingerprint([" Sub_Order Number ", "Supplier_SKU", "Net Settlement Amount"]))
      .toBe(buildSchemaFingerprint(["sub order number", "supplier sku", "net settlement amount"]));
  });

  it("scopes Meesho ads at the connector boundary", () => {
    const report = parseTabularSource({
      fileName: "ads.csv",
      sheetName: "CSV",
      fingerprint: "fp-ads",
      rows: [
        ["Supplier SKU", "Ad Spend", "Attributed Sales"],
        ["SKU-1", "120", "649"],
      ],
    });
    expect(report).toMatchObject({ reportType: "ads", channelId: "meesho", connectorId: "meesho-file-v1" });
    expect(report.adCosts[0].source?.channelId).toBe("meesho");
  });
});
