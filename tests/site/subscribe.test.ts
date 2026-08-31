import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { OUT } from "./dist.ts";

let html = "";
let bundle = "";
beforeAll(() => {
  html = readFileSync(`${OUT}/subscribe.html`, "utf8");
  bundle = [...inlineModules(), ...externalModules()].join("\n");
});

// Astro inlines a small enough island and emits a file for a larger one. The
// waitlist script sits near that threshold, so read both rather than assume.
function inlineModules(): string[] {
  return [...html.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function externalModules(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...html.matchAll(/\/_astro\/[^"']+\.js/g)].map((m) => resolve(OUT, `.${m[0]}`));
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const source = readFileSync(path, "utf8");
    out.push(source);
    for (const m of source.matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g)) {
      queue.push(resolve(dirname(path), m[1]));
    }
  }
  return out;
}

describe("Subscribe page (/subscribe)", () => {
  it("asks to be notified rather than to contribute, while payments are closed", () => {
    expect(html).toContain("Get notified at launch");
    expect(html).not.toContain("Become a Founding Contributor");
  });

  it("renders the waitlist form with name and email", () => {
    expect(html).toContain('id="waitlist-form"');
    expect(html).toContain('id="waitlist-name"');
    expect(html).toContain('id="waitlist-email"');
  });

  it("renders no payment form and asks for no PAN or address", () => {
    expect(html).not.toContain('id="autopay-form"');
    expect(html).not.toContain('id="autopay-pan"');
    expect(html).not.toContain('id="autopay-address"');
  });

  it("loads no payment provider script", () => {
    expect(html).not.toContain("razorpay");
  });

  it("wires the waitlist submit path into the shipped island", () => {
    expect(html).toContain('<script type="module"');
    expect(bundle).toContain("/api/waitlist");
  });

  it("has exactly one h1", () => {
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("sets the subscribe title", () => {
    expect(html).toContain("<title>Get notified at launch — The Rupee Fund</title>");
  });
});
