import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const headers = () => read("_headers");

function policy(): Record<string, string[]> {
  const line = headers()
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("Content-Security-Policy:"));
  if (line === undefined) throw new Error("no enforced Content-Security-Policy in dist/_headers");
  const out: Record<string, string[]> = {};
  for (const part of line.slice("Content-Security-Policy:".length).split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name !== undefined && name.length > 0) out[name] = values;
  }
  return out;
}

function allows(directive: string, origin: string): boolean {
  const p = policy();
  const values = p[directive] ?? p["default-src"] ?? [];
  return values.includes(origin);
}

function externalOrigins(attr: "src" | "href"): Set<string> {
  const found = new Set<string>();
  for (const page of PAGES) {
    const html = read(page);
    for (const m of html.matchAll(
      new RegExp(`<(script|link)[^>]*${attr}="(https://[^"]+)"`, "g"),
    )) {
      found.add(new URL(m[2]!).origin);
    }
  }
  return found;
}

describe("the shipped Content-Security-Policy is enforced, not advisory", () => {
  it("is a real policy and not Report-Only", () => {
    expect(headers()).toContain("Content-Security-Policy:");
  });

  it("carries no Report-Only policy, which would collect nothing without a report sink", () => {
    expect(headers()).not.toContain("Content-Security-Policy-Report-Only");
  });

  it("applies to every page, not just a couple of them", () => {
    const h = headers();
    const sitewide = h.slice(h.indexOf("/*"), h.indexOf("/_astro/*"));
    expect(sitewide).toContain("Content-Security-Policy:");
  });

  it("forbids framing and plugins outright", () => {
    expect(policy()["frame-ancestors"]).toEqual(["'none'"]);
    expect(policy()["object-src"]).toEqual(["'none'"]);
  });

  it("confines form submissions to our own origin and the payment provider", () => {
    expect(policy()["form-action"]).toEqual([
      "'self'",
      "https://api.razorpay.com",
      "https://checkout.razorpay.com",
    ]);
  });
});

describe("the policy permits everything the built pages actually load", () => {
  it("allows every external script origin the build references", () => {
    for (const origin of externalOrigins("src")) {
      expect(allows("script-src", origin), `script-src must allow ${origin}`).toBe(true);
    }
  });

  it("allows the stylesheet origins the build references", () => {
    for (const origin of externalOrigins("href")) {
      const permitted =
        allows("style-src", origin) ||
        allows("font-src", origin) ||
        origin === "https://rupeefund.org";
      expect(permitted, `style-src or font-src must allow ${origin}`).toBe(true);
    }
  });

  it("allows the Google Fonts stylesheet host the layout loads on every page", () => {
    expect(allows("style-src", "https://fonts.googleapis.com")).toBe(true);
  });

  it("allows the Google Fonts file host, which no earlier policy did", () => {
    expect(allows("font-src", "https://fonts.gstatic.com")).toBe(true);
  });

  it("allows the Turnstile script and its iframe", () => {
    expect(allows("script-src", "https://challenges.cloudflare.com")).toBe(true);
    expect(allows("frame-src", "https://challenges.cloudflare.com")).toBe(true);
  });

  it("tolerates the inline script Cloudflare Bot Fight Mode injects into every response", () => {
    expect(policy()["script-src"]).toContain("'unsafe-inline'");
  });

  it("still permits the post-launch payment surface, which ships the same _headers file", () => {
    expect(allows("script-src", "https://checkout.razorpay.com")).toBe(true);
    expect(allows("frame-src", "https://api.razorpay.com")).toBe(true);
    expect(allows("connect-src", "https://lumberjack.razorpay.com")).toBe(true);
  });

  it("allows the two origins Razorpay checkout injects at runtime, which no scan of dist can find", () => {
    expect(allows("script-src", "https://cdn.razorpay.com")).toBe(true);
    expect(allows("connect-src", "https://lumberjack-cx.razorpay.com")).toBe(true);
  });
});
