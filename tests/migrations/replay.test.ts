import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const EXPECTED_TABLES = ["waitlist"];

const RETIRED = [
  "0002_waitlist.sql",
  "0003_voting.sql",
  "0004_proposal_options.sql",
  "0002_waitlist_launch.sql",
  "0003_voting_post_launch.sql",
];

const GONE_TABLES = [
  "ballots",
  "contributors",
  "metrics_cache",
  "processed_events",
  "proposals",
  "vote_tokens",
];

const LEDGER_DDL =
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)";

const DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

function migrationFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function replay(alreadyRecorded: string[] = []): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(LEDGER_DDL);
  for (const name of alreadyRecorded) {
    db.exec(readFileSync(`${DIR}/${name}`, "utf8"));
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  for (const name of migrationFiles()) {
    const seen = db.prepare("SELECT COUNT(*) AS n FROM d1_migrations WHERE name = ?").get(name);
    if ((seen as { n: number }).n > 0) continue;
    db.exec(readFileSync(`${DIR}/${name}`, "utf8"));
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

describe("one migrations directory feeds both databases", () => {
  it("ships exactly one migration file", () => {
    expect(migrationFiles()).toEqual(["0001_init.sql", "0002_contribution_intent.sql"]);
  });

  it("holds no per-environment subdirectory, which is what let the two copies drift", () => {
    const entries = readdirSync(DIR, { withFileTypes: true });
    expect(entries.filter((e) => e.isDirectory()).map((e) => e.name)).toEqual([]);
  });

  it("builds the whole schema from that one file", () => {
    expect(tablesOf(replay())).toEqual(EXPECTED_TABLES);
  });

  it("applies nothing to a database that already recorded every file", () => {
    const files = migrationFiles();
    const db = replay(files);
    const ledger = db
      .prepare("SELECT name FROM d1_migrations ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(ledger).toEqual(files);
    expect(tablesOf(db)).toEqual(EXPECTED_TABLES);
  });

  it("creates no payment or voting table, which this repository no longer ships", () => {
    const tables = tablesOf(replay());
    for (const table of GONE_TABLES) {
      expect(tables).not.toContain(table);
    }
  });
});

describe("wrangler resolves migrations by filename, so a name may never be reused", () => {
  it("uses no filename that this repository has retired", () => {
    expect(migrationFiles().filter((f) => RETIRED.includes(f))).toEqual([]);
  });

  it("still converges if a later migration is ever added", () => {
    const files = migrationFiles();
    const fromZero = replay();
    if (files.length > 1) {
      expect(schemaOf(fromZero)).toEqual(schemaOf(replay(files.slice(0, -1))));
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
    "amount",
    "months",
    "question",
  ]) {
    it(`has ${column}`, () => {
      expect(columns()).toContain(column);
    });
  }

  for (const column of ["amount", "months", "question"]) {
    it(`leaves ${column} nullable, because the rows written before 0002 have no answer`, () => {
      const info = replay()
        .prepare("PRAGMA table_info(waitlist)")
        .all()
        .find((r) => (r as { name: string }).name === column);
      expect((info as { notnull: number }).notnull).toBe(0);
    });
  }

  it("accepts an insert that names no answer, which a pre-0002 Worker still sends", () => {
    const db = replay();
    db.prepare(
      "INSERT INTO waitlist (email, name, consent_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("old@example.com", "O", 1000, "subscribe", 1000, 1000);
    const row = db.prepare("SELECT amount FROM waitlist WHERE email = ?").get("old@example.com");
    expect((row as { amount: string | null }).amount).toBe(null);
  });

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
