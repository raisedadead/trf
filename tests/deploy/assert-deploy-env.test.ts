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

  it("refuses a launch build that also turns the payment pages on", () => {
    const { code, stderr } = run({
      PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY,
      PUBLIC_LAUNCH_LIVE: "true",
    });
    expect(code).toBe(1);
    expect(stderr).toContain("PUBLIC_LAUNCH_LIVE");
  });
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

describe("the deploy guard holds the post-launch build to its own rules", () => {
  it("passes with a real sitekey and the payment pages on", () => {
    const { code } = run({ PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY, PUBLIC_LAUNCH_LIVE: "true" }, [
      "--post-launch",
    ]);
    expect(code).toBe(0);
  });

  it("refuses a post-launch build that leaves the payment pages off", () => {
    const { code, stderr } = run({ PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY }, ["--post-launch"]);
    expect(code).toBe(1);
    expect(stderr).toContain("PUBLIC_LAUNCH_LIVE");
  });

  it("refuses a configuration that declares no post-launch environment", () => {
    const dir = repoWith((c) => {
      delete (c.env as Record<string, unknown>)["post-launch"];
    });
    const { code, stderr } = run(
      { PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY, PUBLIC_LAUNCH_LIVE: "true" },
      ["--post-launch"],
      dir,
    );
    expect(code).toBe(1);
    expect(stderr).toContain("declares no env.post-launch");
  });

  it("refuses a placeholder database id", () => {
    const dir = repoWith((c) => {
      const env = (c.env as Record<string, Record<string, unknown>>)["post-launch"];
      (env.d1_databases as Record<string, string>[])[0].database_id =
        "REPLACE_WITH_POST_LAUNCH_D1_ID";
    });
    const { code, stderr } = run(
      { PUBLIC_TURNSTILE_SITEKEY: REAL_SITEKEY, PUBLIC_LAUNCH_LIVE: "true" },
      ["--post-launch"],
      dir,
    );
    expect(code).toBe(1);
    expect(stderr).toContain("placeholder database_id");
  });
});
