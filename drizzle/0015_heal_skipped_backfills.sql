-- Heals two data statements that the old semicolon splitter silently skipped.
-- Their comments contained a semicolon (see 0012 line 52 and 0013 line 3), so
-- the statement got merged into a comment fragment and failed to parse.
-- Both statements are idempotent and match zero rows on fresh installs.
UPDATE `flat` SET `status` = 'pending' WHERE `status` = 'inactive' AND `activation_code` IS NOT NULL;
DELETE FROM `flat` WHERE `status` = 'request';
