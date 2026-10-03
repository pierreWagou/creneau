-- Backfill empty emails/phones with placeholder values before CHECK constraints
UPDATE `flat` SET `emails` = '["unknown@example.com"]' WHERE `emails` = '[]';
UPDATE `flat` SET `phones` = '["0000000000"]' WHERE `phones` = '[]';
UPDATE `flat_request` SET `emails` = '["unknown@example.com"]' WHERE `emails` = '[]';
UPDATE `flat_request` SET `phones` = '["0000000000"]' WHERE `phones` = '[]';
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_flat` (
	`number` text PRIMARY KEY NOT NULL,
	`activation_code` text,
	`activation_code_expires_at` text,
	`display_name` text,
	`pin_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`emails` text NOT NULL,
	`phones` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "flat_emails_not_empty" CHECK(json_array_length("__new_flat"."emails") > 0),
	CONSTRAINT "flat_phones_not_empty" CHECK(json_array_length("__new_flat"."phones") > 0)
);
--> statement-breakpoint
INSERT INTO `__new_flat`("number", "activation_code", "activation_code_expires_at", "display_name", "pin_hash", "is_admin", "is_active", "activated_at", "emails", "phones", "created_at") SELECT "number", "activation_code", "activation_code_expires_at", "display_name", "pin_hash", "is_admin", "is_active", "activated_at", "emails", "phones", "created_at" FROM `flat`;--> statement-breakpoint
DROP TABLE `flat`;--> statement-breakpoint
ALTER TABLE `__new_flat` RENAME TO `flat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_flat_request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flat_number` text NOT NULL,
	`spot_numbers` text NOT NULL,
	`requester_name` text,
	`emails` text NOT NULL,
	`phones` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`reviewed_by`) REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "flat_request_emails_not_empty" CHECK(json_array_length("__new_flat_request"."emails") > 0),
	CONSTRAINT "flat_request_phones_not_empty" CHECK(json_array_length("__new_flat_request"."phones") > 0)
);
--> statement-breakpoint
INSERT INTO `__new_flat_request`("id", "flat_number", "spot_numbers", "requester_name", "emails", "phones", "status", "created_at", "reviewed_at", "reviewed_by") SELECT "id", "flat_number", "spot_numbers", "requester_name", "emails", "phones", "status", "created_at", "reviewed_at", "reviewed_by" FROM `flat_request`;--> statement-breakpoint
DROP TABLE `flat_request`;--> statement-breakpoint
ALTER TABLE `__new_flat_request` RENAME TO `flat_request`;
