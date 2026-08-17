import { describe, expect, it } from "vitest";
import { handleWebhook, type WebhookDeps } from "./webhook.ts";
import {
  hmacHex,
  makeContributor,
  makeMailer,
  makeRepo,
  type FakeMailer,
  type FakeRepo,
} from "../testkit.ts";

const secret = "whsec_test";

function event(
  entity: { id: string; status: string; customer_id?: string | null },
  name = "subscription.charged",
): string {
  return JSON.stringify({
    event: name,
    payload: { subscription: { entity: { customer_id: null, ...entity } } },
  });
}

async function req(
  raw: string,
  opts?: { sig?: string; eventId?: string | null },
): Promise<Request> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-razorpay-signature": opts?.sig ?? (await hmacHex(raw, secret)),
  };
  const eventId = opts?.eventId === undefined ? "evt_1" : opts.eventId;
  if (eventId !== null) headers["x-razorpay-event-id"] = eventId;
  return new Request("https://rupeefund.org/api/webhook/razorpay", {
    method: "POST",
    body: raw,
    headers,
  });
}

function deps(repo: FakeRepo, mailer: FakeMailer): WebhookDeps {
  return {
    repo,
    webhookSecret: secret,
    mailer,
    now: () => 1000,
    waitUntil: (p) => {
      void p;
    },
  };
}

describe("handleWebhook", () => {
  it("verifies the signature and caches the subscription status", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", status: "created" }),
    ]);
    const raw = event({ id: "sub_test_1", status: "active", customer_id: "cust_9" });
    const res = await handleWebhook(await req(raw), deps(repo, makeMailer()));

    expect(res.status).toBe(200);
    expect(repo.rows[0].status).toBe("active");
    expect(repo.rows[0].rzp_customer_id).toBe("cust_9");
  });

  it("rejects a bad signature with 400 and writes nothing", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", status: "created" }),
    ]);
    const raw = event({ id: "sub_test_1", status: "active" });
    const res = await handleWebhook(
      await req(raw, { sig: "0".repeat(64) }),
      deps(repo, makeMailer()),
    );

    expect(res.status).toBe(400);
    expect(repo.rows[0].status).toBe("created");
  });

  it("rejects a missing event id with 400", async () => {
    const repo = makeRepo();
    const raw = event({ id: "sub_test_1", status: "active" });
    const res = await handleWebhook(await req(raw, { eventId: null }), deps(repo, makeMailer()));

    expect(res.status).toBe(400);
  });

  it("applies a duplicate event only once", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", status: "created" }),
    ]);
    const mailer = makeMailer();
    await handleWebhook(
      await req(event({ id: "sub_test_1", status: "active" })),
      deps(repo, mailer),
    );
    await handleWebhook(
      await req(event({ id: "sub_test_1", status: "halted" })),
      deps(repo, mailer),
    );

    expect(repo.rows[0].status).toBe("active");
  });

  it("sends a welcome email on activation when the contributor consented", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", newsletter_consent: 1 }),
    ]);
    const mailer = makeMailer();
    const raw = event({ id: "sub_test_1", status: "active" }, "subscription.activated");
    await handleWebhook(await req(raw), deps(repo, mailer));

    expect(mailer.sent).toEqual([{ email: "asha@example.com", name: "Asha" }]);
  });

  it("does not mark the event processed if the status update fails, so a retry reprocesses", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", status: "created" }),
    ]);
    let failNext = true;
    const realUpdate = repo.updateStatusBySubscriptionId;
    repo.updateStatusBySubscriptionId = async (...args) => {
      if (failNext) throw new Error("d1 transient");
      return realUpdate(...args);
    };
    const raw = event({ id: "sub_test_1", status: "active" });

    await expect(handleWebhook(await req(raw), deps(repo, makeMailer()))).rejects.toThrow(
      "d1 transient",
    );
    expect(repo.events.has("evt_1")).toBe(false);

    failNext = false;
    const res = await handleWebhook(await req(raw), deps(repo, makeMailer()));

    expect(res.status).toBe(200);
    expect(repo.rows[0].status).toBe("active");
    expect(repo.events.has("evt_1")).toBe(true);
  });

  it("does not re-send the welcome email on a duplicate activated delivery", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", newsletter_consent: 1 }),
    ]);
    const mailer = makeMailer();
    const raw = event({ id: "sub_test_1", status: "active" }, "subscription.activated");
    await handleWebhook(await req(raw), deps(repo, mailer));
    await handleWebhook(await req(raw), deps(repo, mailer));

    expect(mailer.sent).toEqual([{ email: "asha@example.com", name: "Asha" }]);
  });

  it("skips the welcome email when the contributor did not consent", async () => {
    const repo = makeRepo([
      makeContributor({ rzp_subscription_id: "sub_test_1", newsletter_consent: 0 }),
    ]);
    const mailer = makeMailer();
    const raw = event({ id: "sub_test_1", status: "active" }, "subscription.activated");
    await handleWebhook(await req(raw), deps(repo, mailer));

    expect(mailer.sent).toEqual([]);
  });
});
