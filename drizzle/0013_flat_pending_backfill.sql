-- Backfill stored pending status for flats holding a live invitation.
-- (SQLite/Drizzle records no CHECK for the text enum, so no DDL is needed —
-- the enum change is application-level; this data migration aligns existing rows
-- with the new invariant: pending ⟺ activation code present.)
UPDATE `flat` SET `status` = 'pending' WHERE `status` = 'inactive' AND `activation_code` IS NOT NULL;
