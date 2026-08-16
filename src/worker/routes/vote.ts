import { json } from "../lib/http.ts";
import { isValidEmail } from "../lib/validation.ts";
import { isEligible, parseOptions, proposalState } from "../lib/voting.ts";
import type { Repo } from "../types.ts";
import type { RazorpayClient } from "../lib/razorpay.ts";
import type { Mailer } from "../lib/newsletter.ts";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface VoteDeps {
  repo: Repo;
  razorpay: RazorpayClient;
  mailer: Mailer;
  now(): number;
  uuid(): string;
  testMode: boolean;
}

async function eligibleSubscription(deps: VoteDeps, email: string): Promise<string | null> {
  const contributor = await deps.repo.findByEmail(email);
  if (!contributor) return null;
  let sub;
  try {
    sub = await deps.razorpay.fetchSubscription(contributor.rzp_subscription_id);
  } catch {
    return null;
  }
  return isEligible(sub) ? contributor.rzp_subscription_id : null;
}

export async function handleProposals(deps: VoteDeps): Promise<Response> {
  const now = deps.now();
  const proposals = await deps.repo.listProposals();
  return json(
    200,
    proposals.map((p) => ({
      slug: p.slug,
      title: p.title,
      body: p.body,
      options: parseOptions(p.options),
      opens_at: p.opens_at,
      closes_at: p.closes_at,
      state: proposalState(p, now),
    })),
  );
}

export async function handleRequestLink(request: Request, deps: VoteDeps): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const slug = typeof b.proposal_slug === "string" ? b.proposal_slug.trim() : "";
  if (!isValidEmail(email) || slug.length === 0) return json(400, { error: "invalid_input" });

  const proposal = await deps.repo.findProposalBySlug(slug);
  let issued: string | null = null;
  if (proposal && proposalState(proposal, deps.now()) === "open") {
    const eligible = await eligibleSubscription(deps, email);
    if (eligible) {
      const token = deps.uuid();
      await deps.repo.createVoteToken({
        token,
        email,
        proposal_id: proposal.id,
        expires_at: deps.now() + TOKEN_TTL_MS,
        consumed_at: null,
      });
      const link = `${new URL(request.url).origin}/vote?token=${token}&p=${encodeURIComponent(slug)}`;
      await deps.mailer.sendMagicLink(email, link);
      issued = token;
    }
  }

  return json(200, deps.testMode && issued ? { ok: true, token: issued } : { ok: true });
}

export async function handleCast(request: Request, deps: VoteDeps): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token : "";
  const choice = typeof b.choice === "string" ? b.choice.trim() : "";
  if (token.length === 0 || choice.length === 0) return json(400, { error: "invalid_input" });

  const record = await deps.repo.findVoteToken(token);
  if (!record) return json(400, { error: "invalid_token" });
  if (record.consumed_at !== null) return json(409, { error: "already_voted" });
  if (deps.now() >= record.expires_at) return json(400, { error: "token_expired" });

  const proposal = await deps.repo.findProposalById(record.proposal_id);
  if (!proposal) return json(400, { error: "invalid_token" });
  if (proposalState(proposal, deps.now()) !== "open")
    return json(409, { error: "proposal_closed" });
  if (!parseOptions(proposal.options).some((o) => o.key === choice))
    return json(400, { error: "invalid_choice" });

  const subscriptionId = await eligibleSubscription(deps, record.email);
  if (!subscriptionId) return json(403, { error: "ineligible" });

  try {
    await deps.repo.insertBallot({
      proposal_id: proposal.id,
      rzp_subscription_id: subscriptionId,
      choice,
      created_at: deps.now(),
    });
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message))
      return json(409, { error: "already_voted" });
    return json(500, { error: "persist_failed" });
  }

  await deps.repo.consumeVoteToken(token, deps.now());
  return json(200, { ok: true });
}

export async function handleResults(slug: string, deps: VoteDeps): Promise<Response> {
  const proposal = await deps.repo.findProposalBySlug(slug);
  if (!proposal) return json(404, { error: "not_found" });
  if (proposalState(proposal, deps.now()) !== "closed") return json(409, { closed: false });
  const tallies = await deps.repo.tallyBallots(proposal.id);
  return json(200, { closed: true, tallies });
}
