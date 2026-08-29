import { describe, expect, it } from "vitest";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, isValidEmail, validateWaitlist } from "./validation.ts";

const base = { name: "Asha", email: "Asha@Example.com", source: "subscribe" };

describe("validateWaitlist", () => {
  it("accepts a well-formed entry and lowercases the address", () => {
    const result = validateWaitlist(base);
    expect(result).toEqual({
      ok: true,
      value: { name: "Asha", email: "asha@example.com", source: "subscribe" },
    });
  });

  it("rejects a body that is not an object", () => {
    expect(validateWaitlist("nope")).toEqual({ ok: false, errors: ["body"] });
  });

  it("rejects a malformed address", () => {
    const result = validateWaitlist({ ...base, email: "nope" });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = validateWaitlist({ ...base, name: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects a name past the column budget", () => {
    const result = validateWaitlist({ ...base, name: "a".repeat(MAX_NAME_LENGTH + 1) });
    expect(result.ok).toBe(false);
  });

  it("rejects an address past the column budget", () => {
    const long = `${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`;
    const result = validateWaitlist({ ...base, email: long });
    expect(result.ok).toBe(false);
  });

  it("falls back to the default source when the value is not on the allowlist", () => {
    const result = validateWaitlist({ ...base, source: "somewhere-else" });
    expect(result).toMatchObject({ ok: true, value: { source: "subscribe" } });
  });

  it("keeps a source that is on the allowlist", () => {
    const result = validateWaitlist({ ...base, source: "FOOTER" });
    expect(result).toMatchObject({ ok: true, value: { source: "footer" } });
  });

  it("reports every failed field at once", () => {
    const result = validateWaitlist({ name: "", email: "nope" });
    expect(result).toEqual({ ok: false, errors: ["name", "email"] });
  });
});

describe("isValidEmail", () => {
  it("accepts an address with one at sign and a dotted domain", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });

  it("rejects an address with no domain dot", () => {
    expect(isValidEmail("a@b")).toBe(false);
  });
});
