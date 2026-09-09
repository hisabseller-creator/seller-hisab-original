import { channelLabel } from "../channels/catalog";
import type { AnalysisResult } from "../types";
import { formatInr, neutralizeFormula, paiseToDecimal } from "../money";
import { buildReturnRecoverySummary } from "../returns-intelligence";

export async function exportExcel(result: AnalysisResult): Promise<void> {
  const returnRecovery = result.returnRecovery ?? buildReturnRecoverySummary(result.orders, result.skus, result.settlementReconciliation);
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const addSheet = (name: string, rows: Record<string, unknown>[]) => {
    const safeRows = rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeFormula(value)])),
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(safeRows), name);
  };

  addSheet("Executive Summary", [
    {
      Metric: "Confirmed Contribution",
      "Amount (INR)": paiseToDecimal(result.confirmedContributionPaise),
      Status: result.qualityStatus,
    },
    { Metric: "Provisional Contribution", "Amount (INR)": paiseToDecimal(result.provisionalContributionPaise) },
    { Metric: "Still at Risk", "Amount (INR)": paiseToDecimal(result.stillAtRiskPaise) },
    { Metric: "Loss-making SKUs", Value: result.lossMakingSkus },
    { Metric: "Data quality score", Value: result.qualityScore },
    { Metric: "Observed Return/RTO Loss", "Amount (INR)": paiseToDecimal(returnRecovery.observedReturnRtoLossPaise) },
    { Metric: "Open Return Exposure", "Amount (INR)": paiseToDecimal(returnRecovery.openReturnExposurePaise) },
    { Metric: "Potential Recovery", "Amount (INR)": paiseToDecimal(returnRecovery.potentialRecoveryPaise) },
    { Metric: "Analysis scope", Value: result.analysisScope },
    { Metric: "Channels detected", Value: result.channels.map((channel) => channelLabel(channel.channelId)).join(", ") || "Unscoped" },
    ...(result.bankCreditPaise === undefined ? [] : [{ Metric: "Bank credit entered", "Amount (INR)": paiseToDecimal(result.bankCreditPaise) }, { Metric: "Bank credit mismatch", "Amount (INR)": paiseToDecimal(result.bankCreditMismatchPaise ?? 0) }]),
  ]);
  addSheet("SKU Action Board", result.skus.map((sku) => ({
    Channel: channelLabel(sku.channelId),
    SKU: sku.sku,
    Orders: sku.orders,
    "Confirmed Contribution (INR)": paiseToDecimal(sku.confirmedContributionPaise),
    "Provisional Contribution (INR)": paiseToDecimal(sku.provisionalContributionPaise),
    "Contribution / Delivered (INR)": sku.contributionPerDeliveredPaise === undefined ? "" : paiseToDecimal(sku.contributionPerDeliveredPaise),
    "Return/RTO Rate": sku.returnRtoRate === undefined ? "" : sku.returnRtoRate,
    "Break-even Price (INR)": sku.breakEvenPricePaise === undefined ? "" : paiseToDecimal(sku.breakEvenPricePaise),
    Action: sku.action,
    Confidence: sku.confidence,
    Reason: sku.reason,
  })));
  addSheet("SKU Economics", result.skus.map((sku) => ({
    Channel: channelLabel(sku.channelId),
    SKU: sku.sku,
    "Contribution Margin %": sku.contributionMarginPct ?? "",
    "Max Safe Failure Rate": sku.maxSafeFailureRate ?? "",
    "Break-even ROAS": sku.breakEvenRoas ?? "",
    "Max ACoS": sku.maxAcos ?? "",
  })));
  addSheet("Order Review", result.orders.map((order) => ({
    Channel: channelLabel(order.channelId),
    "Sub-Order": order.subOrderId,
    SKU: order.sku,
    Status: order.outcome,
    State: order.state,
    "Settlement (INR)": order.settlementPaise === undefined ? "" : paiseToDecimal(order.settlementPaise),
    "Contribution (INR)": order.contributionPaise === undefined ? "" : paiseToDecimal(order.contributionPaise),
    Source: order.sources.map((source) => `${source.fileName}:${source.sheetName}:${source.rowNumber}`).join("; "),
  })));
  addSheet("Settlement Review", result.orders.filter((order) => !order.hasOrderEvidence || !order.hasSettlementEvidence).map((order) => ({
    Channel: channelLabel(order.channelId),
    "Sub-Order": order.subOrderId,
    SKU: order.sku,
    "Order Evidence": order.hasOrderEvidence ? "Yes" : "No",
    "Settlement Evidence": order.hasSettlementEvidence ? "Yes" : "No",
  })));
  addSheet("Returns Recovery", returnRecovery.skuRisks.map((sku) => ({
    Channel: channelLabel(sku.channelId),
    SKU: sku.sku,
    Returns: sku.returns,
    RTO: sku.rto,
    "Open Returns": sku.openReturns,
    "Return/RTO Rate": sku.returnRtoRate ?? "",
    "Safe Failure Rate": sku.safeFailureRate ?? "",
    "Top Cause": sku.topCauseLabel,
    "Observed Loss (INR)": paiseToDecimal(sku.observedLossPaise),
    "Open Exposure (INR)": paiseToDecimal(sku.openExposurePaise),
    "Avoidable Loss (INR)": paiseToDecimal(sku.avoidableLossPaise),
    Confidence: sku.confidence,
  })));
  addSheet("Recovery Actions", returnRecovery.actions.map((action) => ({
    Urgency: action.urgency,
    Action: action.kind,
    Channel: action.channelId ? channelLabel(action.channelId) : "",
    SKU: action.sku ?? "",
    Title: action.title,
    Detail: action.detail,
    "Money Impact (INR)": paiseToDecimal(action.moneyImpactPaise),
    Confidence: action.confidence,
  })));
  addSheet("Channel Summary", result.channels.map((channel) => ({
    Channel: channelLabel(channel.channelId),
    "Channel Account": channel.channelAccountId ?? "",
    Orders: channel.orders,
    SKUs: channel.skus,
    "Confirmed Contribution (INR)": paiseToDecimal(channel.confirmedContributionPaise),
    "Provisional Contribution (INR)": paiseToDecimal(channel.provisionalContributionPaise),
    "Still at Risk (INR)": paiseToDecimal(channel.stillAtRiskPaise),
    "Settlement (INR)": paiseToDecimal(channel.settlementPaise),
  })));
  addSheet("Missing Data", result.findings.map((finding) => ({
    Severity: finding.severity,
    Issue: finding.title,
    Count: finding.count,
    Explanation: finding.message,
  })));
  addSheet("Methodology", result.assumptions.map((assumption, index) => ({ Number: index + 1, Assumption: assumption })));
  XLSX.writeFile(workbook, `seller-margin-action-report-${result.id}.xlsx`, { compression: true });
}

