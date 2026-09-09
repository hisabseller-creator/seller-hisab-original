CREATE TABLE `connector_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `channel_account_id` text,
  `connector_id` text NOT NULL,
  `mode` text NOT NULL,
  `status` text DEFAULT 'not_connected' NOT NULL,
  `enabled_capabilities_json` text DEFAULT '[]' NOT NULL,
  `granted_scopes_json` text DEFAULT '[]' NOT NULL,
  `last_sync_at` text,
  `last_success_at` text,
  `last_error_code` text,
  `last_error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`channel_account_id`) REFERENCES `channel_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `connector_connections_tenant_idx` ON `connector_connections` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `connector_connections_channel_idx` ON `connector_connections` (`channel_account_id`);
--> statement-breakpoint
CREATE INDEX `connector_connections_connector_status_idx` ON `connector_connections` (`connector_id`,`status`);
