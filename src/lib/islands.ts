interface FormDeps {
  fetchImpl: typeof fetch;
  navigate: (url: string) => void;
}

interface CheckoutHandlerResult {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface CheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  theme: { color: string };
  prefill: { name: string; email: string; contact: string };
  handler: (result: CheckoutHandlerResult) => void;
  modal: { ondismiss: () => void };
}

interface AutopayDeps extends FormDeps {
  openCheckout: (options: CheckoutOptions) => Promise<void>;
}

interface SubscribeResponse {
  subscription_id?: string;
  key_id?: string;
  short_url: string;
}

function showError(err: HTMLElement | null, message: string): void {
  if (!err) return;
  err.textContent = message;
}

async function verifyAndFinish(
  result: CheckoutHandlerResult,
  deps: AutopayDeps,
  err: HTMLElement | null,
): Promise<void> {
  try {
    const res = await deps.fetchImpl("/api/subscribe/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_subscription_id: result.razorpay_subscription_id,
        razorpay_signature: result.razorpay_signature,
      }),
    });
    if (res.ok) deps.navigate("/thank-you");
    else showError(err, "We couldn't confirm your mandate — check your email for confirmation.");
  } catch {
    showError(err, "We couldn't confirm your mandate — check your email for confirmation.");
  }
}

export async function submitAutopay(form: HTMLFormElement, deps: AutopayDeps): Promise<void> {
  const doc = form.ownerDocument;
  const err = doc.getElementById("autopay-error");
  const submit = doc.getElementById("autopay-submit") as HTMLButtonElement | null;
  const tier = doc.getElementById("tier-value") as HTMLInputElement | null;

  showError(err, "");
  const fd = new FormData(form);
  const reset = (): void => {
    if (!submit) return;
    submit.disabled = false;
    submit.textContent = "Set Up UPI AutoPay";
  };
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Setting up…";
  }
  try {
    const res = await deps.fetchImpl("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        mobile: String(fd.get("mobile") ?? ""),
        pan: String(fd.get("pan") ?? ""),
        address: String(fd.get("address") ?? ""),
        tier: Number(tier?.value ?? "0"),
        consent: fd.get("terms") === "on",
        newsletter: fd.get("newsletter") === "on",
      }),
    });
    if (!res.ok) {
      showError(
        err,
        res.status === 409
          ? "You're already subscribed with this email."
          : "Something went wrong. Please try again.",
      );
      reset();
      return;
    }
    const data = (await res.json()) as SubscribeResponse;
    if (!data.subscription_id || !data.key_id) {
      deps.navigate(data.short_url);
      return;
    }
    const options: CheckoutOptions = {
      key: data.key_id,
      subscription_id: data.subscription_id,
      name: "The Rupee Fund",
      description: "Monthly contribution · Founding Contributor",
      theme: { color: "#057a33" },
      prefill: {
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        contact: String(fd.get("mobile") ?? ""),
      },
      handler: (result) => verifyAndFinish(result, deps, err),
      modal: { ondismiss: reset },
    };
    try {
      await deps.openCheckout(options);
    } catch {
      deps.navigate(data.short_url);
    }
  } catch {
    showError(err, "Network error. Please try again.");
    reset();
  }
}

const TURNSTILE_FIELD = "cf-turnstile-response";

interface TurnstileApi {
  reset(container?: string): void;
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function submitWaitlist(
  form: HTMLFormElement,
  deps: Pick<FormDeps, "fetchImpl"> & { tokenTimeoutMs?: number },
): Promise<void> {
  const doc = form.ownerDocument;
  const err = doc.getElementById("waitlist-error");
  const success = doc.getElementById("waitlist-success");
  const submit = doc.getElementById("waitlist-submit") as HTMLButtonElement | null;

  showError(err, "");
  const fd = new FormData(form);
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Joining…";
  }
  try {
    const turnstileToken = await awaitTurnstileToken(form, deps.tokenTimeoutMs ?? 20000);
    if (turnstileToken.length === 0) {
      showError(err, "The bot check is not ready. Complete it above, then submit again.");
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
      submit.textContent = "Join the Waitlist";
    }
  }
}

function initAutopayForm(doc: Document, deps: AutopayDeps): void {
  const form = doc.getElementById("autopay-form") as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitAutopay(form, deps);
  });
}

function initWaitlistForm(doc: Document, deps: Pick<FormDeps, "fetchImpl">): void {
  const form = doc.getElementById("waitlist-form") as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitWaitlist(form, deps);
  });
}

