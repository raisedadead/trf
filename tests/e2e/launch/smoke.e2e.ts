import { expect, test } from "@playwright/test";

const ROUTES = [
  { path: "/", title: /The Rupee Fund/, h1: /Keep Indian open source alive/ },
  { path: "/subscribe", title: /Get notified/, h1: /Get notified at launch/ },
  { path: "/waitlist-confirmed", title: /You're on the list/, h1: /You're on the list/ },
  { path: "/waitlist-problem", title: /didn't go through/, h1: /didn't go through/ },
] as const;

const GATED = ["/manage", "/vote", "/thank-you", "/vote.html"] as const;

test.describe("public pages smoke", () => {
  for (const path of GATED) {
    test(`${path} is not reachable in a launch build`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });
  }

  for (const route of ROUTES) {
    test(`${route.path} renders with one h1 and the right title`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(route.h1);
    });
  }

  test("an unknown route serves the 404 page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(/Page not found/);
  });
});
