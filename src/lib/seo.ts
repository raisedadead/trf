import { SUBSCRIBE_CTA } from "./launch.ts";

export const SITE_URL = "https://rupeefund.org";
export const OG_IMAGE = `${SITE_URL}/logo-foss-united-rupee-fund.png`;

export interface RouteSeo {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
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
    indexable: true,
  },
  {
    path: "/privacy",
    title: "Privacy — The Rupee Fund",
    description:
      "What The Rupee Fund collects, what it does with your IP address, and how to leave the list.",
    ogTitle: "Privacy — The Rupee Fund",
    ogDescription: "What we collect, and how to leave the list.",
    indexable: true,
  },
  {
    path: "/refunds",
    title: "Refunds — The Rupee Fund",
    description:
      "How to claim a refund from The Rupee Fund, the address that takes the claim, and the time limit.",
    ogTitle: "Refunds — The Rupee Fund",
    ogDescription: "How to claim a refund, and the time limit that applies.",
    indexable: true,
  },
  {
    path: "/team",
    title: "Team — The Rupee Fund",
    description:
      "Meet the founding team, website maintainers, and FOSS United staff behind The Rupee Fund.",
    ogTitle: "Team — The Rupee Fund",
    ogDescription: "Meet the people behind The Rupee Fund.",
    indexable: true,
  },
  {
    path: "/waitlist-confirmed",
    title: "You're on the list — The Rupee Fund",
    description: "You'll hear from us the day The Rupee Fund opens.",
    ogTitle: "You're on the list — The Rupee Fund",
    ogDescription: "You'll hear from us the day The Rupee Fund opens.",
    indexable: false,
  },
  {
    path: "/waitlist-problem",
    title: "That didn't go through — The Rupee Fund",
    description: "We couldn't add you to the list.",
    ogTitle: "That didn't go through — The Rupee Fund",
    ogDescription: "We couldn't add you to the list.",
    indexable: false,
  },
  {
    path: "/404",
    title: "Page not found — The Rupee Fund",
    description: "That page doesn't exist.",
    ogTitle: "Page not found — The Rupee Fund",
    ogDescription: "That page doesn't exist.",
    indexable: false,
  },
];

export function normalizePath(path: string): string {
  let normalized = path.replace(/\.html$/, "").replace(/\/index$/, "");
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  return normalized === "" ? "/" : normalized;
}

export function seoForPath(path: string): RouteSeo & { readonly canonical: string } {
  const normalized = normalizePath(path);
  const route = ROUTE_SEO.find((entry) => entry.path === normalized);
  if (route === undefined) {
    // Falling back to the home entry gave the page the home canonical, which
    // tells a crawler the two are one page. Fail the build instead.
    throw new Error(`No SEO entry for ${normalized}. Add one to ROUTE_SEO in src/lib/seo.ts.`);
  }
  return { ...route, canonical: normalized === "/" ? SITE_URL : `${SITE_URL}${normalized}` };
}

export const NON_INDEXABLE_PATHS: readonly string[] = ROUTE_SEO.filter(
  (route) => !route.indexable,
).map((route) => route.path);
