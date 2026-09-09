ALTER TABLE `users` ADD `phone` text;
ALTER TABLE `users` ADD `password_hash` text;
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);
