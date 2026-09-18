import { spawnSync } from "node:child_process";

const steps = [
  ["node", ["scripts/assert-deploy-env.mjs"]],
  ["astro", ["build"]],
  ["node", ["scripts/assert-dist-sitekey.mjs"]],
];

// pnpm/npm resolve installed CLIs to .cmd shims on Windows, which node's
// spawn can only launch through a shell — see nodejs/node#21825.
const shell = process.platform === "win32";

for (const [command, args] of steps) {
  const { status } = spawnSync(command, args, { stdio: "inherit", env: process.env, shell });
  if (status !== 0) process.exit(status ?? 1);
}
