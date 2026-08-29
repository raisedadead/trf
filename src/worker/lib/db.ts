import type { D1Database } from "@cloudflare/workers-types";
import type { Repo } from "../types.ts";

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
  };
}
