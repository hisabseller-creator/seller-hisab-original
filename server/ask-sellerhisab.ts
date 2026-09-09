import type { SessionUser } from "./auth";
import { randomId, sha256 } from "./crypto";
import { getD1, runtimeEnv } from "./runtime";
import { getAdsSummary } from "./ads";
import { getInventorySummary } from "./inventory";
import { loadWorkspace } from "./workspace";
import { ensureWorkspaceAccess, requireWorkspaceCapability } from "./workspace-access";
import {
  ASK_SELLERHISAB_MIN_COHORT,
  buildBenchmarkMetric,
  classifyAskSellerHisabQuestion,
  type AskSellerHisabIntent,
  type BenchmarkMetricResult,
} from "@/core/ask-sellerhisab";
import { formatInr } from "@/core/money";

export type AskEvidenceItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  href?: string;
};

export type AskGovernedAction = {
  actionId?: string;
  label: string;
  detail: string;
  href: string;
  approvalRequired?: boolean;
  approvalStatus?: string;
};

export type AskSellerHisabAnswer = {
  intent: AskSellerHisabIntent;
  title: string;
  answer: string;
  confidenceBps: number;
  confidenceLabel: "High" | "Medium" | "Low";
  evidence: AskEvidenceItem[];
  dataGaps: string[];
  governedActions: AskGovernedAction[];
  boundary: string;
};

export type AskBenchmarkSummary = {
  contributeEnabled: boolean;
  publicationEnabled: boolean;
  canManageParticipation: boolean;
  privacyThreshold: number;
  privacyNote: string;
  metrics: BenchmarkMetricResult[];
};

export type AskSellerHisabDashboard = {
  role: string;
  evidenceDomains: number;
  openActionCount: number;
  connectedConnectorCount: number;
  benchmark: AskBenchmarkSummary;
  suggestedQuestions: string[];
};

