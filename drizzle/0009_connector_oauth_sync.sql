CREATE TABLE `connector_oauth_states` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text NOT NULL,
  `connector_id` text NOT NULL,
  `state_hash` text NOT NULL,
  `context_json` text NOT NULL DEFAULT '{}',
  `expires_at` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_oauth_states_hash_unique` ON `connector_oauth_states` (`state_hash`);
--> statement-breakpoint
CREATE INDEX `connector_oauth_states_user_expiry_idx` ON `connector_oauth_states` (`user_id`,`expires_at`);
--> statement-breakpoint
CREATE TABLE `connector_credentials` (
  `connection_id` text PRIMARY KEY NOT NULL,
  `encrypted_payload` text NOT NULL,
  `iv` text NOT NULL,
  `key_version` text NOT NULL DEFAULT 'v1',
  `expires_at` integer,
  `refresh_expires_at` integer,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`connection_id`) REFERENCES `connector_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `connector_sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `connection_id` text NOT NULL,
  `connector_id` text NOT NULL,
  `status` text NOT NULL,
  `coverage_start` text,
  `coverage_end` text,
  `order_count` integer NOT NULL DEFAULT 0,
  `financial_record_count` integer NOT NULL DEFAULT 0,
  `issue_count` integer NOT NULL DEFAULT 0,
  `started_at` text NOT NULL,
  `completed_at` text,
  `error_code` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`connection_id`) REFERENCES `connector_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connector_sync_runs_connection_started_idx` ON `connector_sync_runs` (`connection_id`,`started_at`);
--> statement-breakpoint
CREATE INDEX `connector_sync_runs_tenant_started_idx` ON `connector_sync_runs` (`tenant_id`,`started_at`);
