PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_id` integer NOT NULL,
	`flat_id` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `spot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flat_id`) REFERENCES `flat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_booking`("id", "spot_id", "flat_id", "start_time", "end_time", "note", "created_at") SELECT "id", "spot_id", "flat_id", "start_time", "end_time", "note", "created_at" FROM `booking`;--> statement-breakpoint
DROP TABLE `booking`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY NOT NULL,
	`flat_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`flat_id`) REFERENCES `flat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_session`("id", "flat_id", "expires_at", "created_at") SELECT "id", "flat_id", "expires_at", "created_at" FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;