import { describe, expect, it } from "vitest";
import { TURNSTILE_TEST_SITEKEY, getSitekey, resolveSitekey } from "./turnstile.ts";

describe("resolveSitekey", () => {
  it("refuses an unset sitekey instead of falling back to the test key", () => {
    expect(() => resolveSitekey(undefined, false)).toThrow(/PUBLIC_TURNSTILE_SITEKEY/);
  });

  it("refuses an empty sitekey", () => {
    expect(() => resolveSitekey("", false)).toThrow(/PUBLIC_TURNSTILE_SITEKEY/);
  });

  it("names the failing variable so a build log explains itself", () => {
    expect(() => resolveSitekey(undefined, false)).toThrow(/unset/);
  });

  it("returns a real sitekey unchanged", () => {
    expect(resolveSitekey("0x4AAAAAAEQqCldZbFvXQvQr", false)).toBe("0x4AAAAAAEQqCldZbFvXQvQr");
  });

  it("refuses the test sitekey when nothing opted in, whatever script ran the build", () => {
    expect(() => resolveSitekey(TURNSTILE_TEST_SITEKEY, false)).toThrow(
      /PUBLIC_ALLOW_TEST_SITEKEY/,
    );
  });

  it("accepts the test sitekey only behind the explicit opt-in", () => {
    expect(resolveSitekey(TURNSTILE_TEST_SITEKEY, true)).toBe(TURNSTILE_TEST_SITEKEY);
  });

  it("still refuses an unset sitekey even with the opt-in on", () => {
    expect(() => resolveSitekey(undefined, true)).toThrow(/PUBLIC_TURNSTILE_SITEKEY/);
  });
});

describe("getSitekey", () => {
  it("is a function, not a module-level constant that throws on import", () => {
    expect(typeof getSitekey).toBe("function");
  });
});
