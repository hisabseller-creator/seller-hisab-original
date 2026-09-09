import { SALES_CHANNELS, type SalesChannelId } from "../channels/catalog";
import { getConnector, type ConnectorId } from "./registry";

export type ConnectorReadiness = {
  connectorId: ConnectorId;
  channelId: SalesChannelId;
  label: string;
  priority: string;
  runtimeStatus: "live" | "partial" | "mapper-ready" | "planned";
  accountStatus: "not-connected" | "connected" | "degraded" | "disabled";
  orders: string;
  settlements: string;
  authorization: string;
  enabledCapabilities: string[];
  lastSuccessAt?: string;
  lastError?: string;
};

const ACCOUNT_CONNECTORS: readonly ConnectorId[] = [
  "meesho-file-v1",
  "amazon-in-v1",
  "flipkart-v1",
  "shopify-v1",
  "woocommerce-v1",
];

const RUNTIME: Record<ConnectorId, Omit<ConnectorReadiness, "connectorId" | "channelId" | "label" | "priority" | "accountStatus" | "enabledCapabilities">> = {
  "meesho-file-v1": {
    runtimeStatus: "live",
    orders: "Live file parser",
    settlements: "Live file settlement parser",
    authorization: "No marketplace password/API token required for local file analysis",
  },
  "amazon-in-v1": {
    runtimeStatus: "live",
    orders: "Live Amazon Orders file parser",
    settlements: "Live Settlement Flat File V2 parser + payout batch evidence",
    authorization: "Files work without API access. Official SP-API read sync is available after SellerHisab app configuration, seller authorization and approved roles/scopes.",
  },
  "flipkart-v1": {
    runtimeStatus: "live",
    orders: "Live Orders report parser",
    settlements: "Live settlement/P&L file parser with deterministic order linkage",
    authorization: "Files work without API access. Official Seller API order sync is available after app configuration and seller authorization; settlement stays validated-file-first.",
  },
  "shopify-v1": {
    runtimeStatus: "live",
    orders: "Live Orders CSV parser",
    settlements: "Live Shopify Payments balance-transactions CSV parser",
    authorization: "Files work without OAuth. Official Admin GraphQL read sync is available after SellerHisab app configuration and merchant authorization.",
  },
  "woocommerce-v1": {
    runtimeStatus: "live",
    orders: "Live WooCommerce REST API wc/v3 order read sync",
    settlements: "Payment-gateway payout/settlement is not inferred from WooCommerce orders",
    authorization: "Public HTTPS store + merchant-generated WooCommerce REST API Read key. No WordPress password is requested.",
  },
};

export function defaultConnectorReadiness(connectorId: ConnectorId): ConnectorReadiness {
  const connector = getConnector(connectorId);
  const channel = SALES_CHANNELS[connector.channelId];
  return {
    connectorId,
    channelId: connector.channelId,
    label: channel.label,
    priority: channel.priority,
    accountStatus: "not-connected",
    enabledCapabilities: [...connector.enabledCapabilities],
    ...RUNTIME[connectorId],
  };
}

export function listAccountConnectorReadiness(): ConnectorReadiness[] {
  return ACCOUNT_CONNECTORS.map(defaultConnectorReadiness);
}

// Compatibility alias used by older tests/callers; F11 expands this account list beyond P0.
export function listP0ConnectorReadiness(): ConnectorReadiness[] {
  return listAccountConnectorReadiness();
}
