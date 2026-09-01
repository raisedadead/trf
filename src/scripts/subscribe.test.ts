import { beforeEach, describe, expect, it, vi } from "vitest";
import { linkOtherAmount, submitWaitlist } from "./subscribe.ts";

function okJson(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("submitWaitlist", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="waitlist-form">
        <input name="name" value="Ada" />
        <input name="email" value="ada@example.com" />
        <input type="radio" name="amount" value="10" />
        <input type="radio" name="amount" value="100" checked />
        <input type="radio" name="amount" value="other" />
        <input name="amount_other" value="" />
        <input name="months" value="12+" />
        <input name="question" value="Who audits this?" />
        <input name="cf-turnstile-response" value="tok" />
        <button id="waitlist-submit">Get notified</button>
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

  it("sends the contribution answers the subscriber gave", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;

    await submitWaitlist(form, { fetchImpl });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      amount: "100",
      amount_other: "",
      months: "12+",
      question: "Who audits this?",
    });
  });

  it("sends the typed amount beside the other option, so the server can resolve it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okJson({ ok: true }));
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    (form.querySelector('input[value="other"]') as HTMLInputElement).checked = true;
    (form.querySelector('input[name="amount_other"]') as HTMLInputElement).value = "250";

    await submitWaitlist(form, { fetchImpl });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ amount: "other", amount_other: "250" });
  });

  it("chooses the other option when the subscriber types an amount, so submit is not blocked", () => {
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const typed = form.querySelector('input[name="amount_other"]') as HTMLInputElement;
    const choice = form.querySelector('input[value="other"]') as HTMLInputElement;
    linkOtherAmount(form);

    typed.value = "250";
    typed.dispatchEvent(new Event("input"));

    expect(choice.checked).toBe(true);
  });

  it("leaves the chosen option alone while the typed amount is only whitespace", () => {
    const form = document.getElementById("waitlist-form") as HTMLFormElement;
    const typed = form.querySelector('input[name="amount_other"]') as HTMLInputElement;
    const choice = form.querySelector('input[value="other"]') as HTMLInputElement;
    linkOtherAmount(form);

    typed.value = "   ";
    typed.dispatchEvent(new Event("input"));

    expect(choice.checked).toBe(false);
    expect((form.querySelector('input[value="100"]') as HTMLInputElement).checked).toBe(true);
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
