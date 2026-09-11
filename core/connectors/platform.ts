import type { SalesChannelId } from "../channels/catalog";
import type { ApiConnectorId } from "./api-runtime";

export type MarketplaceApiPlatformId = ApiConnectorId | "meesho-api-v1";
export type MarketplaceApiActivationState =
  | "runtime-available"
  | "configuration-required"
  | "partner-approval-required";
export type MarketplaceApiAuthMode = "oauth" | "merchant-api-credentials" | "partner-managed";
export type MarketplaceApiDataDomain =
  | "orders"
  | "financials"
  | "payouts"
  | "returns"
  | "inventory"
  | "listings"
  | "ads";

export type MarketplaceApiPlatformDefinition = {
  id: MarketplaceApiPlatformId;
  connectorId: ApiConnectorId | null;
  channelId: SalesChannelId;
  label: string;
  authMode: MarketplaceApiAuthMode;
  activationState: MarketplaceApiActivationState;
  dataDomains: readonly MarketplaceApiDataDomain[];
  incrementalSync: boolean;
  providerNotifications: boolean;
  pollingBackstop: boolean;
  defaultSyncIntervalMinutes: number;
  minimumSyncIntervalMinutes: number;
  maximumSyncIntervalMinutes: number;
  connectRequiresPlan: null;
  syncRequiresPlan: "pro";
  note: string;
};

/**
 * One capability manifest for every marketplace API integration.
 *
 * A provider is only connectable when connectorId is present AND its runtime
 * credentials/configuration are active. This lets future providers (Meesho)
 * be represented honestly without inventing an authorization endpoint.
 */
export const MARKETPLACE_API_PLATFORMS: Record<MarketplaceApiPlatformId, MarketplaceApiPlatformDefinition> = {
  "amazon-in-v1": {
    id: "amazon-in-v1",
    connectorId: "amazon-in-v1",
    channelId: "amazon-in",
    label: "Amazon India",
    authMode: "oauth",
    activationState: "configuration-required",
    dataDomains: ["orders", "financials", "payouts", "returns"],
    incrementalSync: true,
    providerNotifications: true,
    pollingBackstop: true,
    defaultSyncIntervalMinutes: 30,
    minimumSyncIntervalMinutes: 15,
    maximumSyncIntervalMinutes: 1440,
    connectRequiresPlan: null,
    syncRequiresPlan: "pro",
    note: "SP-API seller authorization is free; automatic sync and connected-data analysis require Pro.",
  },
  "flipkart-v1": {
    id: "flipkart-v1",
    connectorId: "flipkart-v1",
    channelId: "flipkart",
    label: "Flipkart",
    authMode: "oauth",
    activationState: "configuration-required",
    dataDomains: ["orders", "returns", "inventory", "listings"],
    incrementalSync: true,
    providerNotifications: false,
    pollingBackstop: true,
    defaultSyncIntervalMinutes: 30,
    minimumSyncIntervalMinutes: 15,
    maximumSyncIntervalMinutes: 1440,
    connectRequiresPlan: null,
    syncRequiresPlan: "pro",
    note: "Seller authorization is free; automatic API sync is activated only when SellerHisab provider credentials are configured.",
  },
  "shopify-v1": {
    id: "shopify-v1",
    connectorId: "shopify-v1",
    channelId: "shopify",
    label: "Shopify",
    authMode: "oauth",
    activationState: "configuration-required",
    dataDomains: ["orders", "financials", "payouts", "returns", "inventory", "listings"],
    incrementalSync: true,
    providerNotifications: true,
    pollingBackstop: true,
    defaultSyncIntervalMinutes: 30,
    minimumSyncIntervalMinutes: 15,
    maximumSyncIntervalMinutes: 1440,
    connectRequiresPlan: null,
    syncRequiresPlan: "pro",
    note: "Merchant authorization is free; connected-data sync and live report refresh require Pro.",
  },
  "woocommerce-v1": {
    id: "woocommerce-v1",
    connectorId: "woocommerce-v1",
    channelId: "woocommerce",
    label: "WooCommerce",
    authMode: "merchant-api-credentials",
    activationState: "runtime-available",
    dataDomains: ["orders", "returns", "inventory", "listings"],
    incrementalSync: true,
    providerNotifications: false,
    pollingBackstop: true,
    defaultSyncIntervalMinutes: 30,
    minimumSyncIntervalMinutes: 15,
    maximumSyncIntervalMinutes: 1440,
    connectRequiresPlan: null,
    syncRequiresPlan: "pro",
    note: "Read-only merchant API credentials can be connected without a paid plan; automatic sync requires Pro.",
  },
  "meesho-api-v1": {
    id: "meesho-api-v1",
    connectorId: null,
    channelId: "meesho",
    label: "Meesho",
    authMode: "partner-managed",
    activationState: "partner-approval-required",
    dataDomains: ["orders", "financials", "payouts", "returns", "inventory", "listings", "ads"],
    incrementalSync: true,
    providerNotifications: false,
    pollingBackstop: true,
    defaultSyncIntervalMinutes: 30,
    minimumSyncIntervalMinutes: 15,
    maximumSyncIntervalMinutes: 1440,
    connectRequiresPlan: null,
    syncRequiresPlan: "pro",
    note: "Architecture reserved for an official/approved Meesho seller API. No fake API endpoint or credential flow is exposed before access is approved.",
  },
};

export const ACTIVE_MARKETPLACE_API_PLATFORM_IDS = [
  "amazon-in-v1",
  "flipkart-v1",
  "shopify-v1",
  "woocommerce-v1",
] as const satisfies readonly ApiConnectorId[];

export function marketplaceApiPlatform(id: MarketplaceApiPlatformId): MarketplaceApiPlatformDefinition {
  return MARKETPLACE_API_PLATFORMS[id];
}

export function marketplaceApiPlatformForConnector(connectorId: ApiConnectorId): MarketplaceApiPlatformDefinition {
  return MARKETPLACE_API_PLATFORMS[connectorId];
}

export function listMarketplaceApiPlatforms(): MarketplaceApiPlatformDefinition[] {
  return Object.values(MARKETPLACE_API_PLATFORMS);
}

export function clampMarketplaceSyncInterval(connectorId: ApiConnectorId, minutes: number): number {
  const platform = marketplaceApiPlatformForConnector(connectorId);
  const rounded = Number.isFinite(minutes) ? Math.round(minutes) : platform.defaultSyncIntervalMinutes;
  return Math.min(platform.maximumSyncIntervalMinutes, Math.max(platform.minimumSyncIntervalMinutes, rounded));
}
