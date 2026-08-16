import type { Proposal, ProposalOption, ProposalState } from "../types.ts";
import type { RazorpaySubscription } from "./razorpay.ts";

export const ELIGIBILITY_MIN_PAID_COUNT = 10;

export function parseOptions(optionsJson: string): ProposalOption[] {
  let raw: unknown;
  try {
    raw = JSON.parse(optionsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is ProposalOption =>
      typeof o === "object" &&
      o !== null &&
      typeof (o as ProposalOption).key === "string" &&
      typeof (o as ProposalOption).label === "string",
  );
}

export function proposalState(
  p: Pick<Proposal, "opens_at" | "closes_at">,
  now: number,
): ProposalState {
  if (now < p.opens_at) return "pending";
  if (now >= p.closes_at) return "closed";
  return "open";
}

export function isEligible(sub: Pick<RazorpaySubscription, "paid_count">): boolean {
  return sub.paid_count >= ELIGIBILITY_MIN_PAID_COUNT;
}
