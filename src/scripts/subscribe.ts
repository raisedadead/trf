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
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
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
      for (const b of buttons) b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
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
