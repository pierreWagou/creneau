CREATE TABLE `booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_id` integer NOT NULL,
	`flat_id` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `spot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`flat_id`) REFERENCES `flat`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`activation_code` text NOT NULL,
	`display_name` text,
	`pin_hash` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flat_number_unique` ON `flat` (`number`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`flat_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`flat_id`) REFERENCES `flat`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
