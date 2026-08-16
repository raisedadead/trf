import { execFileSync } from "node:child_process";

const DB_NAME = "trf-rupeefund";
const BATCH = 500;

export function toCsvField(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows) {
  const lines = ["email,name,attributes"];
  for (const row of rows) {
    const attributes = JSON.stringify({
      source: row.source,
      consent_at: row.consent_at,
      signed_up_at: row.created_at,
    });
    lines.push([row.email, row.name, attributes].map(toCsvField).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function parseD1Json(stdout) {
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

function query(sql, remote) {
  const args = [
    "wrangler",
    "d1",
    "execute",
    DB_NAME,
    remote ? "--remote" : "--local",
    "--json",
    "--command",
    sql,
  ];
  return parseD1Json(execFileSync("pnpm", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
}

function main() {
  const argv = process.argv.slice(2);
  const remote = argv.includes("--remote");
  const dryRun = argv.includes("--dry-run");

  const rows = query(
    `SELECT id, email, name, source, consent_at, created_at FROM waitlist
     WHERE exported_at IS NULL AND unsubscribed_at IS NULL ORDER BY id LIMIT ${BATCH}`,
    remote,
  );

  process.stdout.write(toCsv(rows));

  if (rows.length === 0) {
    process.stderr.write("nothing pending export\n");
    return;
  }
  if (dryRun) {
    process.stderr.write(`${rows.length} row(s) would be stamped; --dry-run made no changes\n`);
    return;
  }

  const ids = rows.map((r) => Number(r.id)).filter(Number.isInteger);
  query(
    `UPDATE waitlist SET exported_at = ${Date.now()} WHERE exported_at IS NULL AND id IN (${ids.join(",")})`,
    remote,
  );
  const stillPending = query(
    "SELECT COUNT(*) AS n FROM waitlist WHERE exported_at IS NULL AND unsubscribed_at IS NULL",
    remote,
  );
  const remaining = Number(stillPending[0]?.n ?? 0);
  process.stderr.write(`${ids.length} row(s) exported and stamped\n`);
  if (remaining > 0) {
    process.stderr.write(`${remaining} row(s) still pending — run again (batch size ${BATCH})\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