type ConnectorRow = {
  connectorId: string;
  status: string;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

type CashEvidence = {
  bankTransactionCount: number;
  totalCreditsPaise: number;
  totalDebitsPaise: number;
  expectedPayoutPaise: number;
  cashAtRiskPaise: number;
  matchedPayoutPaise: number;
};

type ActionLike = {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  expectedImpactPaise: number | null;
  confidenceBps: number;
  approvalRequired: boolean;
  approvalStatus: string;
  evidence?: Record<string, unknown>;
};

function percent(value: number | undefined, digits = 1): string {
  return value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;
}

function ratio(value: number | undefined, digits = 2): string {
  return value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}x`;
}

function confidenceLabel(bps: number): AskSellerHisabAnswer["confidenceLabel"] {
  if (bps >= 8500) return "High";
  if (bps >= 6500) return "Medium";
  return "Low";
}

function humanizeAction(value: string): string {
  return value
    .replace(/^[^.]+\./, "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function safeReason(evidence: Record<string, unknown> | undefined): string | undefined {
  if (!evidence) return undefined;
  if (typeof evidence.reason === "string") return evidence.reason.slice(0, 240);
  if (Array.isArray(evidence.reason)) {
    const first = evidence.reason.find((item) => typeof item === "string");
    if (typeof first === "string") return first.slice(0, 240);
  }
  if (typeof evidence.why === "string") return evidence.why.slice(0, 240);
  if (Array.isArray(evidence.why)) {
    const first = evidence.why.find((item) => typeof item === "string");
    if (typeof first === "string") return first.slice(0, 240);
  }
  return undefined;
}

async function loadConnectorEvidence(tenantId: string): Promise<ConnectorRow[]> {
  const rows = await getD1().prepare(`
    SELECT connector_id AS connectorId, status, last_success_at AS lastSuccessAt,
           last_error_code AS lastErrorCode, last_error_message AS lastErrorMessage
    FROM connector_connections
    WHERE tenant_id = ?1
    ORDER BY updated_at DESC
  `).bind(tenantId).all<ConnectorRow>();
  return rows.results ?? [];
}

async function loadCashEvidence(tenantId: string): Promise<CashEvidence> {
  const [bank, payouts] = await Promise.all([
    getD1().prepare(`
      SELECT COUNT(*) AS rowCount,
             COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_paise ELSE 0 END), 0) AS credits,
             COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_paise ELSE 0 END), 0) AS debits
      FROM bank_transactions WHERE tenant_id = ?1
    `).bind(tenantId).first<{ rowCount: number; credits: number; debits: number }>(),
    getD1().prepare(`
      SELECT COALESCE(SUM(expected_paise), 0) AS expected,
             COALESCE(SUM(CASE
               WHEN status IN ('missing','ambiguous') THEN expected_paise
               WHEN status = 'short' AND difference_paise < 0 THEN -difference_paise
               ELSE 0 END), 0) AS atRisk,
             COALESCE(SUM(CASE WHEN status IN ('matched','short','excess') THEN COALESCE(actual_paise,0) ELSE 0 END), 0) AS matched
      FROM cash_matches WHERE tenant_id = ?1
    `).bind(tenantId).first<{ expected: number; atRisk: number; matched: number }>(),
  ]);
  return {
    bankTransactionCount: Number(bank?.rowCount ?? 0),
    totalCreditsPaise: Number(bank?.credits ?? 0),
    totalDebitsPaise: Number(bank?.debits ?? 0),
    expectedPayoutPaise: Number(payouts?.expected ?? 0),
    cashAtRiskPaise: Number(payouts?.atRisk ?? 0),
    matchedPayoutPaise: Number(payouts?.matched ?? 0),
  };
}

async function loadBenchmarkPreference(tenantId: string): Promise<boolean> {
  const row = await getD1().prepare("SELECT contribute_enabled AS contributeEnabled FROM benchmark_preferences WHERE tenant_id = ?1")
    .bind(tenantId).first<{ contributeEnabled: number }>();
  return row?.contributeEnabled === 1;
}

async function cohortAdsAcos(): Promise<number[]> {
  const rows = await getD1().prepare(`
    SELECT apr.tenant_id AS tenantId,
           SUM(apr.spend_paise) AS spendPaise,
           SUM(COALESCE(apr.attributed_sales_paise, 0)) AS salesPaise,
           SUM(CASE WHEN apr.attributed_sales_paise IS NULL THEN 1 ELSE 0 END) AS missingRows
    FROM ad_performance_rows apr
    JOIN benchmark_preferences bp ON bp.tenant_id = apr.tenant_id AND bp.contribute_enabled = 1
    GROUP BY apr.tenant_id
  `).all<{ tenantId: string; spendPaise: number; salesPaise: number; missingRows: number }>();
  return (rows.results ?? [])
    .filter((row) => Number(row.missingRows) === 0 && Number(row.salesPaise) > 0)
    .map((row) => Number(row.spendPaise) * 100 / Number(row.salesPaise))
    .filter(Number.isFinite);
}

async function cohortInventoryStockoutRate(): Promise<number[]> {
  const rows = await getD1().prepare(`
    WITH latest AS (
      SELECT ipr.tenant_id AS tenantId,
             ipr.available_units AS availableUnits,
             ipr.units_sold_30d AS unitsSold30d,
             ROW_NUMBER() OVER (
               PARTITION BY ipr.tenant_id, ipr.channel_id, ipr.sku, COALESCE(ipr.location, '')
               ORDER BY ipr.snapshot_date DESC, ipr.created_at DESC
             ) AS rn
      FROM inventory_position_rows ipr
      JOIN benchmark_preferences bp ON bp.tenant_id = ipr.tenant_id AND bp.contribute_enabled = 1
    )
    SELECT tenantId,
           SUM(CASE WHEN unitsSold30d IS NOT NULL THEN 1 ELSE 0 END) AS observedRows,
           SUM(CASE WHEN unitsSold30d > 0 AND availableUnits = 0 THEN 1 ELSE 0 END) AS stockoutRows
    FROM latest
    WHERE rn = 1
    GROUP BY tenantId
  `).all<{ tenantId: string; observedRows: number; stockoutRows: number }>();
  return (rows.results ?? [])
    .filter((row) => Number(row.observedRows) > 0)
    .map((row) => Number(row.stockoutRows) * 100 / Number(row.observedRows))
    .filter(Number.isFinite);
}

async function cohortCashRiskRate(): Promise<number[]> {
  const rows = await getD1().prepare(`
    SELECT cm.tenant_id AS tenantId,
           SUM(cm.expected_paise) AS expectedPaise,
           SUM(CASE
             WHEN cm.status IN ('missing','ambiguous') THEN cm.expected_paise
             WHEN cm.status = 'short' AND cm.difference_paise < 0 THEN -cm.difference_paise
             ELSE 0 END) AS atRiskPaise
    FROM cash_matches cm
    JOIN benchmark_preferences bp ON bp.tenant_id = cm.tenant_id AND bp.contribute_enabled = 1
    GROUP BY cm.tenant_id
  `).all<{ tenantId: string; expectedPaise: number; atRiskPaise: number }>();
  return (rows.results ?? [])
    .filter((row) => Number(row.expectedPaise) > 0)
    .map((row) => Number(row.atRiskPaise) * 100 / Number(row.expectedPaise))
    .filter(Number.isFinite);
}

async function buildBenchmarkSummary(input: {
  tenantId: string;
  role: string;
  ads: Awaited<ReturnType<typeof getAdsSummary>>;
  inventory: Awaited<ReturnType<typeof getInventorySummary>>;
  cash: CashEvidence;
}): Promise<AskBenchmarkSummary> {
  const publicationEnabled = runtimeEnv().BENCHMARK_PUBLICATION_ENABLED === "true";
  const [contributeEnabled, adsCohort, inventoryCohort, cashCohort] = await Promise.all([
    loadBenchmarkPreference(input.tenantId),
    publicationEnabled ? cohortAdsAcos() : Promise.resolve([]),
    publicationEnabled ? cohortInventoryStockoutRate() : Promise.resolve([]),
    publicationEnabled ? cohortCashRiskRate() : Promise.resolve([]),
  ]);
  const inventoryObserved = input.inventory.positions.filter((position) => position.unitsSold30d !== undefined).length;
  const inventoryStockoutRate = inventoryObserved > 0 ? input.inventory.stockoutCount * 100 / inventoryObserved : undefined;
  const cashRiskRate = input.cash.expectedPayoutPaise > 0 ? input.cash.cashAtRiskPaise * 100 / input.cash.expectedPayoutPaise : undefined;
  const adsAcos = input.ads.actualAcosBps === undefined ? undefined : input.ads.actualAcosBps / 100;

  return {
    contributeEnabled,
    publicationEnabled,
    canManageParticipation: input.role === "owner" || input.role === "admin",
    privacyThreshold: ASK_SELLERHISAB_MIN_COHORT,
    privacyNote: publicationEnabled
      ? `Cohort medians appear only after at least ${ASK_SELLERHISAB_MIN_COHORT} opted-in businesses have the same comparable metric. SellerHisab never exposes another seller's SKU, campaign, order, bank row or individual metric.`
      : `Cross-seller benchmark publication is currently disabled while comparable period/channel cohorts are being validated. Opt-in preference can be stored, but no cross-seller median is published.`,
    metrics: [
      buildBenchmarkMetric({ id: "ads-acos", label: "Actual ACoS", direction: "lower-is-better", unit: "percent", currentValue: adsAcos, cohortValues: adsCohort }),
      buildBenchmarkMetric({ id: "inventory-stockout-rate", label: "Stockout rate", direction: "lower-is-better", unit: "percent", currentValue: inventoryStockoutRate, cohortValues: inventoryCohort }),
      buildBenchmarkMetric({ id: "cash-at-risk-rate", label: "Payout cash-at-risk rate", direction: "lower-is-better", unit: "percent", currentValue: cashRiskRate, cohortValues: cashCohort }),
    ],
  };
}

