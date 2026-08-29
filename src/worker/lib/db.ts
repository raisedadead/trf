import type { D1Database } from "@cloudflare/workers-types";
import type { Repo, WaitlistRow } from "../types.ts";

const MAX_IDS_PER_UPDATE = 90;

export function createRepo(db: D1Database): Repo {
  return {
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
  };
}
