import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";
import { COMMUNITY_TEAM } from "../../src/data/team.ts";

describe("Team page (/team)", () => {
  const html = read("team.html");

  it("renders the visible team entries", () => {
    const visible = COMMUNITY_TEAM.filter((member) => !member.hidden);
    expect(html.match(/<article\b/g)).toHaveLength(visible.length);
  });

  it("links to the Foundation team", () => {
    expect(html).toContain('href="https://fossunited.org/team"');
  });

  it("has team metadata and one h1", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('rel="canonical" href="https://rupeefund.org/team"');
  });
});

describe("Team navigation", () => {
  const home = read("index.html");

  it("links to the team page from the footer", () => {
    const footer = home.slice(home.indexOf("<footer"));
    expect(footer).toContain('href="/team"');
  });

  it("links to the team page from desktop and mobile navigation", () => {
    const header = home.slice(home.indexOf("<header"), home.indexOf("</header>"));
    expect(header.match(/href="\/team"/g)).toHaveLength(2);
  });

  it("marks Team as current in both navigation menus", () => {
    const team = read("team.html");
    const header = team.slice(team.indexOf("<header"), team.indexOf("</header>"));
    expect(header.match(/href="\/team" aria-current="page"/g)).toHaveLength(2);
  });
});
