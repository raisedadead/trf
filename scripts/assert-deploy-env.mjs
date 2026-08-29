import { readFileSync } from "node:fs";
import { DUMMY_SITEKEYS } from "./turnstile-dummy-keys.mjs";

const PLACEHOLDER_D1 = "REPLACE_WITH_BETA_D1_ID";

const envFlag = process.argv.indexOf("--env");
const envName = envFlag === -1 ? null : process.argv[envFlag + 1];
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

const target = envName === null ? config : config.env?.[envName];
if (envName !== null && target === undefined) {
  problems.push(`wrangler.jsonc declares no env.${envName}.`);
}

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

if (target?.d1_databases?.[0]?.database_id === PLACEHOLDER_D1) {
  problems.push(
    `env.${envName} still has the placeholder database_id. Create the database first:\n      pnpm wrangler d1 create trf-rupeefund-beta\n    then paste the returned id into wrangler.jsonc.`,
  );
}

const siteEnv = process.env.PUBLIC_SITE_ENV ?? "live";
const expected = envName ?? "live";

if (siteEnv !== expected) {
  problems.push(
    `PUBLIC_SITE_ENV is "${siteEnv}" for a ${expected} build. The two must agree, or the build ships the wrong robots.txt to the wrong host.`,
  );
}

if (problems.length > 0) {
  console.error(`refusing to build:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