export function initTiers(doc: Document): void {
  const group = doc.getElementById("tier-group");
  const hidden = doc.getElementById("tier-value") as HTMLInputElement | null;
  if (!group || !hidden) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("button[data-tier]"));
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      hidden.value = btn.dataset.tier ?? hidden.value;
      for (const b of buttons) {
        const active = b === btn;
        b.setAttribute("aria-pressed", active ? "true" : "false");
        b.classList.toggle("border-brand", active);
        b.classList.toggle("bg-brand-50", active);
        b.classList.toggle("text-brand-900", active);
        b.classList.toggle("border-ink/20", !active);
        b.classList.toggle("hover:border-brand", !active);
        b.classList.toggle("hover:text-brand-fg", !active);
      }
    });
  }
}

interface VoteProposal {
  slug: string;
  title: string;
  body: string;
  options: Array<{ key: string; label: string }>;
  state: "pending" | "open" | "closed";
}

export async function submitVoteRequest(
  form: HTMLFormElement,
  deps: Pick<FormDeps, "fetchImpl">,
): Promise<void> {
  const doc = form.ownerDocument;
  const err = doc.getElementById("vote-request-error");
  const success = doc.getElementById("vote-request-success");
  const submit = doc.getElementById("vote-request-submit") as HTMLButtonElement | null;
  showError(err, "");
  const fd = new FormData(form);
  if (submit) submit.disabled = true;
  try {
    const res = await deps.fetchImpl("/api/vote/request-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email") ?? ""),
        proposal_slug: String(fd.get("proposal_slug") ?? ""),
      }),
    });
    if (!res.ok) {
      showError(err, "Something went wrong. Please try again.");
      return;
    }
    form.style.display = "none";
    success?.removeAttribute("hidden");
  } catch {
    showError(err, "Network error. Please try again.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

export async function submitVoteCast(
  form: HTMLFormElement,
  deps: Pick<FormDeps, "fetchImpl">,
): Promise<void> {
  const doc = form.ownerDocument;
  const err = doc.getElementById("vote-cast-error");
  const success = doc.getElementById("vote-cast-success");
  const submit = doc.getElementById("vote-cast-submit") as HTMLButtonElement | null;
  const choice = doc.getElementById("vote-choice-value") as HTMLInputElement | null;
  const token = doc.getElementById("vote-token-value") as HTMLInputElement | null;
  showError(err, "");
  if (!choice?.value) {
    showError(err, "Choose an option first.");
    return;
  }
  if (submit) submit.disabled = true;
  try {
    const res = await deps.fetchImpl("/api/vote/cast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: token?.value ?? "", choice: choice.value }),
    });
    if (!res.ok) {
      const map: Record<number, string> = {
        400: "This voting link is invalid or has expired.",
        403: "Your contribution isn't eligible to vote yet.",
        409: "You've already voted on this proposal.",
      };
      showError(err, map[res.status] ?? "Something went wrong. Please try again.");
      return;
    }
    form.style.display = "none";
    success?.removeAttribute("hidden");
  } catch {
    showError(err, "Network error. Please try again.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

function renderChoices(doc: Document, options: VoteProposal["options"]): void {
  const group = doc.getElementById("vote-choices");
  const hidden = doc.getElementById("vote-choice-value") as HTMLInputElement | null;
  if (!group || !hidden) return;
  group.replaceChildren();
  for (const opt of options) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.dataset.choice = opt.key;
    btn.textContent = opt.label;
    btn.setAttribute("aria-pressed", "false");
    btn.className =
      "px-3 py-2 text-sm font-medium border rounded-md transition duration-150 ease-out border-ink/20 hover:border-brand hover:text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg";
    btn.addEventListener("click", () => {
      hidden.value = opt.key;
      for (const b of group.querySelectorAll<HTMLButtonElement>("button[data-choice]")) {
        const active = b === btn;
        b.setAttribute("aria-pressed", active ? "true" : "false");
        b.classList.toggle("border-brand", active);
        b.classList.toggle("bg-brand-50", active);
        b.classList.toggle("text-brand-900", active);
      }
    });
    group.append(btn);
  }
}

export async function initVote(doc: Document, deps: Pick<FormDeps, "fetchImpl">): Promise<void> {
  const search = doc.defaultView?.location.search ?? "";
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const castSection = doc.getElementById("vote-cast");
  const requestSection = doc.getElementById("vote-request");

  let proposals: VoteProposal[] = [];
  try {
    const res = await deps.fetchImpl("/api/vote/proposals");
    if (res.ok) proposals = (await res.json()) as VoteProposal[];
  } catch {
    proposals = [];
  }

  if (token) {
    castSection?.removeAttribute("hidden");
    requestSection?.setAttribute("hidden", "");
    const tokenInput = doc.getElementById("vote-token-value") as HTMLInputElement | null;
    if (tokenInput) tokenInput.value = token;
    const slug = params.get("p");
    const proposal = proposals.find((p) => p.slug === slug);
    const titleEl = doc.getElementById("vote-cast-title");
    const bodyEl = doc.getElementById("vote-cast-body");
    if (titleEl) titleEl.textContent = proposal?.title ?? "Cast your vote";
    if (bodyEl) bodyEl.textContent = proposal?.body ?? "";
    renderChoices(doc, proposal?.options ?? []);
    const castForm = doc.getElementById("vote-cast-form") as HTMLFormElement | null;
    castForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      void submitVoteCast(castForm, deps);
    });
    return;
  }

  const select = doc.getElementById("vote-proposal-select") as HTMLSelectElement | null;
  const open = proposals.filter((p) => p.state === "open");
  const empty = doc.getElementById("vote-open-empty");
  if (select) {
    select.replaceChildren();
    for (const p of open) {
      const opt = doc.createElement("option");
      opt.value = p.slug;
      opt.textContent = p.title;
      select.append(opt);
    }
  }
  if (open.length === 0) {
    empty?.removeAttribute("hidden");
    doc.getElementById("vote-request-form")?.setAttribute("hidden", "");
  }

  const requestForm = doc.getElementById("vote-request-form") as HTMLFormElement | null;
  requestForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitVoteRequest(requestForm, deps);
  });

  await renderResults(doc, deps, proposals);
}

