-- Range-scan index for availability windows (`getBookingsInRange` powers the
-- timeline, calendar statuses, and stats month slices). Existing rows need no
-- backfill; SQLite builds the index from the table at CREATE time.
CREATE INDEX `booking_start_time_idx` ON `booking` (`start_time`);
