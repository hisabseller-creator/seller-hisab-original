import JSZip from "jszip";
import { buildClosePackSummary, type ClaimCandidate } from "../close-intelligence";
import { buildUnifiedActionInbox } from "../action-inbox";
import { channelLabel } from "../channels/catalog";
import { neutralizeFormula, paiseToDecimal } from "../money";
import type { AnalysisResult, SourceReference } from "../types";

function safeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeFormula(value)])));
}

export async function exportCaClosePack(result: AnalysisResult): Promise<void> {
  const XLSX = await import("xlsx");
  const close = buildClosePackSummary(result);
  const actions = buildUnifiedActionInbox(result);
  const workbook = XLSX.utils.book_new();
  const addSheet = (name: string, rows: Record<string, unknown>[]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(safeRows(rows)), name);
  };

  addSheet("Close Cover", [
    { Field: "Analysis ID", Value: result.id },
    { Field: "Analysis created", Value: result.createdAt },
    { Field: "Period", Value: close.closePeriodLabel },
    { Field: "Close readiness", Value: close.readiness },
    { Field: "Reason", Value: close.readinessReason },
    { Field: "Observed sales (INR)", Value: paiseToDecimal(close.observedSalesPaise) },
    { Field: "Settlement attributable (INR)", Value: paiseToDecimal(close.settlementPaise) },
    { Field: "Confirmed contribution (INR)", Value: paiseToDecimal(close.confirmedContributionPaise) },
    { Field: "Provisional contribution (INR)", Value: paiseToDecimal(close.provisionalContributionPaise) },
    { Field: "Still at risk (INR)", Value: paiseToDecimal(close.stillAtRiskPaise) },
    { Field: "Observed return/RTO loss (INR)", Value: paiseToDecimal(close.observedReturnRtoLossPaise) },
    { Field: "Open return exposure (INR)", Value: paiseToDecimal(close.openReturnExposurePaise) },
    { Field: "Deterministic payout recovery (INR)", Value: paiseToDecimal(close.deterministicRecoveryPaise) },
    { Field: "Prepared information", Value: "For reconciliation/review; not tax filing or professional advice." },
  ]);

  addSheet("Close Checklist", close.checklist.map((item) => ({
    Status: item.status.toUpperCase(),
    Check: item.label,
    Count: item.count,
    Detail: item.detail,
  })));

  addSheet("Channel Close", close.channelRows.map((row) => ({
    Channel: row.channel,
    "Channel Account": row.channelAccountId ?? "",
    Orders: row.orders,
    SKUs: row.skus,
    "Confirmed Contribution (INR)": paiseToDecimal(row.confirmedContributionPaise),
    "Provisional Contribution (INR)": paiseToDecimal(row.provisionalContributionPaise),
    "Still At Risk (INR)": paiseToDecimal(row.stillAtRiskPaise),
    "Settlement (INR)": paiseToDecimal(row.settlementPaise),
  })));

  addSheet("Order Ledger", result.orders.map((order) => ({
    Channel: channelLabel(order.channelId),
    "Channel Account": order.channelAccountId ?? "",
    "Sub Order": order.subOrderId,
    "Order ID": order.orderId ?? "",
    SKU: order.sku,
    Outcome: order.outcome,
    State: order.state,
    Quantity: order.quantity,
    "Sale (INR)": order.salePaise === undefined ? "" : paiseToDecimal(order.salePaise),
    "Settlement (INR)": order.settlementPaise === undefined ? "" : paiseToDecimal(order.settlementPaise),
    "Product Cost (INR)": order.productCostPaise === undefined ? "" : paiseToDecimal(order.productCostPaise),
    "Packaging (INR)": order.packagingCostPaise === undefined ? "" : paiseToDecimal(order.packagingCostPaise),
    "Variable Cost (INR)": order.variableCostPaise === undefined ? "" : paiseToDecimal(order.variableCostPaise),
    "Ads (INR)": order.adCostPaise === undefined ? "" : paiseToDecimal(order.adCostPaise),
    "Contribution (INR)": order.contributionPaise === undefined ? "" : paiseToDecimal(order.contributionPaise),
    "Order Evidence": order.hasOrderEvidence ? "Yes" : "No",
    "Settlement Evidence": order.hasSettlementEvidence ? "Yes" : "No",
    "Settlement Finality": order.settlementFinality ?? "",
    "Evidence IDs": (order.settlementEvidenceIds ?? []).join("; "),
    "Batch IDs": (order.settlementBatchIds ?? []).join("; "),
    "Why": order.reasons.join("; "),
  })));

  addSheet("Payout Claims", close.claimCandidates.map((claim) => ({
    Channel: channelLabel(claim.channelId),
    "Channel Account": claim.channelAccountId ?? "",
    "Payout Batch": claim.externalBatchId,
    Status: claim.status,
    "Expected Bank By": claim.expectedBankBy ?? "",
    Currency: claim.currency ?? "",
    "Expected (INR)": claim.expectedBankPaise === undefined ? "" : paiseToDecimal(claim.expectedBankPaise),
    "Actual (INR)": claim.actualBankPaise === undefined ? "" : paiseToDecimal(claim.actualBankPaise),
    "Recoverable (INR)": paiseToDecimal(claim.recoverablePaise),
    "Settlement Evidence IDs": claim.settlementEvidenceIds.join("; "),
    "Bank Transaction IDs": claim.bankTransactionIds.join("; "),
    "Source Rows": claim.sourceReferences.map(sourceLabel).join("; "),
    Why: claim.why.join(" | "),
  })));

  addSheet("Source Evidence", close.evidenceRows.map((row) => ({
    Channel: row.channel,
    "Sub Order": row.subOrderId,
    "Order ID": row.orderId ?? "",
    SKU: row.sku,
    State: row.state,
    Outcome: row.outcome,
    File: row.fileName,
    Sheet: row.sheetName,
    Row: row.rowNumber,
    Fingerprint: row.sourceFingerprint,
    Parser: row.parserVersion,
  })));

  addSheet("Action Inbox", actions.map((action) => ({
    Urgency: action.urgency,
    "Blocks Close": action.blocksClose ? "Yes" : "No",
    Category: action.category,
    Action: action.actionLabel,
    Channel: action.channelId ? channelLabel(action.channelId) : "",
    SKU: action.sku ?? "",
    Title: action.title,
    Detail: action.detail,
    "Money Impact (INR)": paiseToDecimal(action.moneyImpactPaise),
    Confidence: action.confidence,
    Effort: action.effort,
    "Priority Score": action.score,
  })));

  addSheet("Exceptions", result.findings.map((finding) => ({
    Severity: finding.severity,
    Code: finding.code,
    Count: finding.count,
    Title: finding.title,
    Message: finding.message,
  })));

  addSheet("Methodology", [
    ...result.assumptions.map((assumption, index) => ({ Number: index + 1, Note: assumption })),
    { Number: result.assumptions.length + 1, Note: "SellerHisab prepares reconciliation evidence; it does not file GST/tax returns or replace accountant review." },
    { Number: result.assumptions.length + 2, Note: "Only deterministic short, missing or failed payout evidence is labelled recoverable. Ambiguous/incomplete payouts remain review-only." },
  ]);

  XLSX.writeFile(workbook, `sellerhisab-ca-close-pack-${result.id}.xlsx`, { compression: true });
}

