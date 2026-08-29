import { expect, test } from "@playwright/test";

const PATHS = ["/", "/subscribe", "/waitlist-confirmed"] as const;

test.describe("baseline accessibility", () => {
  for (const path of PATHS) {
    test(`${path} has one h1 and a single main landmark`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
    });
  }

  test("the skip link targets main content and is focusable", async ({ page }) => {
    await page.goto("/");
    const skip = page.locator('a[href="#main"]');
    await expect(skip).toHaveCount(1);
    await skip.focus();
    await expect(skip).toBeFocused();
  });
});
