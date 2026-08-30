import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<string, string>;
const builder = readFileSync("scripts/build.mjs", "utf8");

const ENVIRONMENTS = ["live", "beta"] as const;

describe("the build script name decides the environment, not the ambient variable", () => {
  for (const env of ENVIRONMENTS) {
    it(`build:${env} sets PUBLIC_SITE_ENV=${env} itself`, () => {
      expect(scripts[`build:${env}`]).toBe(`PUBLIC_SITE_ENV=${env} node scripts/build.mjs`);
    });
  }

  it("sets the variable ahead of the command, so an inherited value cannot win", () => {
    for (const env of ENVIRONMENTS) {
      expect(scripts[`build:${env}`].indexOf("PUBLIC_SITE_ENV")).toBe(0);
    }
  });
});

describe("both environments run one build chain, so they cannot drift", () => {
  it("routes every build through the same module", () => {
    for (const env of ENVIRONMENTS) {
      expect(scripts[`build:${env}`]).toContain("node scripts/build.mjs");
    }
  });

  it("runs the config guard, the build, the sitekey guard and the robots step in that order", () => {
    const order = [
      "scripts/assert-deploy-env.mjs",
      "astro",
      "scripts/assert-dist-sitekey.mjs",
      "scripts/apply-site-env.mjs",
    ];
    const positions = order.map((step) => builder.indexOf(step));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("passes no target flag for live and the named target otherwise", () => {
    expect(builder).toContain('siteEnv === "live" ? [] : ["--env", siteEnv]');
  });

  it("stops the chain on the first failing step", () => {
    expect(builder).toContain("if (status !== 0) process.exit(status ?? 1)");
  });
});

describe("each deploy runs its own build first", () => {
  for (const env of ENVIRONMENTS) {
    it(`deploy:${env} chains build:${env}`, () => {
      expect(scripts[`deploy:${env}`]).toContain(`pnpm run build:${env}`);
    });
  }

  it("keeps no unsuffixed deploy, which shadowed pnpm's own deploy command", () => {
    expect(scripts.deploy).toBeUndefined();
  });
});
