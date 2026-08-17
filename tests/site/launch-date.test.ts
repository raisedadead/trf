import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const EVENT = "IndiaFOSS 2026";
const DATES = "26–27 September";

const BUILT = PAGES.map((p) => [p, read(p)] as const);

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the launch date is stated once, not on repeat", () => {
  it("finds the pages it claims to check", () => {
    expect(PAGES).toContain("index.html");
    expect(PAGES.length).toBeGreaterThan(3);
  });

  for (const [page, html] of BUILT) {
    it(`${page} spells the full date at most once`, () => {
      expect(occurrences(html, DATES)).toBeLessThanOrEqual(1);
    });

    it(`${page} names the event at most twice`, () => {
      expect(occurrences(html, EVENT)).toBeLessThanOrEqual(2);
    });

    it(`${page} keeps the date out of its meta descriptions, where it would rot in search results`, () => {
      const metas = [...html.matchAll(/<meta[^>]+content="([^"]*)"[^>]*>/g)].map((m) => m[1]);
      for (const content of metas) {
        expect(content).not.toContain(DATES);
      }
    });
  }

  it("still states it once on the home page, so the date is not simply missing", () => {
    expect(occurrences(read("index.html"), DATES)).toBe(1);
  });
});
