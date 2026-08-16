import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("dist/vote.html", "utf8");
const sitemap = readFileSync("dist/sitemap-0.xml", "utf8");

describe("Vote page (/vote)", () => {
  it("renders the request-link form", () => {
    expect(html).toContain('id="vote-request-form"');
    expect(html).toContain('id="vote-proposal-select"');
  });

  it("renders the hidden cast panel", () => {
    expect(html).toContain('id="vote-cast"');
    expect(html).toContain('id="vote-choices"');
  });

  it("states the eligibility rule", () => {
    expect(html).toContain("10 or more collected");
  });

  it("has exactly one h1", () => {
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("is marked noindex", () => {
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("is excluded from the sitemap", () => {
    expect(sitemap).not.toContain("/vote");
  });
});
