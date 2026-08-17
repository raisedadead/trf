import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

describe("sitemap", () => {
  it("generates the sitemap index", () => {
    expect(existsSync("dist/sitemap-index.xml")).toBe(true);
  });

  it("includes indexable routes", () => {
    const xml = read("sitemap-0.xml");
    expect(xml).toContain("https://rupeefund.org/subscribe");
    expect(xml).toContain("https://rupeefund.org/projects");
  });

  it("excludes noindex routes", () => {
    const xml = read("sitemap-0.xml");
    expect(xml).not.toContain("rupeefund.org/manage");
    expect(xml).not.toContain("rupeefund.org/thank-you");
  });
});

describe("robots.txt", () => {
  it("points at the generated sitemap index", () => {
    expect(read("robots.txt")).toContain("Sitemap: https://rupeefund.org/sitemap-index.xml");
  });
});

describe("_headers", () => {
  const headers = read("_headers");

  it("caches hashed assets immutably", () => {
    expect(headers).toContain("/_astro/*");
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
  });

  it("sets HSTS", () => {
    expect(headers).toContain("Strict-Transport-Security");
  });
});

describe("head metadata", () => {
  const html = read("index.html");

  it("emits Organization JSON-LD", () => {
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Organization"');
  });

  it("emits an apple-touch-icon", () => {
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it("emits Open Graph and Twitter card tags", () => {
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
  });

  it("preconnects to the font origins", () => {
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
  });
});