async function loadEvidence(user: SessionUser) {
  const access = await ensureWorkspaceAccess(user);
  const [ads, inventory, workspace, connectors, cash] = await Promise.all([
    getAdsSummary(user),
    getInventorySummary(user),
    loadWorkspace(user),
    loadConnectorEvidence(access.tenantId),
    loadCashEvidence(access.tenantId),
  ]);
  const benchmark = await buildBenchmarkSummary({ tenantId: access.tenantId, role: access.role, ads, inventory, cash });
  return { access, ads, inventory, workspace, connectors, cash, benchmark };
}

function dataGaps(input: Awaited<ReturnType<typeof loadEvidence>>): string[] {
  const gaps: string[] = [];
  if (input.ads.rowCount === 0) gaps.push("No normalized ad-performance rows are saved yet.");
  else {
    if (!input.ads.salesCoverageComplete) gaps.push("Some ad spend rows are missing attributed sales, so ACoS/ROAS is incomplete.");
    if (input.ads.preAdMarginBps === undefined) gaps.push("Pre-ad contribution margin is not set, so SellerHisab will not claim profit after ads.");
  }
  if (input.inventory.rowCount === 0) gaps.push("No inventory snapshot is saved yet.");
  else if (input.inventory.missingSalesHistoryCount > 0) gaps.push(`${input.inventory.missingSalesHistoryCount} inventory position(s) are missing 30-day unit sales, so reorder velocity cannot be inferred.`);
  if (input.cash.bankTransactionCount === 0) gaps.push("No normalized bank transactions are saved for cash reconciliation.");
  if (input.connectors.length === 0) gaps.push("No official API connector is connected yet; file evidence can still be used where supported.");
  if (!input.benchmark.publicationEnabled) gaps.push("Cross-seller benchmark publication is intentionally disabled until comparable cohort definitions are validated.");
  else if (input.benchmark.metrics.every((metric) => metric.status !== "available")) gaps.push(`Cross-seller cohort benchmarks are unavailable until the ${ASK_SELLERHISAB_MIN_COHORT}-business privacy threshold is met for a metric.`);
  return gaps;
}

