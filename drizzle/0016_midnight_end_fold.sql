-- Midnight-frontier fold: an end at 00:00 closes the previous day, it never
-- opens an extra day. Rewrites next-day-midnight ends to same-day 24:00, the
-- same instant under the domain convention (DAY_END = 24). Idempotent: folded
-- rows no longer match the predicate, and it matches zero rows on fresh installs.
UPDATE `booking` SET `end_time` = date(substr(`end_time`, 1, 10), '-1 day') || 'T24:00:00'
WHERE substr(`end_time`, 12, 8) = '00:00:00' AND substr(`end_time`, 1, 10) > substr(`start_time`, 1, 10);
