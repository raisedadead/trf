import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/subscribe",
  "/terms",
  "/code-of-conduct",
  "/waitlist-confirmed",
  "/waitlist-problem",
] as const;

const REMOVED = ["/manage", "/vote", "/thank-you", "/vote.html"] as const;

test.describe("public pages smoke", () => {
  for (const path of REMOVED) {
    test(`${path} is gone, not merely hidden`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });
  }

  for (const path of ROUTES) {
    test(`${path} renders with a title and one heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(/\S/);
    });
  }

  test("an unknown route serves the 404 page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveCount(1);
  });
});
