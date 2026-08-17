import { describe, expect, it, vi } from "vitest";
import { initThankYou } from "./share.ts";

describe("initThankYou", () => {
  it("copies the share url to the clipboard and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    document.body.innerHTML = `
      <button id="share-btn" data-share-url="https://rupeefund.org">Copy</button>
      <span id="share-note"></span>`;

    initThankYou(document);
    (document.getElementById("share-btn") as HTMLButtonElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("https://rupeefund.org");
    expect(document.getElementById("share-note")?.textContent).toBe("Link copied!");
  });
});
