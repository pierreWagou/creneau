-- Migration: Remove artificial IDs, use natural keys
-- spot: remove id, rename name → number (text PK)
-- flat: remove id, make number the PK
-- booking: spotId → spotNumber (text), flatId → flatNumber (text)
-- session: flatId → flatNumber (text)

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- 1. Rebuild spot table with number as PK
CREATE TABLE `__new_spot` (
	`number` text PRIMARY KEY NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_spot`("number", "description", "created_at") SELECT "name", "description", "created_at" FROM `spot`;--> statement-breakpoint

-- 2. Rebuild flat table with number as PK (drop id column)
CREATE TABLE `__new_flat` (
	`number` text PRIMARY KEY NOT NULL,
	`activation_code` text,
	`activation_code_expires_at` text,
	`display_name` text,
	`pin_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_flat`("number", "activation_code", "activation_code_expires_at", "display_name", "pin_hash", "is_admin", "is_active", "activated_at", "created_at") SELECT "number", "activation_code", "activation_code_expires_at", "display_name", "pin_hash", "is_admin", "is_active", "activated_at", "created_at" FROM `flat`;--> statement-breakpoint

-- 3. Rebuild booking table with text FKs (resolve via JOINs)
CREATE TABLE `__new_booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_number` text NOT NULL,
	`flat_number` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`spot_number`) REFERENCES `__new_spot`(`number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flat_number`) REFERENCES `__new_flat`(`number`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_booking`("id", "spot_number", "flat_number", "start_time", "end_time", "note", "created_at")
SELECT b."id", s."name", f."number", b."start_time", b."end_time", b."note", b."created_at"
FROM `booking` b
INNER JOIN `spot` s ON b."spot_id" = s."id"
INNER JOIN `flat` f ON b."flat_id" = f."id";--> statement-breakpoint

-- 4. Rebuild session table with text FK (resolve via JOIN)
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY NOT NULL,
	`flat_number` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`flat_number`) REFERENCES `__new_flat`(`number`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_session`("id", "flat_number", "expires_at", "created_at")
SELECT s."id", f."number", s."expires_at", s."created_at"
FROM `session` s
INNER JOIN `flat` f ON s."flat_id" = f."id";--> statement-breakpoint

-- 5. Drop old tables and rename new ones
DROP TABLE `booking`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
DROP TABLE `spot`;--> statement-breakpoint
DROP TABLE `flat`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
ALTER TABLE `__new_spot` RENAME TO `spot`;--> statement-breakpoint
ALTER TABLE `__new_flat` RENAME TO `flat`;--> statement-breakpoint

PRAGMA foreign_keys=ON;
