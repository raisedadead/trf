import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/apply-site-env.mjs");

const LIVE_ROBOTS = "User-agent: *\nAllow: /\n\nSitemap: https://rupeefund.org/sitemap-index.xml\n";
const LIVE_HEADERS = "/*\n  X-Frame-Options: DENY\n\n/_astro/*\n  Cache-Control: public\n";

interface Result {
  code: number;
  stderr: string;
  robots: string;
  headers: string;
}

function run(
  siteEnv: string | undefined,
  files: Partial<Record<"robots" | "headers", string>> = {},
): Result {
  const dir = mkdtempSync(join(tmpdir(), "trf-site-env-"));
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "dist/robots.txt"), files.robots ?? LIVE_ROBOTS);
  writeFileSync(join(dir, "dist/_headers"), files.headers ?? LIVE_HEADERS);
  const env = { ...process.env };
  delete env.PUBLIC_SITE_ENV;
  if (siteEnv !== undefined) env.PUBLIC_SITE_ENV = siteEnv;
  const out = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env });
  return {
    code: out.status ?? -1,
    stderr: out.stderr,
    robots: readFileSync(join(dir, "dist/robots.txt"), "utf8"),
    headers: readFileSync(join(dir, "dist/_headers"), "utf8"),
  };
}

describe("a beta build refuses every crawler", () => {
  it("replaces robots.txt with a blanket disallow", () => {
    const { code, robots } = run("beta");
    expect(code).toBe(0);
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Allow: /");
  });

  it("drops the sitemap, which points at the live host", () => {
    expect(run("beta").robots).not.toContain("Sitemap:");
  });

  it("adds the noindex header to the sitewide block, not a narrower one", () => {
    const { headers } = run("beta");
    const sitewide = headers.slice(headers.indexOf("/*"), headers.indexOf("/_astro/*"));
    expect(sitewide).toContain("X-Robots-Tag: noindex, nofollow");
  });

  it("keeps the security headers the sitewide block already carried", () => {
    expect(run("beta").headers).toContain("X-Frame-Options: DENY");
  });

  it("refuses a _headers file with no sitewide block to add the header to", () => {
    const { code, stderr } = run("beta", { headers: "/_astro/*\n  Cache-Control: public\n" });
    expect(code).toBe(1);
    expect(stderr).toContain("does not open with a /*");
  });
});

describe("a live build invites crawlers, and the guard proves it", () => {
  it("passes an untouched live build", () => {
    const { code, robots, headers } = run(undefined);
    expect(code).toBe(0);
    expect(robots).toBe(LIVE_ROBOTS);
    expect(headers).toBe(LIVE_HEADERS);
  });

  it("treats an unset PUBLIC_SITE_ENV as live", () => {
    expect(run(undefined).code).toBe(0);
  });

  it("refuses a live build whose robots.txt forbids crawling", () => {
    const { code, stderr } = run("live", { robots: "User-agent: *\nDisallow: /\n" });
    expect(code).toBe(1);
    expect(stderr).toContain("does not allow crawlers");
  });

  it("refuses a live build that carries a noindex header", () => {
    const { code, stderr } = run("live", {
      headers: "/*\n  X-Robots-Tag: noindex, nofollow\n\n/_astro/*\n  Cache-Control: public\n",
    });
    expect(code).toBe(1);
    expect(stderr).toContain("carries an X-Robots-Tag");
  });
});
