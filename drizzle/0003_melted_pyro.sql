CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`config_json` text NOT NULL,
	`updated_by` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