function governedActions(actions: ActionLike[], prefix?: string): AskGovernedAction[] {
  const filtered = prefix ? actions.filter((action) => action.actionType.startsWith(prefix)) : actions;
  return filtered.slice(0, 5).map((action) => ({
    actionId: action.id,
    label: humanizeAction(action.actionType),
    detail: safeReason(action.evidence) ?? `${action.targetType}${action.targetId ? ` • ${action.targetId}` : ""}`,
    href: "/app/workspace",
    approvalRequired: action.approvalRequired,
    approvalStatus: action.approvalStatus,
  }));
}

function answerPriority(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  const actions = input.workspace.actions as ActionLike[];
  if (!actions.length) {
    const gaps = dataGaps(input);
    return {
      intent: "priority",
      title: "No open governed action is currently recorded",
      answer: gaps.length ? "SellerHisab has no open action recommendation right now, but your evidence coverage is incomplete. Fill the highest-impact data gaps before treating this as an all-clear." : "SellerHisab has no open action recommendation right now across the currently saved tenant evidence.",
      confidenceBps: gaps.length ? 6500 : 9000,
      confidenceLabel: gaps.length ? "Medium" : "High",
      evidence: [{ id: "open-actions", label: "Open actions", value: "0", href: "/app/workspace" }],
      dataGaps: gaps,
      governedActions: [],
      boundary: "SellerHisab ranks recorded evidence; it does not execute marketplace, ad, payout or inventory changes automatically.",
    };
  }
  const top = actions.slice(0, 3);
  const first = top[0];
  const knownImpact = top.reduce((sum, action) => sum + Math.max(0, Number(action.expectedImpactPaise ?? 0)), 0);
  const averageConfidence = Math.round(top.reduce((sum, action) => sum + action.confidenceBps, 0) / top.length);
  return {
    intent: "priority",
    title: "Start with the highest-evidence open action",
    answer: `You have ${actions.length} open governed action(s). The first review should be “${humanizeAction(first.actionType)}”${first.expectedImpactPaise ? ` with ${formatInr(first.expectedImpactPaise)} recorded money impact` : ""}. SellerHisab is ranking recorded evidence, not making an autonomous business change.`,
    confidenceBps: averageConfidence,
    confidenceLabel: confidenceLabel(averageConfidence),
    evidence: [
      { id: "open-actions", label: "Open actions", value: String(actions.length), href: "/app/workspace" },
      { id: "top-impact", label: "Known impact across top 3", value: knownImpact > 0 ? formatInr(knownImpact) : "Not quantified", detail: "Only action rows with explicit expected impact are added." },
      { id: "top-confidence", label: "Top-action evidence confidence", value: percent(averageConfidence / 100, 0) },
    ],
    dataGaps: dataGaps(input).slice(0, 4),
    governedActions: governedActions(actions),
    boundary: "Approval-required actions must still go through the Professional Workspace approval flow before completion.",
  };
}

