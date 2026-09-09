/// <reference lib="webworker" />

import { analyze } from "../analyze";
import { parseBrowserFiles, type BrowserFileInput } from "../parsers/files";
import type { AnalysisInput } from "../types";

type WorkerRequest = {
  type: "analyze";
  files: BrowserFileInput[];
  input: Omit<AnalysisInput, "events" | "parserIssues" | "sourceFingerprints">;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "analyze") return;
  try {
    const bundle = await parseBrowserFiles(event.data.files, (message, percent) => {
      self.postMessage({ type: "progress", message, percent });
    });
    const paymentReports = bundle.reports.filter(
      (report) => report.reportType === "payments" && (report.events.length > 0 || (report.settlementEvidence?.length ?? 0) > 0),
    );
    if (!paymentReports.length) {
      const connectorIssue = bundle.issues.find((issue) => issue.code === "connector_not_ready");
      self.postMessage({
        type: "error",
        message: connectorIssue?.message ?? (bundle.reports.some((report) => report.channelId === "shopify" && report.reportType === "orders" && report.events.length)
          ? "Shopify Orders CSV is ready. Also upload the Shopify Payments balance-transactions CSV so SellerHisab can use source-backed Net payouts instead of order totals."
          : bundle.reports.some((report) => report.channelId === "amazon-in" && report.reportType === "orders" && report.events.length)
            ? "Amazon Orders report is ready. Also upload Settlement Flat File V2 from Payments so SellerHisab can calculate from source-backed settlement amounts."
            : bundle.reports.some((report) => report.channelId === "flipkart" && report.reportType === "orders" && report.events.length)
              ? "Flipkart Orders report is ready. Also upload the settlement/P&L export with Order Item ID + settlement amount for financial analysis."
              : bundle.reports.some((report) => report.reportType === "orders" && report.events.length)
                ? "This looks like an Orders report. Please also add supported settlement/payment evidence for financial analysis."
                : bundle.issues.find((issue) => issue.severity === "critical")?.message ??
                  "New report format detected. We cannot safely calculate profit from this file yet."),
        issues: bundle.issues,
      });
      return;
    }
    const channelsRequiringOrders = ["amazon-in", "flipkart", "shopify"] as const;
    const missingOrderChannel = channelsRequiringOrders.find((channelId) =>
      paymentReports.some((report) => report.channelId === channelId) &&
      !bundle.reports.some((report) => report.channelId === channelId && report.reportType === "orders" && report.events.length > 0),
    );
    if (missingOrderChannel) {
      const message = missingOrderChannel === "amazon-in"
        ? "Amazon settlement evidence is ready. Also upload the matching Amazon Orders report so SellerHisab can link SKU, quantity and order outcome safely."
        : missingOrderChannel === "flipkart"
          ? "Flipkart settlement evidence is ready. Also upload the matching Flipkart Orders report so SellerHisab can verify Order Item ID, SKU, quantity and outcome."
          : "Shopify Payments evidence is ready. Also upload the matching Shopify Orders CSV so SellerHisab can allocate Net payout evidence to actual order lines safely.";
      self.postMessage({ type: "error", message, issues: bundle.issues });
      return;
    }

    const blockingCodes = new Set(["unknown_format", "missing_identifier", "missing_monetary_column", "unsafe_archive", "unsupported_file", "connector_not_ready"]);
    const blockingIssue = bundle.issues.find((issue) => blockingCodes.has(issue.code) && issue.severity === "critical");
    if (blockingIssue) {
      self.postMessage({
        type: "error",
        message: blockingIssue.code === "connector_not_ready"
          ? blockingIssue.message
          : "At least one file has an unknown, unsafe or unsupported critical format. Remove it or use a supported report before calculating.",
        issues: bundle.issues,
      });
      return;
    }
    const adCosts = bundle.reports.flatMap((report) => report.adCosts);
    const settlementEvidence = bundle.reports.flatMap((report) => report.settlementEvidence ?? []);
    const settlementBatches = bundle.reports.flatMap((report) => report.settlementBatches ?? []);
    if (adCosts.length && (event.data.input.manualAdSpendPaise ?? 0) > 0) {
      bundle.issues.push({
        code: "ad_allocation_estimated",
        severity: "warning",
        message: "An Ads report was detected, so the manual total was ignored to prevent double-counting spend.",
      });
    }
    self.postMessage({ type: "progress", message: "Matching sub-orders", percent: 58 });
    const events = bundle.reports.flatMap((report) => report.events);
    self.postMessage({ type: "progress", message: "Calculating costs", percent: 76 });
    const result = analyze({
      ...event.data.input,
      adCosts,
      manualAdSpendPaise: adCosts.length ? undefined : event.data.input.manualAdSpendPaise,
      events,
      settlementEvidence,
      settlementBatches,
      parserIssues: bundle.issues,
      sourceFingerprints: bundle.fingerprints,
    });
    self.postMessage({ type: "progress", message: "Building actions", percent: 94 });
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "The files could not be processed safely.",
    });
  }
};

export {};
