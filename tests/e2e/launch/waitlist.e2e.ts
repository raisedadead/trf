import { expect, test } from "@playwright/test";

test.describe("waitlist signup (pre-launch build)", () => {
  test("submitting the waitlist form shows the success state", async ({ page }) => {
    await page.goto("/subscribe");
    await expect(page.locator("#waitlist-form")).toBeVisible();

    await page.fill("#waitlist-name", "Asha Tester");
    await page.fill("#waitlist-email", `asha+${Date.now()}@example.com`);
    await page.click("#waitlist-submit");

    await expect(page.locator("#waitlist-success")).toBeVisible();
    await expect(page.locator("#waitlist-error")).toBeHidden();
  });
});
