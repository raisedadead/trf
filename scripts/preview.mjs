import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";

const build = spawnSync("astro", ["build", "--outDir", "dist-preview"], {
  stdio: "inherit",
  shell,
  env: {
    ...process.env,
    PUBLIC_ALLOW_TEST_SITEKEY: "true",
    PUBLIC_TURNSTILE_SITEKEY: "1x00000000000000000000AA",
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const dev = spawnSync(
  "wrangler",
  [
    "dev",
    "--assets",
    "dist-preview",
    "--var",
    "TURNSTILE_HOSTNAMES:example.com",
    "--var",
    "TURNSTILE_ACTION:",
  ],
  {
    stdio: "inherit",
    shell,
    env: { ...process.env, TURNSTILE_SECRET: "1x0000000000000000000000000000000AA" },
  },
);
process.exit(dev.status ?? 0);
