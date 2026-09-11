-- Unified marketplace API platform: connection-level automatic sync state,
-- monotonic data revisions and saved connected-report snapshots.
-- Forward-only: do not apply to production without explicit approval.

ALTER TABLE `connector_connections` ADD `auto_sync_enabled` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `connector_connections` ADD `sync_interval_minutes` integer NOT NULL DEFAULT 30;
--> statement-breakpoint
ALTER TABLE `connector_connections` ADD `next_auto_sync_at` text;
--> statement-breakpoint
ALTER TABLE `connector_connections` ADD `data_revision` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `connector_connections` ADD `last_data_change_at` text;
--> statement-breakpoint
ALTER TABLE `connector_connections` ADD `report_revision` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `connector_connections` ADD `last_report_refresh_at` text;
--> statement-breakpoint
CREATE INDEX `connector_connections_auto_sync_due_idx`
  ON `connector_connections` (`auto_sync_enabled`,`next_auto_sync_at`,`status`);
--> statement-breakpoint

ALTER TABLE `connector_sync_jobs` ADD `trigger_kind` text NOT NULL DEFAULT 'manual';
--> statement-breakpoint
CREATE INDEX `connector_sync_jobs_trigger_created_idx`
  ON `connector_sync_jobs` (`trigger_kind`,`created_at`);
--> statement-breakpoint

CREATE TABLE `connector_report_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `connection_id` text NOT NULL,
  `report_key` text NOT NULL DEFAULT 'connected-summary',
  `data_revision` integer NOT NULL,
  `payload_json` text NOT NULL,
  `generated_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`connection_id`) REFERENCES `connector_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_report_snapshots_connection_key_unique`
  ON `connector_report_snapshots` (`connection_id`,`report_key`);
--> statement-breakpoint
CREATE INDEX `connector_report_snapshots_tenant_updated_idx`
  ON `connector_report_snapshots` (`tenant_id`,`updated_at`);
