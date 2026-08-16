import { describe, expect, it } from "vitest";
import { TURNSTILE_TEST_SITEKEY, getSitekey, resolveSitekey } from "./turnstile.ts";

describe("resolveSitekey", () => {
  it("refuses an unset sitekey instead of falling back to the test key", () => {
    expect(() => resolveSitekey(undefined)).toThrow(/PUBLIC_TURNSTILE_SITEKEY/);
  });

  it("refuses an empty sitekey", () => {
    expect(() => resolveSitekey("")).toThrow(/PUBLIC_TURNSTILE_SITEKEY/);
  });

  it("names the failing variable so a build log explains itself", () => {
    expect(() => resolveSitekey(undefined)).toThrow(/unset/);
  });

  it("returns a real sitekey unchanged", () => {
    expect(resolveSitekey("0x4AAAAAAEQqCldZbFvXQvQr")).toBe("0x4AAAAAAEQqCldZbFvXQvQr");
  });

  it("allows the test sitekey, which local preview and CI both set on purpose", () => {
    expect(resolveSitekey(TURNSTILE_TEST_SITEKEY)).toBe(TURNSTILE_TEST_SITEKEY);
  });
});

describe("getSitekey", () => {
  it("stays importable when the variable is absent, and only throws when called", () => {
    expect(typeof getSitekey).toBe("function");
  });
});
