CREATE TABLE `tenants` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenants_owner_idx` ON `tenants` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE `tenant_members` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text DEFAULT 'owner' NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_members_tenant_user_unique` ON `tenant_members` (`tenant_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `tenant_members_user_idx` ON `tenant_members` (`user_id`);
--> statement-breakpoint
CREATE TABLE `legal_entities` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `gstin` text,
  `pan` text,
  `country_code` text DEFAULT 'IN' NOT NULL,
  `base_currency` text DEFAULT 'INR' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `legal_entities_tenant_idx` ON `legal_entities` (`tenant_id`);
--> statement-breakpoint
CREATE TABLE `channel_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `legal_entity_id` text,
  `channel_id` text NOT NULL,
  `external_account_id` text,
  `display_name` text NOT NULL,
  `region` text DEFAULT 'IN' NOT NULL,
  `currency` text DEFAULT 'INR' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`legal_entity_id`) REFERENCES `legal_entities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `channel_accounts_tenant_idx` ON `channel_accounts` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `channel_accounts_channel_idx` ON `channel_accounts` (`channel_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_accounts_external_unique` ON `channel_accounts` (`tenant_id`,`channel_id`,`region`,`external_account_id`);
--> statement-breakpoint
CREATE TABLE `master_products` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `brand` text,
  `canonical_category` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `master_products_tenant_idx` ON `master_products` (`tenant_id`);
--> statement-breakpoint
CREATE TABLE `product_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `master_product_id` text NOT NULL,
  `seller_sku` text,
  `gtin` text,
  `title` text,
  `size` text,
  `color` text,
  `pack` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`master_product_id`) REFERENCES `master_products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_variants_tenant_idx` ON `product_variants` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `product_variants_master_idx` ON `product_variants` (`master_product_id`);
--> statement-breakpoint
CREATE TABLE `channel_listings` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `channel_account_id` text NOT NULL,
  `product_variant_id` text,
  `external_listing_id` text NOT NULL,
  `external_sku` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`channel_account_id`) REFERENCES `channel_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_listings_external_unique` ON `channel_listings` (`channel_account_id`,`external_listing_id`);
--> statement-breakpoint
CREATE INDEX `channel_listings_variant_idx` ON `channel_listings` (`product_variant_id`);
--> statement-breakpoint
CREATE TABLE `sku_aliases` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `product_variant_id` text NOT NULL,
  `channel_account_id` text NOT NULL,
  `channel_listing_id` text,
  `alias_type` text NOT NULL,
  `alias_value` text NOT NULL,
  `confidence_bps` integer DEFAULT 0 NOT NULL,
  `source` text DEFAULT 'import' NOT NULL,
  `approved_by` text,
  `approved_at` text,
  `effective_from` text,
  `effective_to` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`channel_account_id`) REFERENCES `channel_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`channel_listing_id`) REFERENCES `channel_listings`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sku_alias_scope_unique` ON `sku_aliases` (`channel_account_id`,`alias_type`,`alias_value`);
--> statement-breakpoint
CREATE INDEX `sku_alias_variant_idx` ON `sku_aliases` (`product_variant_id`);
--> statement-breakpoint
CREATE TABLE `data_imports` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `channel_account_id` text,
  `user_id` text,
  `source_kind` text NOT NULL,
  `connector_id` text NOT NULL,
  `parser_version` text NOT NULL,
  `original_file_name` text,
  `source_fingerprint` text NOT NULL,
  `schema_fingerprint` text,
  `coverage_start` text,
  `coverage_end` text,
  `status` text DEFAULT 'completed' NOT NULL,
  `issue_count` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`channel_account_id`) REFERENCES `channel_accounts`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_imports_tenant_fingerprint_unique` ON `data_imports` (`tenant_id`,`source_fingerprint`);
--> statement-breakpoint
CREATE INDEX `data_imports_channel_created_idx` ON `data_imports` (`channel_account_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `commerce_ledger_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `legal_entity_id` text,
  `channel_account_id` text,
  `source_import_id` text,
  `order_line_uid` text,
  `semantic` text NOT NULL,
  `amount_paise` integer NOT NULL,
  `currency` text DEFAULT 'INR' NOT NULL,
  `occurred_at` text,
  `source_reference_json` text,
  `reversal_of_entry_id` text,
  `formula_version` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`legal_entity_id`) REFERENCES `legal_entities`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`channel_account_id`) REFERENCES `channel_accounts`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`source_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ledger_tenant_occurred_idx` ON `commerce_ledger_entries` (`tenant_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `ledger_channel_occurred_idx` ON `commerce_ledger_entries` (`channel_account_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `ledger_order_line_idx` ON `commerce_ledger_entries` (`order_line_uid`);
--> statement-breakpoint
CREATE INDEX `ledger_source_import_idx` ON `commerce_ledger_entries` (`source_import_id`);
--> statement-breakpoint
CREATE TABLE `action_recommendations` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `channel_account_id` text,
  `target_type` text NOT NULL,
  `target_id` text,
  `action_type` text NOT NULL,
  `expected_impact_paise` integer,
  `confidence_bps` integer DEFAULT 0 NOT NULL,
  `evidence_json` text NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`channel_account_id`) REFERENCES `channel_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `actions_tenant_status_idx` ON `action_recommendations` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE INDEX `actions_channel_status_idx` ON `action_recommendations` (`channel_account_id`,`status`);
--> statement-breakpoint
CREATE TABLE `action_outcomes` (
  `id` text PRIMARY KEY NOT NULL,
  `action_id` text NOT NULL,
  `tenant_id` text NOT NULL,
  `outcome_type` text NOT NULL,
  `measured_impact_paise` integer,
  `metrics_json` text,
  `measured_at` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`action_id`) REFERENCES `action_recommendations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `action_outcomes_action_idx` ON `action_outcomes` (`action_id`);
--> statement-breakpoint
CREATE INDEX `action_outcomes_tenant_idx` ON `action_outcomes` (`tenant_id`);
--> statement-breakpoint
CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text,
  `user_id` text,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text,
  `metadata_json` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_events_tenant_created_idx` ON `audit_events` (`tenant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `audit_events_user_created_idx` ON `audit_events` (`user_id`,`created_at`);
