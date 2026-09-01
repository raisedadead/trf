import { beforeEach, describe, expect, it } from "vitest";
import { createRepo } from "../../src/worker/lib/db.ts";
import type { Repo, WaitlistEntry } from "../../src/worker/types.ts";
import { migratedD1, rowsOf } from "./d1-adapter.ts";
import type { DatabaseSync } from "node:sqlite";

const EXPORT_BATCH = 500;

const SELECT_PENDING_AS_THE_EXPORTER_RUNS_IT = `SELECT id, email, name, source, consent_at, created_at FROM waitlist
     WHERE exported_at IS NULL AND unsubscribed_at IS NULL ORDER BY id LIMIT ${EXPORT_BATCH}`;

const COUNT_PENDING_AS_THE_EXPORTER_RUNS_IT =
  "SELECT COUNT(*) AS n FROM waitlist WHERE exported_at IS NULL AND unsubscribed_at IS NULL";

function stampExportedAsTheExporterRunsIt(raw: DatabaseSync, ids: number[], at: number): number {
  const res = raw
    .prepare(
      `UPDATE waitlist SET exported_at = ${at} WHERE exported_at IS NULL AND id IN (${ids.join(",")})`,
    )
    .run();
  return Number(res.changes);
}

function markUnsubscribedAsTheOperatorRunsIt(raw: DatabaseSync, email: string, at: number): number {
  const res = raw
    .prepare(
      `UPDATE waitlist SET unsubscribed_at = ${at}, updated_at = ${at}
       WHERE email = ? AND unsubscribed_at IS NULL`,
    )
    .run(email);
  return Number(res.changes);
}

function pending(raw: DatabaseSync): { id: number; email: string }[] {
  return rowsOf(raw, SELECT_PENDING_AS_THE_EXPORTER_RUNS_IT) as unknown as {
    id: number;
    email: string;
  }[];
}

function entry(over: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    email: "asha@example.com",
    name: "Asha",
    consent_at: 1000,
    source: "subscribe",
    created_at: 1000,
    updated_at: 1000,
    amount: "100",
    months: "12",
    question: "Who audits this?",
    ...over,
  };
}

describe("the signup SQL the Worker runs, against a migrated database", () => {
  let repo: Repo;
  let raw: DatabaseSync;

  beforeEach(() => {
    const d1 = migratedD1();
    repo = createRepo(d1.db);
    raw = d1.raw;
  });

  it("stores a signup", async () => {
    await repo.addToWaitlist(entry());
    expect(rowsOf(raw, "SELECT email, name, consent_at, source FROM waitlist")).toEqual([
      { email: "asha@example.com", name: "Asha", consent_at: 1000, source: "subscribe" },
    ]);
  });

  it("writes exactly one row for a repeated address, not a duplicate and not a silent drop", async () => {
    await repo.addToWaitlist(entry());
    await repo.addToWaitlist(entry({ name: "Asha Again", consent_at: 2000, updated_at: 2000 }));
    expect(rowsOf(raw, "SELECT name, consent_at FROM waitlist")).toEqual([
      { name: "Asha Again", consent_at: 2000 },
    ]);
  });

  it("stores the contribution answers beside the signup", async () => {
    await repo.addToWaitlist(entry());
    expect(rowsOf(raw, "SELECT amount, months, question FROM waitlist")).toEqual([
      { amount: "100", months: "12", question: "Who audits this?" },
    ]);
  });

  it("replaces the answers when the same address signs up again", async () => {
    await repo.addToWaitlist(entry());
    await repo.addToWaitlist(
      entry({ amount: "500", months: "24", question: "", consent_at: 2000, updated_at: 2000 }),
    );
    expect(rowsOf(raw, "SELECT amount, months, question FROM waitlist")).toEqual([
      { amount: "500", months: "24", question: "" },
    ]);
  });

  it("writes an empty optional answer as an empty string, not as the word undefined", async () => {
    await repo.addToWaitlist(entry({ months: "", question: "" }));
    expect(rowsOf(raw, "SELECT months, question FROM waitlist")).toEqual([
      { months: "", question: "" },
    ]);
  });

  it("refuses an address that was not normalised before it reached the database", async () => {
    await expect(repo.addToWaitlist(entry({ email: "Asha@Example.com" }))).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });
});

