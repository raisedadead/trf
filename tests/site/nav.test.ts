import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

describe("active-nav highlight", () => {
  it("marks the current route with aria-current on the home page", () => {
    expect(read("index.html")).toContain('aria-current="page"');
  });

  it("offers no nav item for a page this build no longer ships", () => {
    for (const href of ['href="/manage"', 'href="/vote"', 'href="/thank-you"']) {
      expect(read("index.html")).not.toContain(href);
      expect(read("subscribe.html")).not.toContain(href);
    }
  });
});
