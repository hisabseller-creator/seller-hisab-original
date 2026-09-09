-- SellerHisab launch hardening: durable billing events, import lifecycle,
-- overlap/correction metadata, support operations and account lifecycle.
-- This is append-only. Historical deployed migrations are intentionally unchanged.

ALTER TABLE `webhook_events` ADD `state` text NOT NULL DEFAULT 'received';
--> statement-breakpoint
ALTER TABLE `webhook_events` ADD `attempt_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `webhook_events` ADD `processing_started_at` text;
--> statement-breakpoint
ALTER TABLE `webhook_events` ADD `last_error_code` text;
--> statement-breakpoint
ALTER TABLE `webhook_events` ADD `last_error_at` text;
--> statement-breakpoint
UPDATE `webhook_events`
SET `state` = CASE WHEN `processed_at` IS NOT NULL THEN 'completed' ELSE 'received' END;
--> statement-breakpoint
CREATE INDEX `webhook_events_state_received_idx` ON `webhook_events` (`state`,`received_at`);
--> statement-breakpoint

ALTER TABLE `payments` ADD `provider_status` text;
--> statement-breakpoint
ALTER TABLE `payments` ADD `provider_verified_at` text;
--> statement-breakpoint
CREATE INDEX `payments_status_updated_idx` ON `payments` (`status`,`updated_at`);
--> statement-breakpoint

ALTER TABLE `subscriptions` ADD `provider_plan_id` text;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cancel_at_period_end` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `ended_at` integer;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `provider_verified_at` text;
--> statement-breakpoint
CREATE INDEX `subscriptions_status_period_idx` ON `subscriptions` (`status`,`current_period_end`);
--> statement-breakpoint

CREATE TABLE `billing_audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text,
  `payment_id` text,
  `subscription_id` text,
  `provider_event_id` text,
  `event_type` text NOT NULL,
  `state` text NOT NULL,
  `detail_json` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `billing_audit_user_created_idx` ON `billing_audit_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `billing_audit_provider_event_idx` ON `billing_audit_events` (`provider_event_id`);
--> statement-breakpoint

