CREATE TABLE `flat_request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flat_number` text NOT NULL,
	`spot_numbers` text NOT NULL,
	`requester_name` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`reviewed_by`) REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `spot` ADD `flat_number` text REFERENCES flat(number);