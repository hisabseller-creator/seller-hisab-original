import type { AnalysisChannelId, SalesChannelId } from "./channels/catalog";

export const PARSER_VERSION = "connector-runtime-v1.4.1";
export const ENGINE_VERSION = "finance-v1.2.0";
export const CANONICAL_ANALYSIS_VERSION = "multi-market-foundation-v1.0.0";

export type MoneyPaise = number;

export type OrderOutcome =
  | "delivered"
  | "return"
  | "rto"
  | "cancelled"
  | "exchange"
  | "pending"
  | "unknown";

export type ProfitState = "confirmed" | "provisional" | "incomplete";

export type SourceReference = {
  fileName: string;
  channelId?: SalesChannelId;
  channelAccountId?: string;
  sheetName: string;
  rowNumber: number;
  parserVersion: string;
  sourceFingerprint: string;
};

export type NormalizedEvent = {
  eventId: string;
  kind: "payment" | "order" | "adjustment";
  channelId?: SalesChannelId;
  channelAccountId?: string;
  currency?: string;
  subOrderId: string;
  orderId?: string;
  sku: string;
  rawStatus: string;
  outcome: OrderOutcome;
  quantity: number;
  salePaise?: MoneyPaise;
  settlementPaise?: MoneyPaise;
  deductionPaise?: MoneyPaise;
  eventDate?: string;
  source: SourceReference;
};

export type CostRecord = {
  sku: string;
  productCostPaise?: MoneyPaise;
  packagingCostPaise?: MoneyPaise;
  variableCostPaise?: MoneyPaise;
};

export type AdCostRecord = {
  sku?: string;
  spendPaise: MoneyPaise;
  attributableSalesPaise?: MoneyPaise;
  allocation: "sku" | "sales-share" | "manual";
  source?: SourceReference;
};

export type ParserIssue = {
  code:
    | "unknown_format"
    | "missing_identifier"
    | "missing_monetary_column"
    | "invalid_value"
    | "invalid_date"
    | "unrecognized_status"
    | "duplicate_event"
    | "duplicate_file"
    | "unsupported_file"
    | "unsafe_archive"
    | "ad_allocation_estimated"
    | "connector_not_ready"
    | "settlement_unmatched"
    | "settlement_overlap"
    | "settlement_currency_mismatch"
    | "settlement_allocation_estimated";
  severity: "warning" | "critical";
  message: string;
  source?: Partial<SourceReference>;
};

export type ParsedReport = {
  reportType: "payments" | "orders" | "ads" | "diagnostic";
  supportState?: "supported" | "recognized-not-live" | "unrecognized";
  schemaFingerprint?: string;
  detectionConfidenceBps?: number;
  detectionReasons?: string[];
  channelId?: SalesChannelId;
  channelAccountId?: string;
  connectorId?: string;
  adapterId: string;
  parserVersion: string;
  sourceFingerprint: string;
  events: NormalizedEvent[];
  settlementEvidence?: import("./settlements/evidence").SettlementEvidence[];
  settlementBatches?: import("./settlements/reconciliation").SettlementBatchEvidence[];
  adCosts: AdCostRecord[];
  issues: ParserIssue[];
  ignoredColumns: string[];
};

export type AuditLine = {
  key:
    | "settlement"
    | "product_cost"
    | "packaging"
    | "variable_cost"
    | "ads"
    | "return_rto_loss"
    | "adjustments"
    | "contribution";
  label: string;
  amountPaise: MoneyPaise;
  known?: boolean;
  operation: "add" | "subtract" | "equals";
  sources: SourceReference[];
};

export type ReconciledOrder = {
  channelId?: SalesChannelId;
  channelAccountId?: string;
  currency?: string;
  subOrderId: string;
  orderId?: string;
  sku: string;
  skuAmbiguous?: boolean;
  outcome: OrderOutcome;
  rawStatuses: string[];
  quantity: number;
  salePaise?: MoneyPaise;
  settlementPaise?: MoneyPaise;
  sources: SourceReference[];
  eventDates: string[];
  crossPeriod: boolean;
  hasOrderEvidence: boolean;
  hasSettlementEvidence: boolean;
  settlementCashStage?: import("./settlements/evidence").SettlementCashStage;
  settlementFinality?: import("./settlements/evidence").SettlementEvidenceFinality;
  settlementEvidenceIds?: string[];
  settlementBatchIds?: string[];
  settlementWhy?: string[];
  duplicateEvents: number;
};

export type OrderEconomics = ReconciledOrder & {
  state: ProfitState;
  contributionPaise?: MoneyPaise;
  productCostPaise?: MoneyPaise;
  packagingCostPaise?: MoneyPaise;
  variableCostPaise?: MoneyPaise;
  adCostPaise?: MoneyPaise;
  attributableAdSalesPaise?: MoneyPaise;
  returnRtoLossPaise?: MoneyPaise;
  reasons: string[];
  audit: AuditLine[];
};

export type ActionType =
  | "Scale"
  | "Maintain"
  | "Reprice"
  | "Reduce Ads"
  | "Pause"
  | "Add Cost"
  | "Review Settlement"
  | "Review Return/RTO"
  | "Insufficient Data";

export type SkuEconomics = {
  channelId?: SalesChannelId;
  channelAccountId?: string;
  sku: string;
  orders: number;
  delivered: number;
  failures: number;
  sampleSize: number;
  confirmedContributionPaise: MoneyPaise;
  provisionalContributionPaise: MoneyPaise;
  incompleteOrders: number;
  contributionPerDeliveredPaise?: MoneyPaise;
  contributionMarginPct?: number;
  returnRtoRate?: number;
  breakEvenPricePaise?: MoneyPaise;
  maxSafeFailureRate?: number;
  breakEvenRoas?: number;
  maxAcos?: number;
  moneyImpactPaise: MoneyPaise;
  action: ActionType;
  primaryProblem: string;
  reason: string;
  confidence: "High" | "Medium" | "Low";
};


