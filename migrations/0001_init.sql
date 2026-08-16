-- Migration 0001 — the whole Rupee Fund schema.
-- Razorpay is source of truth; this stores ONLY what Razorpay cannot serve.
-- NEVER store PAN / address / payment instrument / amount.

CREATE TABLE contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rzp_customer_id TEXT,
  rzp_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  newsletter_consent INTEGER NOT NULL DEFAULT 0,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_contributors_status ON contributors (status);

CREATE TABLE metrics_cache (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  computed_at INTEGER NOT NULL
);

CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL
);

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

-- Post-launch voting: proposals seeded via SQL (no admin UI); state derived from opens_at/closes_at.
-- options = JSON array of {key,label}; ballot.choice must match a key (prevents tally-splitting).
-- Eligibility is LIVE Razorpay paid_count>=10 — NOT stored here.

CREATE TABLE proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  opens_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE ballots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES proposals (id),
  rzp_subscription_id TEXT NOT NULL,
  choice TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (proposal_id, rzp_subscription_id)
);
CREATE INDEX idx_ballots_proposal ON ballots (proposal_id);

CREATE TABLE vote_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  proposal_id INTEGER NOT NULL REFERENCES proposals (id),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX idx_vote_tokens_email ON vote_tokens (email);
