import { describe, expect, it } from "vitest";
import { createMailer } from "./newsletter.ts";

describe("createMailer", () => {
  it("returns a mailer whose sendWelcome resolves without sending", async () => {
    const mailer = createMailer();
    await expect(mailer.sendWelcome("a@b.com", "A")).resolves.toBeUndefined();
  });
});
