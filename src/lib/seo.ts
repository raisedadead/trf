import { SUBSCRIBE_CTA } from "./launch.ts";

export const SITE_URL = "https://rupeefund.org";
export const OG_IMAGE = `${SITE_URL}/logo-foss-united-rupee-fund.png`;

export interface RouteSeo {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
  readonly canonical: string;
  readonly indexable: boolean;
}

const ROUTE_SEO: readonly RouteSeo[] = [
  {
    path: "/",
    title: "The Rupee Fund — by FOSS United",
    description:
      "The Rupee Fund — a FOSS United Foundation initiative making Indian open source sustainable through small monthly contributions starting at ₹10.",
    ogTitle: "The Rupee Fund — by FOSS United",
    ogDescription:
      "Support Indian FOSS contributors with small periodic contributions. A FOSS United Foundation initiative.",
    canonical: SITE_URL,
    indexable: true,
  },
  {
    path: "/subscribe",
    title: `${SUBSCRIBE_CTA} — The Rupee Fund`,
    description:
      "Leave your email and hear first when monthly contributions from ₹10 open. A FOSS United Foundation initiative.",
    ogTitle: "Get notified when the Rupee Fund opens",
    ogDescription:
      "Hear first when monthly contributions from ₹10 open for Indian FOSS maintainers.",
    canonical: `${SITE_URL}/subscribe`,
    indexable: true,
  },
  {
    path: "/waitlist-confirmed",
    title: "You're on the list — The Rupee Fund",
    description: "You'll hear from us the day The Rupee Fund opens.",
    ogTitle: "You're on the list — The Rupee Fund",
    ogDescription: "You'll hear from us the day The Rupee Fund opens.",
    canonical: `${SITE_URL}/waitlist-confirmed`,
    indexable: false,
  },
  {
    path: "/waitlist-problem",
    title: "That didn't go through — The Rupee Fund",
    description: "We couldn't add you to the list.",
    ogTitle: "That didn't go through — The Rupee Fund",
    ogDescription: "We couldn't add you to the list.",
    canonical: `${SITE_URL}/waitlist-problem`,
    indexable: false,
  },
  {
    path: "/404",
    title: "Page not found — The Rupee Fund",
    description: "That page doesn't exist.",
    ogTitle: "Page not found — The Rupee Fund",
    ogDescription: "That page doesn't exist.",
    canonical: `${SITE_URL}/404`,
    indexable: false,
  },
];

export function normalizePath(path: string): string {
  let normalized = path.replace(/\.html$/, "").replace(/\/index$/, "");
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  return normalized === "" ? "/" : normalized;
}

export function seoForPath(path: string): RouteSeo {
  const normalized = normalizePath(path);
  return ROUTE_SEO.find((route) => route.path === normalized) ?? ROUTE_SEO[0];
}
