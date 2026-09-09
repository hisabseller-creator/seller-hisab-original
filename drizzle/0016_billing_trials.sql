-- SellerHisab RC2: admin-controlled recurring plan free trials.
-- Additive only. Historical migrations, including 0015, remain unchanged.

CREATE TABLE IF NOT EXISTS `billing_trial_settings` (
  `plan` text PRIMARY KEY NOT NULL,
  `enabled` integer NOT NULL DEFAULT 0,
  `trial_days` integer NOT NULL DEFAULT 3,
  `updated_at` text NOT NULL,
  `updated_by_user_id` text,
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT OR IGNORE INTO `billing_trial_settings` (`plan`, `enabled`, `trial_days`, `updated_at`, `updated_by_user_id`)
VALUES ('starter', 0, 3, CURRENT_TIMESTAMP, NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO `billing_trial_settings` (`plan`, `enabled`, `trial_days`, `updated_at`, `updated_by_user_id`)
VALUES ('pro', 0, 3, CURRENT_TIMESTAMP, NULL);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `billing_trial_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `subscription_id` text NOT NULL,
  `provider_subscription_id` text NOT NULL,
  `plan` text NOT NULL,
  `trial_days` integer NOT NULL,
  `trial_started_at` text,
  `trial_ends_at` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'checkout_pending',
  `auto_pay_status` text NOT NULL DEFAULT 'pending',
  `checkout_email` text,
  `checkout_phone` text,
  `provider_last_status` text,
  `first_charge_payment_id` text,
  `converted_at` text,
  `failed_at` text,
  `cancelled_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `billing_trial_claims_user_unique` ON `billing_trial_claims` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `billing_trial_claims_provider_unique` ON `billing_trial_claims` (`provider_subscription_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `billing_trial_claims_status_end_idx` ON `billing_trial_claims` (`status`,`trial_ends_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `billing_trial_claims_plan_created_idx` ON `billing_trial_claims` (`plan`,`created_at`);
