import { describe, expect, it } from "vitest";
import {
  handleCast,
  handleProposals,
  handleRequestLink,
  handleResults,
  type VoteDeps,
} from "./vote.ts";
import {
  makeContributor,
  makeMailer,
  makeProposal,
  makeRazorpay,
  makeRepo,
  type FakeMailer,
  type FakeRazorpay,
  type FakeRepo,
} from "../testkit.ts";
import type { Proposal } from "../types.ts";

const NOW = 1000;

function deps(
  repo: FakeRepo,
  razorpay: FakeRazorpay,
  mailer: FakeMailer,
  over: Partial<VoteDeps> = {},
): VoteDeps {
  return {
    repo,
    razorpay,
    mailer,
    now: () => NOW,
    uuid: () => "vtok_1",
    testMode: true,
    ...over,
  };
}

function openProposal(over: Partial<Proposal> = {}): Proposal {
  return makeProposal({ id: 1, slug: "season-1", opens_at: 0, closes_at: 2000, ...over });
}

function reqLink(body: unknown): Request {
  return new Request("https://rupeefund.org/api/vote/request-link", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function reqCast(body: unknown): Request {
  return new Request("https://rupeefund.org/api/vote/cast", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("handleRequestLink", () => {
  it("issues + emails a token to an eligible member on an open proposal", async () => {
    const repo = makeRepo([makeContributor()], [openProposal()]);
    const mailer = makeMailer();
    const res = await handleRequestLink(
      reqLink({ email: "asha@example.com", proposal_slug: "season-1" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), mailer),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, token: "vtok_1" });
    expect(repo.voteTokens).toHaveLength(1);
    expect(repo.voteTokens[0]).toMatchObject({ email: "asha@example.com", proposal_id: 1 });
    expect(mailer.magicLinks).toHaveLength(1);
    expect(mailer.magicLinks[0].link).toBe("https://rupeefund.org/vote?token=vtok_1&p=season-1");
  });

  it("returns a generic ok without a token for a non-member (no enumeration)", async () => {
    const repo = makeRepo([], [openProposal()]);
    const mailer = makeMailer();
    const res = await handleRequestLink(
      reqLink({ email: "ghost@example.com", proposal_slug: "season-1" }),
      deps(repo, makeRazorpay(), mailer),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.voteTokens).toHaveLength(0);
    expect(mailer.magicLinks).toHaveLength(0);
  });

  it("returns a generic ok without a token for an ineligible member", async () => {
    const repo = makeRepo([makeContributor()], [openProposal()]);
    const mailer = makeMailer();
    const res = await handleRequestLink(
      reqLink({ email: "asha@example.com", proposal_slug: "season-1" }),
      deps(repo, makeRazorpay({ paidCount: 3 }), mailer),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.voteTokens).toHaveLength(0);
  });

  it("returns a generic ok without a token when the proposal is not open", async () => {
    const repo = makeRepo([makeContributor()], [openProposal({ closes_at: 500 })]);
    const mailer = makeMailer();
    const res = await handleRequestLink(
      reqLink({ email: "asha@example.com", proposal_slug: "season-1" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), mailer),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.voteTokens).toHaveLength(0);
  });

  it("returns a generic ok without a token for an unknown proposal slug", async () => {
    const repo = makeRepo([makeContributor()], [openProposal()]);
    const res = await handleRequestLink(
      reqLink({ email: "asha@example.com", proposal_slug: "nope" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.voteTokens).toHaveLength(0);
  });

  it("rejects a malformed email with 400", async () => {
    const repo = makeRepo([makeContributor()], [openProposal()]);
    const res = await handleRequestLink(
      reqLink({ email: "nope", proposal_slug: "season-1" }),
      deps(repo, makeRazorpay(), makeMailer()),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-JSON body with 400", async () => {
    const repo = makeRepo([makeContributor()], [openProposal()]);
    const bad = new Request("https://rupeefund.org/api/vote/request-link", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await handleRequestLink(bad, deps(repo, makeRazorpay(), makeMailer()));
    expect(res.status).toBe(400);
  });
});

describe("handleCast", () => {
  function seededRepo(tokenOver = {}, proposalOver = {}) {
    const repo = makeRepo([makeContributor()], [openProposal(proposalOver)]);
    repo.voteTokens.push({
      token: "vtok_1",
      email: "asha@example.com",
      proposal_id: 1,
      expires_at: NOW + 100,
      consumed_at: null,
      ...tokenOver,
    });
    return repo;
  }

  it("records a ballot, consumes the token, returns ok", async () => {
    const repo = seededRepo();
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(repo.ballots).toHaveLength(1);
    expect(repo.ballots[0]).toMatchObject({
      proposal_id: 1,
      rzp_subscription_id: "sub_test_1",
      choice: "project-a",
    });
    expect(repo.voteTokens[0].consumed_at).toBe(NOW);
  });

  it("rejects a reused (consumed) token with 409", async () => {
    const repo = seededRepo({ consumed_at: 500 });
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(409);
    expect(repo.ballots).toHaveLength(0);
  });

  it("rejects a second ballot from the same subscription with 409 (UNIQUE)", async () => {
    const repo = seededRepo();
    repo.ballots.push({
      id: 1,
      proposal_id: 1,
      rzp_subscription_id: "sub_test_1",
      choice: "project-b",
      created_at: 1,
    });
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(409);
    expect(repo.ballots).toHaveLength(1);
  });

  it("rejects an unknown token with 400", async () => {
    const repo = seededRepo();
    const res = await handleCast(
      reqCast({ token: "nope", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an expired token with 400", async () => {
    const repo = seededRepo({ expires_at: NOW - 1 });
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(400);
    expect(repo.ballots).toHaveLength(0);
  });

  it("rejects casting on a closed proposal with 409", async () => {
    const repo = seededRepo({}, { closes_at: 500 });
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(409);
    expect(repo.ballots).toHaveLength(0);
  });

  it("rejects an ineligible voter at cast time with 403", async () => {
    const repo = seededRepo();
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "project-a" }),
      deps(repo, makeRazorpay({ paidCount: 2 }), makeMailer()),
    );
    expect(res.status).toBe(403);
    expect(repo.ballots).toHaveLength(0);
    expect(repo.voteTokens[0].consumed_at).toBeNull();
  });

  it("rejects a missing choice with 400", async () => {
    const repo = seededRepo();
    const res = await handleCast(
      reqCast({ token: "vtok_1" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a choice not in the proposal's options with 400", async () => {
    const repo = seededRepo();
    const res = await handleCast(
      reqCast({ token: "vtok_1", choice: "write-in" }),
      deps(repo, makeRazorpay({ paidCount: 12 }), makeMailer()),
    );
    expect(res.status).toBe(400);
    expect(repo.ballots).toHaveLength(0);
    expect(repo.voteTokens[0].consumed_at).toBeNull();
  });
});

describe("handleResults", () => {
  it("returns tallies after the proposal closes", async () => {
    const repo = makeRepo([], [openProposal({ closes_at: 500 })]);
    repo.ballots.push(
      { id: 1, proposal_id: 1, rzp_subscription_id: "s1", choice: "a", created_at: 1 },
      { id: 2, proposal_id: 1, rzp_subscription_id: "s2", choice: "a", created_at: 1 },
      { id: 3, proposal_id: 1, rzp_subscription_id: "s3", choice: "b", created_at: 1 },
    );
    const res = await handleResults("season-1", deps(repo, makeRazorpay(), makeMailer()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ closed: true, tallies: { a: 2, b: 1 } });
  });

  it("hides tallies while the proposal is open (409)", async () => {
    const repo = makeRepo([], [openProposal()]);
    const res = await handleResults("season-1", deps(repo, makeRazorpay(), makeMailer()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ closed: false });
  });

  it("returns 404 for an unknown proposal", async () => {
    const repo = makeRepo([], []);
    const res = await handleResults("nope", deps(repo, makeRazorpay(), makeMailer()));
    expect(res.status).toBe(404);
  });
});

describe("handleProposals", () => {
  it("lists proposals with derived state", async () => {
    const repo = makeRepo(
      [],
      [
        openProposal({ id: 1, slug: "open-one", opens_at: 0, closes_at: 2000 }),
        openProposal({ id: 2, slug: "closed-one", opens_at: 0, closes_at: 500 }),
        openProposal({ id: 3, slug: "pending-one", opens_at: 5000, closes_at: 9000 }),
      ],
    );
    const res = await handleProposals(deps(repo, makeRazorpay(), makeMailer()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ slug: string; state: string }>;
    const byslug = Object.fromEntries(body.map((p) => [p.slug, p.state]));
    expect(byslug).toEqual({
      "open-one": "open",
      "closed-one": "closed",
      "pending-one": "pending",
    });
  });
});
