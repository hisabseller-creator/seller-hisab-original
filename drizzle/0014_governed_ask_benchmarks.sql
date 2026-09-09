CREATE TABLE `benchmark_preferences` (
  `tenant_id` text PRIMARY KEY NOT NULL,
  `contribute_enabled` integer DEFAULT 0 NOT NULL,
  `updated_by_user_id` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `benchmark_preferences_contribute_idx` ON `benchmark_preferences` (`contribute_enabled`);
