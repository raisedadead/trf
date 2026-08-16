import { readFileSync } from "node:fs";

const TEST_SITEKEY = "1x00000000000000000000AA";
const PLACEHOLDER_D1 = "REPLACE_WITH_POST_LAUNCH_D1_ID";

const postLaunch = process.argv.includes("--post-launch");
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/,(\s*[}\]])/g, "$1"));

const problems = [];
const sitekey = process.env.PUBLIC_TURNSTILE_SITEKEY;

if (sitekey === undefined || sitekey.length === 0) {
  problems.push(
    "PUBLIC_TURNSTILE_SITEKEY is unset. Set it in the build environment — the Astro build fails on /subscribe without it.",
  );
} else if (sitekey === TEST_SITEKEY) {
  problems.push(
    "PUBLIC_TURNSTILE_SITEKEY is Cloudflare's TEST sitekey. Use the real one from the Turnstile dashboard.",
  );
}

const target = postLaunch ? config.env?.["post-launch"] : config;
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

if (postLaunch) {
  const env = config.env?.["post-launch"];
  if (env === undefined) problems.push("wrangler.jsonc declares no env.post-launch.");
  if (env?.d1_databases?.[0]?.database_id === PLACEHOLDER_D1) {
    problems.push(
      `env.post-launch still has the placeholder database_id. Create the database first:\n      pnpm wrangler d1 create trf-rupeefund-post-launch\n    then paste the returned id into wrangler.jsonc.`,
    );
  }
  if (process.env.PUBLIC_LAUNCH_LIVE !== "true") {
    problems.push(
      'PUBLIC_LAUNCH_LIVE must be "true" for a post-launch build, or the pages ship with the waitlist form while the API expects payments.',
    );
  }
} else if (process.env.PUBLIC_LAUNCH_LIVE === "true") {
  problems.push(
    'PUBLIC_LAUNCH_LIVE is "true" for a launch deploy. That would ship the autopay form to rupeefund.org while the Worker 404s every payment route.',
  );
}

if (problems.length > 0) {
  console.error(`refusing to build:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
