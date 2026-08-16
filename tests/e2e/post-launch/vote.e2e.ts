import { expect, test } from "@playwright/test";

test.describe("voting request-link flow", () => {
  test("the vote page renders the request-link and results sections", async ({ page }) => {
    await page.goto("/vote");
    await expect(page.locator("#vote-request")).toBeVisible();
    await expect(page.locator("#vote-results")).toBeVisible();
  });

  test("requesting a link for a seeded open proposal shows the check-email state", async ({
    page,
  }) => {
    await page.goto("/vote");
    const options = page.locator("#vote-proposal-select option");
    await expect(page.locator("#vote-request-form")).toBeVisible();
    test.skip(
      (await options.count()) === 0,
      "no open proposal seeded — run scripts/seed-dev.sql (demo-open) against local D1",
    );

    await page.selectOption("#vote-proposal-select", { index: 0 });
    await page.fill("#vote-email", `voter+${Date.now()}@example.com`);
    await page.click("#vote-request-submit");

    await expect(page.locator("#vote-request-success")).toBeVisible();
  });
});
