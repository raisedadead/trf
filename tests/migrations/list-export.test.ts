import { describe, expect, it } from "vitest";
import { parseD1Json, toCsv, toCsvField } from "../../scripts/list-export.mts";

describe("CSV escaping survives the names people actually have", () => {
  it("leaves a plain value alone", () => {
    expect(toCsvField("Asha")).toBe("Asha");
  });

  it("quotes a value containing a comma", () => {
    expect(toCsvField("Rao, Asha")).toBe('"Rao, Asha"');
  });

  it("doubles embedded quotes rather than truncating the field", () => {
    expect(toCsvField('Asha "The" Rao')).toBe('"Asha ""The"" Rao"');
  });

  it("quotes a value containing a newline", () => {
    expect(toCsvField("Asha\nRao")).toBe('"Asha\nRao"');
  });

  it("passes non-ASCII through untouched", () => {
    expect(toCsvField("आशा")).toBe("आशा");
  });

  it("renders an absent value as empty rather than the string undefined", () => {
    expect(toCsvField(undefined)).toBe("");
  });
});

describe("the exported file is importable by a list manager", () => {
  const rows = [
    {
      id: 1,
      email: "a@example.com",
      name: "Asha",
      source: "subscribe",
      consent_at: 10,
      created_at: 10,
    },
    {
      id: 2,
      email: "b@example.com",
      name: 'B, "the" one',
      source: "footer",
      consent_at: 20,
      created_at: 20,
    },
  ];

  it("starts with the header row", () => {
    expect(toCsv(rows).split("\n")[0]).toBe("email,name,attributes");
  });

  it("writes one line per subscriber plus the header and a trailing newline", () => {
    expect(toCsv(rows).split("\n")).toHaveLength(4);
  });

  it("puts valid JSON in the attributes column of every row", () => {
    for (const line of toCsv(rows).trim().split("\n").slice(1)) {
      const attributes = line.slice(line.indexOf(',"{') + 2, -1).replaceAll('""', '"');
      expect(() => JSON.parse(attributes)).not.toThrow();
    }
  });

  it("carries the consent record into the attributes, not just the address", () => {
    expect(toCsv(rows)).toContain("consent_at");
    expect(toCsv(rows)).toContain("source");
  });

  it("emits only a header when nobody is pending", () => {
    expect(toCsv([])).toBe("email,name,attributes\n");
  });
});

describe("the wrangler --json envelope is unwrapped as wrangler actually emits it", () => {
  it("reads results out of the array wrangler returns", () => {
    const stdout = JSON.stringify([
      { results: [{ id: 13 }], success: true, meta: { duration: 0 } },
    ]);
    expect(parseD1Json(stdout)).toEqual([{ id: 13 }]);
  });

  it("tolerates a bare object instead of an array", () => {
    expect(parseD1Json(JSON.stringify({ results: [{ id: 1 }] }))).toEqual([{ id: 1 }]);
  });

  it("returns nothing rather than throwing when the envelope has no results", () => {
    expect(parseD1Json(JSON.stringify([{ success: true }]))).toEqual([]);
  });
});

describe("a spreadsheet cannot be made to execute the export", () => {
  for (const payload of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
    it(`neutralises a field starting with ${payload[0]}`, () => {
      expect(toCsvField(payload).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
    });
  }

  it("leaves an ordinary name untouched", () => {
    expect(toCsvField("Asha")).toBe("Asha");
  });

  it("still quotes a neutralised field that also contains a comma", () => {
    expect(toCsvField("=cmd,x")).toBe(`"'=cmd,x"`);
  });
});