describe("the export SQL that scripts/list-export.mts itself runs, against a migrated database", () => {
  let repo: Repo;
  let raw: DatabaseSync;

  beforeEach(() => {
    const d1 = migratedD1();
    repo = createRepo(d1.db);
    raw = d1.raw;
  });

  it("hands each pending row to the exporter exactly once", async () => {
    await repo.addToWaitlist(entry());
    await repo.addToWaitlist(entry({ email: "b@example.com" }));

    const rows = pending(raw);
    expect(rows.map((r) => r.email)).toEqual(["asha@example.com", "b@example.com"]);

    expect(
      stampExportedAsTheExporterRunsIt(
        raw,
        rows.map((r) => r.id),
        5000,
      ),
    ).toBe(2);
    expect(pending(raw)).toEqual([]);
  });

  it("does not re-stamp a row that a previous run already exported", async () => {
    await repo.addToWaitlist(entry());
    const [row] = pending(raw);
    stampExportedAsTheExporterRunsIt(raw, [row!.id], 5000);
    expect(stampExportedAsTheExporterRunsIt(raw, [row!.id], 9999)).toBe(0);
    expect(rowsOf(raw, "SELECT exported_at FROM waitlist")).toEqual([{ exported_at: 5000 }]);
  });

  it("withholds an unsubscribed row and reports whether the removal changed anything", async () => {
    await repo.addToWaitlist(entry());
    expect(markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 3000)).toBe(1);
    expect(markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 4000)).toBe(0);
    expect(pending(raw)).toEqual([]);
  });

  it("refuses to resurrect someone who unsubscribed, because anyone can post their address", async () => {
    await repo.addToWaitlist(entry());
    const [row] = pending(raw);
    stampExportedAsTheExporterRunsIt(raw, [row!.id], 5000);
    markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 6000);

    await repo.addToWaitlist(entry({ name: "Someone Else", consent_at: 7000, updated_at: 7000 }));

    expect(
      rowsOf(raw, "SELECT name, exported_at, unsubscribed_at, consent_at FROM waitlist"),
    ).toEqual([{ name: "Asha", exported_at: 5000, unsubscribed_at: 6000, consent_at: 1000 }]);
    expect(pending(raw)).toEqual([]);
  });

  it("leaves an unsubscribed row's answers alone, which the same guard protects", async () => {
    await repo.addToWaitlist(entry());
    markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 6000);
    await repo.addToWaitlist(entry({ amount: "500", consent_at: 7000, updated_at: 7000 }));
    expect(rowsOf(raw, "SELECT amount FROM waitlist")).toEqual([{ amount: "100" }]);
  });

  it("keeps the removal on record, so the operator can still see one was requested", async () => {
    await repo.addToWaitlist(entry());
    markUnsubscribedAsTheOperatorRunsIt(raw, "asha@example.com", 6000);
    await repo.addToWaitlist(entry({ consent_at: 7000, updated_at: 7000 }));
    expect(
      rowsOf(raw, "SELECT COUNT(*) AS n FROM waitlist WHERE unsubscribed_at IS NOT NULL"),
    ).toEqual([{ n: 1 }]);
  });

  it("leaves an already-exported subscriber alone when they simply sign up twice", async () => {
    await repo.addToWaitlist(entry());
    const [row] = pending(raw);
    stampExportedAsTheExporterRunsIt(raw, [row!.id], 5000);

    await repo.addToWaitlist(entry({ consent_at: 7000, updated_at: 7000 }));

    expect(rowsOf(raw, "SELECT exported_at FROM waitlist")).toEqual([{ exported_at: 5000 }]);
  });

  it("hands the mailing-list exporter no contribution answer, which it has no reason to hold", () => {
    for (const column of ["amount", "months", "question"]) {
      expect(SELECT_PENDING_AS_THE_EXPORTER_RUNS_IT).not.toContain(column);
    }
  });

  it("reports nothing pending once every row is stamped", async () => {
    await repo.addToWaitlist(entry());
    stampExportedAsTheExporterRunsIt(
      raw,
      pending(raw).map((r) => r.id),
      5000,
    );
    expect(rowsOf(raw, COUNT_PENDING_AS_THE_EXPORTER_RUNS_IT)).toEqual([{ n: 0 }]);
  });

  it("takes one batch at a time, and reports what is still pending after it", async () => {
    for (let i = 0; i < EXPORT_BATCH + 20; i += 1) {
      await repo.addToWaitlist(entry({ email: `p${String(i).padStart(4, "0")}@example.com` }));
    }

    const first = pending(raw);
    expect(first).toHaveLength(EXPORT_BATCH);
    expect(
      stampExportedAsTheExporterRunsIt(
        raw,
        first.map((r) => r.id),
        9000,
      ),
    ).toBe(EXPORT_BATCH);
    expect(rowsOf(raw, COUNT_PENDING_AS_THE_EXPORTER_RUNS_IT)).toEqual([{ n: 20 }]);

    const second = pending(raw);
    expect(second).toHaveLength(20);
    expect(
      stampExportedAsTheExporterRunsIt(
        raw,
        second.map((r) => r.id),
        9001,
      ),
    ).toBe(20);
    expect(rowsOf(raw, COUNT_PENDING_AS_THE_EXPORTER_RUNS_IT)).toEqual([{ n: 0 }]);
  });
});
