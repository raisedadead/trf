import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

describe("active-nav highlight", () => {
  it("marks the current route with aria-current on the home page", () => {
    expect(read("index.html")).toContain('aria-current="page"');
  });

  it("offers no Manage nav item in a launch build, even on the gated page itself", () => {
    expect(read("manage.html")).not.toContain('href="/manage"');
  });
});
