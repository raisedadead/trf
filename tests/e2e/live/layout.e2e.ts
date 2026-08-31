/// <reference lib="dom" />
// The evaluate callbacks read layout in the browser. The DOM lib stays scoped
// to the files that need it rather than widening tsconfig.node.json.
import { expect, test } from "@playwright/test";

const SHORT_PAGES = ["/privacy", "/refunds"] as const;
const TALL = { width: 1280, height: 1600 };

test.describe("a short page ends at the footer, not a screen past it", () => {
  for (const path of SHORT_PAGES) {
    test(`${path} needs no scroll on a tall viewport`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await page.goto(path);

      const seen = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        viewport: window.innerHeight,
        footerBottom: document.querySelector("footer")?.getBoundingClientRect().bottom ?? 0,
      }));

      // main once carried min-h-screen, so the page measured header + 100vh +
      // footer whatever the content was. The footer then sat a whole screen
      // below the text, and every short page scrolled for nothing.
      expect(seen.scrollHeight).toBeLessThanOrEqual(seen.viewport + 1);
      expect(seen.footerBottom, "the footer must reach the bottom of the screen").toBeGreaterThan(
        seen.viewport - 2,
      );
    });
  }
});
