import type { ApiConnectorId } from "@/core/connectors/api-runtime";
import type { PageCheckpoint } from "@/core/connectors/coverage";
import { marketplaceApiPlatformForConnector } from "@/core/connectors/platform";
import { fetchConnectorPage } from "./pages";
import { connectorApiConfigured, ensureFreshCredential } from "./providers";
import type { OwnedConnection, StoredConnectorCredential } from "./store";

export type ConnectorProviderAdapter = {
  connectorId: ApiConnectorId;
  configured(): boolean;
  ensureCredential(credential: StoredConnectorCredential): Promise<StoredConnectorCredential>;
  fetchPage(credential: StoredConnectorCredential, connection: OwnedConnection, checkpoint: PageCheckpoint): ReturnType<typeof fetchConnectorPage>;
  platform: ReturnType<typeof marketplaceApiPlatformForConnector>;
};

function buildAdapter(connectorId: ApiConnectorId): ConnectorProviderAdapter {
  return {
    connectorId,
    platform: marketplaceApiPlatformForConnector(connectorId),
    configured: () => connectorApiConfigured(connectorId),
    ensureCredential: ensureFreshCredential,
    fetchPage: (credential, connection, checkpoint) => fetchConnectorPage(credential, connection, checkpoint),
  };
}

const ADAPTERS: Record<ApiConnectorId, ConnectorProviderAdapter> = {
  "amazon-in-v1": buildAdapter("amazon-in-v1"),
  "flipkart-v1": buildAdapter("flipkart-v1"),
  "shopify-v1": buildAdapter("shopify-v1"),
  "woocommerce-v1": buildAdapter("woocommerce-v1"),
};

export function connectorProviderAdapter(connectorId: ApiConnectorId): ConnectorProviderAdapter {
  return ADAPTERS[connectorId];
}

export function listConnectorProviderAdapters(): ConnectorProviderAdapter[] {
  return Object.values(ADAPTERS);
}
