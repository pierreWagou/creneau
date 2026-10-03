-- Spot lifecycle status: shared (pool, bookable) · assigned (a lot's) · unassigned (limbo to route).
-- Existing rows are backfilled from the holder FK (the previous implicit rule).
ALTER TABLE `spot` ADD `status` text NOT NULL DEFAULT 'unassigned';
UPDATE `spot` SET `status` = 'shared' WHERE `flat_number` IS NULL;
UPDATE `spot` SET `status` = 'assigned' WHERE `flat_number` IS NOT NULL;
