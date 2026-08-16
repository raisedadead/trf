import type { D1Database, Fetcher, RateLimit } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SIGNUP_LIMITER?: RateLimit;
  TURNSTILE_SECRET?: string;
  TURNSTILE_HOSTNAMES?: string;
  TURNSTILE_ACTION?: string;
  POST_LAUNCH_ENABLED?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RZP_PLAN_10?: string;
  RZP_PLAN_50?: string;
  RZP_PLAN_100?: string;
  RZP_PLAN_500?: string;
  RZP_PLAN_1000?: string;
}

export const TIERS = [10, 50, 100, 500, 1000] as const;
export type Tier = (typeof TIERS)[number];

export interface SubscribeInput {
  name: string;
  email: string;
  mobile: string;
  pan: string;
  address: string;
  tier: Tier;
  consent: boolean;
  newsletter: boolean;
}

export interface Contributor {
  id: number;
  email: string;
  name: string;
  rzp_customer_id: string | null;
  rzp_subscription_id: string;
  status: string;
  newsletter_consent: number;
  unsubscribe_token: string;
  created_at: number;
  updated_at: number;
}

export interface NewContributor {
  email: string;
  name: string;
  rzp_subscription_id: string;
  newsletter_consent: number;
  unsubscribe_token: string;
  created_at: number;
  updated_at: number;
}

export interface WaitlistEntry {
  email: string;
  name: string;
  consent_at: number;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface WaitlistRow extends WaitlistEntry {
  id: number;
  exported_at: number | null;
  unsubscribed_at: number | null;
}

export interface MetricsSnapshot {
  total_contributors: number;
  active: number;
  monthly_inr: number;
  computed_at: number;
}

export interface Proposal {
  id: number;
  slug: string;
  title: string;
  body: string;
  options: string;
  opens_at: number;
  closes_at: number;
  created_at: number;
}

export interface ProposalOption {
  key: string;
  label: string;
}

export type ProposalState = "pending" | "open" | "closed";

export interface Ballot {
  id: number;
  proposal_id: number;
  rzp_subscription_id: string;
  choice: string;
  created_at: number;
}

export interface NewBallot {
  proposal_id: number;
  rzp_subscription_id: string;
  choice: string;
  created_at: number;
}

export interface VoteToken {
  token: string;
  email: string;
  proposal_id: number;
  expires_at: number;
  consumed_at: number | null;
}

export interface Repo {
  findByEmail(email: string): Promise<Contributor | null>;
  findBySubscriptionId(id: string): Promise<Contributor | null>;
  insertContributor(c: NewContributor): Promise<void>;
  updateStatusBySubscriptionId(
    id: string,
    status: string,
    customerId: string | null,
    updatedAt: number,
  ): Promise<void>;
  clearConsentByToken(token: string): Promise<boolean>;
  countByStatus(): Promise<{ total: number; active: number }>;
  recordEventOnce(eventId: string, receivedAt: number): Promise<boolean>;
  isEventProcessed(eventId: string): Promise<boolean>;
  getMetrics(): Promise<MetricsSnapshot | null>;
  setMetrics(snapshot: MetricsSnapshot): Promise<void>;
  addToWaitlist(entry: WaitlistEntry): Promise<void>;
  listPendingExport(limit: number): Promise<WaitlistRow[]>;
  markExported(ids: number[], exportedAt: number): Promise<number>;
  unsubscribeFromWaitlist(email: string, unsubscribedAt: number): Promise<boolean>;
  listProposals(): Promise<Proposal[]>;
  findProposalBySlug(slug: string): Promise<Proposal | null>;
  findProposalById(id: number): Promise<Proposal | null>;
  insertBallot(b: NewBallot): Promise<void>;
  tallyBallots(proposalId: number): Promise<Record<string, number>>;
  createVoteToken(t: VoteToken): Promise<void>;
  findVoteToken(token: string): Promise<VoteToken | null>;
  consumeVoteToken(token: string, consumedAt: number): Promise<boolean>;
}
