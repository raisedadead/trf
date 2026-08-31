import { spawnSync } from "node:child_process";

const steps = [
  ["node", ["scripts/assert-deploy-env.mjs"]],
  ["./node_modules/.bin/astro", ["build"]],
  ["node", ["scripts/assert-dist-sitekey.mjs"]],
];

for (const [command, args] of steps) {
  const { status } = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (status !== 0) process.exit(status ?? 1);
}