CREATE TABLE `subscription_payment_events` (
  `id` text PRIMARY KEY NOT NULL,
  `subscription_id` text NOT NULL,
  `provider_payment_id` text NOT NULL,
  `event_type` text NOT NULL,
  `amount_paise` integer,
  `currency` text,
  `status` text NOT NULL,
  `occurred_at` text NOT NULL,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_payment_provider_unique` ON `subscription_payment_events` (`provider_payment_id`);
--> statement-breakpoint
CREATE INDEX `subscription_payment_subscription_occurred_idx` ON `subscription_payment_events` (`subscription_id`,`occurred_at`);
--> statement-breakpoint

ALTER TABLE `data_imports` ADD `completed_at` text;
--> statement-breakpoint
ALTER TABLE `data_imports` ADD `failed_at` text;
--> statement-breakpoint
ALTER TABLE `data_imports` ADD `superseded_by_import_id` text;
--> statement-breakpoint
ALTER TABLE `data_imports` ADD `last_error_code` text;
--> statement-breakpoint
UPDATE `data_imports` SET `completed_at` = `created_at` WHERE `status` = 'completed' AND `completed_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `data_imports_tenant_status_created_idx` ON `data_imports` (`tenant_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `data_imports_superseded_idx` ON `data_imports` (`superseded_by_import_id`);
--> statement-breakpoint

ALTER TABLE `bank_transactions` ADD `logical_key` text;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `is_active` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `superseded_at` text;
--> statement-breakpoint
CREATE INDEX `bank_transactions_tenant_active_booked_idx` ON `bank_transactions` (`tenant_id`,`is_active`,`booked_at`);
--> statement-breakpoint
CREATE INDEX `bank_transactions_tenant_logical_idx` ON `bank_transactions` (`tenant_id`,`logical_key`);
--> statement-breakpoint

ALTER TABLE `ad_performance_rows` ADD `logical_key` text;
--> statement-breakpoint
ALTER TABLE `ad_performance_rows` ADD `is_active` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `ad_performance_rows` ADD `superseded_at` text;
--> statement-breakpoint
CREATE INDEX `ad_performance_tenant_active_date_idx` ON `ad_performance_rows` (`tenant_id`,`is_active`,`report_date`);
--> statement-breakpoint
CREATE INDEX `ad_performance_tenant_logical_idx` ON `ad_performance_rows` (`tenant_id`,`logical_key`);
--> statement-breakpoint

CREATE TABLE `ledger_entry_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `ledger_entry_id` text NOT NULL,
  `tenant_id` text NOT NULL,
  `source_import_id` text,
  `semantic` text NOT NULL,
  `amount_paise` integer NOT NULL,
  `currency` text NOT NULL,
  `occurred_at` text,
  `source_reference_json` text,
  `replaced_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ledger_revisions_entry_replaced_idx` ON `ledger_entry_revisions` (`ledger_entry_id`,`replaced_at`);
--> statement-breakpoint
CREATE INDEX `ledger_revisions_tenant_replaced_idx` ON `ledger_entry_revisions` (`tenant_id`,`replaced_at`);
--> statement-breakpoint

ALTER TABLE `connector_sync_runs` ADD `attempt_count` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `connector_sync_runs` ADD `next_retry_at` text;
--> statement-breakpoint
ALTER TABLE `connector_sync_runs` ADD `last_error_message` text;
--> statement-breakpoint
CREATE INDEX `connector_sync_retry_idx` ON `connector_sync_runs` (`status`,`next_retry_at`);
--> statement-breakpoint

ALTER TABLE `contact_requests` ADD `category` text NOT NULL DEFAULT 'general';
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `priority` text NOT NULL DEFAULT 'normal';
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `assigned_to` text;
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `updated_at` text;
--> statement-breakpoint
CREATE INDEX `contact_priority_status_created_idx` ON `contact_requests` (`priority`,`status`,`created_at`);
--> statement-breakpoint

ALTER TABLE `users` ADD `deleted_at` text;
--> statement-breakpoint
CREATE INDEX `users_deleted_at_idx` ON `users` (`deleted_at`);
--> statement-breakpoint
ALTER TABLE `inventory_position_rows` ADD `logical_key` text;
--> statement-breakpoint
ALTER TABLE `inventory_position_rows` ADD `is_active` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `inventory_position_rows` ADD `superseded_at` text;
--> statement-breakpoint
CREATE INDEX `inventory_position_tenant_active_date_idx` ON `inventory_position_rows` (`tenant_id`,`is_active`,`snapshot_date`);
--> statement-breakpoint
CREATE INDEX `inventory_position_tenant_logical_idx` ON `inventory_position_rows` (`tenant_id`,`logical_key`);
--> statement-breakpoint

ALTER TABLE `contact_requests` ADD `resolution_note` text;
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `resolved_at` text;
--> statement-breakpoint

CREATE TABLE `support_request_events` (
  `id` text PRIMARY KEY NOT NULL,
  `support_request_id` text NOT NULL,
  `actor_user_id` text,
  `event_type` text NOT NULL,
  `detail_json` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`support_request_id`) REFERENCES `contact_requests`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_events_request_created_idx` ON `support_request_events` (`support_request_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE `account_deletion_receipts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_hash` text NOT NULL,
  `requested_at` text NOT NULL,
  `completed_at` text NOT NULL,
  `retained_categories_json` text NOT NULL,
  `deleted_categories_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_deletion_receipts_completed_idx` ON `account_deletion_receipts` (`completed_at`);
--> statement-breakpoint

CREATE TRIGGER `action_workflows_same_tenant_insert`
BEFORE INSERT ON `action_workflows`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `action_recommendations` ar
  WHERE ar.id = NEW.action_id AND ar.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'action_workflow_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `action_workflows_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`action_id` ON `action_workflows`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `action_recommendations` ar
  WHERE ar.id = NEW.action_id AND ar.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'action_workflow_tenant_mismatch');
END;
--> statement-breakpoint

CREATE TRIGGER `bank_transaction_same_tenant_insert`
BEFORE INSERT ON `bank_transactions`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `data_imports` di
  WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'bank_import_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `ad_row_same_tenant_insert`
BEFORE INSERT ON `ad_performance_rows`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `data_imports` di
  WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'ads_import_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `inventory_row_same_tenant_insert`
BEFORE INSERT ON `inventory_position_rows`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `data_imports` di
  WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'inventory_import_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TABLE `connector_sync_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `connection_id` text NOT NULL,
  `requested_by_user_id` text,
  `days` integer NOT NULL DEFAULT 30,
  `status` text NOT NULL DEFAULT 'queued',
  `attempt_count` integer NOT NULL DEFAULT 0,
  `max_attempts` integer NOT NULL DEFAULT 5,
  `next_attempt_at` text NOT NULL,
  `processing_started_at` text,
  `last_error_code` text,
  `last_error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`connection_id`) REFERENCES `connector_connections`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `connector_sync_jobs_due_idx` ON `connector_sync_jobs` (`status`,`next_attempt_at`);
--> statement-breakpoint
CREATE INDEX `connector_sync_jobs_connection_created_idx` ON `connector_sync_jobs` (`connection_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `bank_transaction_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`source_import_id` ON `bank_transactions`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `data_imports` di
  WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'bank_import_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `ad_row_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`source_import_id` ON `ad_performance_rows`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `data_imports` di
  WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'ads_import_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `inventory_row_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`source_import_id` ON `inventory_position_rows`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `data_imports` di
  WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'inventory_import_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `action_outcome_same_tenant_insert`
BEFORE INSERT ON `action_outcomes`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `action_recommendations` ar
  WHERE ar.id = NEW.action_id AND ar.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'action_outcome_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `action_outcome_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`action_id` ON `action_outcomes`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `action_recommendations` ar
  WHERE ar.id = NEW.action_id AND ar.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'action_outcome_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `cash_match_same_tenant_insert`
BEFORE INSERT ON `cash_matches`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `bank_transactions` bt
  JOIN `commerce_ledger_entries` le ON le.id = NEW.expected_ledger_entry_id
  WHERE bt.id = NEW.bank_transaction_id
    AND bt.tenant_id = NEW.tenant_id
    AND le.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'cash_match_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `cash_match_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`bank_transaction_id`,`expected_ledger_entry_id` ON `cash_matches`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `bank_transactions` bt
  JOIN `commerce_ledger_entries` le ON le.id = NEW.expected_ledger_entry_id
  WHERE bt.id = NEW.bank_transaction_id
    AND bt.tenant_id = NEW.tenant_id
    AND le.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'cash_match_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `product_variant_same_tenant_insert`
BEFORE INSERT ON `product_variants`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `master_products` mp
  WHERE mp.id = NEW.master_product_id AND mp.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'product_variant_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `channel_listing_same_tenant_insert`
BEFORE INSERT ON `channel_listings`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `channel_accounts` ca
  WHERE ca.id = NEW.channel_account_id AND ca.tenant_id = NEW.tenant_id
)
OR (
  NEW.product_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `product_variants` pv
    WHERE pv.id = NEW.product_variant_id AND pv.tenant_id = NEW.tenant_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'channel_listing_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `sku_alias_same_tenant_insert`
BEFORE INSERT ON `sku_aliases`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `product_variants` pv
  WHERE pv.id = NEW.product_variant_id AND pv.tenant_id = NEW.tenant_id
)
OR NOT EXISTS (
  SELECT 1 FROM `channel_accounts` ca
  WHERE ca.id = NEW.channel_account_id AND ca.tenant_id = NEW.tenant_id
)
OR (
  NEW.channel_listing_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `channel_listings` cl
    WHERE cl.id = NEW.channel_listing_id AND cl.tenant_id = NEW.tenant_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'sku_alias_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `ledger_same_tenant_insert`
BEFORE INSERT ON `commerce_ledger_entries`
FOR EACH ROW
WHEN (
  NEW.legal_entity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `legal_entities` le
    WHERE le.id = NEW.legal_entity_id AND le.tenant_id = NEW.tenant_id
  )
) OR (
  NEW.channel_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `channel_accounts` ca
    WHERE ca.id = NEW.channel_account_id AND ca.tenant_id = NEW.tenant_id
  )
) OR (
  NEW.source_import_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `data_imports` di
    WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'ledger_tenant_mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `ledger_same_tenant_update`
BEFORE UPDATE OF `tenant_id`,`legal_entity_id`,`channel_account_id`,`source_import_id` ON `commerce_ledger_entries`
FOR EACH ROW
WHEN (
  NEW.legal_entity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `legal_entities` le
    WHERE le.id = NEW.legal_entity_id AND le.tenant_id = NEW.tenant_id
  )
) OR (
  NEW.channel_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `channel_accounts` ca
    WHERE ca.id = NEW.channel_account_id AND ca.tenant_id = NEW.tenant_id
  )
) OR (
  NEW.source_import_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `data_imports` di
    WHERE di.id = NEW.source_import_id AND di.tenant_id = NEW.tenant_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'ledger_tenant_mismatch');
END;
