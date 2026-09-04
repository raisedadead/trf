import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUT, read } from "./dist.ts";

describe("sitemap", () => {
  it("generates the sitemap index", () => {
    expect(existsSync(`${OUT}/sitemap-index.xml`)).toBe(true);
  });

  it("excludes every route the sitemap filter names", () => {
    const xml = read("sitemap-0.xml");
    for (const slug of ["404", "waitlist-confirmed", "waitlist-problem"]) {
      expect(xml).not.toContain(`rupeefund.org/${slug}`);
    }
  });

  it("lists the five indexable pages and nothing else", () => {
    const xml = read("sitemap-0.xml");
    expect(xml.match(/<loc>/g)).toHaveLength(5);
    for (const path of ["/privacy", "/refunds", "/subscribe", "/team"]) {
      expect(xml, `sitemap is missing ${path}`).toContain(`https://rupeefund.org${path}`);
    }
  });
});

describe("robots.txt", () => {
  it("points at the generated sitemap index", () => {
    expect(read("robots.txt")).toContain("Sitemap: https://rupeefund.org/sitemap-index.xml");
  });

  it("permits crawlers, because the one deployed site is the public one", () => {
    expect(read("robots.txt")).toContain("Allow: /");
    expect(read("robots.txt")).not.toContain("Disallow: /");
  });
});

describe("_headers", () => {
  const headers = read("_headers");

  it("carries no sitewide noindex, which would hide rupeefund.org from every engine", () => {
    expect(headers).not.toContain("X-Robots-Tag");
  });

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
