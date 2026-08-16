import { beforeEach, describe, expect, it } from "vitest";
import { createRepo } from "../../src/worker/lib/db.ts";
import type { Repo, WaitlistEntry } from "../../src/worker/types.ts";
import { migratedD1, rowsOf } from "./d1-adapter.ts";
import type { DatabaseSync } from "node:sqlite";

function entry(over: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    email: "asha@example.com",
    name: "Asha",
    consent_at: 1000,
    source: "subscribe",
    created_at: 1000,
    updated_at: 1000,
    ...over,
  };
}

describe("the waitlist SQL actually executed against a migrated database", () => {
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

  it("refuses an address that was not normalised before it reached the database", async () => {
    await expect(repo.addToWaitlist(entry({ email: "Asha@Example.com" }))).rejects.toThrow();
  });

  it("hands each pending row to the exporter exactly once", async () => {
    await repo.addToWaitlist(entry());
    await repo.addToWaitlist(entry({ email: "b@example.com" }));

    const pending = await repo.listPendingExport(100);
    expect(pending.map((r) => r.email)).toEqual(["asha@example.com", "b@example.com"]);

    expect(
      await repo.markExported(
        pending.map((r) => r.id),
        5000,
      ),
    ).toBe(2);
    expect(await repo.listPendingExport(100)).toEqual([]);
  });

  it("does not re-stamp a row that a previous run already exported", async () => {
    await repo.addToWaitlist(entry());
    const [row] = await repo.listPendingExport(100);
    await repo.markExported([row!.id], 5000);
    expect(await repo.markExported([row!.id], 9999)).toBe(0);
    expect(rowsOf(raw, "SELECT exported_at FROM waitlist")).toEqual([{ exported_at: 5000 }]);
  });

  it("withholds an unsubscribed row and reports whether the removal changed anything", async () => {
    await repo.addToWaitlist(entry());
    expect(await repo.unsubscribeFromWaitlist("asha@example.com", 3000)).toBe(true);
    expect(await repo.unsubscribeFromWaitlist("asha@example.com", 4000)).toBe(false);
    expect(await repo.listPendingExport(100)).toEqual([]);
  });

  it("refuses to resurrect someone who unsubscribed, because anyone can post their address", async () => {
    await repo.addToWaitlist(entry());
    const [row] = await repo.listPendingExport(100);
    await repo.markExported([row!.id], 5000);
    await repo.unsubscribeFromWaitlist("asha@example.com", 6000);

    await repo.addToWaitlist(entry({ name: "Someone Else", consent_at: 7000, updated_at: 7000 }));

    expect(
      rowsOf(raw, "SELECT name, exported_at, unsubscribed_at, consent_at FROM waitlist"),
    ).toEqual([{ name: "Asha", exported_at: 5000, unsubscribed_at: 6000, consent_at: 1000 }]);
    expect(await repo.listPendingExport(100)).toEqual([]);
  });

  it("keeps the removal on record, so the operator can still see one was requested", async () => {
    await repo.addToWaitlist(entry());
    await repo.unsubscribeFromWaitlist("asha@example.com", 6000);
    await repo.addToWaitlist(entry({ consent_at: 7000, updated_at: 7000 }));
    expect(
      rowsOf(raw, "SELECT COUNT(*) AS n FROM waitlist WHERE unsubscribed_at IS NOT NULL"),
    ).toEqual([{ n: 1 }]);
  });

  it("leaves an already-exported subscriber alone when they simply sign up twice", async () => {
    await repo.addToWaitlist(entry());
    const [row] = await repo.listPendingExport(100);
    await repo.markExported([row!.id], 5000);

    await repo.addToWaitlist(entry({ consent_at: 7000, updated_at: 7000 }));

    expect(rowsOf(raw, "SELECT exported_at FROM waitlist")).toEqual([{ exported_at: 5000 }]);
  });

  it("exports nothing when there is nothing pending", async () => {
    expect(await repo.markExported([], 1)).toBe(0);
  });
});

describe("the exporter survives a batch bigger than one SQL statement can bind", () => {
  it("stamps every id even past D1's bound-parameter cap", async () => {
    const d1 = migratedD1();
    const repo = createRepo(d1.db);
    for (let i = 0; i < 250; i += 1) {
      await repo.addToWaitlist(entry({ email: `p${i}@example.com` }));
    }
    const pending = await repo.listPendingExport(500);
    expect(pending).toHaveLength(250);

    expect(
      await repo.markExported(
        pending.map((r) => r.id),
        9000,
      ),
    ).toBe(250);
    expect(await repo.listPendingExport(500)).toEqual([]);
  });
});
