-- Booking lifecycle: cancelled is a soft-delete — kept for display, ignored
-- by availability/conflicts/calendar/stats. Existing rows inherit 'active'.
ALTER TABLE `booking` ADD `status` text DEFAULT 'active' NOT NULL;
