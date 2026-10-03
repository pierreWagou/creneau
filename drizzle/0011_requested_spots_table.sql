ALTER TABLE `flat` DROP COLUMN `request_conflicts`;

CREATE TABLE `flat_requested_spot` (
	`flat_number` text NOT NULL,
	`spot_number` text NOT NULL,
	PRIMARY KEY(`flat_number`, `spot_number`),
	FOREIGN KEY (`flat_number`) REFERENCES `flat`(`number`) ON UPDATE no action ON DELETE cascade
);