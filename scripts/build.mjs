import { spawnSync } from "node:child_process";

const siteEnv = process.env.PUBLIC_SITE_ENV ?? "live";
const targetArgs = siteEnv === "live" ? [] : ["--env", siteEnv];

const steps = [
  ["node", ["scripts/assert-deploy-env.mjs", ...targetArgs]],
  ["pnpm", ["exec", "astro", "build"]],
  ["node", ["scripts/assert-dist-sitekey.mjs"]],
  ["node", ["scripts/apply-site-env.mjs"]],
];

for (const [command, args] of steps) {
  const { status } = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (status !== 0) process.exit(status ?? 1);
}
