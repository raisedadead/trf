import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

describe("Home page (/)", () => {
  const html = read("index.html");

  it("renders the hero headline", () => {
    expect(html).toContain("Keep Indian open source alive, one rupee at a time");
  });

  it("centers the launch label without a square marker", () => {
    expect(html).toContain('class="mb-12 flex justify-center"');
    expect(html).not.toContain('class="w-2 h-2 bg-brand inline-block"');
  });

  it("renders the How It Works section", () => {
    expect(html).toContain("How It Works");
  });

  it("renders the Funding Seasons section", () => {
    expect(html).toContain("Funding Seasons");
  });

  it("renders every funding season", () => {
    for (const name of ["WINTER", "SUMMER", "MONSOON", "POST-MONSOON"]) {
      expect(html).toContain(name);
    }
  });

  it("renders the FAQ section", () => {
    expect(html).toContain("Frequently Asked Questions");
  });

  it("has exactly one h1", () => {
    expect(h1Count(html)).toBe(1);
  });

  it("sets the home title", () => {
    expect(html).toContain("<title>The Rupee Fund — by FOSS United</title>");
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

  it("renders the not-found heading", () => {
    expect(html).toContain("Page not found");
  });

  it("renders the 404 marker", () => {
    expect(html).toContain(">404<");
  });
});
