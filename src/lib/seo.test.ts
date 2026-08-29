import { describe, expect, it } from "vitest";
import { normalizePath, seoForPath } from "./seo.ts";

describe("normalizePath", () => {
  it("strips the .html build-format extension", () => {
    expect(normalizePath("/subscribe.html")).toBe("/subscribe");
  });

  it("keeps the root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("strips a trailing slash", () => {
    expect(normalizePath("/waitlist-confirmed/")).toBe("/waitlist-confirmed");
  });
});

describe("seoForPath", () => {
  it("matches the home route", () => {
    expect(seoForPath("/").canonical).toBe("https://rupeefund.org");
  });

  it("matches a route from a build-format .html pathname", () => {
    expect(seoForPath("/subscribe.html").title).toBe("Get notified at launch — The Rupee Fund");
  });

  it("matches a route from a trailing-slash pathname", () => {
    expect(seoForPath("/waitlist-confirmed/").title).toBe("You're on the list — The Rupee Fund");
  });

  it("marks a waitlist outcome page as non-indexable", () => {
    expect(seoForPath("/waitlist-confirmed.html").indexable).toBe(false);
  });

  it("falls back to home for an unknown path", () => {
    expect(seoForPath("/does-not-exist").canonical).toBe("https://rupeefund.org");
  });
});
