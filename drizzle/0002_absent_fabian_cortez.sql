PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_flat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`activation_code` text,
	`activation_code_expires_at` text,
	`display_name` text,
	`pin_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_flat`("id", "number", "activation_code", "activation_code_expires_at", "display_name", "pin_hash", "is_admin", "is_active", "activated_at", "created_at") SELECT "id", "number", "activation_code", NULL, "display_name", "pin_hash", "is_admin", "is_active", "activated_at", "created_at" FROM `flat`;--> statement-breakpoint
DROP TABLE `flat`;--> statement-breakpoint
ALTER TABLE `__new_flat` RENAME TO `flat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `flat_number_unique` ON `flat` (`number`);