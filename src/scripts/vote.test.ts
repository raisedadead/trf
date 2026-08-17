import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitVoteCast, submitVoteRequest } from "./vote.ts";

function okJson(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

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