export async function exportClaimEvidencePack(result: AnalysisResult): Promise<void> {
  const close = buildClosePackSummary(result);
  const zip = new JSZip();
  const root = zip.folder(`sellerhisab-claim-evidence-${result.id}`)!;
  root.file("README.txt", [
    "SellerHisab payout recovery evidence pack",
    `Analysis: ${result.id}`,
    `Created: ${result.createdAt}`,
    "",
    "This pack contains normalized reconciliation facts and source references only.",
    "It does not include raw marketplace/customer files and does not constitute a tax/legal claim opinion.",
    "Only deterministic short, missing or failed payout exceptions are included as recovery candidates.",
  ].join("\n"));

  root.file("claims.csv", toCsv(close.claimCandidates.map(claimCsvRow)));
  for (const claim of close.claimCandidates) {
    const folder = root.folder(safeFolderName(`${claim.externalBatchId}-${claim.status}`))!;
    folder.file("claim-summary.txt", claimSummaryText(claim));
    folder.file("source-references.csv", toCsv(claim.sourceReferences.map((source) => ({
      file: source.fileName,
      sheet: source.sheetName,
      row: source.rowNumber,
      fingerprint: source.sourceFingerprint,
      parser: source.parserVersion,
      channel: source.channelId ?? "",
      channelAccount: source.channelAccountId ?? "",
    }))));
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, `sellerhisab-claim-evidence-${result.id}.zip`);
}

function claimCsvRow(claim: ClaimCandidate): Record<string, unknown> {
  return {
    channel: channelLabel(claim.channelId),
    channelAccount: claim.channelAccountId ?? "",
    payoutBatch: claim.externalBatchId,
    status: claim.status,
    expectedBankBy: claim.expectedBankBy ?? "",
    currency: claim.currency ?? "",
    expectedInr: claim.expectedBankPaise === undefined ? "" : paiseToDecimal(claim.expectedBankPaise),
    actualInr: claim.actualBankPaise === undefined ? "" : paiseToDecimal(claim.actualBankPaise),
    recoverableInr: paiseToDecimal(claim.recoverablePaise),
    settlementEvidenceIds: claim.settlementEvidenceIds.join("; "),
    bankTransactionIds: claim.bankTransactionIds.join("; "),
    sourceRows: claim.sourceReferences.map(sourceLabel).join("; "),
    why: claim.why.join(" | "),
  };
}

function sourceLabel(source: SourceReference): string {
  return `${source.fileName}:${source.sheetName}:${source.rowNumber}`;
}

function claimSummaryText(claim: ClaimCandidate): string {
  return [
    `Channel: ${channelLabel(claim.channelId)}`,
    `Channel account: ${claim.channelAccountId ?? "default"}`,
    `Payout batch: ${claim.externalBatchId}`,
    `Exception: ${claim.status}`,
    `Expected bank by: ${claim.expectedBankBy ?? "not supplied"}`,
    `Expected: ${claim.expectedBankPaise === undefined ? "not supplied" : paiseToDecimal(claim.expectedBankPaise)}`,
    `Actual matched: ${claim.actualBankPaise === undefined ? "not matched/supplied" : paiseToDecimal(claim.actualBankPaise)}`,
    `Deterministic recovery amount: ${paiseToDecimal(claim.recoverablePaise)}`,
    `Settlement evidence IDs: ${claim.settlementEvidenceIds.join(", ") || "none"}`,
    `Bank transaction IDs: ${claim.bankTransactionIds.join(", ") || "none"}`,
    "",
    "Why:",
    ...claim.why.map((line) => `- ${line}`),
    "",
    "Source references:",
    ...(claim.sourceReferences.length ? claim.sourceReferences.map((source) => `- ${sourceLabel(source)} • ${source.sourceFingerprint}`) : ["- No order-attributed source row was available for this batch in the normalized analysis."]),
  ].join("\n");
}

function safeFolderName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "claim";
}

function csvCell(value: unknown): string {
  const text = String(neutralizeFormula(value ?? ""));
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "status\n\"No deterministic claim candidates\"\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
