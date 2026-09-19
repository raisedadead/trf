-- Nullable because docs/deploy.md section 4 requires an additive migration:
-- the Worker version running during the deploy predates these columns, and a
-- row nobody asked is not a row that ticked no box.

ALTER TABLE waitlist ADD COLUMN is_foss_user INTEGER;
ALTER TABLE waitlist ADD COLUMN is_foss_contributor INTEGER;
ALTER TABLE waitlist ADD COLUMN is_student INTEGER;
