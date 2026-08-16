import { json } from "../lib/http.ts";
import { verifyPaymentSignature } from "../lib/signature.ts";

export interface VerifyDeps {
  keySecret: string;
}

export async function handleVerifySubscription(
  request: Request,
  deps: VerifyDeps,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const paymentId = b.razorpay_payment_id;
  const subscriptionId = b.razorpay_subscription_id;
  const signature = b.razorpay_signature;
  if (
    typeof paymentId !== "string" ||
    typeof subscriptionId !== "string" ||
    typeof signature !== "string"
  )
    return json(400, { error: "invalid_input" });

  const ok = await verifyPaymentSignature(paymentId, subscriptionId, signature, deps.keySecret);
  if (!ok) return json(400, { error: "invalid_signature" });
  return json(200, { ok: true });
}
