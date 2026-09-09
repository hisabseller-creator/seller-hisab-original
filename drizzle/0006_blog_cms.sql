CREATE TABLE `blog_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `subtitle` text NOT NULL,
  `tag` text NOT NULL,
  `image_key` text,
  `image_alt` text,
  `html_content` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `featured` integer DEFAULT 0 NOT NULL,
  `published_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `updated_by` text,
  FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_posts_slug_unique` ON `blog_posts` (`slug`);
--> statement-breakpoint
CREATE INDEX `blog_posts_status_published_idx` ON `blog_posts` (`status`,`published_at`);
--> statement-breakpoint
CREATE INDEX `blog_posts_featured_idx` ON `blog_posts` (`featured`);