async function renderResults(
  doc: Document,
  deps: Pick<FormDeps, "fetchImpl">,
  proposals: VoteProposal[],
): Promise<void> {
  const list = doc.getElementById("vote-results-list");
  if (!list) return;
  const closed = proposals.filter((p) => p.state === "closed");
  if (closed.length === 0) {
    list.textContent = "No results yet.";
    return;
  }
  list.replaceChildren();
  for (const p of closed) {
    let tallies: Record<string, number> = {};
    try {
      const res = await deps.fetchImpl(`/api/vote/results/${encodeURIComponent(p.slug)}`);
      if (res.ok) tallies = ((await res.json()) as { tallies: Record<string, number> }).tallies;
    } catch {
      tallies = {};
    }
    const labelFor = (key: string): string => p.options.find((o) => o.key === key)?.label ?? key;
    const item = doc.createElement("div");
    const heading = doc.createElement("p");
    heading.className = "font-semibold text-ink";
    heading.textContent = p.title;
    item.append(heading);
    const entries = Object.entries(tallies);
    if (entries.length === 0) {
      const none = doc.createElement("p");
      none.textContent = "No votes cast.";
      item.append(none);
    } else {
      const ul = doc.createElement("ul");
      ul.className = "list-disc list-inside";
      for (const [key, count] of entries) {
        const li = doc.createElement("li");
        li.textContent = `${labelFor(key)}: ${count}`;
        ul.append(li);
      }
      item.append(ul);
    }
    list.append(item);
  }
}

function onReady(run: () => void): void {
  if (typeof document === "undefined") return;
  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run);
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayCtor = new (options: CheckoutOptions) => { open(): void };

function razorpayWindow(doc: Document): (Window & { Razorpay?: RazorpayCtor }) | null {
  return doc.defaultView as (Window & { Razorpay?: RazorpayCtor }) | null;
}

let checkoutLoad: Promise<void> | null = null;
function ensureCheckout(doc: Document): Promise<void> {
  if (razorpayWindow(doc)?.Razorpay) return Promise.resolve();
  if (checkoutLoad) return checkoutLoad;
  checkoutLoad = new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      checkoutLoad = null;
      reject(new Error("checkout script failed to load"));
    });
    doc.head.append(script);
  });
  return checkoutLoad;
}

function makeOpenCheckout(doc: Document): (options: CheckoutOptions) => Promise<void> {
  return async (options) => {
    await ensureCheckout(doc);
    const Ctor = razorpayWindow(doc)?.Razorpay;
    if (!Ctor) throw new Error("Razorpay unavailable");
    new Ctor(options).open();
  };
}

export function initSubscribePage(): void {
  onReady(() => {
    const fetchImpl = window.fetch.bind(window);
    if (document.getElementById("autopay-form")) {
      initTiers(document);
      initAutopayForm(document, {
        fetchImpl,
        navigate: (url) => {
          window.location.href = url;
        },
        openCheckout: makeOpenCheckout(document),
      });
      const submit = document.getElementById("autopay-submit");
      const preload = (): void => {
        void ensureCheckout(document).catch(() => undefined);
      };
      submit?.addEventListener("pointerenter", preload, { once: true });
      submit?.addEventListener("focus", preload, { once: true });
      submit?.addEventListener("touchstart", preload, { once: true, passive: true });
    }
    if (document.getElementById("waitlist-form")) {
      initWaitlistForm(document, { fetchImpl });
    }
  });
}

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
