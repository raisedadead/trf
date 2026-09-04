import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const REMOVED_HREFS = ["/vote", "/manage", "/thank-you"] as const;

describe("no shipped page links to a page this build removed", () => {
  // Every built page, so a page added later is scanned without a list to update.
  for (const page of PAGES) {
    for (const href of REMOVED_HREFS) {
      it(`${page} has no link to ${href}`, () => {
        expect(read(page)).not.toContain(`href="${href}"`);
      });
    }
  }
});

describe("signup navigation", () => {
  it("links to the signup page", () => {
    expect(read("index.html")).toContain('href="/subscribe"');
  });

  it("links to privacy from the signup page", () => {
    expect(read("subscribe.html")).toContain('href="/privacy"');
  });
});
