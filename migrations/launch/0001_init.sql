-- Migration 0001 — the launch schema.
-- The launch Worker serves the information pages and the mailing-list signup.
-- It never reads or writes a payment table or a voting table, so this database
-- holds neither. The post-launch environment has its own database and its own
-- migrations directory, migrations/post-launch/.
--
-- Razorpay is source of truth; this stores ONLY what Razorpay cannot serve.
-- NEVER store PAN / address / payment instrument / amount.

-- >>> shared: waitlist — byte-identical in every migrations directory.
-- Launch mailing list.
-- consent_at and source are the consent record; neither can be backfilled.
-- exported_at is the hand-off watermark: the exporter selects rows where it is
-- NULL and stamps them, so a second run never resurrects an unsubscribe.

CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name TEXT NOT NULL,
  consent_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  exported_at INTEGER,
  unsubscribed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_waitlist_pending_export ON waitlist (id)
  WHERE exported_at IS NULL AND unsubscribed_at IS NULL;
-- <<< shared: waitlist
