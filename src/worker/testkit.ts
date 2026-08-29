import type { Env, Repo, WaitlistRow } from "./types.ts";

export interface FakeRepo extends Repo {
  waitlist: WaitlistRow[];
}

export function makeRepo(): FakeRepo {
  const self: FakeRepo = {
    waitlist: [],

    async addToWaitlist(entry) {
      const existing = self.waitlist.find((w) => w.email === entry.email);
      if (existing === undefined) {
        self.waitlist.push({
          ...entry,
          id: self.waitlist.length + 1,
          exported_at: null,
          unsubscribed_at: null,
        });
        return;
      }
      if (existing.unsubscribed_at !== null) return;
      existing.name = entry.name;
      existing.consent_at = entry.consent_at;
      existing.source = entry.source;
      existing.updated_at = entry.updated_at;
    },

    async listPendingExport(limit) {
      return self.waitlist
        .filter((w) => w.exported_at === null && w.unsubscribed_at === null)
        .sort((a, b) => a.id - b.id)
        .slice(0, limit);
    },

    async markExported(ids, exportedAt) {
      let changed = 0;
      for (const row of self.waitlist) {
        if (!ids.includes(row.id) || row.exported_at !== null) continue;
        row.exported_at = exportedAt;
        changed += 1;
      }
      return changed;
    },

    async unsubscribeFromWaitlist(email, unsubscribedAt) {
      const row = self.waitlist.find((w) => w.email === email && w.unsubscribed_at === null);
      if (row === undefined) return false;
      row.unsubscribed_at = unsubscribedAt;
      row.updated_at = unsubscribedAt;
      return true;
    },
  };
  return self;
}

export interface FakeLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
  keys: string[];
}

export function makeLimiter(opts: { allow?: boolean; throws?: boolean } = {}): FakeLimiter {
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      if (opts.throws === true) throw new Error("limiter unavailable");
      return { success: opts.allow !== false };
    },
  };
}

export interface FakeVerifier {
  (token: string, remoteIp: string | null): Promise<boolean>;
  calls: Array<{ token: string; remoteIp: string | null }>;
}

export function makeVerifier(opts: { pass?: boolean; throws?: boolean } = {}): FakeVerifier {
  const calls: Array<{ token: string; remoteIp: string | null }> = [];
  const fn = async (token: string, remoteIp: string | null) => {
    calls.push({ token, remoteIp });
    if (opts.throws === true) throw new Error("siteverify unavailable");
    return opts.pass !== false;
  };
  return Object.assign(fn, { calls });
}

export function makeLogger(): {
  entries: Record<string, unknown>[];
  log: (e: Record<string, unknown>) => void;
} {
  const entries: Record<string, unknown>[] = [];
  return { entries, log: (e) => entries.push(e) };
}

export function makeD1(): Env["DB"] {
  const statement = {
    bind: () => statement,
    all: async () => ({ success: true, results: [], meta: {} }),
    first: async () => null,
    run: async () => ({ success: true, meta: { changes: 0 } }),
  };
  return { prepare: () => statement } as unknown as Env["DB"];
}
