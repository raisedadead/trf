/// <reference lib="dom" />
// The evaluate callbacks read layout in the browser. The DOM lib stays scoped
// to the files that need it rather than widening tsconfig.node.json.
import { expect, test } from "@playwright/test";

const LEGAL_PAGES = ["/privacy", "/refunds"] as const;
const TALL = { width: 1280, height: 1600 };
const MAX_DEAD_SPACE_RATIO = 0.25;

test.describe("a short page ends at the footer, not a screen past it", () => {
  for (const path of LEGAL_PAGES) {
    test(`${path} scrolls only for text, never for empty space`, async ({ page }) => {
      await page.setViewportSize(TALL);
      await page.goto(path);

      const seen = await page.evaluate(() => {
        const main = document.querySelector("main");
        const footer = document.querySelector("footer");
        const content = main?.lastElementChild?.getBoundingClientRect().bottom ?? 0;
        return {
          scrollHeight: document.documentElement.scrollHeight,
          viewport: window.innerHeight,
          gap: (footer?.getBoundingClientRect().top ?? 0) - content,
          footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
        };
      });

      // main once carried min-h-screen, so the page measured header + 100vh +
      // footer whatever the content was: it scrolled, and a whole screen of
      // nothing sat between the text and the footer. A page that fits may
      // still hold a gap, because the footer is pinned to the bottom there.
      const fits = seen.scrollHeight <= seen.viewport + 1;
      if (fits) {
        expect(seen.footerBottom, "the footer must reach the bottom of the screen").toBeGreaterThan(
          seen.viewport - 2,
        );
      } else {
        expect(seen.gap, "dead space between the text and the footer").toBeLessThan(
          seen.viewport * MAX_DEAD_SPACE_RATIO,
        );
      }
    });
  }
});
