import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GUARD = resolve("scripts/assert-deploy-env.mjs");
const REAL_SITEKEY = "0x4AAAAAAEQqCldZbFvXQvQr";
const TEST_SITEKEY = "1x00000000000000000000AA";
const DUMMY_SITEKEYS = [
  TEST_SITEKEY,
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
] as const;

interface Result {
  code: number;
  stderr: string;
}

function run(env: Record<string, string>, args: string[] = [], cwd = process.cwd()): Result {
  const out = spawnSync(process.execPath, [GUARD, ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  });
  return { code: out.status ?? -1, stderr: out.stderr };
}

function repoWith(mutate: (config: Record<string, unknown>) => void): string {
  const raw = readFileSync("wrangler.jsonc", "utf8");
  const config = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
  mutate(config);
  const dir = mkdtempSync(join(tmpdir(), "trf-guard-"));
  writeFileSync(join(dir, "wrangler.jsonc"), JSON.stringify(config));
  return dir;
}

describe("the deploy guard refuses a launch build that cannot take signups", () => {
  it("passes on the real configuration with a real sitekey", () => {
    expect(run({ PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY }).code).toBe(0);
  });

  it("refuses an unset sitekey", () => {
    const { code, stderr } = run({});
    expect(code).toBe(1);
    expect(stderr).toContain("PUBLIC_TURNSTILE_SITEKEY is unset");
  });

  it("refuses an empty sitekey", () => {
    const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: "" });
    expect(code).toBe(1);
    expect(stderr).toContain("PUBLIC_TURNSTILE_SITEKEY is unset");
  });

  for (const key of DUMMY_SITEKEYS) {
    it(`refuses Cloudflare's dummy sitekey ${key}`, () => {
      const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: key });
      expect(code).toBe(1);
      expect(stderr).toContain(key);
    });
  }
});

describe("the deploy guard refuses a Turnstile configuration that checks nothing", () => {
  it("refuses an empty hostname list, which turns the hostname check off", () => {
    const dir = repoWith((c) => {
      (c.vars as Record<string, string>).TURNSTILE_HOSTNAMES = "";
    });
    const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY }, [], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("TURNSTILE_HOSTNAMES is not set");
  });

  it("refuses a development host in the hostname list", () => {
    const dir = repoWith((c) => {
      (c.vars as Record<string, string>).TURNSTILE_HOSTNAMES = "localhost";
    });
    const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY }, [], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("development host");
  });

  it("refuses an empty action, which turns the action check off", () => {
    const dir = repoWith((c) => {
      (c.vars as Record<string, string>).TURNSTILE_ACTION = "";
    });
    const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY }, [], dir);
    expect(code).toBe(1);
    expect(stderr).toContain("TURNSTILE_ACTION is not set");
  });
});

describe("the deploy guard holds the beta build to the beta configuration", () => {
  const betaRepo = () =>
    repoWith((c) => {
      const beta = (c.env as Record<string, Record<string, unknown>>).beta;
      (beta.d1_databases as Record<string, unknown>[])[0].database_id = "real-beta-id";
    });

  it("passes a beta build once the database id is real", () => {
    const { code } = run(
      { PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY, PUBLIC_SITE_ENV: "beta" },
      ["--env", "beta"],
      betaRepo(),
    );
    expect(code).toBe(0);
  });

  it("refuses the placeholder database id, so beta cannot write to the live list", () => {
    const { code, stderr } = run(
      { PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY, PUBLIC_SITE_ENV: "beta" },
      ["--env", "beta"],
    );
    expect(code).toBe(1);
    expect(stderr).toContain("placeholder database_id");
  });

  it("refuses a beta build that forgets PUBLIC_SITE_ENV, which would ship an indexable beta", () => {
    const { code, stderr } = run(
      { PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY },
      ["--env", "beta"],
      betaRepo(),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("PUBLIC_SITE_ENV");
  });

  it("refuses a live build that carries the beta PUBLIC_SITE_ENV", () => {
    const { code, stderr } = run({
      PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY,
      PUBLIC_SITE_ENV: "beta",
    });
    expect(code).toBe(1);
    expect(stderr).toContain("PUBLIC_SITE_ENV");
  });

  it("refuses an environment the configuration does not declare", () => {
    const { code, stderr } = run(
      { PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY, PUBLIC_SITE_ENV: "staging" },
      ["--env", "staging"],
    );
    expect(code).toBe(1);
    expect(stderr).toContain("declares no env.staging");
  });

  it("holds the beta host to its own Turnstile hostname, not the live one", () => {
    const raw = readFileSync("wrangler.jsonc", "utf8");
    const config = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
    const beta = (config.env as Record<string, Record<string, unknown>>).beta;
    expect((beta.vars as Record<string, string>).TURNSTILE_HOSTNAMES).toBe("beta.rupeefund.org");
    expect((config.vars as Record<string, string>).TURNSTILE_HOSTNAMES).toBe("rupeefund.org");
  });

  it("gives beta its own rate-limit namespace, so it cannot spend the live budget", () => {
    const raw = readFileSync("wrangler.jsonc", "utf8");
    const config = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
    const beta = (config.env as Record<string, Record<string, unknown>>).beta;
    const betaNs = (beta.ratelimits as Record<string, string>[])[0].namespace_id;
    const liveNs = (config.ratelimits as Record<string, string>[])[0].namespace_id;
    expect(betaNs).not.toBe(liveNs);
  });

  it("points both environments at the one migrations directory", () => {
    const raw = readFileSync("wrangler.jsonc", "utf8");
    const config = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
    const beta = (config.env as Record<string, Record<string, unknown>>).beta;
    expect((beta.d1_databases as Record<string, string>[])[0].migrations_dir).toBe("migrations");
    expect((config.d1_databases as Record<string, string>[])[0].migrations_dir).toBe("migrations");
  });

  it("gives the two environments different databases", () => {
    const raw = readFileSync("wrangler.jsonc", "utf8");
    const config = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as Record<string, unknown>;
    const beta = (config.env as Record<string, Record<string, unknown>>).beta;
    expect((beta.d1_databases as Record<string, string>[])[0].database_name).not.toBe(
      (config.d1_databases as Record<string, string>[])[0].database_name,
    );
  });
});
