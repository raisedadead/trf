interface VoteDeps {
  fetchImpl: typeof fetch;
}

interface VoteProposal {
  slug: string;
  title: string;
  body: string;
  options: Array<{ key: string; label: string }>;
  state: "pending" | "open" | "closed";
}

function showError(err: HTMLElement | null, message: string): void {
  if (!err) return;
  err.textContent = message;
}

export async function submitVoteRequest(form: HTMLFormElement, deps: VoteDeps): Promise<void> {
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

export async function submitVoteCast(form: HTMLFormElement, deps: VoteDeps): Promise<void> {
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
    btn.className = "choice text-sm font-medium";
    btn.addEventListener("click", () => {
      hidden.value = opt.key;
      for (const b of group.querySelectorAll<HTMLButtonElement>("button[data-choice]")) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      }
    });
    group.append(btn);
  }
}

async function renderResults(
  doc: Document,
  deps: VoteDeps,
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
    heading.textContent = p.title;
    item.append(heading);
    const entries = Object.entries(tallies);
    if (entries.length === 0) {
      const none = doc.createElement("p");
      none.textContent = "No votes cast.";
      item.append(none);
    } else {
      const ul = doc.createElement("ul");
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

export async function initVote(doc: Document, deps: VoteDeps): Promise<void> {
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
