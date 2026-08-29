import { readFileSync } from "node:fs";
import { DUMMY_SITEKEYS } from "./turnstile-dummy-keys.mjs";

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/,(\s*[}\]])/g, "$1"));

const problems = [];
const sitekey = process.env.PUBLIC_TURNSTILE_SITEKEY;

if (sitekey === undefined || sitekey.length === 0) {
  problems.push(
    "PUBLIC_TURNSTILE_SITEKEY is unset. Set it in the build environment — the Astro build fails on /subscribe without it.",
  );
} else if (DUMMY_SITEKEYS.includes(sitekey)) {
  problems.push(
    `PUBLIC_TURNSTILE_SITEKEY is Cloudflare's dummy TEST sitekey ${sitekey}. Use the real one from the Turnstile dashboard.`,
  );
}

const target = config;
const vars = target?.vars ?? {};
const hostnames = String(vars.TURNSTILE_HOSTNAMES ?? "");

if (hostnames.length === 0) {
  problems.push(
    "TURNSTILE_HOSTNAMES is not set in wrangler.jsonc for this target. An empty value turns the hostname check off, so a token solved on any other site would be accepted.",
  );
} else if (/localhost|127\.0\.0\.1|example\.com/.test(hostnames)) {
  problems.push(`TURNSTILE_HOSTNAMES contains a development host: ${hostnames}`);
}

if (String(vars.TURNSTILE_ACTION ?? "").length === 0) {
  problems.push(
    "TURNSTILE_ACTION is not set in wrangler.jsonc for this target. An empty value turns the action check off.",
  );
}

if (problems.length > 0) {
  console.error(`refusing to build:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