function answerAds(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  const actions = input.workspace.actions as ActionLike[];
  if (input.ads.rowCount === 0) {
    return {
      intent: "ads",
      title: "Ad economics are not available yet",
      answer: "No normalized ad-performance rows are saved. SellerHisab will not guess spend, sales, ACoS, ROAS or profit-after-ads.",
      confidenceBps: 9900,
      confidenceLabel: "High",
      evidence: [{ id: "ad-rows", label: "Saved ad rows", value: "0", href: "/app/ads" }],
      dataGaps: ["Import a supported ad report before asking for ad-efficiency decisions."],
      governedActions: [],
      boundary: "No ad account changes are executed from Ask SellerHisab.",
    };
  }
  const flagged = input.ads.campaigns.filter((campaign) => campaign.action !== "Maintain");
  const topFlagged = flagged[0];
  const confidence = input.ads.salesCoverageComplete && input.ads.preAdMarginBps !== undefined ? 9000 : 7000;
  return {
    intent: "ads",
    title: flagged.length ? `${flagged.length} campaign(s) need review` : "Saved campaigns are inside the current modeled boundary",
    answer: topFlagged
      ? `${topFlagged.campaignName} is the first campaign to review: ${topFlagged.reason}`
      : "No saved campaign is currently flagged under your explicit margin assumptions. This is not a guarantee of future profitability.",
    confidenceBps: confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidence: [
      { id: "ad-spend", label: "Observed ad spend", value: formatInr(input.ads.totalSpendPaise), href: "/app/ads" },
      { id: "ad-sales", label: "Attributed sales", value: formatInr(input.ads.totalAttributedSalesPaise) },
      { id: "acos", label: "Actual ACoS", value: input.ads.actualAcosBps === undefined ? "Incomplete" : percent(input.ads.actualAcosBps / 100) },
      { id: "roas", label: "Actual ROAS", value: ratio(input.ads.actualRoas) },
      { id: "ad-risk", label: "Spend above modeled limit", value: input.ads.preAdMarginBps === undefined ? "Margin baseline missing" : formatInr(input.ads.spendAtRiskPaise) },
    ],
    dataGaps: dataGaps(input).filter((gap) => gap.toLowerCase().includes("ad") || gap.toLowerCase().includes("margin")),
    governedActions: governedActions(actions, "ads."),
    boundary: "Profit-after-ads is modeled only when you explicitly supply the pre-ad contribution margin and return/RTO loss assumption.",
  };
}

function answerInventory(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  const actions = input.workspace.actions as ActionLike[];
  if (input.inventory.rowCount === 0) {
    return {
      intent: "inventory",
      title: "Inventory evidence is not available yet",
      answer: "No current inventory snapshot is saved, so SellerHisab cannot infer stock cover or reorder quantity.",
      confidenceBps: 9900,
      confidenceLabel: "High",
      evidence: [{ id: "inventory-rows", label: "Current positions", value: "0", href: "/app/inventory" }],
      dataGaps: ["Import an inventory snapshot. 30-day units sold unlocks velocity and reorder math."],
      governedActions: [],
      boundary: "SellerHisab never creates a purchase order or stock transfer automatically.",
    };
  }
  const urgent = input.inventory.stockoutCount + input.inventory.reorderNowCount;
  const firstUrgent = input.inventory.positions.find((position) => position.status === "Stockout" || position.status === "Reorder now");
  const confidence = input.inventory.missingSalesHistoryCount === 0 ? 9000 : 7800;
  return {
    intent: "inventory",
    title: urgent ? `${urgent} urgent inventory position(s)` : "No current stockout/reorder-now position",
    answer: firstUrgent
      ? `${firstUrgent.productName ?? firstUrgent.sku} is the first replenishment review: ${firstUrgent.reason}`
      : `No saved position is currently stocked out or inside the lead-time + safety reorder window. ${input.inventory.overstockCount} position(s) are flagged for overstock/no-sales review.`,
    confidenceBps: confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidence: [
      { id: "available-units", label: "Available units", value: String(input.inventory.totalAvailableUnits), href: "/app/inventory" },
      { id: "urgent-stock", label: "Stockout + reorder now", value: String(urgent) },
      { id: "reorder-units", label: "Suggested reorder", value: `${input.inventory.totalSuggestedReorderUnits} units` },
      { id: "inventory-value", label: "Known inventory value", value: formatInr(input.inventory.knownInventoryValuePaise) },
      { id: "missing-sales", label: "Missing 30-day sales history", value: String(input.inventory.missingSalesHistoryCount) },
    ],
    dataGaps: dataGaps(input).filter((gap) => gap.toLowerCase().includes("inventory") || gap.toLowerCase().includes("reorder")),
    governedActions: governedActions(actions, "inventory."),
    boundary: "Reorder quantities are deterministic planning outputs from reported velocity and explicit lead-time/safety assumptions, not demand forecasts.",
  };
}

