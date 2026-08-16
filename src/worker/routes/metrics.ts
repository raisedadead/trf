import { json } from "../lib/http.ts";
import type { MetricsSnapshot, Repo, Tier } from "../types.ts";
import type { RazorpayClient } from "../lib/razorpay.ts";

export interface MetricsDeps {
  repo: Repo;
  razorpay: RazorpayClient;
  amountForPlan(planId: string): Tier | null;
  now(): number;
}

const PAGE = 100;

export async function computeMetrics(deps: MetricsDeps): Promise<MetricsSnapshot> {
  let skip = 0;
  let total = 0;
  let active = 0;
  let monthly = 0;

  for (;;) {
    const page = await deps.razorpay.listSubscriptions(skip, PAGE);
    for (const sub of page.items) {
      if (sub.notes?.program !== "rupee-fund") continue;
      if (sub.status === "created") continue; // never-authorized / abandoned checkout — not a contributor
      total++;
      if (sub.status === "active") {
        active++;
        const amount = deps.amountForPlan(sub.plan_id);
        if (amount) monthly += amount;
      }
    }
    if (page.items.length < PAGE) break;
    skip += PAGE;
  }

  return { total_contributors: total, active, monthly_inr: monthly, computed_at: deps.now() };
}

async function metricsSnapshot(deps: MetricsDeps): Promise<MetricsSnapshot> {
  const cached = await deps.repo.getMetrics();
  if (cached) return cached;
  return { total_contributors: 0, active: 0, monthly_inr: 0, computed_at: deps.now() };
}

export async function refreshMetrics(deps: MetricsDeps): Promise<void> {
  const snapshot = await computeMetrics(deps).catch(() => null);
  if (snapshot) await deps.repo.setMetrics(snapshot);
}

const CACHE = { "cache-control": "public, max-age=300" };

export async function handleMetrics(deps: MetricsDeps): Promise<Response> {
  return json(200, await metricsSnapshot(deps), CACHE);
}

export async function handleDataset(deps: MetricsDeps): Promise<Response> {
  const snapshot = await metricsSnapshot(deps);
  return json(
    200,
    {
      program: "rupee-fund",
      active_contributors: snapshot.active,
      total_contributors: snapshot.total_contributors,
      monthly_inr: snapshot.monthly_inr,
      as_of: snapshot.computed_at,
    },
    CACHE,
  );
}
