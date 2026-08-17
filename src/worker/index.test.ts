import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";
import worker, { app } from "./index.ts";
import { makeD1 } from "./testkit.ts";
import { GATE_HEADER, type Env } from "./types.ts";

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    DB: makeD1(),
    ASSETS: {
      fetch: async (input: Request | URL) => {
        const { pathname } = input instanceof URL ? input : new URL(input.url);
        return new Response(`<html>asset:${pathname}</html>`, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-frame-options": "DENY",
            "x-content-type-options": "nosniff",
            "strict-transport-security": "max-age=63072000",
            "referrer-policy": "strict-origin-when-cross-origin",
          },
        });
      },
    } as unknown as Env["ASSETS"],
    RAZORPAY_KEY_ID: "rzp_test_abc",
    RAZORPAY_KEY_SECRET: "secret",
    RAZORPAY_WEBHOOK_SECRET: "whsec",
    RZP_PLAN_10: "plan_10",
    RZP_PLAN_50: "plan_50",
    RZP_PLAN_100: "plan_100",
    RZP_PLAN_500: "plan_500",
    RZP_PLAN_1000: "plan_1000",
    ...over,
  };
}

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext;

describe("worker router (Hono)", () => {
  it("delegates non-/api requests to the ASSETS binding (SPA fallthrough)", async () => {
    const res = await app.request("/subscribe", {}, makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("asset:/subscribe");
  });

  it("reports ok on /api/health without reading any Razorpay secret", async () => {
    const res = await app.request("/api/health", {}, makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 JSON for an unknown /api route", async () => {
    const res = await app.request("/api/nope", {}, makeEnv(), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

const POST_LAUNCH_ROUTES = [
  { method: "POST", path: "/api/subscribe" },
  { method: "POST", path: "/api/subscribe/verify" },
  { method: "POST", path: "/api/webhook/razorpay" },
  { method: "GET", path: "/api/unsubscribe?token=x" },
  { method: "GET", path: "/api/metrics" },
  { method: "GET", path: "/api/dataset" },
  { method: "GET", path: "/api/vote/proposals" },
  { method: "POST", path: "/api/vote/request-link" },
  { method: "POST", path: "/api/vote/cast" },
  { method: "GET", path: "/api/vote/results/season-1" },
] as const;

function envWithoutRazorpaySecrets(over: Partial<Env> = {}): Env {
  const env = makeEnv(over) as Partial<Env>;
  for (const key of Object.keys(env)) {
    if (key.startsWith("RAZORPAY_") || key.startsWith("RZP_")) delete env[key as keyof Env];
  }
  return env as Env;
}

describe("post-launch routes are gated off by default", () => {
  for (const { method, path } of POST_LAUNCH_ROUTES) {
    it(`404s ${method} ${path}`, async () => {
      const res = await app.request(path, { method }, makeEnv(), ctx);
      expect(res.status).toBe(404);
      expect(res.headers.get(GATE_HEADER)).toBe("closed");
      expect(await res.json()).toEqual({ error: "not_found" });
    });
  }

  for (const { method, path } of POST_LAUNCH_ROUTES) {
    it(`stops intercepting ${method} ${path} when POST_LAUNCH_ENABLED is true`, async () => {
      const res = await app.request(
        path,
        { method },
        makeEnv({ POST_LAUNCH_ENABLED: "true" }),
        ctx,
      );
      expect(res.headers.get(GATE_HEADER)).toBeNull();
    });
  }
});

const POST_LAUNCH_PAGE_REQUESTS = [
  "/vote",
  "/vote.html",
  "/vote/",
  "/manage",
  "/manage.html",
  "/thank-you",
  "/thank-you.html",
  "/vote.",
  "/vote//",
] as const;

const LAUNCH_PAGE_REQUESTS = [
  "/",
  "/subscribe",
  "/subscribe.html",
  "/projects",
  "/404.html",
] as const;

describe("post-launch pages are gated off by default", () => {
  for (const path of POST_LAUNCH_PAGE_REQUESTS) {
    it(`404s ${path} with the 404 page, not the page itself`, async () => {
      const res = await app.request(path, {}, makeEnv(), ctx);
      expect(res.status).toBe(404);
      expect(await res.text()).toContain("asset:/404.html");
    });
  }

  for (const path of LAUNCH_PAGE_REQUESTS) {
    it(`still serves the launch page ${path}`, async () => {
      const res = await app.request(path, {}, makeEnv(), ctx);
      expect(res.status).toBe(200);
    });
  }

  const SECURITY_HEADERS = [
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "referrer-policy",
  ] as const;

  for (const header of SECURITY_HEADERS) {
    it(`keeps ${header} on the gated 404, same as every other page`, async () => {
      const gated = await app.request("/vote", {}, makeEnv(), ctx);
      const normal = await app.request("/subscribe", {}, makeEnv(), ctx);
      expect(gated.headers.get(header)).toBe(normal.headers.get(header));
    });
  }

  for (const path of POST_LAUNCH_PAGE_REQUESTS) {
    it(`serves ${path} from assets when POST_LAUNCH_ENABLED is true`, async () => {
      const res = await app.request(path, {}, makeEnv({ POST_LAUNCH_ENABLED: "true" }), ctx);
      expect(res.status).toBe(200);
    });
  }
});

describe("scheduled() is gated with the rest of post-launch", () => {
  it("is a no-op in the launch build rather than throwing on missing secrets", async () => {
    const env = envWithoutRazorpaySecrets();
    const scheduled: Promise<unknown>[] = [];
    const cronCtx = {
      waitUntil: (p: Promise<unknown>) => scheduled.push(p),
      passThroughOnException() {},
    } as unknown as ExecutionContext;

    await worker.scheduled({} as never, env, cronCtx);

    expect(scheduled).toHaveLength(0);
  });

  it("still refreshes metrics when POST_LAUNCH_ENABLED is true", async () => {
    const scheduled: Promise<unknown>[] = [];
    const cronCtx = {
      waitUntil: (p: Promise<unknown>) => scheduled.push(p),
      passThroughOnException() {},
    } as unknown as ExecutionContext;

    await worker.scheduled({} as never, makeEnv({ POST_LAUNCH_ENABLED: "true" }), cronCtx);

    expect(scheduled).toHaveLength(1);
  });
});

describe("the launch build boots with no razorpay secret present", () => {
  const launchEnv = envWithoutRazorpaySecrets;

  it("serves /api/health", async () => {
    const res = await app.request("/api/health", {}, launchEnv(), ctx);
    expect(res.status).toBe(200);
  });

  it("serves the asset fallthrough", async () => {
    const res = await app.request("/subscribe", {}, launchEnv(), ctx);
    expect(res.status).toBe(200);
  });

  it("never 5xxs on any post-launch route — they are gated, not crashing", async () => {
    for (const { method, path } of POST_LAUNCH_ROUTES) {
      const res = await app.request(path, { method }, launchEnv(), ctx);
      expect(res.status).toBe(404);
    }
  });
});

describe("the post-launch host must never be indexed", () => {
  it("serves a disallow-all robots.txt when post-launch is enabled", async () => {
    const res = await app.request("/robots.txt", {}, makeEnv({ POST_LAUNCH_ENABLED: "true" }), ctx);
    expect(await res.text()).toContain("Disallow: /");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("serves the real robots.txt on the launch host", async () => {
    const res = await app.request("/robots.txt", {}, makeEnv(), ctx);
    expect(await res.text()).toContain("asset:/robots.txt");
  });
});
