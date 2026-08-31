const TURNSTILE_FIELD = "cf-turnstile-response";

interface TurnstileApi {
  reset(container?: string): void;
}

function showError(err: HTMLElement | null, message: string): void {
  if (!err) return;
  err.textContent = message;
}

function resetTurnstile(doc: Document): void {
  const api = (doc.defaultView as unknown as { turnstile?: TurnstileApi } | null)?.turnstile;
  if (api === undefined) return;
  api.reset("#waitlist-turnstile");
}

async function awaitTurnstileToken(form: HTMLFormElement, timeoutMs = 20000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const token = String(new FormData(form).get(TURNSTILE_FIELD) ?? "");
    if (token.length > 0) return token;
    if (Date.now() >= deadline) return "";
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
}

export async function submitWaitlist(
  form: HTMLFormElement,
  deps: { fetchImpl: typeof fetch; tokenTimeoutMs?: number },
): Promise<void> {
  const doc = form.ownerDocument;
  const err = doc.getElementById("waitlist-error");
  const success = doc.getElementById("waitlist-success");
  const submit = doc.getElementById("waitlist-submit") as HTMLButtonElement | null;

  showError(err, "");
  const fd = new FormData(form);
  const idleLabel = submit?.textContent ?? "";
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Joining…";
  }
  try {
    const turnstileToken = await awaitTurnstileToken(form, deps.tokenTimeoutMs);
    if (turnstileToken.length === 0) {
      showError(err, "The bot check did not finish. Reload the page, then try again.");
      return;
    }
    const res = await deps.fetchImpl("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        source: String(fd.get("source") ?? ""),
        company: String(fd.get("company") ?? ""),
        turnstileToken,
      }),
    });
    if (!res.ok) {
      resetTurnstile(doc);
      showError(err, "Something went wrong. Please try again.");
      return;
    }
    form.style.display = "none";
    success?.classList.remove("hidden");
  } catch {
    resetTurnstile(doc);
    showError(err, "Network error. Please try again.");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = idleLabel;
    }
  }
}

function initWaitlistForm(doc: Document, deps: { fetchImpl: typeof fetch }): void {
  const form = doc.getElementById("waitlist-form") as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitWaitlist(form, deps);
  });
}

function onReady(run: () => void): void {
  if (typeof document === "undefined") return;
  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run);
}

export function initSubscribePage(): void {
  onReady(() => {
    initWaitlistForm(document, { fetchImpl: window.fetch.bind(window) });
  });
}
