-- 1. Create flat_email table
CREATE TABLE `flat_email` (
	`flat_number` text NOT NULL REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE cascade,
	`email` text NOT NULL,
	PRIMARY KEY(`flat_number`, `email`)
);--> statement-breakpoint
-- 2. Create flat_phone table
CREATE TABLE `flat_phone` (
	`flat_number` text NOT NULL REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE cascade,
	`phone` text NOT NULL,
	PRIMARY KEY(`flat_number`, `phone`)
);--> statement-breakpoint
-- 3. Migrate existing flat.emails JSON → flat_email rows
INSERT INTO `flat_email` (`flat_number`, `email`) SELECT `flat`.`number`, `json_each`.`value` FROM `flat`, json_each(`flat`.`emails`);--> statement-breakpoint
-- 4. Migrate existing flat.phones JSON → flat_phone rows
INSERT INTO `flat_phone` (`flat_number`, `phone`) SELECT `flat`.`number`, `json_each`.`value` FROM `flat`, json_each(`flat`.`phones`);--> statement-breakpoint
-- 5. Migrate flat_request contacts → flat_email, flat_phone for pending requests
INSERT INTO `flat_email` (`flat_number`, `email`) SELECT `flat_request`.`flat_number`, `json_each`.`value` FROM `flat_request`, json_each(`flat_request`.`emails`) WHERE `flat_request`.`status` = 'pending';--> statement-breakpoint
INSERT INTO `flat_phone` (`flat_number`, `phone`) SELECT `flat_request`.`flat_number`, `json_each`.`value` FROM `flat_request`, json_each(`flat_request`.`phones`) WHERE `flat_request`.`status` = 'pending';--> statement-breakpoint
-- 6. Bind spots for pending requests
UPDATE `spot` SET `flat_number` = (SELECT `fr`.`flat_number` FROM `flat_request` `fr` WHERE `fr`.`flat_number` = `spot`.`flat_number` AND `fr`.`status` = 'pending' LIMIT 1) WHERE EXISTS (SELECT 1 FROM `flat_request` `fr2` WHERE `fr2`.`flat_number` = `spot`.`flat_number` AND `fr2`.`status` = 'pending');--> statement-breakpoint
-- 7. Save pending request data to temp table (before dropping flat_request)
CREATE TABLE `_tmp_pending_requests` AS SELECT `flat_number`, `requester_name`, `reviewed_at`, `reviewed_by`, `created_at` FROM `flat_request` WHERE `status` = 'pending';--> statement-breakpoint
-- 8. Drop flat_request table
DROP TABLE `flat_request`;--> statement-breakpoint
-- 9. Recreate flat table (SQLite can't DROP COLUMN when CHECK constraints reference it)
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_flat` (
	`number` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`activation_code` text,
	`activation_code_expires_at` text,
	`display_name` text,
	`pin_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
-- 10. Copy existing flat rows (derive status from is_active)
INSERT INTO `__new_flat` (`number`, `status`, `activation_code`, `activation_code_expires_at`, `display_name`, `pin_hash`, `is_admin`, `activated_at`, `created_at`) SELECT `number`, CASE WHEN `is_active` = 1 THEN 'active' ELSE 'inactive' END, `activation_code`, `activation_code_expires_at`, `display_name`, `pin_hash`, `is_admin`, `activated_at`, `created_at` FROM `flat`;--> statement-breakpoint
-- 11. Insert pending request rows as flats with status 'request'
INSERT INTO `__new_flat` (`number`, `status`, `display_name`, `reviewed_at`, `reviewed_by`, `created_at`) SELECT `flat_number`, 'request', `requester_name`, `reviewed_at`, `reviewed_by`, `created_at` FROM `_tmp_pending_requests`;--> statement-breakpoint
-- 12. Drop old flat, rename new
DROP TABLE `flat`;--> statement-breakpoint
ALTER TABLE `__new_flat` RENAME TO `flat`;--> statement-breakpoint
-- 13. Drop temp table
DROP TABLE `_tmp_pending_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
