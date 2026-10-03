-- Rebuild spot table with correct ON DELETE SET NULL FK + pad spot numbers to 2 digits
PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- Pad booking spot numbers to 2 digits
UPDATE `booking` SET `spot_number` = CASE WHEN length(`spot_number`) = 1 THEN '0' || `spot_number` ELSE `spot_number` END WHERE length(`spot_number`) = 1;--> statement-breakpoint
-- Rebuild spot table with correct FK and padded numbers
CREATE TABLE `__new_spot` (
	`number` text PRIMARY KEY NOT NULL,
	`flat_number` text REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE set null,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_spot` (`number`, `flat_number`, `description`, `created_at`) SELECT CASE WHEN length(`number`) = 1 THEN '0' || `number` ELSE `number` END, `flat_number`, `description`, `created_at` FROM `spot`;--> statement-breakpoint
DROP TABLE `spot`;--> statement-breakpoint
ALTER TABLE `__new_spot` RENAME TO `spot`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
