import { describe, expect, it } from "vitest";
import { proposalState } from "./voting.ts";
import { makeRepo } from "../testkit.ts";

describe("proposalState", () => {
  const p = { opens_at: 100, closes_at: 200 };
  it("pending strictly before opens_at", () => expect(proposalState(p, 50)).toBe("pending"));
  it("open at opens_at boundary", () => expect(proposalState(p, 100)).toBe("open"));
  it("open mid-window", () => expect(proposalState(p, 150)).toBe("open"));
  it("closed at closes_at boundary", () => expect(proposalState(p, 200)).toBe("closed"));
  it("closed after closes_at", () => expect(proposalState(p, 250)).toBe("closed"));
});

describe("ballot repo — one vote per subscription per proposal", () => {
  it("rejects a second ballot from the same subscription on the same proposal", async () => {
    const repo = makeRepo();
    await repo.insertBallot({
      proposal_id: 1,
      rzp_subscription_id: "sub_1",
      choice: "a",
      created_at: 1,
    });
    await expect(
      repo.insertBallot({
        proposal_id: 1,
        rzp_subscription_id: "sub_1",
        choice: "b",
        created_at: 2,
      }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("allows the same subscription to vote on a different proposal", async () => {
    const repo = makeRepo();
    await repo.insertBallot({
      proposal_id: 1,
      rzp_subscription_id: "sub_1",
      choice: "a",
      created_at: 1,
    });
    await expect(
      repo.insertBallot({
        proposal_id: 2,
        rzp_subscription_id: "sub_1",
        choice: "a",
        created_at: 2,
      }),
    ).resolves.toBeUndefined();
  });

  it("tallies choices scoped to a proposal", async () => {
    const repo = makeRepo();
    await repo.insertBallot({
      proposal_id: 1,
      rzp_subscription_id: "s1",
      choice: "yes",
      created_at: 1,
    });
    await repo.insertBallot({
      proposal_id: 1,
      rzp_subscription_id: "s2",
      choice: "yes",
      created_at: 1,
    });
    await repo.insertBallot({
      proposal_id: 1,
      rzp_subscription_id: "s3",
      choice: "no",
      created_at: 1,
    });
    await repo.insertBallot({
      proposal_id: 2,
      rzp_subscription_id: "s1",
      choice: "no",
      created_at: 1,
    });
    expect(await repo.tallyBallots(1)).toEqual({ yes: 2, no: 1 });
  });
});

describe("vote tokens — single use", () => {
  it("issues, finds, and consumes a token exactly once", async () => {
    const repo = makeRepo();
    await repo.createVoteToken({
      token: "t1",
      email: "a@b.com",
      proposal_id: 1,
      expires_at: 10,
      consumed_at: null,
    });
    expect((await repo.findVoteToken("t1"))?.email).toBe("a@b.com");
    expect(await repo.consumeVoteToken("t1", 5)).toBe(true);
    expect(await repo.consumeVoteToken("t1", 6)).toBe(false);
    expect((await repo.findVoteToken("t1"))?.consumed_at).toBe(5);
  });

  it("returns null for an unknown token", async () => {
    const repo = makeRepo();
    expect(await repo.findVoteToken("nope")).toBeNull();
  });
});
