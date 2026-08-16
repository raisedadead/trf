import { expect, test } from "@playwright/test";

test.describe("autopay checkout (launch build)", () => {
  test.skip(
    process.env.PUBLIC_LAUNCH_LIVE !== "true",
    "needs PUBLIC_LAUNCH_LIVE=true build + real rzp_test_ keys (T1); un-skip after manual de-risk",
  );

  test("the subscribe page renders the autopay form and lazy-loads checkout.js", async ({
    page,
  }) => {
    await page.goto("/subscribe");
    await expect(page.locator("#autopay-submit")).toBeVisible();
    await page.locator("#autopay-submit").focus();
    await expect
      .poll(async () => page.locator('script[src*="checkout.razorpay.com"]').count())
      .toBeGreaterThan(0);
  });
});
