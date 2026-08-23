ALTER TABLE `flat` ADD `emails` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `flat` ADD `phones` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `flat_request` ADD `emails` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `flat_request` ADD `phones` text DEFAULT '[]' NOT NULL;