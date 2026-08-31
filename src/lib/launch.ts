export const LAUNCH_EVENT = "IndiaFOSS 2026";
export const LAUNCH_EVENT_URL = "https://fossunited.org/indiafoss/2026";
const LAUNCH_DATES = "26–27 September";
const LAUNCH_CITY = "Bengaluru";

export const LAUNCH_WHEN = `${LAUNCH_EVENT}, ${LAUNCH_DATES}, ${LAUNCH_CITY}`;

export const SUBSCRIBE_CTA = "Get notified at launch";

export const REMOVAL_ADDRESS = "foundation@fossunited.org";

export const REFUND_ADDRESS = "audit@fossunited.org";

interface Season {
  spriteSlug: string;
  name: string;
  months: string;
  duration: string;
  accent: string;
  grad: string;
}

export const SEASONS: readonly Season[] = [
  {
    spriteSlug: "winter",
    name: "WINTER",
    months: "DEC – FEB",
    duration: "3 MONTHS",
    accent: "oklch(0.55 0.13 235)",
    grad: "linear-gradient(to bottom, oklch(0.72 0.14 235 / 0.16) 0%, oklch(0.78 0.10 235 / 0.04) 55%, oklch(0.85 0.06 235 / 0) 100%)",
  },
  {
    spriteSlug: "summer",
    name: "SUMMER",
    months: "MAR – MAY",
    duration: "3 MONTHS",
    accent: "oklch(0.52 0.15 60)",
    grad: "linear-gradient(to bottom, oklch(0.72 0.14 72 / 0.16) 0%, oklch(0.78 0.10 72 / 0.04) 55%, oklch(0.85 0.06 72 / 0) 100%)",
  },
  {
    spriteSlug: "monsoon",
    name: "MONSOON",
    months: "JUN – SEP",
    duration: "4 MONTHS",
    accent: "oklch(0.52 0.15 152)",
    grad: "linear-gradient(to bottom, oklch(0.72 0.15 152 / 0.16) 0%, oklch(0.78 0.10 152 / 0.04) 55%, oklch(0.85 0.06 152 / 0) 100%)",
  },
  {
    spriteSlug: "post-monsoon",
    name: "POST-MONSOON",
    months: "OCT – NOV",
    duration: "2 MONTHS",
    accent: "oklch(0.55 0.22 330)",
    grad: "linear-gradient(to bottom, oklch(0.72 0.18 330 / 0.16) 0%, oklch(0.78 0.13 330 / 0.04) 55%, oklch(0.85 0.07 330 / 0) 100%)",
  },
];
