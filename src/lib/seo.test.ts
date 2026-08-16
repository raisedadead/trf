import { describe, expect, it } from "vitest";
import { normalizePath, seoForPath } from "./seo.ts";

describe("normalizePath", () => {
  it("strips the .html build-format extension", () => {
    expect(normalizePath("/projects.html")).toBe("/projects");
  });

  it("keeps the root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("strips a trailing slash", () => {
    expect(normalizePath("/manage/")).toBe("/manage");
  });
});

describe("seoForPath", () => {
  it("matches the home route", () => {
    expect(seoForPath("/").canonical).toBe("https://rupeefund.org");
  });

  it("matches a route from a build-format .html pathname", () => {
    expect(seoForPath("/subscribe.html").title).toBe("Subscribe — The Rupee Fund");
  });

  it("matches a route from a trailing-slash pathname", () => {
    expect(seoForPath("/projects/").title).toBe("Projects — The Rupee Fund");
  });

  it("marks manage as non-indexable", () => {
    expect(seoForPath("/manage.html").indexable).toBe(false);
  });

  it("falls back to home for an unknown path", () => {
    expect(seoForPath("/does-not-exist").canonical).toBe("https://rupeefund.org");
  });
});
