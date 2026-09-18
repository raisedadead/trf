import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync(".wrangler/state/v3/d1", { recursive: true, force: true });

const shell = process.platform === "win32";
const { status } = spawnSync(
  "wrangler",
  ["d1", "migrations", "apply", "trf-rupeefund", "--local"],
  { stdio: "inherit", env: process.env, shell },
);
process.exit(status ?? 1);
