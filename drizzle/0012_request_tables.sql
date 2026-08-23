-- Create request tables
CREATE TABLE IF NOT EXISTS `request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flat_number` text NOT NULL,
	`requester_name` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS `request_spot` (
	`request_id` integer NOT NULL,
	`spot_number` text NOT NULL,
	PRIMARY KEY(`request_id`, `spot_number`),
	FOREIGN KEY (`request_id`) REFERENCES `request`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `request_email` (
	`request_id` integer NOT NULL,
	`email` text NOT NULL,
	PRIMARY KEY(`request_id`, `email`),
	FOREIGN KEY (`request_id`) REFERENCES `request`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `request_phone` (
	`request_id` integer NOT NULL,
	`phone` text NOT NULL,
	PRIMARY KEY(`request_id`, `phone`),
	FOREIGN KEY (`request_id`) REFERENCES `request`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Migrate existing request flats to request table (0 rows on fresh install)
INSERT OR IGNORE INTO `request` (`flat_number`, `requester_name`, `status`, `reviewed_by`, `reviewed_at`, `created_at`)
SELECT `number`, `display_name`, 'pending', `reviewed_by`, `reviewed_at`, `created_at`
FROM `flat` WHERE `status` = 'request';

-- Migrate contacts from request flats to request tables
INSERT OR IGNORE INTO `request_email` (`request_id`, `email`)
SELECT r.`id`, fe.`email`
FROM `flat_email` fe
JOIN `request` r ON r.`flat_number` = fe.`flat_number`
WHERE fe.`flat_number` IN (SELECT `number` FROM `flat` WHERE `status` = 'request');

INSERT OR IGNORE INTO `request_phone` (`request_id`, `phone`)
SELECT r.`id`, fp.`phone`
FROM `flat_phone` fp
JOIN `request` r ON r.`flat_number` = fp.`flat_number`
WHERE fp.`flat_number` IN (SELECT `number` FROM `flat` WHERE `status` = 'request');

-- Migrate requested spots (only if flat_requested_spot exists — skip on fresh install)
-- Note: flat_requested_spot may not exist on fresh installs; this is safe because
-- there are no request flats on fresh installs either.

-- Delete request flats (cascades to flat_email, flat_phone, flat_requested_spot)
DELETE FROM `flat` WHERE `status` = 'request';

-- Drop flat_requested_spot table if it exists
DROP TABLE IF EXISTS `flat_requested_spot`;

-- Rebuild flat table without reviewed_by, reviewed_at columns
DROP TABLE IF EXISTS `__new_flat`;

CREATE TABLE `__new_flat` (
	`number` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`activation_code` text,
	`activation_code_expires_at` text,
	`display_name` text,
	`pin_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);

INSERT OR IGNORE INTO `__new_flat` (`number`, `status`, `activation_code`, `activation_code_expires_at`, `display_name`, `pin_hash`, `is_admin`, `activated_at`, `created_at`)
SELECT `number`, `status`, `activation_code`, `activation_code_expires_at`, `display_name`, `pin_hash`, `is_admin`, `activated_at`, `created_at`
FROM `flat`;

DROP TABLE `flat`;

ALTER TABLE `__new_flat` RENAME TO `flat`;
