import { Hono } from "hono";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { createRepo } from "./lib/db.ts";
import { createRazorpay } from "./lib/razorpay.ts";
import { createMailer } from "./lib/newsletter.ts";
import { createTurnstile, parseHostnames } from "./lib/turnstile.ts";
import { handleSubscribe } from "./routes/subscribe.ts";
import { handleVerifySubscription } from "./routes/verify.ts";
import { handleWebhook } from "./routes/webhook.ts";
import { handleWaitlist, type WaitlistLimiter } from "./routes/waitlist.ts";
import { handleDataset, handleMetrics, refreshMetrics } from "./routes/metrics.ts";
import {
  handleCast,
  handleProposals,
  handleRequestLink,
  handleResults,
  type VoteDeps,
} from "./routes/vote.ts";
import { GATE_HEADER, TIERS, type Env, type Tier } from "./types.ts";

export function isPostLaunchEnabled(env: Env): boolean {
  return env.POST_LAUNCH_ENABLED === "true";
}

function requireSecret(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0)
    throw new Error(`missing required post-launch secret: ${name}`);
  return value;
}

function planMap(env: Env): Record<Tier, string> {
  return {
    10: requireSecret(env.RZP_PLAN_10, "RZP_PLAN_10"),
    50: requireSecret(env.RZP_PLAN_50, "RZP_PLAN_50"),
    100: requireSecret(env.RZP_PLAN_100, "RZP_PLAN_100"),
    500: requireSecret(env.RZP_PLAN_500, "RZP_PLAN_500"),
    1000: requireSecret(env.RZP_PLAN_1000, "RZP_PLAN_1000"),
  };
}

function razorpayFor(env: Env) {
  return createRazorpay(
    requireSecret(env.RAZORPAY_KEY_ID, "RAZORPAY_KEY_ID"),
    requireSecret(env.RAZORPAY_KEY_SECRET, "RAZORPAY_KEY_SECRET"),
  );
}

function amountForPlan(env: Env, planId: string): Tier | null {
  const map = planMap(env);
  for (const tier of TIERS) if (map[tier] === planId) return tier;
  return null;
}

function metricsDeps(env: Env) {
  return {
    repo: createRepo(env.DB),
    razorpay: razorpayFor(env),
    amountForPlan: (p: string) => amountForPlan(env, p),
    now: () => Date.now(),
  };
}

function voteDeps(env: Env): VoteDeps {
  return {
    repo: createRepo(env.DB),
    razorpay: razorpayFor(env),
    mailer: createMailer(),
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
    testMode: requireSecret(env.RAZORPAY_KEY_ID, "RAZORPAY_KEY_ID").startsWith("rzp_test_"),
  };
}

export const app = new Hono<{ Bindings: Env }>();

const POST_LAUNCH_PATHS = [
  "/api/subscribe",
  "/api/subscribe/*",
  "/api/webhook/*",
  "/api/unsubscribe",
  "/api/metrics",
  "/api/dataset",
  "/api/vote/*",
] as const;

for (const path of POST_LAUNCH_PATHS) {
  app.all(path, async (c, next) => {
    if (!isPostLaunchEnabled(c.env)) {
      return c.json({ error: "not_found" }, 404, { [GATE_HEADER]: "closed" });
    }
    await next();
  });
}

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/subscribe", (c) => {
  const env = c.env;
  const map = planMap(env);
  return handleSubscribe(c.req.raw, {
    repo: createRepo(env.DB),
    razorpay: razorpayFor(env),
    planFor: (t) => map[t],
    keyId: requireSecret(env.RAZORPAY_KEY_ID, "RAZORPAY_KEY_ID"),
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
  });
});

app.post("/api/subscribe/verify", (c) =>
  handleVerifySubscription(c.req.raw, {
    keySecret: requireSecret(c.env.RAZORPAY_KEY_SECRET, "RAZORPAY_KEY_SECRET"),
  }),
);

app.post("/api/webhook/razorpay", (c) =>
  handleWebhook(c.req.raw, {
    repo: createRepo(c.env.DB),
    webhookSecret: requireSecret(c.env.RAZORPAY_WEBHOOK_SECRET, "RAZORPAY_WEBHOOK_SECRET"),
    mailer: createMailer(),
    now: () => Date.now(),
    waitUntil: (p) => c.executionCtx.waitUntil(p),
  }),
);

const DENY_ALL_LIMITER: WaitlistLimiter = {
  limit: async () => ({ success: false }),
};

app.post("/api/waitlist", (c) =>
  handleWaitlist(c.req.raw, {
    repo: createRepo(c.env.DB),
    now: () => Date.now(),
    limiter: c.env.SIGNUP_LIMITER ?? DENY_ALL_LIMITER,
    verifyToken: createTurnstile(c.env.TURNSTILE_SECRET ?? "", {
      hostnames: parseHostnames(c.env.TURNSTILE_HOSTNAMES),
      action: c.env.TURNSTILE_ACTION ?? "",
    }),
    log: (event) => console.error(JSON.stringify(event)),
  }),
);

app.get("/api/unsubscribe", async (c) => {
  await createRepo(c.env.DB).clearConsentByToken(c.req.query("token") ?? "");
  return c.text("You have been unsubscribed from The Rupee Fund updates.");
});

app.get("/api/metrics", (c) => handleMetrics(metricsDeps(c.env)));
app.get("/api/dataset", (c) => handleDataset(metricsDeps(c.env)));

app.get("/api/vote/proposals", (c) => handleProposals(voteDeps(c.env)));
app.post("/api/vote/request-link", (c) => handleRequestLink(c.req.raw, voteDeps(c.env)));
app.post("/api/vote/cast", (c) => handleCast(c.req.raw, voteDeps(c.env)));
app.get("/api/vote/results/:slug", (c) => handleResults(c.req.param("slug"), voteDeps(c.env)));

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

const POST_LAUNCH_ROBOTS = "User-agent: *\nDisallow: /\n";

app.get("/robots.txt", async (c, next) => {
  if (!isPostLaunchEnabled(c.env)) return next();
  return c.text(POST_LAUNCH_ROBOTS, 200, { "x-robots-tag": "noindex, nofollow" });
});

const POST_LAUNCH_PAGES: readonly string[] = ["/vote", "/manage", "/thank-you"];

export function isPostLaunchPage(pathname: string): boolean {
  const trimmed = pathname.length > 1 ? pathname.replace(/[/.]+$/, "") : pathname;
  const withoutExt = trimmed.endsWith(".html") ? trimmed.slice(0, -5) : trimmed;
  return POST_LAUNCH_PAGES.includes(withoutExt);
}

app.all("*", async (c, next) => {
  if (isPostLaunchEnabled(c.env) || !isPostLaunchPage(new URL(c.req.url).pathname)) return next();
  const notFound = await c.env.ASSETS.fetch(new URL("/404.html", c.req.url));
  const headers = new Headers();
  notFound.headers.forEach((value, key) => headers.set(key, value));
  return new Response(notFound.body as BodyInit | null, { status: 404, headers });
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (!isPostLaunchEnabled(env)) return;
    ctx.waitUntil(refreshMetrics(metricsDeps(env)));
  },
};
