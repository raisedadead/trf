import { json } from "../lib/http.ts";
import { validateSubscribe } from "../lib/validation.ts";
import type { Repo, Tier } from "../types.ts";
import type { RazorpayClient } from "../lib/razorpay.ts";

export interface SubscribeDeps {
  repo: Repo;
  razorpay: RazorpayClient;
  planFor(tier: Tier): string;
  keyId: string;
  now(): number;
  uuid(): string;
}

export async function handleSubscribe(request: Request, deps: SubscribeDeps): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const result = validateSubscribe(body);
  if (!result.ok) return json(400, { error: "invalid_input", fields: result.errors });
  const input = result.value;

  const existing = await deps.repo.findByEmail(input.email);
  if (existing) {
    let sub;
    try {
      sub = await deps.razorpay.fetchSubscription(existing.rzp_subscription_id);
    } catch {
      return json(502, { error: "razorpay_unavailable" });
    }
    if (sub.status === "created")
      return json(200, { subscription_id: sub.id, key_id: deps.keyId, short_url: sub.short_url });
    return json(409, { error: "already_subscribed" });
  }

  let subscriptionId: string;
  let shortUrl: string;
  try {
    const sub = await deps.razorpay.createSubscription({
      plan_id: deps.planFor(input.tier),
      total_count: 120,
      customer_notify: 1,
      notes: { program: "rupee-fund", pan: input.pan, address: input.address },
    });
    subscriptionId = sub.id;
    shortUrl = sub.short_url;
  } catch {
    return json(502, { error: "razorpay_unavailable" });
  }

  const ts = deps.now();
  try {
    await deps.repo.insertContributor({
      email: input.email,
      name: input.name,
      rzp_subscription_id: subscriptionId,
      newsletter_consent: input.newsletter ? 1 : 0,
      unsubscribe_token: deps.uuid(),
      created_at: ts,
      updated_at: ts,
    });
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message))
      return json(409, { error: "already_subscribed" });
    return json(500, { error: "persist_failed" });
  }

  return json(200, { subscription_id: subscriptionId, key_id: deps.keyId, short_url: shortUrl });
}
