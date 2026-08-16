import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initThankYou,
  initTiers,
  submitAutopay,
  submitVoteCast,
  submitVoteRequest,
  submitWaitlist,
} from "./islands.ts";

function okJson(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("submitAutopay", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="autopay-form">
        <input name="name" value="Ada" />
        <input name="email" value="ada@example.com" />
        <input name="mobile" value="+91 90000 00000" />
        <input id="tier-value" value="100" />
        <button id="autopay-submit">Set Up UPI AutoPay</button>
        <p id="autopay-error"></p>
      </form>`;
  });

  const okSubscribe = () =>
    okJson({ subscription_id: "sub_1", key_id: "rzp_test_k", short_url: "https://rzp.io/x" });

  it("opens the Razorpay checkout modal on a successful subscribe", async () => {
    const openCheckout = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(okSubscribe());
    const form = document.getElementById("autopay-form") as HTMLFormElement;

    await submitAutopay(form, { fetchImpl, navigate: vi.fn(), openCheckout });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/subscribe",
      expect.objectContaining({ method: "POST" }),
    );
    expect(openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_id: "sub_1", key: "rzp_test_k" }),
    );
  });

  it("verifies the signature and lands on thank-you when the mandate is authorized", async () => {
    const navigate = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okSubscribe())
      .mockResolvedValueOnce(okJson({ ok: true }));
    const openCheckout = vi.fn().mockImplementation((opts) =>
      Promise.resolve(
        opts.handler({
          razorpay_payment_id: "pay_1",
          razorpay_subscription_id: "sub_1",
          razorpay_signature: "sig_1",
        }),
      ),
    );
    const form = document.getElementById("autopay-form") as HTMLFormElement;

    await submitAutopay(form, { fetchImpl, navigate, openCheckout });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/subscribe/verify",
      expect.objectContaining({ method: "POST" }),
    );
    expect(navigate).toHaveBeenCalledWith("/thank-you");
  });

  it("re-enables the submit button when the modal is dismissed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okSubscribe());
    const openCheckout = vi.fn().mockImplementation((opts) => {
      opts.modal.ondismiss();
      return Promise.resolve();
    });
    const form = document.getElementById("autopay-form") as HTMLFormElement;
    const submit = document.getElementById("autopay-submit") as HTMLButtonElement;

    await submitAutopay(form, { fetchImpl, navigate: vi.fn(), openCheckout });

    expect(submit.disabled).toBe(false);
  });

  it("falls back to the short_url redirect when the modal cannot open", async () => {
    const navigate = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(okSubscribe());
    const openCheckout = vi.fn().mockRejectedValue(new Error("blocked"));
    const form = document.getElementById("autopay-form") as HTMLFormElement;

    await submitAutopay(form, { fetchImpl, navigate, openCheckout });

    expect(navigate).toHaveBeenCalledWith("https://rzp.io/x");
  });

  it("shows the already-subscribed message and re-enables on 409", async () => {
    const openCheckout = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(okJson({}, 409));
    const form = document.getElementById("autopay-form") as HTMLFormElement;
    const submit = document.getElementById("autopay-submit") as HTMLButtonElement;

    await submitAutopay(form, { fetchImpl, navigate: vi.fn(), openCheckout });

    expect(openCheckout).not.toHaveBeenCalled();
    expect(document.getElementById("autopay-error")?.textContent).toContain("already subscribed");
    expect(submit.disabled).toBe(false);
  });

  it("shows a network error and re-enables on fetch rejection", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const form = document.getElementById("autopay-form") as HTMLFormElement;
    const submit = document.getElementById("autopay-submit") as HTMLButtonElement;

    await submitAutopay(form, { fetchImpl, navigate: vi.fn(), openCheckout: vi.fn() });

    expect(document.getElementById("autopay-error")?.textContent).toContain("Network error");
    expect(submit.disabled).toBe(false);
  });
});

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

describe("submitWaitlist", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="waitlist-form">
        <input name="name" value="Ada" />
        <input name="email" value="ada@example.com" />
        <input name="cf-turnstile-response" value="tok" />
        <button id="waitlist-submit">Join the Waitlist</button>
        <p id="waitlist-error"></p>
      </form>
      <div id="waitlist-success" class="hidden"></div>`;
  });

  it("hides the form and reveals success on ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl });

    expect(form.style.display).toBe("none");
    expect(document.getElementById("waitlist-success")?.classList.contains("hidden")).toBe(false);
  });

  it("sends the bot-check token the widget produced", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.turnstileToken).toBe("tok");
  });

  it("waits for a token that the widget supplies late, instead of giving up immediately", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const field = form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
    field.value = "";
    setTimeout(() => {
      field.value = "late-token";
    }, 150);

    await submitWaitlist(form, { fetchImpl, tokenTimeoutMs: 4000 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).turnstileToken).toBe(
      "late-token",
    );
  });

  it("gives up once its deadline passes rather than polling forever", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement).value = "";

    await submitWaitlist(form, { fetchImpl, tokenTimeoutMs: 120 });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("re-enables the submit button after a failed attempt", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement).value = "";

    await submitWaitlist(form, { fetchImpl, tokenTimeoutMs: 0 });

    expect((document.getElementById("waitlist-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("asks Cloudflare for a new token after the server rejects the request", async () => {
    const resets: string[] = [];
    (window as unknown as { turnstile: { reset(c?: string): void } }).turnstile = {
      reset: (c) => resets.push(String(c)),
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl });

    expect(resets).toEqual(["#waitlist-turnstile"]);
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it("does not fail when Cloudflare's script is absent", async () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl });

    expect(document.getElementById("waitlist-error")?.textContent).toMatch(/went wrong/i);
  });

  it("says the bot check did not load rather than posting a request that must fail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    form.querySelector('input[name="cf-turnstile-response"]')!.remove();

    await submitWaitlist(form, { fetchImpl, tokenTimeoutMs: 0 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(document.getElementById("waitlist-error")?.textContent).toMatch(/bot check/i);
  });
});

