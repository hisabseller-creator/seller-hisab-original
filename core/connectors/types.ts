import type { DataAcquisitionCode, SalesChannelId } from "../channels/catalog";

export type ConnectorCapability =
  | "read-orders"
  | "read-settlements"
  | "read-returns"
  | "read-ads"
  | "read-inventory"
  | "read-listings"
  | "write-listings"
  | "write-price"
  | "write-inventory"
  | "write-ads";

export type ConnectorIngestionMode =
  | "file"
  | "manual"
  | "oauth-api"
  | "seller-api"
  | "webhook"
  | "partner-feed";

export type ConnectorStatus =
  | "live"
  | "planned"
  | "partner-required"
  | "discovery";

export type ConnectorDefinition = {
  id: string;
  channelId: SalesChannelId;
  version: string;
  status: ConnectorStatus;
  ingestionModes: readonly ConnectorIngestionMode[];
  acquisition: readonly DataAcquisitionCode[];
  capabilities: readonly ConnectorCapability[];
  enabledCapabilities: readonly ConnectorCapability[];
  notes: string;
};

export function hasEnabledCapability(
  connector: ConnectorDefinition,
  capability: ConnectorCapability,
): boolean {
  return connector.enabledCapabilities.includes(capability);
}
