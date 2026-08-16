import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TEST_SITEKEY = "1x00000000000000000000AA";

const CARRIERS = [
  "src/lib/turnstile.ts",
  "scripts/assert-deploy-env.mjs",
  "tests/site/build.setup.ts",
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("the test sitekey literal", () => {
  for (const path of CARRIERS) {
    it(`is spelled the same in ${path}`, () => {
      expect(read(path)).toContain(`"${TEST_SITEKEY}"`);
    });
  }
});

describe("every build path that uses the test sitekey opts in explicitly", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;

  for (const [name, body] of Object.entries(scripts)) {
    if (!body.includes(TEST_SITEKEY)) continue;
    it(`pnpm ${name} sets PUBLIC_ALLOW_TEST_SITEKEY`, () => {
      expect(body).toContain("PUBLIC_ALLOW_TEST_SITEKEY=true");
    });
  }

  it("covers the CI jobs that build with the test sitekey", () => {
    const ci = read(".github/workflows/ci.yml");
    const withSitekey = ci.split("PUBLIC_TURNSTILE_SITEKEY").length - 1;
    const withOptIn = ci.split("PUBLIC_ALLOW_TEST_SITEKEY").length - 1;
    expect(withOptIn).toBe(withSitekey);
  });

  it("finds at least one such build path, so the suite cannot pass vacuously", () => {
    const paths = Object.values(scripts).filter((body) => body.includes(TEST_SITEKEY));
    expect(paths.length).toBeGreaterThan(0);
  });
});
