import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let html = "";
let bundle = "";
beforeAll(() => {
  html = readFileSync("dist/subscribe.html", "utf8");
  const entrySrc = html.match(/\/_astro\/subscribe[^"']*\.js/)?.[0];
  bundle = entrySrc ? readBundle(entrySrc) : "";
});

function readBundle(entrySrc: string): string {
  const entryPath = resolve("dist", `.${entrySrc}`);
  const entry = readFileSync(entryPath, "utf8");
  const imports = [...entry.matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g)].map((m) =>
    readFileSync(resolve(dirname(entryPath), m[1]), "utf8"),
  );
  return [entry, ...imports].join("\n");
}

describe("Subscribe page (/subscribe) — pre-launch (waitlist-only, PUBLIC_LAUNCH_LIVE unset)", () => {
  it("renders the heading", () => {
    expect(html).toContain("Become a Founding Contributor");
  });

  it("renders the waitlist form with name and email", () => {
    expect(html).toContain('id="waitlist-form"');
    expect(html).toContain('id="waitlist-name"');
    expect(html).toContain('id="waitlist-email"');
  });

  it("does not render the autopay form or PII fields pre-launch", () => {
    expect(html).not.toContain('id="autopay-form"');
    expect(html).not.toContain('id="autopay-pan"');
    expect(html).not.toContain('id="autopay-address"');
  });

  it("does not render the dropped mode toggle", () => {
    expect(html).not.toContain('id="mode-autopay"');
    expect(html).not.toContain('id="mode-waitlist"');
    expect(html).not.toContain("peer-checked/ap");
    expect(html).not.toContain('getElementById("mode-autopay")');
  });

  it("wires the waitlist submit path in the island bundle", () => {
    expect(html).toContain('<script type="module"');
    expect(bundle).toContain("/api/waitlist");
  });

  it("has exactly one h1", () => {
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("sets the subscribe title", () => {
    expect(html).toContain("<title>Subscribe — The Rupee Fund</title>");
  });
});