function answerCash(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  const actions = input.workspace.actions as ActionLike[];
  const hasPayoutEvidence = input.cash.expectedPayoutPaise > 0;
  if (input.cash.bankTransactionCount === 0 && !hasPayoutEvidence) {
    return {
      intent: "cash",
      title: "Cash evidence is not available yet",
      answer: "No normalized bank transactions or payout-to-bank matches are saved, so SellerHisab cannot make a cash-risk claim.",
      confidenceBps: 9900,
      confidenceLabel: "High",
      evidence: [{ id: "bank-rows", label: "Saved bank transactions", value: "0", href: "/app/cash" }],
      dataGaps: ["Import a bank statement and add settlement/payout evidence where available."],
      governedActions: [],
      boundary: "SellerHisab does not connect to your bank credentials or initiate bank transfers.",
    };
  }
  const riskRate = input.cash.expectedPayoutPaise > 0 ? input.cash.cashAtRiskPaise * 100 / input.cash.expectedPayoutPaise : undefined;
  const confidence = hasPayoutEvidence ? 9000 : 7200;
  return {
    intent: "cash",
    title: input.cash.cashAtRiskPaise > 0 ? `${formatInr(input.cash.cashAtRiskPaise)} payout cash is at risk` : "No payout cash-at-risk is currently recorded",
    answer: hasPayoutEvidence
      ? `SellerHisab has ${formatInr(input.cash.expectedPayoutPaise)} of expected payout evidence and ${formatInr(input.cash.cashAtRiskPaise)} currently classified as missing, short or ambiguous.`
      : "Bank movement is saved, but no expected marketplace payout observations are available. SellerHisab therefore will not call unmatched credits a settlement success or failure.",
    confidenceBps: confidence,
    confidenceLabel: confidenceLabel(confidence),
    evidence: [
      { id: "bank-rows", label: "Saved bank transactions", value: String(input.cash.bankTransactionCount), href: "/app/cash" },
      { id: "credits", label: "Observed bank credits", value: formatInr(input.cash.totalCreditsPaise) },
      { id: "debits", label: "Observed bank debits", value: formatInr(input.cash.totalDebitsPaise) },
      { id: "expected-payout", label: "Expected payout evidence", value: formatInr(input.cash.expectedPayoutPaise) },
      { id: "cash-risk-rate", label: "Payout cash-at-risk rate", value: riskRate === undefined ? "No payout denominator" : percent(riskRate) },
    ],
    dataGaps: dataGaps(input).filter((gap) => gap.toLowerCase().includes("bank") || gap.toLowerCase().includes("cash")),
    governedActions: governedActions(actions, "cash."),
    boundary: "Cash reconciliation is evidence matching, not bank-balance verification or a payment instruction.",
  };
}

function answerConnections(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  const active = input.connectors.filter((item) => item.status === "connected" || item.status === "healthy" || item.status === "degraded");
  const degraded = active.filter((item) => item.status === "degraded" || Boolean(item.lastErrorCode));
  return {
    intent: "connections",
    title: degraded.length ? `${degraded.length} connector(s) need attention` : `${active.length} active connector(s) with no stored error`,
    answer: active.length === 0
      ? "No official API connector is currently connected. This does not block supported file-first workflows."
      : degraded.length
        ? `Review ${degraded.map((item) => item.connectorId).join(", ")}. SellerHisab is reporting stored connector health; it will not invent sync success.`
        : "The currently connected API connectors have no stored error state. Check the Connections page for latest sync coverage before assuming data is current.",
    confidenceBps: 9000,
    confidenceLabel: "High",
    evidence: [
      { id: "active-connectors", label: "Active connectors", value: String(active.length), href: "/app/connections" },
      { id: "degraded-connectors", label: "Need attention", value: String(degraded.length) },
      { id: "last-success", label: "Most recent recorded success", value: active.map((item) => item.lastSuccessAt).filter(Boolean).sort().at(-1) ? new Date(active.map((item) => item.lastSuccessAt).filter((value): value is string => Boolean(value)).sort().at(-1)!).toLocaleString("en-IN") : "No success timestamp" },
    ],
    dataGaps: active.length ? [] : ["Connect an approved official API or use supported file imports."],
    governedActions: [],
    boundary: "Connection health is based on SellerHisab's stored sync state, not a promise that the marketplace API itself is currently available.",
  };
}

