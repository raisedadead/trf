import { describe, expect, it } from "vitest";
import { handleSubscribe, type SubscribeDeps } from "./subscribe.ts";
import {
  makeContributor,
  makeRazorpay,
  makeRepo,
  type FakeRazorpay,
  type FakeRepo,
} from "../testkit.ts";

const valid = {
  name: "Asha",
  email: "asha@example.com",
  mobile: "+91 98765 43210",
  pan: "ABCDE1234F",
  address: "MG Road, Bengaluru",
  tier: 100,
  consent: true,
  newsletter: true,
};

function req(body: unknown): Request {
  return new Request("https://rupeefund.org/api/subscribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function deps(repo: FakeRepo, razorpay: FakeRazorpay): SubscribeDeps {
  return {
    repo,
    razorpay,
    planFor: (t) => `plan_${t}`,
    keyId: "rzp_test_fake",
    now: () => 1000,
    uuid: () => "tok_1",
  };
}

describe("handleSubscribe", () => {
  it("creates a rupee-fund-tagged subscription and a contributor (no PAN stored)", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay();
    const res = await handleSubscribe(req(valid), deps(repo, razorpay));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      subscription_id: "sub_test_1",
      key_id: "rzp_test_fake",
      short_url: "https://rzp.io/test",
    });
    expect(razorpay.created[0].plan_id).toBe("plan_100");
    expect(razorpay.created[0].notes).toEqual({
      program: "rupee-fund",
      pan: "ABCDE1234F",
      address: "MG Road, Bengaluru",
    });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].email).toBe("asha@example.com");
    expect(repo.rows[0].newsletter_consent).toBe(1);
    expect(Object.keys(repo.rows[0])).not.toContain("pan");
  });

  it("rejects invalid input without calling Razorpay or writing the DB", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay();
    const res = await handleSubscribe(req({ ...valid, email: "nope" }), deps(repo, razorpay));

    expect(res.status).toBe(400);
    expect(razorpay.created).toHaveLength(0);
    expect(repo.rows).toHaveLength(0);
  });

  it("rejects re-subscribe with 409 when the existing mandate is already active", async () => {
    const repo = makeRepo([makeContributor({ email: "asha@example.com" })]);
    const razorpay = makeRazorpay({ fetchStatus: "active" });
    const res = await handleSubscribe(req(valid), deps(repo, razorpay));

    expect(res.status).toBe(409);
    expect(razorpay.created).toHaveLength(0);
  });

  it("resumes the same mandate (200) when an unauthorized contributor re-subscribes", async () => {
    const repo = makeRepo([
      makeContributor({ email: "asha@example.com", rzp_subscription_id: "sub_prev" }),
    ]);
    const razorpay = makeRazorpay({ fetchStatus: "created" });
    const res = await handleSubscribe(req(valid), deps(repo, razorpay));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      subscription_id: "sub_prev",
      key_id: "rzp_test_fake",
      short_url: "https://rzp.io/test",
    });
    expect(razorpay.created).toHaveLength(0);
    expect(repo.rows).toHaveLength(1);
  });

  it("returns 502 when fetching the existing subscription fails on re-subscribe", async () => {
    const repo = makeRepo([makeContributor({ email: "asha@example.com" })]);
    const razorpay = makeRazorpay({ fetchFail: true });
    const res = await handleSubscribe(req(valid), deps(repo, razorpay));

    expect(res.status).toBe(502);
  });

  it("returns 502 and writes nothing when Razorpay fails", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay({ fail: true });
    const res = await handleSubscribe(req(valid), deps(repo, razorpay));

    expect(res.status).toBe(502);
    expect(repo.rows).toHaveLength(0);
  });

  it("returns 409 (not 500) when the contributor insert hits a unique violation", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay();
    await handleSubscribe(req(valid), deps(repo, razorpay));
    const res = await handleSubscribe(
      req({ ...valid, email: "asha2@example.com" }),
      deps(repo, razorpay),
    );

    expect(res.status).toBe(409);
    expect(repo.rows).toHaveLength(1);
  });

  it("returns 400 invalid_json for a non-JSON body", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay();
    const bad = new Request("https://rupeefund.org/api/subscribe", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await handleSubscribe(bad, deps(repo, razorpay));

    expect(res.status).toBe(400);
    expect(razorpay.created).toHaveLength(0);
  });

  it("returns 500 persist_failed on a non-unique insert error", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay();
    repo.insertContributor = async () => {
      throw new Error("d1 transient");
    };
    const res = await handleSubscribe(req(valid), deps(repo, razorpay));

    expect(res.status).toBe(500);
  });

  it("stores newsletter_consent 0 when newsletter is false", async () => {
    const repo = makeRepo();
    const razorpay = makeRazorpay();
    await handleSubscribe(req({ ...valid, newsletter: false }), deps(repo, razorpay));

    expect(repo.rows[0].newsletter_consent).toBe(0);
  });
});
