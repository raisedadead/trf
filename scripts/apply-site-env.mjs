import { readFileSync, writeFileSync } from "node:fs";

const BETA_ROBOTS = "User-agent: *\nDisallow: /\n";
const NOINDEX = "  X-Robots-Tag: noindex, nofollow\n";
const SITEWIDE = "/*\n";

const siteEnv = process.env.PUBLIC_SITE_ENV ?? "live";
const robotsPath = "dist/robots.txt";
const headersPath = "dist/_headers";

const headers = readFileSync(headersPath, "utf8");

if (siteEnv === "beta") {
  writeFileSync(robotsPath, BETA_ROBOTS);
  if (!headers.startsWith(SITEWIDE)) {
    console.error(
      `refusing to build:\n  - ${headersPath} does not open with a ${SITEWIDE.trim()} block.`,
    );
    process.exit(1);
  }
  writeFileSync(headersPath, headers.replace(SITEWIDE, SITEWIDE + NOINDEX));
  process.exit(0);
}

const problems = [];
const robots = readFileSync(robotsPath, "utf8");

if (!robots.includes("Allow: /")) {
  problems.push(`${robotsPath} does not allow crawlers. A ${siteEnv} build must.`);
}

if (headers.includes("X-Robots-Tag")) {
  problems.push(`${headersPath} carries an X-Robots-Tag. A ${siteEnv} build must not.`);
}

if (problems.length > 0) {
  console.error(`refusing to build:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
