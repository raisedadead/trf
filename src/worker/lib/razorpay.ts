export interface CreateSubscriptionInput {
  plan_id: string;
  total_count: number;
  customer_notify: 0 | 1;
  notes: Record<string, string>;
}

export interface RazorpaySubscription {
  id: string;
  short_url: string;
  status: string;
  plan_id: string;
  customer_id: string | null;
  paid_count: number;
  notes: Record<string, string>;
}

export interface SubscriptionList {
  count: number;
  items: RazorpaySubscription[];
}

export interface RazorpayClient {
  createSubscription(input: CreateSubscriptionInput): Promise<RazorpaySubscription>;
  fetchSubscription(id: string): Promise<RazorpaySubscription>;
  listSubscriptions(skip: number, count: number): Promise<SubscriptionList>;
}

const BASE = "https://api.razorpay.com/v1";

export class RazorpayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

export function createRazorpay(
  keyId: string,
  keySecret: string,
  fetchImpl: typeof fetch = fetch,
): RazorpayClient {
  const auth = `Basic ${btoa(`${keyId}:${keySecret}`)}`;

  async function call(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetchImpl(`${BASE}${path}`, {
      ...init,
      headers: {
        authorization: auth,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new RazorpayError(res.status, `razorpay ${path} → ${res.status}`);
    return res.json();
  }

  return {
    async createSubscription(input) {
      return (await call("/subscriptions", {
        method: "POST",
        body: JSON.stringify(input),
      })) as RazorpaySubscription;
    },
    async fetchSubscription(id) {
      return (await call(`/subscriptions/${id}`)) as RazorpaySubscription;
    },
    async listSubscriptions(skip, count) {
      return (await call(`/subscriptions?skip=${skip}&count=${count}`)) as SubscriptionList;
    },
  };
}
