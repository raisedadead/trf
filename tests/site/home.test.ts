import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

let html = "";
beforeAll(() => {
  html = readFileSync("dist/index.html", "utf8");
});

describe("Home page (/)", () => {
  it("renders the hero headline", () => {
    expect(html).toContain("Keep Indian open source alive");
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
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
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
