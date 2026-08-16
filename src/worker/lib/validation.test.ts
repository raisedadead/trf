import { describe, expect, it } from "vitest";
import { validateSubscribe } from "./validation.ts";

const base = {
  name: "Asha",
  email: "asha@example.com",
  mobile: "+91 98765 43210",
  pan: "abcde1234f",
  address: "MG Road, Bengaluru",
  tier: 100,
  consent: true,
  newsletter: true,
};

describe("validateSubscribe", () => {
  it("accepts and normalizes valid input", () => {
    const result = validateSubscribe(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pan).toBe("ABCDE1234F");
      expect(result.value.mobile).toBe("9876543210");
      expect(result.value.email).toBe("asha@example.com");
    }
  });

  it("rejects a bad email", () => {
    const result = validateSubscribe({ ...base, email: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("email");
  });

  it("rejects an amount outside the fixed tier set", () => {
    const result = validateSubscribe({ ...base, tier: 37 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("tier");
  });

  it("requires the authorization consent", () => {
    const result = validateSubscribe({ ...base, consent: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("consent");
  });

  it("rejects an invalid PAN", () => {
    const result = validateSubscribe({ ...base, pan: "XYZ" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("pan");
  });
});
