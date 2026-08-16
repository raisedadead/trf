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
    title: "Subscribe — The Rupee Fund",
    description:
      "Join the mailing list for The Rupee Fund and hear first when monthly contributions from ₹10 open at IndiaFOSS 2026. A FOSS United Foundation initiative.",
    ogTitle: "Join the Rupee Fund mailing list",
    ogDescription:
      "Hear first when monthly contributions from ₹10 open for Indian FOSS maintainers.",
    canonical: `${SITE_URL}/subscribe`,
    indexable: true,
  },
  {
    path: "/projects",
    title: "Projects — The Rupee Fund",
    description:
      "See the Indian FOSS maintainers and projects supported by The Rupee Fund, a FOSS United Foundation initiative.",
    ogTitle: "Projects funded by The Rupee Fund",
    ogDescription:
      "Discover the Indian open source projects and maintainers backed by Rupee Fund contributors.",
    canonical: `${SITE_URL}/projects`,
    indexable: true,
  },
  {
    path: "/manage",
    title: "Manage your contribution — The Rupee Fund",
    description: "Manage or cancel your monthly Rupee Fund contribution.",
    ogTitle: "Manage your Rupee Fund contribution",
    ogDescription: "Update or cancel your monthly Rupee Fund contribution.",
    canonical: `${SITE_URL}/manage`,
    indexable: false,
  },
  {
    path: "/thank-you",
    title: "Thank you — The Rupee Fund",
    description: "Your monthly Rupee Fund contribution is being set up.",
    ogTitle: "Thank you — The Rupee Fund",
    ogDescription: "Your monthly Rupee Fund contribution is being set up.",
    canonical: `${SITE_URL}/thank-you`,
    indexable: false,
  },
  {
    path: "/vote",
    title: "Vote — The Rupee Fund",
    description:
      "Eligible Rupee Fund contributors vote on how the fund supports Indian open source. A FOSS United Foundation initiative.",
    ogTitle: "Vote on Rupee Fund proposals",
    ogDescription: "Eligible contributors decide how The Rupee Fund supports Indian open source.",
    canonical: `${SITE_URL}/vote`,
    indexable: false,
  },
  {
    path: "/waitlist-confirmed",
    title: "You're on the list — The Rupee Fund",
    description: "You'll hear from us when Season 1 opens at IndiaFOSS 2026.",
    ogTitle: "You're on the list — The Rupee Fund",
    ogDescription: "You'll hear from us when Season 1 opens at IndiaFOSS 2026.",
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
