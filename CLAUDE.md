# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Rupee Fund: a waitlist for recurring UPI AutoPay donations to Indian open source software, run by FOSS United Foundation. Astro (static site) + Hono (Cloudflare Worker) + D1, deployed to Cloudflare Workers. The system takes no payment and holds no vote — it collects a mailing list only.

Read `docs/architecture.md` before touching the Worker, the database, or the security headers — it explains the waitlist write path, migrations, and CSP in detail. Read `CONTRIBUTING.md` before your first commit — it explains the TypeScript project layout, the formatter split, and the delivery workflow. Read `docs/deploy.md` before promoting or applying a migration — it explains the branch model and the promote/rollback commands. All three are load-bearing; don't restate their content from memory, re-read them.

## Commands

```sh
pnpm install
pnpm db:reset    # wipes + reapplies local D1 migrations
pnpm preview     # build to dist-preview, serve with wrangler dev, http://localhost:8787 (needed for the signup form; `pnpm dev` alone won't show it)
pnpm check       # wrangler types + oxlint + tsc -b + astro check + vitest — the full gate
pnpm test:e2e    # Playwright against the local preview build
pnpm format      # oxfmt, then Prettier for .astro — run before every commit
```

Single test / subset:

```sh
pnpm vitest run -t "<name>"                      # by test name, any project
pnpm vitest run --project worker                  # one vitest project: web | lib | worker | migrations | deploy | site
pnpm vitest run src/worker/routes/waitlist.test.ts   # one file
pnpm exec playwright test --project live -g "<name>" # one e2e test
```

`pnpm check` writes `worker-configuration.d.ts` (via `wrangler types`) before typechecking — do not run `tsc` directly against a fresh checkout, it reads stale/missing types.

`main` deploys nothing — Cloudflare Workers Builds watches `live`, and only the maintainer promotes to it (a fast-forward push, `docs/deploy.md` §3). Work on a branch and open a PR against `main`. If a change adds a migration, apply it to the remote D1 database by hand before promoting (`docs/deploy.md` §4) — the deployment applies no migration itself.

## Architecture, in brief

- **One stage, one environment.** There is no payment surface and no voting surface in this codebase — just the static site and a waitlist signup. See `docs/architecture.md` §1–3.
- **The only public write path** is `POST /api/waitlist` (`src/worker/routes/waitlist.ts`): origin check → rate limiter → 8192-byte body cap → honeypot field → field validation → Turnstile (JSON requests only) → upsert. Content-Type branches JSON (fetch, 200) vs form-urlencoded (no-JS, 303 redirect). Every failure mode fails closed. See `docs/architecture.md` §4.
- **Migrations are one additive file per schema change**, in `migrations/` (no per-stage split). Wrangler tracks migrations by filename only, not content hash — never edit an already-applied migration's contents once real data exists, and never reuse a retired filename (`tests/migrations/replay.test.ts` enforces this).
- **Worker layout:** `index.ts` (entry/router/`scheduled()`) → `routes/waitlist.ts` (the one endpoint, test alongside) → `lib/*.ts` (`db`, `http`, `turnstile`, `validation` — infra only). `types.ts` holds `Env` and domain models; `testkit.ts` holds shared fakes (`FakeRepo`, etc.) used across route tests.
- **Site layout:** `pages/*.astro` are the routes; `layouts/Base.astro` is the shell (head/SEO/header/footer/JSON-LD); each page's interactivity lives in one `src/scripts/<page>.ts` loaded via `<script>` — pages must work without JS. `lib/seo.ts` holds per-route meta. Adding a page means also adding an entry to `seo.ts`.
- **Buttons come only from `src/index.css`** (`btn`, `btn-primary`, `btn-secondary`, `btn-lg`, `btn-block`). Never add utility padding/width/text classes to a button in markup — extend `index.css` instead.
- **Styling state, not JS-painted classes:** read UI state off an attribute (e.g. `aria-pressed`) and style the attribute in CSS.

## Testing shape

Six vitest projects (`vitest.config.ts`): `web` (jsdom; `src/scripts`), `lib` (`src/lib`), `worker` (node; `src/worker/**`), `migrations`, `deploy`, and `site` (builds the site first via `tests/site/build.setup.ts`, then asserts on the HTML in `dist-preview` — a change to one page can fail a test that doesn't name it). Playwright (`tests/e2e/{live,no-js}`, projects `live` and `live-no-js`) runs against a real `pnpm preview` server, including a JS-disabled project to check the no-JS fallback paths.

Tests stay next to the module (`*.test.ts`). Logic under test must take epoch time / ids as parameters rather than calling `Date.now()` / `crypto.randomUUID()` directly, so tests stay deterministic.

## Conventions

- TypeScript strict; explicit return type on every exported function; `unknown` + type guard instead of `any` (if you must use `any`, add a `// reason:` comment).
- Conventional Commits, subject line only unless the reason isn't obvious.
- `.env` / `.dev.vars` are gitignored; only `*.example` files are tracked. Never commit a secret.
- Don't loosen an oxlint rule to make the gate pass — disable it in `.oxlintrc.json` with a stated reason instead (see the table in `CONTRIBUTING.md`).
