-- Dev-only proposal + ballot fixtures for manual UI + E2E testing.
-- Self-dating via strftime so state never goes stale. Local D1 only.
-- Voting lives only in the post-launch database; the launch database has no
-- proposals or ballots table to seed.
-- Run: pnpm wrangler d1 execute trf-rupeefund-post-launch --env post-launch --local --file scripts/seed-dev.sql

DELETE FROM ballots WHERE proposal_id IN (SELECT id FROM proposals WHERE slug IN ('demo-open', 'demo-closed'));
DELETE FROM proposals WHERE slug IN ('demo-open', 'demo-closed');

INSERT INTO proposals (slug, title, body, options, opens_at, closes_at, created_at) VALUES
  ('demo-open', 'Demo: open proposal', 'Which project should Season 1 fund first?',
   '[{"key":"a","label":"Project A"},{"key":"b","label":"Project B"},{"key":"c","label":"Project C"}]',
   (CAST(strftime('%s','now') AS INTEGER) - 86400) * 1000,
   (CAST(strftime('%s','now') AS INTEGER) + 2592000) * 1000,
   (CAST(strftime('%s','now') AS INTEGER) - 86400) * 1000),
  ('demo-closed', 'Demo: closed proposal', 'A past vote — results are visible.',
   '[{"key":"x","label":"Option X"},{"key":"y","label":"Option Y"}]',
   (CAST(strftime('%s','now') AS INTEGER) - 5184000) * 1000,
   (CAST(strftime('%s','now') AS INTEGER) - 86400) * 1000,
   (CAST(strftime('%s','now') AS INTEGER) - 5184000) * 1000);

INSERT INTO ballots (proposal_id, rzp_subscription_id, choice, created_at) VALUES
  ((SELECT id FROM proposals WHERE slug = 'demo-closed'), 'sub_demo_0001', 'x', (CAST(strftime('%s','now') AS INTEGER) - 172800) * 1000),
  ((SELECT id FROM proposals WHERE slug = 'demo-closed'), 'sub_demo_0002', 'x', (CAST(strftime('%s','now') AS INTEGER) - 172800) * 1000),
  ((SELECT id FROM proposals WHERE slug = 'demo-closed'), 'sub_demo_0003', 'y', (CAST(strftime('%s','now') AS INTEGER) - 172800) * 1000);
