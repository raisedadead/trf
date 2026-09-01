import { expect, test } from "@playwright/test";

test.describe("waitlist signup with JavaScript disabled", () => {
  test("submitting the form records the signup and lands on a confirmation page", async ({
    page,
  }) => {
    await page.goto("/subscribe");
    await page.fill("#waitlist-name", "No Script");
    await page.fill("#waitlist-email", `nojs+${process.env.E2E_STAMP ?? "1"}@example.com`);
    await page.check('input[name="amount"][value="other"]');
    await page.fill("#waitlist-amount-other", "250");

    await Promise.all([page.waitForURL("**/waitlist-confirmed"), page.click("#waitlist-submit")]);

    await expect(page.locator("h1")).toHaveText(/You're on the list/);
  });

  test("never puts the address in the URL, which a GET fallback would do", async ({ page }) => {
    await page.goto("/subscribe");
    await page.fill("#waitlist-name", "No Script");
    await page.fill("#waitlist-email", `leak+${process.env.E2E_STAMP ?? "2"}@example.com`);
    await page.check('input[name="amount"][value="10"]');

    await Promise.all([page.waitForURL("**/waitlist-confirmed"), page.click("#waitlist-submit")]);

    expect(page.url()).not.toContain("@");
    expect(page.url()).not.toContain("email=");
  });

  test("refuses to post until an amount is chosen, with no script to enforce it", async ({
    page,
  }) => {
    await page.goto("/subscribe");
    await page.fill("#waitlist-name", "No Amount");
    await page.fill("#waitlist-email", `noamount+${process.env.E2E_STAMP ?? "3"}@example.com`);

    await page.click("#waitlist-submit");

    await expect(page).toHaveURL(/\/subscribe$/);
    await expect(page.locator("#waitlist-form")).toBeVisible();
  });
});
