import type { SalesChannelId } from "../channels/catalog";
import type { ConnectorDefinition } from "./types";

const CONNECTORS = {
  "meesho-file-v1": {
    id: "meesho-file-v1",
    channelId: "meesho",
    version: "1.0.0",
    status: "live",
    ingestionModes: ["file", "manual"],
    acquisition: ["A", "B", "D", "E"],
    capabilities: ["read-orders", "read-settlements", "read-returns", "read-ads"],
    enabledCapabilities: ["read-orders", "read-settlements", "read-returns", "read-ads"],
    notes: "File-first parser. No public general seller API is assumed.",
  },
  "amazon-in-v1": {
    id: "amazon-in-v1",
    channelId: "amazon-in",
    version: "1.0.0",
    status: "live",
    ingestionModes: ["file", "oauth-api"],
    acquisition: ["A", "C", "D", "E"],
    capabilities: ["read-orders", "read-settlements", "read-returns", "read-ads", "read-inventory", "read-listings"],
    enabledCapabilities: ["read-orders", "read-settlements"],
    notes: "File analysis is live. Official SP-API read sync is implemented and remains gated by SellerHisab app configuration, seller authorization and approved roles/scopes.",
  },
  "flipkart-v1": {
    id: "flipkart-v1",
    channelId: "flipkart",
    version: "1.0.0",
    status: "live",
    ingestionModes: ["file", "seller-api"],
    acquisition: ["A", "B", "C", "D"],
    capabilities: ["read-orders", "read-settlements", "read-returns", "read-inventory", "read-listings"],
    enabledCapabilities: ["read-orders", "read-settlements"],
    notes: "File analysis is live. Official Seller API order sync is implemented after app configuration and seller authorization; settlement remains validated-file-first.",
  },
  "shopify-v1": {
    id: "shopify-v1",
    channelId: "shopify",
    version: "1.0.0",
    status: "live",
    ingestionModes: ["file", "oauth-api", "webhook"],
    acquisition: ["A", "B", "C", "D", "E"],
    capabilities: ["read-orders", "read-settlements", "read-returns", "read-inventory", "read-listings"],
    enabledCapabilities: ["read-orders", "read-settlements"],
    notes: "File analysis is live. Official Admin GraphQL read sync is implemented after app configuration and merchant authorization; Shopify Payments depends on granted payout scope.",
  },
  "woocommerce-v1": {
    id: "woocommerce-v1",
    channelId: "woocommerce",
    version: "1.0.0",
    status: "live",
    ingestionModes: ["seller-api"],
    acquisition: ["B", "C"],
    capabilities: ["read-orders", "read-returns", "read-inventory", "read-listings"],
    enabledCapabilities: ["read-orders"],
    notes: "Merchant-controlled WooCommerce REST API wc/v3 read sync. SellerHisab accepts only a public HTTPS store URL and a read-only Consumer Key/Secret; no WordPress password is requested.",
  },
} as const satisfies Record<string, ConnectorDefinition>;

export type ConnectorId = keyof typeof CONNECTORS;

export function getConnector(id: ConnectorId): ConnectorDefinition {
  return CONNECTORS[id];
}

export function getConnectorsForChannel(channelId: SalesChannelId): ConnectorDefinition[] {
  return Object.values(CONNECTORS).filter((connector) => connector.channelId === channelId);
}

export function listConnectors(): ConnectorDefinition[] {
  return Object.values(CONNECTORS);
}

export function liveConnectors(): ConnectorDefinition[] {
  return listConnectors().filter((connector) => connector.status === "live");
}
