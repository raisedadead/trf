import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

describe("Home page (/)", () => {
  const html = read("index.html");

  it("has exactly one h1", () => {
    expect(h1Count(html)).toBe(1);
  });

  it("sets the home title", () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });

  it("sets the canonical URL", () => {
    expect(html).toContain('rel="canonical" href="https://rupeefund.org"');
  });

  it("provides a skip-to-content link and main landmark", () => {
    expect(html).toContain('href="#main"');
    expect(html).toContain('<main id="main"');
  });
});

describe("404 page", () => {
  const html = read("404.html");

  it("has one heading", () => {
    expect(h1Count(html)).toBe(1);
  });
});
