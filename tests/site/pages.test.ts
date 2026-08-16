import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(`dist/${file}`, "utf8");
const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

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
