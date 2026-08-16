import { describe, expect, it } from "vitest";
import { handleVerifySubscription } from "./verify.ts";
import { hmacHex } from "../testkit.ts";

const SECRET = "test_secret";

function req(body: unknown): Request {
  return new Request("https://rupeefund.org/api/subscribe/verify", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("handleVerifySubscription", () => {
  it("accepts a signature computed over payment_id|subscription_id", async () => {
    const sig = await hmacHex("pay_1|sub_1", SECRET);
    const res = await handleVerifySubscription(
      req({
        razorpay_payment_id: "pay_1",
        razorpay_subscription_id: "sub_1",
        razorpay_signature: sig,
      }),
      { keySecret: SECRET },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects a forged signature with 400 invalid_signature", async () => {
    const res = await handleVerifySubscription(
      req({
        razorpay_payment_id: "pay_1",
        razorpay_subscription_id: "sub_1",
        razorpay_signature: "0".repeat(64),
      }),
      { keySecret: SECRET },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_signature" });
  });

  it("rejects a signature over the reversed message (order matters)", async () => {
    const sig = await hmacHex("sub_1|pay_1", SECRET);
    const res = await handleVerifySubscription(
      req({
        razorpay_payment_id: "pay_1",
        razorpay_subscription_id: "sub_1",
        razorpay_signature: sig,
      }),
      { keySecret: SECRET },
    );

    expect(res.status).toBe(400);
  });

  it("rejects missing fields with invalid_input", async () => {
    const res = await handleVerifySubscription(req({ razorpay_payment_id: "pay_1" }), {
      keySecret: SECRET,
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("rejects a non-JSON body with invalid_json", async () => {
    const res = await handleVerifySubscription(req("{bad"), { keySecret: SECRET });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });
});
