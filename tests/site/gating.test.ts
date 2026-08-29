import { describe, expect, it } from "vitest";
import { read } from "./dist.ts";

const LAUNCH_PAGES = ["index.html", "subscribe.html", "404.html"] as const;
const GATED_HREFS = ["/vote", "/manage", "/thank-you"] as const;

describe("launch pages never link to a gated post-launch page", () => {
  for (const page of LAUNCH_PAGES) {
    for (const href of GATED_HREFS) {
      it(`${page} has no link to ${href}`, () => {
        expect(read(page)).not.toContain(`href="${href}"`);
      });
    }
  }
});

describe("launch copy promises only what the launch build can do", () => {
  it("asks visitors to be notified rather than to contribute, while payments are closed", () => {
    expect(read("index.html")).toContain("Get notified at launch");
    expect(read("index.html")).not.toContain("Become a Founding Contributor");
  });

  it("states a working removal address wherever it collects an address", () => {
    expect(read("subscribe.html")).toContain("foundation@fossunited.org");
  });

  it("links a privacy policy from the form that collects personal data", () => {
    expect(read("subscribe.html")).toContain("fossunited.org/privacy-policy");
  });
});
