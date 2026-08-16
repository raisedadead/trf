import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(`dist/${file}`, "utf8");

describe("active-nav highlight", () => {
  it("marks the current route with marker-underline on the home page", () => {
    expect(read("index.html")).toContain("marker-underline");
  });

  it("marks the current route on /projects", () => {
    expect(read("projects.html")).toContain("marker-underline");
  });

  it("offers no Manage nav item in a launch build, even on the gated page itself", () => {
    expect(read("manage.html")).not.toContain('href="/manage"');
  });
});
