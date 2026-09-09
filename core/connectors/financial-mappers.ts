import { parseFinancialDate } from "../dates";
import { parseMoneyToPaise } from "../money";
import { PARSER_VERSION, type ParserIssue, type SourceReference } from "../types";
import type { SettlementEvidence } from "../settlements/evidence";
import type { SettlementBatchEvidence, SettlementBatchStatus } from "../settlements/reconciliation";

export type FinancialMapperResult = {
  evidence: SettlementEvidence[];
  batches: SettlementBatchEvidence[];
  issues: ParserIssue[];
};

type FinancialMapperContext = {
  sourceFingerprint: string;
  channelAccountId?: string;
};

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function iso(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function money(value: unknown): { amountPaise?: number; currency?: string } {
  const obj = object(value);
  if (!obj) return { amountPaise: parseMoneyToPaise(value) };
  const amount = obj.amount ?? obj.value ?? obj.currencyAmount ?? obj.Amount ?? obj.Value ?? obj.CurrencyAmount;
  const currency = text(obj.currencyCode ?? obj.currency ?? obj.CurrencyCode ?? obj.Currency) || undefined;
  return { amountPaise: parseMoneyToPaise(amount), currency };
}

function source(
  fileName: string,
  channelId: "shopify" | "amazon-in" | "flipkart",
  sheetName: string,
  rowNumber: number,
  context: FinancialMapperContext,
): SourceReference {
  return {
    fileName,
    channelId,
    channelAccountId: context.channelAccountId,
    sheetName,
    rowNumber,
    parserVersion: PARSER_VERSION,
    sourceFingerprint: context.sourceFingerprint,
  };
}

function nodes(value: unknown): unknown[] {
  const obj = object(value);
  return array(obj?.nodes ?? value);
}

function shopifyPayoutStatus(value: unknown): SettlementBatchStatus {
  const status = text(value).toUpperCase();
  if (status === "PAID") return "paid";
  if (status === "FAILED") return "failed";
  if (status === "CANCELED" || status === "CANCELLED") return "cancelled";
  if (status === "SCHEDULED" || status === "IN_TRANSIT" || status === "PENDING") return "pending";
  return "unknown";
}

/**
 * Maps source-backed Shopify Payments money data.
 *
 * - Order-linked balance transactions become settlement lines.
 * - Explicit payout objects become settlement batches with authoritative payout net amount.
 * - A PAID payout is still not a bank statement row; bank confirmation belongs to the
 *   settlement-chain reconciler when bank transaction evidence is supplied.
 */
export function mapShopifyPaymentsGraphql(payload: unknown, context: FinancialMapperContext): FinancialMapperResult {
  const root = object(payload) ?? {};
  const data = object(root.data) ?? root;
  const account = object(data.shopifyPaymentsAccount) ?? {};
  const transactions = nodes(object(account.balanceTransactions)?.nodes ?? account.balanceTransactions);
  const payouts = nodes(object(account.payouts)?.nodes ?? account.payouts);
  const evidence: SettlementEvidence[] = [];
  const batches: SettlementBatchEvidence[] = [];
  const issues: ParserIssue[] = [];

  transactions.forEach((raw, index) => {
    const transaction = object(raw);
    if (!transaction) return;
    if (transaction.test === true) {
      issues.push({
        code: "invalid_value",
        severity: "warning",
        message: "A Shopify Payments test transaction was ignored.",
        source: source("Shopify Admin GraphQL", "shopify", "Shopify Payments balanceTransactions", index + 1, context),
      });
      return;
    }

    const associatedOrder = object(transaction.associatedOrder);
    const associatedPayout = object(transaction.associatedPayout);
    const orderId = text(associatedOrder?.name ?? associatedOrder?.id);
    const transactionId = text(transaction.id);
    const payoutId = text(associatedPayout?.id);
    const net = money(transaction.net);
    if (!transactionId || !orderId || net.amountPaise === undefined) {
      issues.push({
        code: "missing_identifier",
        severity: "warning",
        message: "A Shopify Payments balance transaction without transaction ID, associated order or net amount was not used for order settlement.",
        source: source("Shopify Admin GraphQL", "shopify", "Shopify Payments balanceTransactions", index + 1, context),
      });
      return;
    }

    const payoutStatus = text(associatedPayout?.status).toUpperCase();
    evidence.push({
      id: `${context.sourceFingerprint}:shopify-payments:${transactionId}`,
      channelId: "shopify",
      channelAccountId: context.channelAccountId,
      orderId,
      batchId: payoutId || undefined,
      amountPaise: net.amountPaise,
      currency: net.currency,
      occurredAt: iso(transaction.transactionDate ?? transaction.processedAt ?? transaction.createdAt),
      finality: payoutStatus === "PAID" ? "released" : "provisional",
      cashStage: "payout",
      semantic: `shopify-payments:${text(transaction.type) || "balance-transaction"}`,
      source: source("Shopify Admin GraphQL", "shopify", "Shopify Payments balanceTransactions", index + 1, context),
    });
  });

  payouts.forEach((raw, index) => {
    const payout = object(raw);
    if (!payout) return;
    const payoutId = text(payout.id);
    const net = money(payout.net);
    const transactionType = text(payout.transactionType).toUpperCase();
    if (!payoutId || net.amountPaise === undefined || !net.currency) {
      issues.push({
        code: "missing_identifier",
        severity: "warning",
        message: "A Shopify Payments payout without payout ID, net amount or currency was not used for payout-to-bank reconciliation.",
        source: source("Shopify Admin GraphQL", "shopify", "Shopify Payments payouts", index + 1, context),
      });
      return;
    }

    const expectedAmountPaise = transactionType === "WITHDRAWAL"
      ? -Math.abs(net.amountPaise)
      : Math.abs(net.amountPaise);
    const externalTraceId = text(payout.externalTraceId);
    batches.push({
      id: `${context.sourceFingerprint}:shopify-payout:${payoutId}`,
      channelId: "shopify",
      channelAccountId: context.channelAccountId,
      externalBatchId: payoutId,
      expectedAmountPaise,
      currency: net.currency,
      status: shopifyPayoutStatus(payout.status),
      issuedAt: iso(payout.issuedAt),
      referenceKeys: [payoutId, externalTraceId].filter(Boolean),
      source: source("Shopify Admin GraphQL", "shopify", "Shopify Payments payouts", index + 1, context),
    });
  });

  return { evidence, batches, issues };
}

function relatedIdentifier(transaction: Record<string, unknown>, wanted: string): string {
  for (const raw of array(transaction.relatedIdentifiers ?? transaction.RelatedIdentifiers)) {
    const item = object(raw);
    if (!item) continue;
    const name = text(item.relatedIdentifierName ?? item.RelatedIdentifierName ?? item.name).toUpperCase();
    if (name === wanted) return text(item.relatedIdentifierValue ?? item.RelatedIdentifierValue ?? item.value);
  }
  return "";
}

function amazonEventGroupId(transaction: Record<string, unknown>): string {
  return relatedIdentifier(transaction, "FINANCIAL_EVENT_GROUP_ID") || relatedIdentifier(transaction, "EVENT_GROUP_ID");
}

export function mapAmazonFinances2024(payload: unknown, context: FinancialMapperContext): FinancialMapperResult {
  const root = object(payload) ?? {};
  const body = object(root.payload) ?? root;
  const transactions = array(body.transactions ?? body.Transactions);
  const evidence: SettlementEvidence[] = [];
  const issues: ParserIssue[] = [];

  transactions.forEach((raw, index) => {
    const transaction = object(raw);
    if (!transaction) return;
    const transactionId = text(transaction.transactionId ?? transaction.TransactionId ?? transaction.id);
    const orderId = relatedIdentifier(transaction, "ORDER_ID") || text(transaction.orderId);
    const groupId = amazonEventGroupId(transaction);
    const total = money(transaction.totalAmount ?? transaction.TotalAmount);
    const status = text(transaction.transactionStatus ?? transaction.TransactionStatus).toUpperCase();
    if (!transactionId || !orderId || total.amountPaise === undefined) {
      issues.push({
        code: "missing_identifier",
        severity: "warning",
        message: "An Amazon Finances transaction without transaction ID, ORDER_ID or total amount was not used for order settlement.",
        source: source("Amazon SP-API", "amazon-in", "Finances API v2024-06-19", index + 1, context),
      });
      return;
    }

    evidence.push({
      id: `${context.sourceFingerprint}:amazon-finance:${transactionId}`,
      channelId: "amazon-in",
      channelAccountId: context.channelAccountId,
      orderId,
      batchId: groupId || undefined,
      amountPaise: total.amountPaise,
      currency: total.currency,
      occurredAt: iso(transaction.postedDate ?? transaction.PostedDate),
      finality: status === "RELEASED" || status === "DEFERRED_RELEASED" ? "released" : "provisional",
      cashStage: "marketplace-financial",
      semantic: `amazon-finances:${text(transaction.transactionType ?? transaction.TransactionType) || "transaction"}`,
      source: source("Amazon SP-API", "amazon-in", "Finances API v2024-06-19", index + 1, context),
    });
  });

  return { evidence, batches: [], issues };
}

function amazonGroupStatus(group: Record<string, unknown>): SettlementBatchStatus {
  const transfer = text(group.FundTransferStatus ?? group.fundTransferStatus).toUpperCase();
  if (/SUCCEEDED|SUCCESSFUL|COMPLETED/.test(transfer)) return "paid";
  if (/FAILED/.test(transfer)) return "failed";
  if (/CANCELLED|CANCELED/.test(transfer)) return "cancelled";
  if (/PENDING|PROCESSING/.test(transfer)) return "pending";
  if (iso(group.FundTransferDate ?? group.fundTransferDate)) return "released";
  return "pending";
}

/**
 * Amazon documents the payment composition bridge as:
 * Finances v0 listFinancialEventGroups -> FinancialEventGroupId -> released v2024 transactions.
 * This mapper therefore treats the financial event group as a payout batch, not as an order row.
 */
export function mapAmazonFinancialEventGroupsV0(payload: unknown, context: FinancialMapperContext): FinancialMapperResult {
  const root = object(payload) ?? {};
  const body = object(root.payload) ?? root;
  const groups = array(body.FinancialEventGroupList ?? body.financialEventGroupList ?? body.financialEventGroups);
  const batches: SettlementBatchEvidence[] = [];
  const issues: ParserIssue[] = [];

  groups.forEach((raw, index) => {
    const group = object(raw);
    if (!group) return;
    const groupId = text(group.FinancialEventGroupId ?? group.financialEventGroupId);
    const converted = money(group.ConvertedTotal ?? group.convertedTotal);
    const original = money(group.OriginalTotal ?? group.originalTotal);
    const total = converted.amountPaise !== undefined ? converted : original;
    if (!groupId || total.amountPaise === undefined || !total.currency) {
      issues.push({
        code: "missing_identifier",
        severity: "warning",
        message: "An Amazon financial event group without group ID, payout total or currency was not used for payout-to-bank reconciliation.",
        source: source("Amazon SP-API", "amazon-in", "Finances API v0 financialEventGroups", index + 1, context),
      });
      return;
    }

    const traceId = text(group.TraceId ?? group.traceId);
    batches.push({
      id: `${context.sourceFingerprint}:amazon-event-group:${groupId}`,
      channelId: "amazon-in",
      channelAccountId: context.channelAccountId,
      externalBatchId: groupId,
      expectedAmountPaise: total.amountPaise,
      currency: total.currency,
      status: amazonGroupStatus(group),
      issuedAt: iso(group.FundTransferDate ?? group.fundTransferDate ?? group.FinancialEventGroupEnd ?? group.financialEventGroupEnd),
      referenceKeys: [groupId, traceId].filter(Boolean),
      source: source("Amazon SP-API", "amazon-in", "Finances API v0 financialEventGroups", index + 1, context),
    });
  });

  return { evidence: [], batches, issues };
}

export type FlipkartSettlementColumnMap = {
  orderId: string;
  settlementAmount: string;
  orderItemId?: string;
  sku?: string;
  settlementDate?: string;
  status?: string;
  currency?: string;
  batchId?: string;
};

export type FlipkartSettlementBatchInput = {
  batchId: string;
  amount: unknown;
  currency?: string;
  status?: string;
  settlementDate?: unknown;
  expectedBankBy?: unknown;
  bankReference?: string;
};

function rowValue(row: Record<string, unknown>, column: string | undefined): unknown {
  if (!column) return undefined;
  return row[column];
}

function flipkartBatchStatus(value: unknown): SettlementBatchStatus {
  const status = text(value).toLowerCase();
  if (/failed|rejected/.test(status)) return "failed";
  if (/cancel/.test(status)) return "cancelled";
  if (/pending|upcoming|hold|processing/.test(status)) return "pending";
  if (/paid|settled|completed|success/.test(status)) return "released";
  return "unknown";
}

/**
 * Flipkart's public Payment Management API page is still a "Coming Soon" placeholder.
 * Therefore SellerHisab does not guess a universal settlement export schema.
 * This mapper only runs after a seller/export fixture supplies an explicit column map.
 */
export function mapFlipkartSettlementRows(
  rows: Array<Record<string, unknown>>,
  columns: FlipkartSettlementColumnMap,
  context: FinancialMapperContext,
): FinancialMapperResult {
  const evidence: SettlementEvidence[] = [];
  const issues: ParserIssue[] = [];

  rows.forEach((row, index) => {
    const orderId = text(rowValue(row, columns.orderId));
    const amountPaise = parseMoneyToPaise(rowValue(row, columns.settlementAmount));
    const itemId = text(rowValue(row, columns.orderItemId));
    const batchId = text(rowValue(row, columns.batchId));
    const status = text(rowValue(row, columns.status)).toUpperCase();
    if (!orderId || amountPaise === undefined) {
      issues.push({
        code: "missing_identifier",
        severity: "warning",
        message: `Flipkart settlement row ${index + 1} is missing the explicitly mapped order ID or settlement amount.`,
        source: source("Flipkart seller export", "flipkart", "Mapped settlement file", index + 1, context),
      });
      return;
    }
    evidence.push({
      id: `${context.sourceFingerprint}:flipkart-settlement:${itemId || orderId}:${index + 1}`,
      channelId: "flipkart",
      channelAccountId: context.channelAccountId,
      orderId,
      orderItemId: itemId || undefined,
      batchId: batchId || undefined,
      amountPaise,
      currency: text(rowValue(row, columns.currency)) || "INR",
      occurredAt: iso(rowValue(row, columns.settlementDate)),
      finality: /pending|upcoming|hold|processing/.test(status.toLowerCase()) ? "provisional" : "released",
      cashStage: "payout",
      semantic: `flipkart-settlement:${status || "reported"}`,
      source: source("Flipkart seller export", "flipkart", "Mapped settlement file", index + 1, context),
    });
  });

  return { evidence, batches: [], issues };
}

/**
 * Explicit Flipkart payout-batch adapter. Call only when a validated seller export/fixture
 * exposes a batch total/reference. SellerHisab never derives a batch total by guessing that
 * a partial row selection is the complete settlement.
 */
export function mapFlipkartSettlementBatch(
  input: FlipkartSettlementBatchInput,
  context: FinancialMapperContext,
): FinancialMapperResult {
  const amountPaise = parseMoneyToPaise(input.amount);
  const batchId = input.batchId.trim();
  if (!batchId || amountPaise === undefined) {
    return {
      evidence: [],
      batches: [],
      issues: [{
        code: "missing_identifier",
        severity: "warning",
        message: "Flipkart settlement batch is missing the explicit batch ID or payout amount.",
        source: source("Flipkart seller export", "flipkart", "Mapped settlement batch", 1, context),
      }],
    };
  }

  return {
    evidence: [],
    batches: [{
      id: `${context.sourceFingerprint}:flipkart-batch:${batchId}`,
      channelId: "flipkart",
      channelAccountId: context.channelAccountId,
      externalBatchId: batchId,
      expectedAmountPaise: amountPaise,
      currency: input.currency?.trim().toUpperCase() || "INR",
      status: flipkartBatchStatus(input.status),
      issuedAt: iso(input.settlementDate),
      expectedBankBy: iso(input.expectedBankBy),
      referenceKeys: [batchId, input.bankReference?.trim() || ""].filter(Boolean),
      source: source("Flipkart seller export", "flipkart", "Mapped settlement batch", 1, context),
    }],
    issues: [],
  };
}
