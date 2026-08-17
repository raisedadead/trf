export function initThankYou(doc: Document): void {
  const btn = doc.getElementById("share-btn") as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener("click", () => {
    const view = doc.defaultView;
    if (!view) return;
    const url = btn.dataset.shareUrl ?? view.location.origin;
    void view.navigator.clipboard?.writeText(url).then(() => {
      const note = doc.getElementById("share-note");
      if (!note) return;
      note.textContent = "Link copied!";
      view.setTimeout(() => {
        note.textContent = "";
      }, 1500);
    });
  });
}