function answerBenchmark(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  if (!input.benchmark.publicationEnabled) {
    return {
      intent: "benchmark",
      title: "Cross-seller benchmarks are intentionally not published yet",
      answer: "SellerHisab is keeping cross-seller benchmark output off until metric periods, channel scope and freshness are comparable. It will not substitute mixed-lifetime data for a credible industry benchmark.",
      confidenceBps: 9900,
      confidenceLabel: "High",
      evidence: input.benchmark.metrics.map((metric) => ({ id: metric.id, label: metric.label, value: metric.currentValue === undefined ? "Your data missing" : `${metric.currentValue.toFixed(1)}%`, detail: "Cross-seller median publication disabled." })),
      dataGaps: ["Comparable cohort period/channel/freshness rules are still being validated."],
      governedActions: [],
      boundary: input.benchmark.privacyNote,
    };
  }
  const available = input.benchmark.metrics.filter((metric) => metric.status === "available");
  const missing = input.benchmark.metrics.filter((metric) => metric.status !== "available");
  const evidence: AskEvidenceItem[] = input.benchmark.metrics.map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: metric.currentValue === undefined ? "Your metric unavailable" : percent(metric.currentValue),
    detail: metric.status === "available"
      ? `Cohort median ${percent(metric.cohortMedian)} • ${metric.comparison ?? "near"} • ${metric.cohortSizeBand ?? "privacy-qualified cohort"}`
      : metric.status === "insufficient-cohort"
        ? `Cohort hidden until ${input.benchmark.privacyThreshold}+ opted-in businesses have this metric.`
        : "Your current tenant does not have enough evidence for this metric.",
    href: "/app/ask",
  }));
  return {
    intent: "benchmark",
    title: available.length ? `${available.length} privacy-qualified benchmark metric(s) available` : "Cross-seller benchmark is not available yet",
    answer: available.length
      ? `SellerHisab compares only aggregate cohort medians. ${available.map((metric) => `${metric.label}: you are ${metric.comparison ?? "near"} the cohort median`).join("; ")}.`
      : `SellerHisab will not fabricate an industry average. A cohort median stays hidden until at least ${input.benchmark.privacyThreshold} opted-in businesses have the same normalized metric.`,
    confidenceBps: 9800,
    confidenceLabel: "High",
    evidence,
    dataGaps: missing.map((metric) => metric.status === "insufficient-cohort" ? `${metric.label}: privacy threshold not met.` : `${metric.label}: current tenant metric unavailable.`),
    governedActions: [],
    boundary: input.benchmark.privacyNote,
  };
}

function answerDataGaps(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  const gaps = dataGaps(input);
  return {
    intent: "data-gaps",
    title: gaps.length ? `${gaps.length} evidence gap(s) found` : "No major evidence gap detected in the governed domains",
    answer: gaps.length ? "Fill these gaps before relying on a broader business conclusion. SellerHisab keeps missing values explicit instead of silently replacing them with zero or estimates." : "Ads, inventory, cash and connection evidence are currently present at the governed-domain level. Individual rows can still require review.",
    confidenceBps: 9500,
    confidenceLabel: "High",
    evidence: [
      { id: "ad-rows", label: "Ad rows", value: String(input.ads.rowCount), href: "/app/ads" },
      { id: "inventory-positions", label: "Inventory positions", value: String(input.inventory.rowCount), href: "/app/inventory" },
      { id: "bank-rows", label: "Bank transactions", value: String(input.cash.bankTransactionCount), href: "/app/cash" },
      { id: "connectors", label: "Stored connectors", value: String(input.connectors.length), href: "/app/connections" },
    ],
    dataGaps: gaps,
    governedActions: [],
    boundary: "This check covers SellerHisab's currently governed evidence domains; it is not an audit opinion or tax/accounting certification.",
  };
}

