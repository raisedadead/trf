import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const OWN_ORIGIN = "https://rupeefund.org";

interface Anchor {
  page: string;
  href: string;
  tag: string;
}

function anchors(): Anchor[] {
  const found: Anchor[] = [];
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/<a\s[^>]*>/g)) {
      const tag = m[0];
      const href = /\shref="([^"]*)"/.exec(tag)?.[1];
      if (href !== undefined) found.push({ page, href, tag });
    }
  }
  return found;
}

const ANCHORS = anchors();

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href) && new URL(href).origin !== OWN_ORIGIN;
}

describe('the external-link arrow is painted from `target="_blank"`, so that attribute must mark every external link and nothing else', () => {
  it("finds anchors to check, so a broken scan cannot pass silently", () => {
    expect(ANCHORS.length).toBeGreaterThan(20);
  });

  it("finds external anchors to check, so a broken origin test cannot pass silently", () => {
    expect(ANCHORS.filter((a) => isExternal(a.href)).length).toBeGreaterThan(10);
  });

  it("gives every external link the attribute the arrow is drawn from", () => {
    for (const a of ANCHORS.filter((x) => isExternal(x.href))) {
      expect(a.tag, `${a.page} → ${a.href}`).toContain('target="_blank"');
    }
  });

  it("gives every external link `noopener`, so the new tab cannot reach back", () => {
    for (const a of ANCHORS.filter((x) => isExternal(x.href))) {
      expect(a.tag, `${a.page} → ${a.href}`).toContain("noopener");
    }
  });

  it("marks nothing else — no internal or mailto link claims `_blank`", () => {
    for (const a of ANCHORS.filter((x) => x.tag.includes('target="_blank"'))) {
      expect(isExternal(a.href), `${a.page} → ${a.href} is not external`).toBe(true);
    }
  });
});

const OPTED_OUT = new Set([
  "https://fossunited.org/privacy-policy",
  "https://fossunited.org/terms-of-service",
  "https://fossunited.org/refund-transfer-policy",
  "https://fossunited.org/code-of-conduct",
  "https://x.com/fossunited",
  "https://mas.to/@fossunited",
  "https://in.linkedin.com/company/fossunited",
  "https://www.youtube.com/c/fossunited",
  "https://t.me/fossunited",
]);

describe("`.link-plain` drops both the arrow and the new-tab announcement, so only the footer policy and social rows may carry it", () => {
  const plain = ANCHORS.filter((a) => /\sclass="[^"]*\blink-plain\b/.test(a.tag));

  it("finds opted-out anchors, so a broken class scan cannot pass silently", () => {
    expect(plain.length).toBeGreaterThan(0);
  });

  it("opts out no link beyond the two footer rows", () => {
    for (const a of plain) {
      expect(OPTED_OUT.has(a.href), `${a.page} → ${a.href} may not opt out`).toBe(true);
    }
  });

  it("opts out the same nine footer links on every page, and no more", () => {
    for (const page of PAGES) {
      const onPage = plain.filter((a) => a.page === page);
      expect(onPage.length, `${page} opts out ${onPage.length} links`).toBe(9);
    }
  });
});
