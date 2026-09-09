CREATE TABLE `ad_performance_rows` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text,
  `source_import_id` text NOT NULL,
  `row_key` text NOT NULL,
  `report_date` text NOT NULL,
  `channel_id` text NOT NULL,
  `campaign_name` text NOT NULL,
  `campaign_id` text,
  `ad_group_name` text,
  `sku` text,
  `spend_paise` integer NOT NULL,
  `attributed_sales_paise` integer,
  `attributed_orders` integer,
  `clicks` integer,
  `impressions` integer,
  `currency` text DEFAULT 'INR' NOT NULL,
  `source_row` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`source_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_performance_import_row_unique` ON `ad_performance_rows` (`source_import_id`,`row_key`);
--> statement-breakpoint
CREATE INDEX `ad_performance_tenant_date_idx` ON `ad_performance_rows` (`tenant_id`,`report_date`);
--> statement-breakpoint
CREATE INDEX `ad_performance_tenant_channel_idx` ON `ad_performance_rows` (`tenant_id`,`channel_id`);
--> statement-breakpoint
CREATE INDEX `ad_performance_tenant_campaign_idx` ON `ad_performance_rows` (`tenant_id`,`campaign_name`);
--> statement-breakpoint
CREATE TABLE `ad_preferences` (
  `tenant_id` text PRIMARY KEY NOT NULL,
  `pre_ad_margin_bps` integer,
  `return_loss_bps` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
