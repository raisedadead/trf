import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

const EXPECTED_TABLES = [
  "ballots",
  "contributors",
  "metrics_cache",
  "processed_events",
  "proposals",
  "vote_tokens",
  "waitlist",
];

const LEDGER_DDL =
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)";

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function replay(alreadyRecorded: string[] = []): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(LEDGER_DDL);
  for (const name of alreadyRecorded) {
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  for (const name of migrationFiles()) {
    const seen = db.prepare("SELECT COUNT(*) AS n FROM d1_migrations WHERE name = ?").get(name);
    if ((seen as { n: number }).n > 0) continue;
    db.exec(readFileSync(`${MIGRATIONS_DIR}/${name}`, "utf8"));
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

describe("the schema is one migration, and stays one until the first real signup", () => {
  it("ships exactly one migration file", () => {
    expect(migrationFiles()).toEqual(["0001_init.sql"]);
  });

  it("builds the whole schema from that one file", () => {
    expect(tablesOf(replay())).toEqual(EXPECTED_TABLES);
  });

  it("applies nothing to a database that already recorded it", () => {
    const db = replay(["0001_init.sql"]);
    expect(tablesOf(db)).toEqual([]);
  });
});

describe("wrangler resolves migrations by filename, so a name may never be reused", () => {
  it("uses no filename that this repository has retired", () => {
    const retired = ["0002_waitlist.sql", "0003_voting.sql", "0004_proposal_options.sql"];
    expect(migrationFiles().filter((f) => retired.includes(f))).toEqual([]);
  });

  it("still converges if a later migration is ever added", () => {
    const fromZero = replay();
    const incremental = replay(migrationFiles().slice(0, -1));
    if (migrationFiles().length > 1) {
      expect(schemaOf(fromZero)).toEqual(schemaOf(incremental));
    }
    expect(tablesOf(fromZero)).toEqual(EXPECTED_TABLES);
  });
});

describe("the waitlist table records consent and export state", () => {
  const columns = () =>
    replay()
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
    const info = replay()
      .prepare("PRAGMA table_info(waitlist)")
      .all()
      .find((r) => (r as { name: string }).name === "consent_at");
    expect((info as { notnull: number }).notnull).toBe(1);
  });

  it("hands a row to the exporter once and never again after it is stamped", () => {
    const db = replay();
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
    const db = replay();
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