describe("initTiers", () => {
  it("marks the clicked tier active and updates the hidden value", () => {
    document.body.innerHTML = `
      <input id="tier-value" value="100" />
      <div id="tier-group">
        <button data-tier="100" aria-pressed="true">₹100</button>
        <button data-tier="500" aria-pressed="false">₹500</button>
      </div>`;
    initTiers(document);
    const btn500 = document.querySelector<HTMLButtonElement>('button[data-tier="500"]')!;
    btn500.click();

    expect((document.getElementById("tier-value") as HTMLInputElement).value).toBe("500");
    expect(btn500.getAttribute("aria-pressed")).toBe("true");
    expect(btn500.classList.contains("text-brand-900")).toBe(true);
  });
});

describe("submitVoteRequest", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="vote-request-form">
        <select name="proposal_slug"><option value="season-1" selected>S1</option></select>
        <input name="email" value="ada@example.com" />
        <button id="vote-request-submit"></button>
        <p id="vote-request-error"></p>
      </form>
      <div id="vote-request-success" hidden></div>`;
  });

  it("posts a request-link and reveals the check-your-email panel", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("vote-request-form") as HTMLFormElement;

    await submitVoteRequest(form, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/vote/request-link",
      expect.objectContaining({ method: "POST" }),
    );
    expect(form.style.display).toBe("none");
    expect(document.getElementById("vote-request-success")?.hasAttribute("hidden")).toBe(false);
  });
});

describe("submitVoteCast", () => {
  function setup(choice: string) {
    document.body.innerHTML = `
      <form id="vote-cast-form">
        <input id="vote-token-value" value="tok1" />
        <input id="vote-choice-value" value="${choice}" />
        <button id="vote-cast-submit"></button>
        <p id="vote-cast-error"></p>
      </form>
      <div id="vote-cast-success" hidden></div>`;
    return document.getElementById("vote-cast-form") as HTMLFormElement;
  }

  it("guards against submitting without a choice", async () => {
    const fetchImpl = vi.fn();
    const form = setup("");

    await submitVoteCast(form, { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(document.getElementById("vote-cast-error")?.textContent).toContain("Choose an option");
  });

  it("posts token + choice and reveals success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = setup("project-a");

    await submitVoteCast(form, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/vote/cast",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok1", choice: "project-a" }),
      }),
    );
    expect(document.getElementById("vote-cast-success")?.hasAttribute("hidden")).toBe(false);
  });

  it("maps a 409 to an already-voted message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({}, 409));
    const form = setup("project-a");

    await submitVoteCast(form, { fetchImpl });

    expect(document.getElementById("vote-cast-error")?.textContent).toContain("already voted");
  });
});
