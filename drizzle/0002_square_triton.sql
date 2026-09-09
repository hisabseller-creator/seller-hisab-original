CREATE TABLE `contact_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_status_created_idx` ON `contact_requests` (`status`,`created_at`);