import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./signature.ts";
import { hmacHex } from "../testkit.ts";

const secret = "whsec_test";
const body = JSON.stringify({ event: "subscription.charged", id: "evt_1" });

describe("verifyWebhookSignature", () => {
  it("accepts a correct signature over the raw body", async () => {
    expect(await verifyWebhookSignature(body, await hmacHex(body, secret), secret)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const sig = await hmacHex(body, secret);
    expect(await verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    expect(await verifyWebhookSignature(body, await hmacHex(body, "other"), secret)).toBe(false);
  });

  it("rejects a malformed (non 64-hex) signature without throwing", async () => {
    expect(await verifyWebhookSignature(body, "deadbeef", secret)).toBe(false);
    expect(await verifyWebhookSignature(body, "", secret)).toBe(false);
  });
});
