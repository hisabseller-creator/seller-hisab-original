import type { MoneyPaise } from "../types";
import type { SalesChannelId } from "../channels/catalog";

export const CANONICAL_SCHEMA_VERSION = "sellerhisab-canonical-v1.0.0";

export type CanonicalSourceKind = "file" | "api" | "webhook" | "email" | "manual";

export type CanonicalDataImport = {
  importId: string;
  tenantId: string;
  channelAccountId?: string;
  sourceKind: CanonicalSourceKind;
  connectorId: string;
  parserVersion: string;
  sourceFingerprint: string;
  schemaFingerprint?: string;
  originalFileName?: string;
  coverageStart?: string;
  coverageEnd?: string;
  createdAt: string;
};

export type CanonicalChannelAccount = {
  channelAccountId: string;
  tenantId: string;
  legalEntityId?: string;
  channelId: SalesChannelId;
  externalAccountId?: string;
  region: string;
  currency: string;
};

export type CanonicalProductIdentity = {
  masterProductId: string;
  variantId: string;
  tenantId: string;
  sellerSku?: string;
  gtin?: string;
  title?: string;
  size?: string;
  color?: string;
  pack?: string;
};

export type CanonicalSkuAlias = {
  aliasId: string;
  tenantId: string;
  variantId: string;
  channelAccountId: string;
  aliasType: "seller-sku" | "asin" | "fsn" | "catalog-id" | "style-id" | "listing-id" | "gtin" | "other";
  aliasValue: string;
  confidenceBps: number;
  approvedBy?: string;
  approvedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type CommerceLedgerSemantic =
  | "sale"
  | "marketplace-fee"
  | "shipping"
  | "discount"
  | "tax"
  | "tds"
  | "tcs"
  | "refund"
  | "return-cost"
  | "rto-cost"
  | "ad-spend"
  | "settlement"
  | "bank-credit"
  | "adjustment"
  | "cogs"
  | "packaging"
  | "other";

export type CanonicalLedgerEntry = {
  ledgerEntryId: string;
  tenantId: string;
  legalEntityId?: string;
  channelAccountId?: string;
  orderLineUid?: string;
  semantic: CommerceLedgerSemantic;
  amountPaise: MoneyPaise;
  currency: string;
  occurredAt?: string;
  sourceImportId?: string;
  sourceReferenceJson?: string;
  reversalOfEntryId?: string;
  createdAt: string;
};

export type CanonicalActionRecommendation = {
  actionId: string;
  tenantId: string;
  channelAccountId?: string;
  targetType: "business" | "channel" | "master-product" | "variant" | "listing" | "order" | "settlement";
  targetId?: string;
  actionType: string;
  expectedImpactPaise?: MoneyPaise;
  confidenceBps: number;
  evidenceJson: string;
  status: "open" | "accepted" | "rejected" | "done" | "expired";
  createdAt: string;
};
