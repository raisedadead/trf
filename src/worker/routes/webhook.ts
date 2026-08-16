import { text } from "../lib/http.ts";
import { verifyWebhookSignature } from "../lib/signature.ts";
import type { Repo } from "../types.ts";
import type { Mailer } from "../lib/newsletter.ts";

interface SubscriptionEntity {
  id: string;
  status: string;
  customer_id: string | null;
}

interface WebhookPayload {
  event: string;
  payload?: { subscription?: { entity?: SubscriptionEntity } };
}

export interface WebhookDeps {
  repo: Repo;
  webhookSecret: string;
  mailer: Mailer;
  now(): number;
  waitUntil(p: Promise<unknown>): void;
}

export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!(await verifyWebhookSignature(raw, signature, deps.webhookSecret)))
    return text(400, "invalid signature");

  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  if (eventId.length === 0) return text(400, "missing event id");

  if (await deps.repo.isEventProcessed(eventId)) return text(200, "ok");

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return text(400, "invalid json");
  }

  const entity = payload.payload?.subscription?.entity;
  if (entity)
    await deps.repo.updateStatusBySubscriptionId(
      entity.id,
      entity.status,
      entity.customer_id ?? null,
      deps.now(),
    );

  const fresh = await deps.repo.recordEventOnce(eventId, deps.now());

  if (fresh && entity && payload.event === "subscription.activated") {
    const contributor = await deps.repo.findBySubscriptionId(entity.id);
    if (contributor && contributor.newsletter_consent === 1)
      deps.waitUntil(deps.mailer.sendWelcome(contributor.email, contributor.name));
  }

  return text(200, "ok");
}
