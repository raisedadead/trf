import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

describe("Team page (/team)", () => {
  const html = read("team.html");

  it("identifies the founding team and current website maintainers", () => {
    expect(html).not.toContain(">People<");
    expect(html).toContain("Founding team");
    expect(html).toContain("The founding team currently maintains this website");
    for (const name of ["Shree Kumar", "Mrugesh Mohapatra", "Khitab"]) {
      expect(html).toContain(name);
    }
  });

  it("keeps placeholders for each founder bio and profile link", () => {
    expect(html.match(/Bio to follow\./g)).toHaveLength(3);
    expect(html.match(/Profile link to follow\./g)).toHaveLength(3);
  });

  it("includes the current FOSS United staff group and its source", () => {
    expect(html).toContain("FOSS United staff");
    for (const name of [
      "Ansh Arora",
      "Ashlesh B",
      "Dilip G",
      "Jeswin Jose",
      "Ruchika Bagde",
      "Siddharth Shivkumar",
      "Vrinda Gandhi",
    ]) {
      expect(html).toContain(name);
    }
    for (const name of [
      "Ananya Arora",
      "Kratika Tekwani",
      "Sadhana Thirumangai Kalidoss",
      "Siddharth Bansal",
    ]) {
      expect(html).not.toContain(name);
    }
    expect(html).toContain('href="https://fossunited.org/team"');
  });

  it("has team metadata and one h1", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).not.toContain("max-w-2xl");
    expect(html).toContain("<title>Team — The Rupee Fund</title>");
    expect(html).toContain('rel="canonical" href="https://rupeefund.org/team"');
  });
});

describe("Team navigation", () => {
  const home = read("index.html");

  it("links to the team page from the footer", () => {
    const footer = home.slice(home.indexOf("<footer"));
    expect(footer).toContain('href="/team"');
  });

  it("does not link to the team page from the header", () => {
    const header = home.slice(home.indexOf("<header"), home.indexOf("</header>"));
    expect(header).not.toContain('href="/team"');
  });
});
