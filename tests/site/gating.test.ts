import { describe, expect, it } from "vitest";
import { PAGES, read } from "./dist.ts";

const REMOVED_HREFS = ["/vote", "/manage", "/thank-you"] as const;

describe("no shipped page links to a page this build removed", () => {
  // Every built page, so a page added later is scanned without a list to update.
  for (const page of PAGES) {
    for (const href of REMOVED_HREFS) {
      it(`${page} has no link to ${href}`, () => {
        expect(read(page)).not.toContain(`href="${href}"`);
      });
    }
  }
});

describe("the copy promises only what this build can do", () => {
  it("asks visitors to be notified rather than to contribute, while payments are closed", () => {
    expect(read("index.html")).toContain("Get notified at launch");
    expect(read("index.html")).not.toContain("Become a Founding Contributor");
  });

  it("states a working removal address wherever it collects an address", () => {
    expect(read("subscribe.html")).toContain("foundation@fossunited.org");
  });

  it("links a privacy policy from the form that collects personal data", () => {
    expect(read("subscribe.html")).toContain('href="/privacy"');
  });
});

describe("the privacy page carries what an invisible Turnstile widget obliges", () => {
  const html = read("privacy.html");

  it("references the Turnstile Privacy Addendum, which invisible mode makes a condition", () => {
    expect(html).toContain("https://www.cloudflare.com/turnstile-privacy-policy/");
  });

  it("points at the full FOSS United policy it sits under", () => {
    expect(html).toContain("https://fossunited.org/privacy-policy");
  });

  it("states the removal address", () => {
    expect(html).toContain("foundation@fossunited.org");
  });
});

describe("each legal page names the route its governing document names", () => {
  it("sends a refund claim to the address the refund policy names, with its limit", () => {
    const html = read("refunds.html");
    expect(html).toContain("audit@fossunited.org");
    expect(html).toContain("15 days");
  });

  it("links the FOSS United document it defers to, and claims no more than that", () => {
    // Each document is written for fossunited.org. The page may adopt it; it
    // cannot say the document already binds rupeefund.org. Pin the link, which
    // is structural, rather than the sentence around it.
    const upstream = {
      "privacy.html": "https://fossunited.org/privacy-policy",
      "refunds.html": "https://fossunited.org/refund-transfer-policy",
    };
    for (const [page, url] of Object.entries(upstream)) {
      const html = read(page);
      expect(html, `${page} does not link its document`).toContain(url);
      expect(html, `${page} overstates the scope`).not.toMatch(/govern[s]? this site/);
    }
  });

  it("names Cloudflare where it states what happens to the IP address", () => {
    // The signup passes the IP to Turnstile verification, so Cloudflare is a
    // recipient. Scope the check to that section: the page names Cloudflare
    // elsewhere too, and a page-wide match would pass on the wrong sentence.
    const section = /Your IP address<\/h2>([\s\S]*?)<\/p>/.exec(read("privacy.html"))?.[1] ?? "";
    expect(section, "no IP address section").not.toBe("");
    expect(section).toContain("Cloudflare");
  });
});
