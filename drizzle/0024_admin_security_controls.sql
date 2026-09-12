CREATE TABLE `admin_mfa_settings` (
  `user_id` text PRIMARY KEY NOT NULL,
  `secret_ciphertext` text,
  `secret_iv` text,
  `secret_key_version` text,
  `pending_secret_ciphertext` text,
  `pending_secret_iv` text,
  `pending_key_version` text,
  `pending_created_at` text,
  `enabled_at` text,
  `last_totp_step` integer,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `admin_mfa_recovery_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `code_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `used_at` text,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `admin_mfa_recovery_user_used_idx` ON `admin_mfa_recovery_codes` (`user_id`,`used_at`);

CREATE TABLE `user_security_state` (
  `user_id` text PRIMARY KEY NOT NULL,
  `failed_password_attempts` integer NOT NULL DEFAULT 0,
  `locked_until` integer,
  `last_password_failure_at` text,
  `password_changed_at` text,
  `security_version` integer NOT NULL DEFAULT 1,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `user_security_locked_idx` ON `user_security_state` (`locked_until`);

CREATE TABLE `user_password_history` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `user_password_history_user_created_idx` ON `user_password_history` (`user_id`,`created_at`);

INSERT INTO `user_security_state` (`user_id`,`password_changed_at`,`updated_at`)
SELECT `id`,`created_at`,`created_at` FROM `users`;
