import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TEST_SITEKEY = "1x00000000000000000000AA";

const CARRIERS = [
  "src/lib/turnstile.ts",
  "scripts/turnstile-dummy-keys.mjs",
  "scripts/preview.mjs",
  "tests/site/build.setup.ts",
  "tests/deploy/assert-deploy-env.test.ts",
  "tests/deploy/assert-dist-sitekey.test.ts",
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

// A pnpm script that only delegates to a node wrapper (e.g. "node scripts/preview.mjs")
// carries none of its own literals, so the actual gate must be found in that file.
function scriptSource(body: string): string {
  const delegate = /^node (\S+)$/.exec(body)?.[1];
  return delegate ? read(delegate) : body;
}

describe("every build path that uses the test sitekey opts in explicitly", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
  const sources = Object.fromEntries(
    Object.entries(scripts).map(([name, body]) => [name, scriptSource(body)]),
  );

  for (const [name, source] of Object.entries(sources)) {
    if (!source.includes(TEST_SITEKEY)) continue;
    it(`pnpm ${name} sets PUBLIC_ALLOW_TEST_SITEKEY`, () => {
      expect(source).toMatch(/PUBLIC_ALLOW_TEST_SITEKEY(=|:\s*)"true"?/);
    });
  }

  it("never lets CI reach for the test sitekey, so the deploy guard runs as it does in production", () => {
    expect(read(".github/workflows/ci.yml")).not.toContain(TEST_SITEKEY);
  });

  it("makes CI supply no sitekey at all, because the repository already carries it", () => {
    expect(read(".github/workflows/ci.yml")).not.toContain("PUBLIC_TURNSTILE_SITEKEY");
  });

  it("that chain still reads dist afterwards, which is what protects the real deploy", () => {
    expect(read("scripts/build.mjs")).toContain("scripts/assert-dist-sitekey.mjs");
  });

  it("finds at least one such build path, so the suite cannot pass vacuously", () => {
    const paths = Object.values(sources).filter((source) => source.includes(TEST_SITEKEY));
    expect(paths.length).toBeGreaterThan(0);
  });
});
