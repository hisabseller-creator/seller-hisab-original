CREATE TABLE IF NOT EXISTS `workspace_preferences` (
  `user_id` text PRIMARY KEY NOT NULL,
  `active_tenant_id` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`active_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `workspace_preferences_tenant_idx` ON `workspace_preferences` (`active_tenant_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_invites` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `email` text NOT NULL,
  `role` text NOT NULL,
  `token_hash` text NOT NULL,
  `invited_by_user_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `expires_at` integer NOT NULL,
  `created_at` text NOT NULL,
  `accepted_at` text,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `workspace_invites_token_unique` ON `workspace_invites` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `workspace_invites_tenant_status_idx` ON `workspace_invites` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `workspace_invites_email_status_idx` ON `workspace_invites` (`email`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `action_workflows` (
  `action_id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `assigned_to_user_id` text,
  `approval_required` integer NOT NULL DEFAULT 0,
  `approval_status` text NOT NULL DEFAULT 'not_required',
  `requested_by_user_id` text,
  `requested_at` text,
  `approved_by_user_id` text,
  `approved_at` text,
  `rejected_by_user_id` text,
  `rejected_at` text,
  `rejection_note` text,
  `completed_by_user_id` text,
  `completed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`action_id`) REFERENCES `action_recommendations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`rejected_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `action_workflows_tenant_approval_idx` ON `action_workflows` (`tenant_id`,`approval_status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `action_workflows_assignee_idx` ON `action_workflows` (`assigned_to_user_id`);
