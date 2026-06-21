-- Migration: Fix FK references in booking and session tables
-- Migration 0003 created __new_booking and __new_session with FKs referencing
-- __new_spot/__new_flat (temp names). After RENAME those names no longer exist,
-- so SQLite resolves the FK to a non-existent table at runtime when
-- PRAGMA foreign_keys = ON. This migration rebuilds both tables with correct
-- FK references to spot and flat.

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Rebuild booking with correct FK references
CREATE TABLE `__new_booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_number` text NOT NULL,
	`flat_number` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`spot_number`) REFERENCES `spot`(`number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flat_number`) REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_booking`("id", "spot_number", "flat_number", "start_time", "end_time", "note", "created_at")
	SELECT "id", "spot_number", "flat_number", "start_time", "end_time", "note", "created_at" FROM `booking`;--> statement-breakpoint
DROP TABLE `booking`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint

-- Rebuild session with correct FK references
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY NOT NULL,
	`flat_number` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`flat_number`) REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_session`("id", "flat_number", "expires_at", "created_at")
	SELECT "id", "flat_number", "expires_at", "created_at" FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint

PRAGMA foreign_keys=ON;
