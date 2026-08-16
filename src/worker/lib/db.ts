import type { D1Database } from "@cloudflare/workers-types";
import type {
  Contributor,
  MetricsSnapshot,
  NewContributor,
  Proposal,
  Repo,
  VoteToken,
  WaitlistRow,
} from "../types.ts";

const MAX_IDS_PER_UPDATE = 90;

export function createRepo(db: D1Database): Repo {
  return {
    async findByEmail(email) {
      const row = await db
        .prepare("SELECT * FROM contributors WHERE email = ?")
        .bind(email)
        .first<Contributor>();
      return row ?? null;
    },

    async findBySubscriptionId(id) {
      const row = await db
        .prepare("SELECT * FROM contributors WHERE rzp_subscription_id = ?")
        .bind(id)
        .first<Contributor>();
      return row ?? null;
    },

    async insertContributor(c: NewContributor) {
      await db
        .prepare(
          "INSERT INTO contributors (email, name, rzp_subscription_id, newsletter_consent, unsubscribe_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          c.email,
          c.name,
          c.rzp_subscription_id,
          c.newsletter_consent,
          c.unsubscribe_token,
          c.created_at,
          c.updated_at,
        )
        .run();
    },

    async updateStatusBySubscriptionId(id, status, customerId, updatedAt) {
      await db
        .prepare(
          "UPDATE contributors SET status = ?, rzp_customer_id = COALESCE(?, rzp_customer_id), updated_at = ? WHERE rzp_subscription_id = ?",
        )
        .bind(status, customerId, updatedAt, id)
        .run();
    },

    async clearConsentByToken(token) {
      const res = await db
        .prepare("UPDATE contributors SET newsletter_consent = 0 WHERE unsubscribe_token = ?")
        .bind(token)
        .run();
      return (res.meta.changes ?? 0) > 0;
    },

    async countByStatus() {
      const row = await db
        .prepare(
          "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active FROM contributors",
        )
        .first<{ total: number; active: number | null }>();
      return { total: row?.total ?? 0, active: row?.active ?? 0 };
    },

    async recordEventOnce(eventId, receivedAt) {
      const res = await db
        .prepare("INSERT OR IGNORE INTO processed_events (event_id, received_at) VALUES (?, ?)")
        .bind(eventId, receivedAt)
        .run();
      return (res.meta.changes ?? 0) > 0;
    },

    async isEventProcessed(eventId) {
      const row = await db
        .prepare("SELECT 1 FROM processed_events WHERE event_id = ?")
        .bind(eventId)
        .first();
      return row !== null;
    },

    async getMetrics() {
      const row = await db
        .prepare("SELECT value_json FROM metrics_cache WHERE key = 'snapshot'")
        .first<{ value_json: string }>();
      if (!row) return null;
      return JSON.parse(row.value_json) as MetricsSnapshot;
    },

    async setMetrics(snapshot) {
      await db
        .prepare(
          "INSERT OR REPLACE INTO metrics_cache (key, value_json, computed_at) VALUES ('snapshot', ?, ?)",
        )
        .bind(JSON.stringify(snapshot), snapshot.computed_at)
        .run();
    },

    async addToWaitlist(entry) {
      await db
        .prepare(
          `INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (email) DO UPDATE SET
             name = excluded.name,
             consent_at = excluded.consent_at,
             source = excluded.source,
             updated_at = excluded.updated_at
           WHERE waitlist.unsubscribed_at IS NULL`,
        )
        .bind(
          entry.email,
          entry.name,
          entry.consent_at,
          entry.source,
          entry.created_at,
          entry.updated_at,
        )
        .run();
    },

    async listPendingExport(limit) {
      const { results } = await db
        .prepare(
          "SELECT * FROM waitlist WHERE exported_at IS NULL AND unsubscribed_at IS NULL ORDER BY id LIMIT ?",
        )
        .bind(limit)
        .all<WaitlistRow>();
      return results;
    },

    async markExported(ids, exportedAt) {
      let changed = 0;
      for (let at = 0; at < ids.length; at += MAX_IDS_PER_UPDATE) {
        const batch = ids.slice(at, at + MAX_IDS_PER_UPDATE);
        const placeholders = batch.map(() => "?").join(",");
        const { meta } = await db
          .prepare(
            `UPDATE waitlist SET exported_at = ? WHERE exported_at IS NULL AND id IN (${placeholders})`,
          )
          .bind(exportedAt, ...batch)
          .run();
        changed += meta.changes ?? 0;
      }
      return changed;
    },

    async unsubscribeFromWaitlist(email, unsubscribedAt) {
      const { meta } = await db
        .prepare(
          "UPDATE waitlist SET unsubscribed_at = ?, updated_at = ? WHERE email = ? AND unsubscribed_at IS NULL",
        )
        .bind(unsubscribedAt, unsubscribedAt, email)
        .run();
      return (meta.changes ?? 0) > 0;
    },

    async listProposals() {
      const { results } = await db
        .prepare("SELECT * FROM proposals ORDER BY opens_at DESC")
        .all<Proposal>();
      return results ?? [];
    },

    async findProposalBySlug(slug) {
      const row = await db
        .prepare("SELECT * FROM proposals WHERE slug = ?")
        .bind(slug)
        .first<Proposal>();
      return row ?? null;
    },

    async findProposalById(id) {
      const row = await db
        .prepare("SELECT * FROM proposals WHERE id = ?")
        .bind(id)
        .first<Proposal>();
      return row ?? null;
    },

    async insertBallot(b) {
      await db
        .prepare(
          "INSERT INTO ballots (proposal_id, rzp_subscription_id, choice, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(b.proposal_id, b.rzp_subscription_id, b.choice, b.created_at)
        .run();
    },

    async tallyBallots(proposalId) {
      const { results } = await db
        .prepare("SELECT choice, COUNT(*) AS n FROM ballots WHERE proposal_id = ? GROUP BY choice")
        .bind(proposalId)
        .all<{ choice: string; n: number }>();
      const out: Record<string, number> = {};
      for (const r of results ?? []) out[r.choice] = r.n;
      return out;
    },

    async createVoteToken(t) {
      await db
        .prepare(
          "INSERT INTO vote_tokens (token, email, proposal_id, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(t.token, t.email, t.proposal_id, t.expires_at, t.consumed_at)
        .run();
    },

    async findVoteToken(token) {
      const row = await db
        .prepare("SELECT * FROM vote_tokens WHERE token = ?")
        .bind(token)
        .first<VoteToken>();
      return row ?? null;
    },

    async consumeVoteToken(token, consumedAt) {
      const res = await db
        .prepare("UPDATE vote_tokens SET consumed_at = ? WHERE token = ? AND consumed_at IS NULL")
        .bind(consumedAt, token)
        .run();
      return (res.meta.changes ?? 0) > 0;
    },
  };
}