export type ReturnCauseCategory =
  | "size_fit"
  | "quality_damage"
  | "wrong_item"
  | "not_as_described"
  | "packaging"
  | "delivery_issue"
  | "buyer_refusal"
  | "rto"
  | "other"
  | "unknown";

export type ReturnSkuRisk = {
  channelId?: SalesChannelId;
  channelAccountId?: string;
  sku: string;
  delivered: number;
  returns: number;
  rto: number;
  openReturns: number;
  returnRtoRate?: number;
  safeFailureRate?: number;
  observedLossPaise: MoneyPaise;
  openExposurePaise: MoneyPaise;
  avoidableLossPaise: MoneyPaise;
  topCause: ReturnCauseCategory;
  topCauseLabel: string;
  severity: "Critical" | "High" | "Normal";
  confidence: "High" | "Medium" | "Low";
};

export type ReturnRecoveryAction = {
  id: string;
  kind:
    | "Recover Settlement"
    | "Review Open Returns"
    | "Fix Packaging"
    | "QC / Supplier"
    | "Fix Listing"
    | "Reduce RTO"
    | "Review Return/RTO"
    | "Add Return Data";
  title: string;
  detail: string;
  channelId?: SalesChannelId;
  sku?: string;
  moneyImpactPaise: MoneyPaise;
  confidence: "High" | "Medium" | "Low";
  urgency: "Critical" | "High" | "Normal";
};

export type ReturnRecoverySummary = {
  returnCount: number;
  rtoCount: number;
  openReturnCount: number;
  returnRtoRate?: number;
  observedReturnRtoLossPaise: MoneyPaise;
  openReturnExposurePaise: MoneyPaise;
  avoidableReturnRtoLossPaise: MoneyPaise;
  settlementRecoverablePaise: MoneyPaise;
  settlementReviewExposurePaise: MoneyPaise;
  potentialRecoveryPaise: MoneyPaise;
  topCauses: Array<{
    cause: ReturnCauseCategory;
    label: string;
    count: number;
    lossPaise: MoneyPaise;
    openExposurePaise: MoneyPaise;
  }>;
  channels: Array<{
    channelId: AnalysisChannelId;
    channelAccountId?: string;
    delivered: number;
    returns: number;
    rto: number;
    openReturns: number;
    returnRtoRate?: number;
    observedLossPaise: MoneyPaise;
    openExposurePaise: MoneyPaise;
  }>;
  skuRisks: ReturnSkuRisk[];
  actions: ReturnRecoveryAction[];
};

export type QualityFinding = {
  code: string;
  severity: "info" | "warning" | "critical";
  count: number;
  title: string;
  message: string;
};

export type ChannelAnalysisSummary = {
  channelId: AnalysisChannelId;
  channelAccountId?: string;
  orders: number;
  skus: number;
  confirmedContributionPaise: MoneyPaise;
  provisionalContributionPaise: MoneyPaise;
  stillAtRiskPaise: MoneyPaise;
  settlementPaise: MoneyPaise;
};

export type AnalysisResult = {
  canonicalAnalysisVersion: string;
  analysisScope: "unscoped" | "single-channel" | "multi-channel";
  channels: ChannelAnalysisSummary[];

  id: string;
  createdAt: string;
  parserVersion: string;
  engineVersion: string;
  sourceFingerprints: string[];
  confirmedContributionPaise: MoneyPaise;
  provisionalContributionPaise: MoneyPaise;
  stillAtRiskPaise: MoneyPaise;
  estimatedNetProfitPaise?: MoneyPaise;
  bankCreditPaise?: MoneyPaise;
  bankCreditMismatchPaise?: MoneyPaise;
  bankReconcilableSettlementPaise?: MoneyPaise;
  settlementReconciliation?: import("./settlements/reconciliation").SettlementReconciliationSummary;
  returnRecovery?: ReturnRecoverySummary;
  lossMakingSkus: number;
  needsReviewCount: number;
  qualityScore: number;
  qualityStatus: "Reliable" | "Mostly Reliable" | "Needs Attention" | "Incomplete";
  findings: QualityFinding[];
  orders: OrderEconomics[];
  skus: SkuEconomics[];
  topActions: SkuEconomics[];
  periods: Array<{
    period: string;
    orders: number;
    confirmedContributionPaise: MoneyPaise;
    provisionalContributionPaise: MoneyPaise;
  }>;
  bridge: {
    settlementPaise: MoneyPaise;
    productCostPaise: MoneyPaise;
    packagingPaise: MoneyPaise;
    variableCostPaise: MoneyPaise;
    adsPaise: MoneyPaise;
    contributionPaise: MoneyPaise;
  };
  assumptions: string[];
};

export type AnalysisInput = {
  events: NormalizedEvent[];
  settlementEvidence?: import("./settlements/evidence").SettlementEvidence[];
  settlementBatches?: import("./settlements/reconciliation").SettlementBatchEvidence[];
  bankTransactions?: import("./settlements/reconciliation").BankTransactionEvidence[];
  bankEvidenceCompleteThrough?: string;
  parserIssues?: ParserIssue[];
  sourceFingerprints?: string[];
  costs: CostRecord[];
  adCosts?: AdCostRecord[];
  defaultPackagingPaise?: MoneyPaise;
  manualAdSpendPaise?: MoneyPaise;
  adAllocation?: "sales-share" | "manual";
  monthlyFixedOverheadPaise?: MoneyPaise;
  bankCreditPaise?: MoneyPaise;
  minimumSampleSize?: number;
};
