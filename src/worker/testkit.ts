import type {
  Ballot,
  Contributor,
  MetricsSnapshot,
  NewContributor,
  Proposal,
  Repo,
  VoteToken,
  WaitlistRow,
} from "./types.ts";
import type {
  CreateSubscriptionInput,
  RazorpayClient,
  RazorpaySubscription,
} from "./lib/razorpay.ts";
import type { Mailer } from "./lib/newsletter.ts";

export interface FakeRepo extends Repo {
  rows: Contributor[];
  events: Set<string>;
  metricsValue: MetricsSnapshot | null;
  waitlist: WaitlistRow[];
  proposals: Proposal[];
  ballots: Ballot[];
  voteTokens: VoteToken[];
}

export function makeRepo(seed: Contributor[] = [], proposals: Proposal[] = []): FakeRepo {
  const self: FakeRepo = {
    rows: [...seed],
    events: new Set<string>(),
    metricsValue: null,
    waitlist: [],
    proposals: [...proposals],
    ballots: [],
    voteTokens: [],
    async findByEmail(email) {
      return self.rows.find((r) => r.email === email) ?? null;
    },
    async findBySubscriptionId(id) {
      return self.rows.find((r) => r.rzp_subscription_id === id) ?? null;
    },
    async insertContributor(c: NewContributor) {
      if (self.rows.some((r) => r.email === c.email))
        throw new Error("UNIQUE constraint failed: contributors.email");
      if (self.rows.some((r) => r.rzp_subscription_id === c.rzp_subscription_id))
        throw new Error("UNIQUE constraint failed: contributors.rzp_subscription_id");
      self.rows.push({ id: self.rows.length + 1, rzp_customer_id: null, status: "created", ...c });
    },
    async updateStatusBySubscriptionId(id, status, customerId, updatedAt) {
      const row = self.rows.find((r) => r.rzp_subscription_id === id);
      if (!row) return;
      row.status = status;
      if (customerId) row.rzp_customer_id = customerId;
      row.updated_at = updatedAt;
    },
    async clearConsentByToken(token) {
      const row = self.rows.find((r) => r.unsubscribe_token === token);
      if (!row) return false;
      row.newsletter_consent = 0;
      return true;
    },
    async countByStatus() {
      return {
        total: self.rows.length,
        active: self.rows.filter((r) => r.status === "active").length,
      };
    },
    async recordEventOnce(eventId) {
      if (self.events.has(eventId)) return false;
      self.events.add(eventId);
      return true;
    },
    async isEventProcessed(eventId) {
      return self.events.has(eventId);
    },
    async getMetrics() {
      return self.metricsValue;
    },
    async setMetrics(snapshot) {
      self.metricsValue = snapshot;
    },
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
    async listProposals() {
      return [...self.proposals];
    },
    async findProposalBySlug(slug) {
      return self.proposals.find((p) => p.slug === slug) ?? null;
    },
    async findProposalById(id) {
      return self.proposals.find((p) => p.id === id) ?? null;
    },
    async insertBallot(b) {
      if (
        self.ballots.some(
          (x) => x.proposal_id === b.proposal_id && x.rzp_subscription_id === b.rzp_subscription_id,
        )
      )
        throw new Error(
          "UNIQUE constraint failed: ballots.proposal_id, ballots.rzp_subscription_id",
        );
      self.ballots.push({ id: self.ballots.length + 1, ...b });
    },
    async tallyBallots(proposalId) {
      const out: Record<string, number> = {};
      for (const x of self.ballots.filter((b) => b.proposal_id === proposalId))
        out[x.choice] = (out[x.choice] ?? 0) + 1;
      return out;
    },
    async createVoteToken(t) {
      self.voteTokens.push({ ...t });
    },
    async findVoteToken(token) {
      return self.voteTokens.find((t) => t.token === token) ?? null;
    },
    async consumeVoteToken(token, consumedAt) {
      const t = self.voteTokens.find((x) => x.token === token);
      if (!t || t.consumed_at !== null) return false;
      t.consumed_at = consumedAt;
      return true;
    },
  };
  return self;
}

export function makeProposal(over: Partial<Proposal> = {}): Proposal {
  return {
    id: 1,
    slug: "season-1",
    title: "Season 1 grants",
    body: "Pick the projects.",
    options: JSON.stringify([
      { key: "project-a", label: "Project A" },
      { key: "project-b", label: "Project B" },
    ]),
    opens_at: 0,
    closes_at: 1_000_000_000_000_000,
    created_at: 0,
    ...over,
  };
}

export interface FakeRazorpay extends RazorpayClient {
  created: CreateSubscriptionInput[];
}

export function makeRazorpay(opts?: {
  fail?: boolean;
  listFail?: boolean;
  fetchFail?: boolean;
  fetchStatus?: string;
  paidCount?: number;
  list?: RazorpaySubscription[];
}): FakeRazorpay {
  const created: CreateSubscriptionInput[] = [];
  return {
    created,
    async createSubscription(input) {
      created.push(input);
      if (opts?.fail) throw new Error("razorpay down");
      return {
        id: "sub_test_1",
        short_url: "https://rzp.io/test",
        status: "created",
        plan_id: input.plan_id,
        customer_id: null,
        paid_count: 0,
        notes: input.notes,
      };
    },
    async fetchSubscription(id) {
      if (opts?.fetchFail) throw new Error("razorpay down");
      return {
        id,
        short_url: "https://rzp.io/test",
        status: opts?.fetchStatus ?? "active",
        plan_id: "plan_100",
        customer_id: "cust_1",
        paid_count: opts?.paidCount ?? 12,
        notes: { program: "rupee-fund" },
      };
    },
    async listSubscriptions(skip = 0, count = 100) {
      if (opts?.listFail) throw new Error("razorpay down");
      const all = opts?.list ?? [];
      return { count: all.length, items: all.slice(skip, skip + count) };
    },
  };
}

export interface FakeMailer extends Mailer {
  sent: Array<{ email: string; name: string }>;
  magicLinks: Array<{ email: string; link: string }>;
}

export function makeMailer(): FakeMailer {
  const sent: Array<{ email: string; name: string }> = [];
  const magicLinks: Array<{ email: string; link: string }> = [];
  return {
    sent,
    magicLinks,
    async sendWelcome(email, name) {
      sent.push({ email, name });
    },
    async sendMagicLink(email, link) {
      magicLinks.push({ email, link });
    },
  };
}

export async function hmacHex(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeContributor(over: Partial<Contributor> = {}): Contributor {
  return {
    id: 1,
    email: "asha@example.com",
    name: "Asha",
    rzp_customer_id: null,
    rzp_subscription_id: "sub_test_1",
    status: "created",
    newsletter_consent: 1,
    unsubscribe_token: "tok_1",
    created_at: 1,
    updated_at: 1,
    ...over,
  };
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
