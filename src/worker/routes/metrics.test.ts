import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  handleDataset,
  handleMetrics,
  refreshMetrics,
  type MetricsDeps,
} from "./metrics.ts";
import { makeRazorpay, makeRepo } from "../testkit.ts";
import type { RazorpaySubscription } from "../lib/razorpay.ts";

function sub(over: Partial<RazorpaySubscription> = {}): RazorpaySubscription {
  return {
    id: "sub_x",
    short_url: "https://rzp.io/test",
    status: "active",
    plan_id: "plan_100",
    customer_id: null,
    paid_count: 0,
    notes: { program: "rupee-fund" },
    ...over,
  };
}

function deps(over: Partial<MetricsDeps> = {}): MetricsDeps {
  return {
    repo: makeRepo(),
    razorpay: makeRazorpay({ listFail: true }),
    amountForPlan: () => null,
    now: () => 5,
    ...over,
  };
}

describe("metrics endpoints", () => {
  it("serves a zeroed snapshot (200) when cache is cold and Razorpay is down", async () => {
    const res = await handleMetrics(deps());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      total_contributors: 0,
      active: 0,
      monthly_inr: 0,
      computed_at: 5,
    });
  });

  it("dataset degrades to zeros (200) when cache is cold and Razorpay is down", async () => {
    const res = await handleDataset(deps());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      program: "rupee-fund",
      active_contributors: 0,
      total_contributors: 0,
      monthly_inr: 0,
      as_of: 5,
    });
  });
});

describe("computeMetrics", () => {
  it("counts authorized rupee-fund subs, excludes 'created' and foreign programs", async () => {
    const list = [
      sub({ status: "active", plan_id: "plan_100" }),
      sub({ status: "active", plan_id: "plan_500" }),
      sub({ status: "halted", plan_id: "plan_100" }),
      sub({ status: "created", plan_id: "plan_100" }),
      sub({ status: "active", plan_id: "plan_100", notes: { program: "other" } }),
    ];
    const snapshot = await computeMetrics({
      repo: makeRepo(),
      razorpay: makeRazorpay({ list }),
      amountForPlan: (p) => (p === "plan_100" ? 100 : p === "plan_500" ? 500 : null),
      now: () => 7,
    });

    expect(snapshot).toEqual({
      total_contributors: 3,
      active: 2,
      monthly_inr: 600,
      computed_at: 7,
    });
  });

  it("paginates past the first page of 100", async () => {
    const list = Array.from({ length: 150 }, (_, i) =>
      sub({ id: `sub_${i}`, status: "active", plan_id: "plan_100" }),
    );
    const snapshot = await computeMetrics({
      repo: makeRepo(),
      razorpay: makeRazorpay({ list }),
      amountForPlan: () => 100,
      now: () => 0,
    });

    expect(snapshot.total_contributors).toBe(150);
    expect(snapshot.active).toBe(150);
  });
});

describe("refreshMetrics", () => {
  it("writes the freshly computed snapshot to the cache", async () => {
    const repo = makeRepo();
    await refreshMetrics({
      repo,
      razorpay: makeRazorpay({ list: [sub({ status: "active", plan_id: "plan_100" })] }),
      amountForPlan: () => 100,
      now: () => 9,
    });

    expect(repo.metricsValue).toEqual({
      total_contributors: 1,
      active: 1,
      monthly_inr: 100,
      computed_at: 9,
    });
  });

  it("swallows a Razorpay outage and leaves the last good cache intact", async () => {
    const repo = makeRepo();
    repo.metricsValue = { total_contributors: 5, active: 5, monthly_inr: 500, computed_at: 1 };
    await expect(
      refreshMetrics({
        repo,
        razorpay: makeRazorpay({ listFail: true }),
        amountForPlan: () => null,
        now: () => 2,
      }),
    ).resolves.toBeUndefined();

    expect(repo.metricsValue?.total_contributors).toBe(5);
  });
});
