CREATE TABLE `bank_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text,
  `source_import_id` text NOT NULL,
  `row_key` text NOT NULL,
  `transaction_fingerprint` text NOT NULL,
  `booked_at` text NOT NULL,
  `amount_paise` integer NOT NULL,
  `direction` text NOT NULL,
  `currency` text DEFAULT 'INR' NOT NULL,
  `reference` text,
  `description` text,
  `closing_balance_paise` integer,
  `source_row` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`source_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_transactions_import_row_unique` ON `bank_transactions` (`source_import_id`,`row_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_transactions_tenant_fingerprint_unique` ON `bank_transactions` (`tenant_id`,`transaction_fingerprint`);
--> statement-breakpoint
CREATE INDEX `bank_transactions_tenant_booked_idx` ON `bank_transactions` (`tenant_id`,`booked_at`);
--> statement-breakpoint
CREATE INDEX `bank_transactions_tenant_direction_idx` ON `bank_transactions` (`tenant_id`,`direction`);
--> statement-breakpoint
CREATE TABLE `cash_matches` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `bank_transaction_id` text NOT NULL,
  `expected_ledger_entry_id` text NOT NULL,
  `status` text NOT NULL,
  `match_method` text,
  `expected_paise` integer NOT NULL,
  `actual_paise` integer,
  `difference_paise` integer,
  `reason` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`expected_ledger_entry_id`) REFERENCES `commerce_ledger_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_matches_expected_unique` ON `cash_matches` (`expected_ledger_entry_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_matches_bank_unique` ON `cash_matches` (`bank_transaction_id`);
--> statement-breakpoint
CREATE INDEX `cash_matches_tenant_status_idx` ON `cash_matches` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE TABLE `cash_preferences` (
  `tenant_id` text PRIMARY KEY NOT NULL,
  `current_balance_paise` integer,
  `weekly_fixed_outflow_paise` integer,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
