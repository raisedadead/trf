import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const VARIANTS = ["launch", "post-launch"] as const;
type Variant = (typeof VARIANTS)[number];

const LAUNCH_TABLES = ["waitlist"];

const POST_LAUNCH_TABLES = [
  "ballots",
  "contributors",
  "metrics_cache",
  "processed_events",
  "proposals",
  "vote_tokens",
  "waitlist",
];

const EXPECTED: Record<Variant, string[]> = {
  launch: LAUNCH_TABLES,
  "post-launch": POST_LAUNCH_TABLES,
};

const RETIRED = [
  "0002_waitlist.sql",
  "0003_voting.sql",
  "0004_proposal_options.sql",
  "0002_waitlist_launch.sql",
  "0003_voting_post_launch.sql",
];

const SHARED_OPEN = "-- >>> shared: waitlist";
const SHARED_CLOSE = "-- <<< shared: waitlist";

const LEDGER_DDL =
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)";

function dirOf(variant: Variant): string {
  return fileURLToPath(new URL(`../../migrations/${variant}`, import.meta.url));
}

function migrationFiles(variant: Variant): string[] {
  return readdirSync(dirOf(variant))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function replay(variant: Variant, alreadyRecorded: string[] = []): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(LEDGER_DDL);
  for (const name of alreadyRecorded) {
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  for (const name of migrationFiles(variant)) {
    const seen = db.prepare("SELECT COUNT(*) AS n FROM d1_migrations WHERE name = ?").get(name);
    if ((seen as { n: number }).n > 0) continue;
    db.exec(readFileSync(`${dirOf(variant)}/${name}`, "utf8"));
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  return db;
}

function schemaOf(db: DatabaseSync): string[] {
  return db
    .prepare(
      "SELECT type || ' ' || name AS o FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != 'd1_migrations' ORDER BY o",
    )
    .all()
    .map((r) => (r as { o: string }).o);
}

function tablesOf(db: DatabaseSync): string[] {
  return schemaOf(db)
    .filter((o) => o.startsWith("table "))
    .map((o) => o.slice(6))
    .sort();
}

function sharedBlock(variant: Variant): string {
  const sql = readFileSync(`${dirOf(variant)}/0001_init.sql`, "utf8");
  const start = sql.indexOf(SHARED_OPEN);
  const end = sql.indexOf(SHARED_CLOSE);
  if (start < 0 || end < 0) throw new Error(`no shared waitlist block in migrations/${variant}`);
  return sql.slice(start, end + SHARED_CLOSE.length);
}

describe("each environment has its own migrations directory", () => {
  for (const variant of VARIANTS) {
    it(`${variant} ships exactly one migration file`, () => {
      expect(migrationFiles(variant)).toEqual(["0001_init.sql"]);
    });

    it(`${variant} builds its whole schema from that one file`, () => {
      expect(tablesOf(replay(variant))).toEqual(EXPECTED[variant]);
    });

    it(`${variant} applies nothing to a database that already recorded it`, () => {
      expect(tablesOf(replay(variant, ["0001_init.sql"]))).toEqual([]);
    });
  }

  it("keeps the payment and voting tables out of the launch database", () => {
    const launch = tablesOf(replay("launch"));
    for (const table of [
      "contributors",
      "metrics_cache",
      "processed_events",
      "proposals",
      "ballots",
      "vote_tokens",
    ]) {
      expect(launch).not.toContain(table);
    }
  });

  it("gives the post-launch database everything the launch database has", () => {
    const launch = tablesOf(replay("launch"));
    const post = tablesOf(replay("post-launch"));
    expect(post).toEqual(expect.arrayContaining(launch));
  });
});

describe("the shared waitlist block cannot drift between the directories", () => {
  it("is byte-identical in every migrations directory", () => {
    const [first, ...rest] = VARIANTS.map(sharedBlock);
    for (const block of rest) expect(block).toBe(first);
  });

  it("actually contains the waitlist table, so the comparison is not empty", () => {
    expect(sharedBlock("launch")).toContain("CREATE TABLE waitlist");
  });
});

describe("wrangler resolves migrations by filename, so a name may never be reused", () => {
  for (const variant of VARIANTS) {
    it(`${variant} uses no filename that this repository has retired`, () => {
      expect(migrationFiles(variant).filter((f) => RETIRED.includes(f))).toEqual([]);
    });
  }

  it("keeps no migration at the old flat path, which both ledgers already record", () => {
    const flat = readdirSync(fileURLToPath(new URL("../../migrations", import.meta.url)));
    expect(flat.filter((f) => f.endsWith(".sql"))).toEqual([]);
  });

  for (const variant of VARIANTS) {
    it(`${variant} still converges if a later migration is ever added`, () => {
      const files = migrationFiles(variant);
      const fromZero = replay(variant);
      if (files.length > 1) {
        expect(schemaOf(fromZero)).toEqual(schemaOf(replay(variant, files.slice(0, -1))));
      }
      expect(tablesOf(fromZero)).toEqual(EXPECTED[variant]);
    });
  }
});

describe("the waitlist table records consent and export state", () => {
  const columns = () =>
    replay("launch")
      .prepare("PRAGMA table_info(waitlist)")
      .all()
      .map((r) => (r as { name: string }).name);

  for (const column of [
    "email",
    "name",
    "consent_at",
    "source",
    "exported_at",
    "unsubscribed_at",
    "created_at",
    "updated_at",
  ]) {
    it(`has ${column}`, () => {
      expect(columns()).toContain(column);
    });
  }

  it("requires a consent timestamp, because consent cannot be backfilled", () => {
    const info = replay("launch")
      .prepare("PRAGMA table_info(waitlist)")
      .all()
      .find((r) => (r as { name: string }).name === "consent_at");
    expect((info as { notnull: number }).notnull).toBe(1);
  });

  it("hands a row to the exporter once and never again after it is stamped", () => {
    const db = replay("launch");
    const pending = () =>
      db
        .prepare("SELECT id FROM waitlist WHERE exported_at IS NULL AND unsubscribed_at IS NULL")
        .all().length;

    db.prepare(
      "INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("a@example.com", "A", 1000, "subscribe", 1000, 1000);
    expect(pending()).toBe(1);

    db.prepare("UPDATE waitlist SET exported_at = ? WHERE exported_at IS NULL").run(2000);
    expect(pending()).toBe(0);
  });

  it("withholds an unsubscribed row from the exporter", () => {
    const db = replay("launch");
    db.prepare(
      "INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at, unsubscribed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("gone@example.com", "G", 1000, "subscribe", 1000, 1000, 1500);
    expect(
      db
        .prepare("SELECT id FROM waitlist WHERE exported_at IS NULL AND unsubscribed_at IS NULL")
        .all().length,
    ).toBe(0);
  });
});
