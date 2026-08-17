import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

describe("Home page (/)", () => {
  const html = read("index.html");

  it("renders the hero headline", () => {
    expect(html).toContain("Keep Indian open source alive, one rupee at a time");
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

describe("Projects page (/projects)", () => {
  const html = read("projects.html");

  it("renders the heading", () => {
    expect(html).toContain("Where your rupees will go");
  });

  it("renders the no-disbursements state", () => {
    expect(html).toContain("No disbursements yet");
  });

  it("has exactly one h1", () => {
    expect(h1Count(html)).toBe(1);
  });

  it("is indexable (no robots noindex)", () => {
    expect(html).not.toContain('name="robots"');
  });
});

describe("Manage page (/manage)", () => {
  const html = read("manage.html");

  it("renders the heading", () => {
    expect(html).toContain("Manage Subscription");
  });

  it("renders the preview empty state", () => {
    expect(html).toContain("No active subscription yet");
  });

  it("is marked noindex", () => {
    expect(html).toContain('name="robots" content="noindex"');
  });
});

describe("Thank-you page (/thank-you)", () => {
  const html = read("thank-you.html");

  it("renders the founding-contributor heading", () => {
    expect(html).toContain("You're a Founding Contributor");
  });

  it("renders the share action", () => {
    expect(html).toContain('id="share-btn"');
  });

  it("is marked noindex", () => {
    expect(html).toContain('name="robots" content="noindex"');
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
