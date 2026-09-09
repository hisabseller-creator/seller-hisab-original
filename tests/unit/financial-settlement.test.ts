import { describe, expect, it } from "vitest";
import { analyze } from "@/core/analyze";
import {
  mapAmazonFinancialEventGroupsV0,
  mapAmazonFinances2024,
  mapFlipkartSettlementBatch,
  mapFlipkartSettlementRows,
  mapShopifyPaymentsGraphql,
} from "@/core/connectors/financial-mappers";
import { applyOrderSettlementEvidence } from "@/core/settlements/evidence";
import { reconcileSettlementChain, type SettlementBatchEvidence } from "@/core/settlements/reconciliation";
import type { ReconciledOrder } from "@/core/types";

function order(overrides: Partial<ReconciledOrder> = {}): ReconciledOrder {
  return {
    channelId: "shopify",
    channelAccountId: "acct",
    currency: "INR",
    subOrderId: "123:line:1",
    orderId: "123",
    sku: "SKU-1",
    outcome: "pending",
    rawStatuses: ["paid / unfulfilled"],
    quantity: 1,
    salePaise: 60_000,
    settlementPaise: undefined,
    sources: [{
      fileName: "orders.csv",
      channelId: "shopify",
      channelAccountId: "acct",
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: "orders-fp",
    }],
    eventDates: ["2026-09-03T04:30:00.000Z"],
    crossPeriod: false,
    hasOrderEvidence: true,
    hasSettlementEvidence: false,
    duplicateEvents: 0,
    ...overrides,
  };
}

