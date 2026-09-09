CREATE TABLE `inventory_position_rows` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text,
  `source_import_id` text NOT NULL,
  `row_key` text NOT NULL,
  `snapshot_date` text NOT NULL,
  `channel_id` text NOT NULL,
  `sku` text NOT NULL,
  `master_sku` text,
  `product_name` text,
  `available_units` integer NOT NULL,
  `inbound_units` integer,
  `units_sold_30d` integer,
  `lead_time_days` integer,
  `unit_cost_paise` integer,
  `contribution_margin_bps` integer,
  `location` text,
  `source_row` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`source_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_position_import_row_unique` ON `inventory_position_rows` (`source_import_id`,`row_key`);
--> statement-breakpoint
CREATE INDEX `inventory_position_tenant_date_idx` ON `inventory_position_rows` (`tenant_id`,`snapshot_date`);
--> statement-breakpoint
CREATE INDEX `inventory_position_tenant_channel_sku_idx` ON `inventory_position_rows` (`tenant_id`,`channel_id`,`sku`);
--> statement-breakpoint
CREATE INDEX `inventory_position_tenant_master_sku_idx` ON `inventory_position_rows` (`tenant_id`,`master_sku`);
--> statement-breakpoint
CREATE TABLE `inventory_preferences` (
  `tenant_id` text PRIMARY KEY NOT NULL,
  `default_lead_time_days` integer DEFAULT 14 NOT NULL,
  `safety_days` integer DEFAULT 7 NOT NULL,
  `target_cover_days` integer DEFAULT 30 NOT NULL,
  `overstock_days` integer DEFAULT 120 NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