export async function exportPdf(result: AnalysisResult): Promise<void> {
  const returnRecovery = result.returnRecovery ?? buildReturnRecoverySummary(result.orders, result.skus, result.settlementReconciliation);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 52;
  const write = (text: string, size = 10, color: [number, number, number] = [17, 24, 39]) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, pageWidth - 88);
    if (y + lines.length * (size + 4) > 790) {
      pdf.addPage();
      y = 48;
    }
    pdf.text(lines, 44, y);
    y += lines.length * (size + 4) + 6;
  };
  write("SellerHisab Action Report", 20);
  write(`Analysis ${result.id} • ${new Date(result.createdAt).toLocaleDateString("en-IN")}`, 9, [102, 112, 133]);
  y += 8;
  write(`Confirmed contribution: ${formatInr(result.confirmedContributionPaise)}`, 15, [5, 150, 105]);
  write(`Provisional contribution: ${formatInr(result.provisionalContributionPaise)}  |  Still at risk: ${formatInr(result.stillAtRiskPaise)}`, 10, [180, 83, 9]);
  write(`Loss-making SKUs: ${result.lossMakingSkus}  |  Data quality: ${result.qualityStatus} (${result.qualityScore}/100)`, 10);
  write(`Return/RTO loss: ${formatInr(returnRecovery.observedReturnRtoLossPaise)}  |  Open return exposure: ${formatInr(returnRecovery.openReturnExposurePaise)}  |  Potential recovery: ${formatInr(returnRecovery.potentialRecoveryPaise)}`, 10);
  y += 12;
  write("Top actions", 14);
  result.topActions.forEach((sku, index) => {
    write(`${index + 1}. ${channelLabel(sku.channelId)} • ${sku.sku} — ${sku.action} — ${sku.primaryProblem}. ${sku.reason}`, 10);
  });
  y += 10;
  write("Loss-making SKUs", 14);
  result.skus
    .filter((sku) => sku.confirmedContributionPaise + sku.provisionalContributionPaise < 0)
    .forEach((sku) => write(`${channelLabel(sku.channelId)} • ${sku.sku}: ${formatInr(sku.confirmedContributionPaise + sku.provisionalContributionPaise)} • ${sku.action} • ${sku.confidence} confidence`, 10));
  y += 10;
  write("Scale candidates", 14);
  const scale = result.skus.filter((sku) => sku.action === "Scale");
  if (scale.length) scale.forEach((sku) => write(`${channelLabel(sku.channelId)} • ${sku.sku}: ${formatInr(sku.confirmedContributionPaise + sku.provisionalContributionPaise)} • ${sku.sampleSize} order sample • ${sku.confidence} confidence`, 10));
  else write("No SKU met the configured scale rule with sufficient complete evidence.", 10, [102, 112, 133]);
  y += 10;
  write("Returns / RTO / recovery", 14);
  if (returnRecovery.actions.length) returnRecovery.actions.slice(0, 6).forEach((action, index) => write(`${index + 1}. ${action.kind}: ${action.title} • ${formatInr(action.moneyImpactPaise)} • ${action.confidence} confidence`, 10));
  else write("No supportable return/RTO or payout recovery action was found in the supplied evidence.", 10, [102, 112, 133]);
  y += 10;
  write("Profit Bridge", 14);
  write(`Settlement ${formatInr(result.bridge.settlementPaise)} − product cost ${formatInr(result.bridge.productCostPaise)} − packaging ${formatInr(result.bridge.packagingPaise)} − variable costs ${formatInr(result.bridge.variableCostPaise)} − ads ${formatInr(result.bridge.adsPaise)} = contribution ${formatInr(result.bridge.contributionPaise)}`, 10);
  y += 10;
  write("Missing data / review", 14);
  result.findings.forEach((finding) => write(`${finding.title}: ${finding.message}`, 10));
  y += 10;
  write("Methodology and assumptions", 14);
  result.assumptions.forEach((assumption, index) => write(`${index + 1}. ${assumption}`, 9, [71, 84, 103]));
  write("Independent seller analytics utility. Not affiliated with or endorsed by any marketplace or commerce platform. Results are analytical estimates, not tax, legal or accounting advice.", 8, [102, 112, 133]);
  pdf.save(`sellerhisab-action-report-${result.id}.pdf`);
}