describe("financial settlement evidence", () => {
  it("maps paid Shopify Payments balance transactions to released order-level evidence", () => {
    const result = mapShopifyPaymentsGraphql({
      data: {
        shopifyPaymentsAccount: {
          balanceTransactions: {
            nodes: [{
              id: "gid://shopify/ShopifyPaymentsBalanceTransaction/10",
              type: "CHARGE",
              test: false,
              transactionDate: "2026-09-03T05:00:00Z",
              associatedOrder: { id: "gid://shopify/Order/123" },
              associatedPayout: { id: "gid://shopify/ShopifyPaymentsPayout/20", status: "PAID" },
              net: { amount: "900.00", currencyCode: "INR" },
            }],
          },
        },
      },
    }, { sourceFingerprint: "shopify-money", channelAccountId: "acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({
      channelId: "shopify",
      channelAccountId: "acct",
      orderId: "gid://shopify/Order/123",
      amountPaise: 90_000,
      currency: "INR",
      finality: "released",
      cashStage: "payout",
    });
  });

  it("allocates a released order-level settlement across Shopify order lines by sale share", () => {
    const evidence = mapShopifyPaymentsGraphql({
      data: {
        shopifyPaymentsAccount: {
          balanceTransactions: {
            nodes: [{
              id: "txn-1",
              type: "CHARGE",
              test: false,
              associatedOrder: { id: "gid://shopify/Order/123" },
              associatedPayout: { id: "payout-1", status: "PAID" },
              net: { amount: "900.00", currencyCode: "INR" },
            }],
          },
        },
      },
    }, { sourceFingerprint: "shopify-money", channelAccountId: "acct" }).evidence;

    const applied = applyOrderSettlementEvidence([
      order(),
      order({ subOrderId: "123:line:2", sku: "SKU-2", salePaise: 40_000 }),
    ], evidence);

    expect(applied.issues).toHaveLength(0);
    expect(applied.orders.map((item) => item.settlementPaise)).toEqual([54_000, 36_000]);
    expect(applied.orders.every((item) => item.hasSettlementEvidence)).toBe(true);
  });

  it("does not apply unpaid Shopify payout evidence as released settlement", () => {
    const evidence = mapShopifyPaymentsGraphql({
      data: {
        shopifyPaymentsAccount: {
          balanceTransactions: {
            nodes: [{
              id: "txn-2",
              associatedOrder: { id: "gid://shopify/Order/123" },
              associatedPayout: { id: "payout-2", status: "SCHEDULED" },
              net: { amount: "900.00", currencyCode: "INR" },
            }],
          },
        },
      },
    }, { sourceFingerprint: "shopify-money", channelAccountId: "acct" }).evidence;

    expect(evidence[0].finality).toBe("provisional");
    const applied = applyOrderSettlementEvidence([order()], evidence);
    expect(applied.orders[0].settlementPaise).toBeUndefined();
    expect(applied.orders[0].hasSettlementEvidence).toBe(false);
  });

  it("maps released Amazon Finances v2024-06-19 transactions by ORDER_ID", () => {
    const result = mapAmazonFinances2024({
      payload: {
        transactions: [{
          transactionId: "AF-1",
          transactionType: "Shipment",
          transactionStatus: "RELEASED",
          postedDate: "2026-09-03T05:00:00Z",
          totalAmount: { currencyAmount: "740.50", currencyCode: "INR" },
          relatedIdentifiers: [{ relatedIdentifierName: "ORDER_ID", relatedIdentifierValue: "403-123" }],
        }],
      },
    }, { sourceFingerprint: "amazon-money", channelAccountId: "amazon-acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.evidence[0]).toMatchObject({
      channelId: "amazon-in",
      orderId: "403-123",
      amountPaise: 74_050,
      finality: "released",
      cashStage: "marketplace-financial",
    });
  });

  it("keeps deferred Amazon finance transactions provisional", () => {
    const result = mapAmazonFinances2024({
      transactions: [{
        transactionId: "AF-2",
        transactionStatus: "DEFERRED",
        totalAmount: { currencyAmount: "100.00", currencyCode: "INR" },
        relatedIdentifiers: [{ relatedIdentifierName: "ORDER_ID", relatedIdentifierValue: "403-124" }],
      }],
    }, { sourceFingerprint: "amazon-money" });
    expect(result.evidence[0].finality).toBe("provisional");
  });

  it("maps Flipkart settlement only through an explicit seller-file column map", () => {
    const result = mapFlipkartSettlementRows([{
      "Order ID": "OD-1",
      "Net Settlement": "529.00",
      "Settlement Date": "2026-09-03",
      "Payment Status": "Settled",
    }], {
      orderId: "Order ID",
      settlementAmount: "Net Settlement",
      settlementDate: "Settlement Date",
      status: "Payment Status",
    }, { sourceFingerprint: "fk-settlement", channelAccountId: "fk-acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.evidence[0]).toMatchObject({
      channelId: "flipkart",
      orderId: "OD-1",
      amountPaise: 52_900,
      currency: "INR",
      finality: "released",
      cashStage: "payout",
    });
  });

  it("refuses to double-count order-level evidence when line settlement already exists", () => {
    const existing = order({ settlementPaise: 50_000, hasSettlementEvidence: true });
    const result = applyOrderSettlementEvidence([existing], [{
      id: "e-1",
      channelId: "shopify",
      channelAccountId: "acct",
      orderId: "123",
      amountPaise: 90_000,
      currency: "INR",
      finality: "released",
      cashStage: "payout",
      semantic: "test",
      source: {
        fileName: "money.json",
        channelId: "shopify",
        channelAccountId: "acct",
        sheetName: "API",
        rowNumber: 1,
        parserVersion: "test",
        sourceFingerprint: "money",
      },
    }]);

    expect(result.orders[0].settlementPaise).toBe(50_000);
    expect(result.issues[0]?.code).toBe("settlement_overlap");
  });

  it("fails closed when one order contains conflicting currencies", () => {
    const result = applyOrderSettlementEvidence([
      order({ currency: "INR" }),
      order({ subOrderId: "123:line:2", sku: "SKU-2", currency: "USD", salePaise: 40_000 }),
    ], [{
      id: "e-currency",
      channelId: "shopify",
      channelAccountId: "acct",
      orderId: "123",
      amountPaise: 90_000,
      currency: "INR",
      finality: "released",
      cashStage: "payout",
      semantic: "test",
      source: {
        fileName: "money.json",
        channelId: "shopify",
        channelAccountId: "acct",
        sheetName: "API",
        rowNumber: 1,
        parserVersion: "test",
        sourceFingerprint: "money",
      },
    }]);

    expect(result.orders.every((item) => item.settlementPaise === undefined)).toBe(true);
    expect(result.issues[0]?.code).toBe("settlement_currency_mismatch");
  });



  it("maps Shopify payout objects as authoritative payout batches", () => {
    const result = mapShopifyPaymentsGraphql({
      data: {
        shopifyPaymentsAccount: {
          balanceTransactions: { nodes: [] },
          payouts: {
            nodes: [{
              id: "gid://shopify/ShopifyPaymentsPayout/20",
              status: "PAID",
              transactionType: "DEPOSIT",
              issuedAt: "2026-09-03T06:00:00Z",
              externalTraceId: "UTR-SHOP-20",
              net: { amount: "900.00", currencyCode: "INR" },
            }],
          },
        },
      },
    }, { sourceFingerprint: "shopify-payouts", channelAccountId: "acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.batches[0]).toMatchObject({
      channelId: "shopify",
      externalBatchId: "gid://shopify/ShopifyPaymentsPayout/20",
      expectedAmountPaise: 90_000,
      currency: "INR",
      status: "paid",
      referenceKeys: ["gid://shopify/ShopifyPaymentsPayout/20", "UTR-SHOP-20"],
    });
  });

  it("links Amazon released transactions to their financial event group", () => {
    const result = mapAmazonFinances2024({
      payload: {
        transactions: [{
          transactionId: "AF-G1",
          transactionStatus: "RELEASED",
          totalAmount: { currencyAmount: "300.00", currencyCode: "INR" },
          relatedIdentifiers: [
            { relatedIdentifierName: "ORDER_ID", relatedIdentifierValue: "403-200" },
            { relatedIdentifierName: "FINANCIAL_EVENT_GROUP_ID", relatedIdentifierValue: "FEG-1" },
          ],
        }],
      },
    }, { sourceFingerprint: "amazon-money" });

    expect(result.evidence[0].batchId).toBe("FEG-1");
  });

  it("maps Amazon financial event groups as payout batches", () => {
    const result = mapAmazonFinancialEventGroupsV0({
      payload: {
        FinancialEventGroupList: [{
          FinancialEventGroupId: "FEG-1",
          OriginalTotal: { CurrencyAmount: "1000.00", CurrencyCode: "INR" },
          FundTransferDate: "2026-09-03T08:00:00Z",
          TraceId: "AMZ-UTR-1",
        }],
      },
    }, { sourceFingerprint: "amazon-groups", channelAccountId: "amazon-acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.batches[0]).toMatchObject({
      channelId: "amazon-in",
      externalBatchId: "FEG-1",
      expectedAmountPaise: 100_000,
      currency: "INR",
      status: "released",
      referenceKeys: ["FEG-1", "AMZ-UTR-1"],
    });
  });

  it("maps Flipkart payout batches only from explicit fixture fields", () => {
    const result = mapFlipkartSettlementBatch({
      batchId: "FK-PAY-1",
      amount: "529.00",
      currency: "INR",
      status: "Settled",
      settlementDate: "2026-09-03",
      expectedBankBy: "2026-09-05",
      bankReference: "FK-UTR-1",
    }, { sourceFingerprint: "fk-batch", channelAccountId: "fk-acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.batches[0]).toMatchObject({
      externalBatchId: "FK-PAY-1",
      expectedAmountPaise: 52_900,
      status: "released",
      referenceKeys: ["FK-PAY-1", "FK-UTR-1"],
    });
    expect(result.batches[0].expectedBankBy).toBe("2026-09-05T00:00:00.000Z");
  });

  function payoutBatch(overrides: Partial<SettlementBatchEvidence> = {}): SettlementBatchEvidence {
    return {
      id: "batch-1",
      channelId: "shopify",
      channelAccountId: "acct",
      externalBatchId: "PAYOUT-1",
      expectedAmountPaise: 90_000,
      currency: "INR",
      status: "paid",
      issuedAt: "2026-09-03T05:00:00Z",
      referenceKeys: ["UTR-1"],
      source: {
        fileName: "payouts.json",
        channelId: "shopify",
        channelAccountId: "acct",
        sheetName: "API",
        rowNumber: 1,
        parserVersion: "test",
        sourceFingerprint: "payouts-fp",
      },
      ...overrides,
    };
  }


  it("deduplicates identical settlement evidence IDs before order roll-up", () => {
    const evidence = {
      id: "same-evidence",
      channelId: "shopify" as const,
      channelAccountId: "acct",
      orderId: "123",
      batchId: "PAYOUT-1",
      amountPaise: 90_000,
      currency: "INR",
      finality: "released" as const,
      cashStage: "payout" as const,
      semantic: "shopify-payments:charge",
      source: {
        fileName: "money.json",
        channelId: "shopify" as const,
        channelAccountId: "acct",
        sheetName: "API",
        rowNumber: 1,
        parserVersion: "test",
        sourceFingerprint: "money",
      },
    };
    const result = applyOrderSettlementEvidence([order()], [evidence, { ...evidence }]);

    expect(result.orders[0].settlementPaise).toBe(90_000);
    expect(result.issues.some((issue) => issue.code === "duplicate_event")).toBe(true);
  });

  it("deduplicates identical payout-batch IDs before expected-bank roll-up", () => {
    const batch = payoutBatch();
    const result = reconcileSettlementChain({
      batches: [batch, { ...batch, id: "batch-copy" }],
      bankTransactions: [{
        id: "bank-1",
        amountPaise: 90_000,
        currency: "INR",
        direction: "credit",
        bookedAt: "2026-09-04T05:00:00Z",
        reference: "UTR-1",
      }],
    });

    expect(result.expectedBankPaise).toBe(90_000);
    expect(result.matchedCount).toBe(1);
    expect(result.why.join(" ")).toContain("duplicate payout-batch row");
  });

  it("fails closed when duplicate payout-batch IDs disagree on money", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch(), payoutBatch({ id: "batch-conflict", expectedAmountPaise: 95_000 })],
      bankTransactions: [],
    });

    expect(result.confidence).toBe("Incomplete");
    expect(result.incompleteCount).toBe(1);
    expect(result.expectedBankPaise).toBe(0);
    expect(result.batches[0].why.join(" ")).toContain("conflicting amount");
  });

  it("confirms payout-to-bank reconciliation on an explicit reference match", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch()],
      bankTransactions: [{
        id: "bank-1",
        amountPaise: 90_000,
        currency: "INR",
        direction: "credit",
        bookedAt: "2026-09-04T05:00:00Z",
        reference: "UTR-1",
      }],
    });

    expect(result.confidence).toBe("Confirmed");
    expect(result.matchedCount).toBe(1);
    expect(result.expectedBankPaise).toBe(90_000);
    expect(result.actualMatchedBankPaise).toBe(90_000);
    expect(result.differencePaise).toBe(0);
  });

  it("classifies short payment only when a bank row is reference-linked", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch()],
      bankTransactions: [{
        id: "bank-short",
        amountPaise: 85_000,
        currency: "INR",
        direction: "credit",
        bookedAt: "2026-09-04T05:00:00Z",
        reference: "UTR-1",
      }],
    });

    expect(result.shortCount).toBe(1);
    expect(result.batches[0].status).toBe("short");
    expect(result.batches[0].differencePaise).toBe(-5_000);
    expect(result.confidence).toBe("Incomplete");
  });

  it("uses a unique exact amount/currency/date match without inventing a reference", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch({ referenceKeys: [] })],
      bankTransactions: [{
        id: "bank-exact",
        amountPaise: 90_000,
        currency: "INR",
        direction: "credit",
        bookedAt: "2026-09-04T05:00:00Z",
      }],
    });

    expect(result.matchedCount).toBe(1);
    expect(result.confidence).toBe("Confirmed");
  });

  it("fails closed when more than one bank row fits the exact fallback rule", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch({ referenceKeys: [] })],
      bankTransactions: [
        { id: "bank-a", amountPaise: 90_000, currency: "INR", direction: "credit", bookedAt: "2026-09-04T05:00:00Z" },
        { id: "bank-b", amountPaise: 90_000, currency: "INR", direction: "credit", bookedAt: "2026-09-05T05:00:00Z" },
      ],
    });

    expect(result.ambiguousCount).toBe(1);
    expect(result.batches[0].status).toBe("ambiguous");
    expect(result.confidence).toBe("Incomplete");
  });

  it("does not call a final payout missing when bank-statement coverage is unknown", () => {
    const result = reconcileSettlementChain({ batches: [payoutBatch()], bankTransactions: [] });

    expect(result.missingCount).toBe(0);
    expect(result.incompleteCount).toBe(1);
    expect(result.batches[0].status).toBe("incomplete");
    expect(result.batches[0].why.join(" ")).toContain("will not label the payment missing");
  });

  it("detects a missing payout only when explicit bank coverage reaches the expected-bank date", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch({ expectedBankBy: "2026-09-05T00:00:00Z" })],
      bankTransactions: [],
      bankEvidenceCompleteThrough: "2026-09-06T23:59:59Z",
    });

    expect(result.missingCount).toBe(1);
    expect(result.batches[0].status).toBe("missing");
    expect(result.confidence).toBe("Incomplete");
  });

  it("excludes pending payout batches from the final expected-bank total", () => {
    const result = reconcileSettlementChain({
      batches: [payoutBatch({ status: "pending" })],
      bankTransactions: [],
    });

    expect(result.pendingCount).toBe(1);
    expect(result.expectedBankPaise).toBe(0);
    expect(result.confidence).toBe("Provisional");
  });

  it("uses explicit payout-batch amount for manual bank comparison instead of order-attributed settlement total", () => {
    const source = {
      fileName: "shopify-orders.csv",
      channelId: "shopify" as const,
      channelAccountId: "acct",
      sheetName: "CSV",
      rowNumber: 2,
      parserVersion: "test",
      sourceFingerprint: "shopify-orders",
    };
    const result = analyze({
      events: [{
        eventId: "shop-order-1",
        kind: "order",
        channelId: "shopify",
        channelAccountId: "acct",
        currency: "INR",
        subOrderId: "123:line:1",
        orderId: "123",
        sku: "SKU-1",
        rawStatus: "delivered",
        outcome: "delivered",
        quantity: 1,
        salePaise: 100_000,
        source,
      }],
      settlementEvidence: [{
        id: "shop-settlement-1",
        channelId: "shopify",
        channelAccountId: "acct",
        orderId: "123",
        batchId: "PAYOUT-1",
        amountPaise: 80_000,
        currency: "INR",
        finality: "released",
        cashStage: "payout",
        semantic: "shopify-payments:charge",
        source: { ...source, fileName: "shopify-payments.json", sourceFingerprint: "shopify-money" },
      }],
      settlementBatches: [payoutBatch({ expectedAmountPaise: 100_000 })],
      costs: [{ sku: "SKU-1", productCostPaise: 50_000 }],
      bankCreditPaise: 100_000,
    });

    expect(result.bridge.settlementPaise).toBe(80_000);
    expect(result.bankReconcilableSettlementPaise).toBe(100_000);
    expect(result.bankCreditMismatchPaise).toBe(0);
  });

  it("keeps Amazon marketplace-financial evidence out of bank payout reconciliation", () => {
    const source = {
      fileName: "amazon-orders.json",
      channelId: "amazon-in" as const,
      channelAccountId: "amazon-acct",
      sheetName: "API",
      rowNumber: 1,
      parserVersion: "test",
      sourceFingerprint: "orders-fp",
    };
    const result = analyze({
      events: [{
        eventId: "amazon-order-1",
        kind: "order",
        channelId: "amazon-in",
        channelAccountId: "amazon-acct",
        currency: "INR",
        subOrderId: "OI-A1",
        orderId: "403-123",
        sku: "AMZ-SKU-1",
        rawStatus: "delivered",
        outcome: "delivered",
        quantity: 1,
        salePaise: 100_000,
        source,
      }],
      settlementEvidence: [{
        id: "amazon-fin-1",
        channelId: "amazon-in",
        channelAccountId: "amazon-acct",
        orderId: "403-123",
        amountPaise: 80_000,
        currency: "INR",
        finality: "released",
        cashStage: "marketplace-financial",
        semantic: "amazon-finances:Shipment",
        source: { ...source, fileName: "amazon-finances.json", sourceFingerprint: "money-fp" },
      }],
      costs: [{ sku: "AMZ-SKU-1", productCostPaise: 50_000, packagingCostPaise: 5_000 }],
      bankCreditPaise: 0,
    });

    expect(result.orders[0].state).toBe("confirmed");
    expect(result.orders[0].contributionPaise).toBe(25_000);
    expect(result.bankCreditMismatchPaise).toBe(0);
  });

});
