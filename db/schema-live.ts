import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { channelAccounts, tenants, users } from "./schema.ts";

/**
 * 0023 connector live-platform schema extension.
 *
 * These two table declarations intentionally supersede their pre-0023 shapes
 * from schema.ts when schema-all.ts is used. Keeping the forward-only extension
 * isolated makes the reviewed migration boundary explicit without rewriting the
 * historical schema mirror.
 */
export const connectorConnectionsLive = sqliteTable("connector_connections", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  channelAccountId: text("channel_account_id").references(() => channelAccounts.id, { onDelete: "set null" }),
  connectorId: text("connector_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("not_connected"),
  enabledCapabilitiesJson: text("enabled_capabilities_json").notNull().default("[]"),
  grantedScopesJson: text("granted_scopes_json").notNull().default("[]"),
  lastSyncAt: text("last_sync_at"),
  lastSuccessAt: text("last_success_at"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  autoSyncEnabled: integer("auto_sync_enabled").notNull().default(0),
  syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(30),
  nextAutoSyncAt: text("next_auto_sync_at"),
  dataRevision: integer("data_revision").notNull().default(0),
  lastDataChangeAt: text("last_data_change_at"),
  reportRevision: integer("report_revision").notNull().default(0),
  lastReportRefreshAt: text("last_report_refresh_at"),
}, (table) => [
  index("connector_connections_tenant_idx").on(table.tenantId),
  index("connector_connections_channel_idx").on(table.channelAccountId),
  index("connector_connections_connector_status_idx").on(table.connectorId, table.status),
  index("connector_connections_auto_sync_due_idx").on(table.autoSyncEnabled, table.nextAutoSyncAt, table.status),
]);

export const connectorSyncJobsLive = sqliteTable("connector_sync_jobs", {
  id: text("id").primaryKey().notNull(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  connectionId: text("connection_id").notNull().references(() => connectorConnectionsLive.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  days: integer("days").notNull().default(30),
  status: text("status").notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  nextAttemptAt: text("next_attempt_at").notNull(),
  processingStartedAt: text("processing_started_at"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  logicalKey: text("logical_key"),
  checkpointJson: text("checkpoint_json"),
  coverageJson: text("coverage_json"),
  leaseToken: text("lease_token"),
  triggerKind: text("trigger_kind").notNull().default("manual"),
}, (table) => [
  index("connector_sync_jobs_connection_created_idx").on(table.connectionId, table.createdAt),
  index("connector_sync_jobs_due_idx").on(table.status, table.nextAttemptAt),
  uniqueIndex("connector_sync_jobs_logical_unique").on(table.logicalKey),
  index("connector_sync_jobs_trigger_created_idx").on(table.triggerKind, table.createdAt),
]);

export const connectorReportSnapshots = sqliteTable("connector_report_snapshots", {
  id: text("id").primaryKey().notNull(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  connectionId: text("connection_id").notNull().references(() => connectorConnectionsLive.id, { onDelete: "cascade" }),
  reportKey: text("report_key").notNull().default("connected-summary"),
  dataRevision: integer("data_revision").notNull(),
  payloadJson: text("payload_json").notNull(),
  generatedAt: text("generated_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("connector_report_snapshots_connection_key_unique").on(table.connectionId, table.reportKey),
  index("connector_report_snapshots_tenant_updated_idx").on(table.tenantId, table.updatedAt),
]);