function unsupportedAnswer(input: Awaited<ReturnType<typeof loadEvidence>>): AskSellerHisabAnswer {
  return {
    intent: "unsupported",
    title: "I need a SellerHisab evidence question",
    answer: "Ask about today's priorities, ads, inventory/reorder, cash/payout risk, connector health, missing data or privacy-qualified benchmarks. F12 does not use a free-form model to guess facts outside your saved SellerHisab evidence.",
    confidenceBps: 9900,
    confidenceLabel: "High",
    evidence: [{ id: "domains", label: "Evidence domains available", value: String(evidenceDomainCount(input)) }],
    dataGaps: [],
    governedActions: [],
    boundary: "Unsupported questions are not answered with invented business facts.",
  };
}

function evidenceDomainCount(input: Awaited<ReturnType<typeof loadEvidence>>): number {
  return [input.ads.rowCount > 0, input.inventory.rowCount > 0, input.cash.bankTransactionCount > 0 || input.cash.expectedPayoutPaise > 0, input.connectors.length > 0].filter(Boolean).length;
}

export async function getAskSellerHisabDashboard(user: SessionUser): Promise<AskSellerHisabDashboard> {
  const evidence = await loadEvidence(user);
  return {
    role: evidence.access.role,
    evidenceDomains: evidenceDomainCount(evidence),
    openActionCount: evidence.workspace.actions.length,
    connectedConnectorCount: evidence.connectors.filter((item) => item.status === "connected" || item.status === "healthy" || item.status === "degraded").length,
    benchmark: evidence.benchmark,
    suggestedQuestions: [
      "What should I do today?",
      "Which ads need attention?",
      "What stock should I reorder?",
      "How much payout cash is at risk?",
      "What data is missing?",
      "How do I compare with the benchmark?",
    ],
  };
}

export async function askSellerHisab(input: { user: SessionUser; question: string }): Promise<AskSellerHisabAnswer> {
  const question = input.question.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  if (question.length < 3) throw new Error("Ask a business question using at least 3 characters.");
  const evidence = await loadEvidence(input.user);
  const intent = classifyAskSellerHisabQuestion(question);
  let answer: AskSellerHisabAnswer;
  if (intent === "priority") answer = answerPriority(evidence);
  else if (intent === "ads") answer = answerAds(evidence);
  else if (intent === "inventory") answer = answerInventory(evidence);
  else if (intent === "cash") answer = answerCash(evidence);
  else if (intent === "connections") answer = answerConnections(evidence);
  else if (intent === "benchmark") answer = answerBenchmark(evidence);
  else if (intent === "data-gaps") answer = answerDataGaps(evidence);
  else answer = unsupportedAnswer(evidence);

  const questionHash = await sha256(question.toLowerCase());
  await getD1().prepare(`
    INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?1, ?2, ?3, 'ask.query', 'ask', NULL, ?4, ?5)
  `).bind(randomId("aud"), evidence.access.tenantId, input.user.id, JSON.stringify({ intent: answer.intent, questionHash, evidenceCount: answer.evidence.length, confidenceBps: answer.confidenceBps }), new Date().toISOString()).run();
  return answer;
}

export async function setBenchmarkParticipation(input: { user: SessionUser; contributeEnabled: boolean }): Promise<AskBenchmarkSummary> {
  const access = await requireWorkspaceCapability(input.user, "workspace_manage");
  const now = new Date().toISOString();
  await getD1().batch([
    getD1().prepare(`
      INSERT INTO benchmark_preferences (tenant_id, contribute_enabled, updated_by_user_id, updated_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(tenant_id) DO UPDATE SET
        contribute_enabled = excluded.contribute_enabled,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at
    `).bind(access.tenantId, input.contributeEnabled ? 1 : 0, input.user.id, now),
    getD1().prepare(`
      INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
      VALUES (?1, ?2, ?3, 'benchmark.participation.updated', 'benchmark', ?2, ?4, ?5)
    `).bind(randomId("aud"), access.tenantId, input.user.id, JSON.stringify({ contributeEnabled: input.contributeEnabled }), now),
  ]);
  const [ads, inventory, cash] = await Promise.all([getAdsSummary(input.user), getInventorySummary(input.user), loadCashEvidence(access.tenantId)]);
  return buildBenchmarkSummary({ tenantId: access.tenantId, role: access.role, ads, inventory, cash });
}
