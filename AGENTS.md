# AGENTS.md

Read `docs/architecture.md` before you touch the Worker, the database, or the security headers. Read `docs/deploy.md` before a promote or a migration. Read `CONTRIBUTING.md` before your first commit. Do not restate them from memory.

## Nuances

- There is no payment surface and no voting surface. The site collects a mailing list only. Do not add one.
- `pnpm preview` serves the signup form. `pnpm dev` alone does not show it.
- `pnpm check` runs `wrangler types` first. Do not run `tsc` directly against a fresh checkout.
- `package.json` scripts run under pnpm's shell emulator (`shellEmulator` in `pnpm-workspace.yaml`), not a real shell. It accepts an env prefix, `&&`, `||`, `|`, a redirect and `$(...)`. It rejects `if`, `for` and `case`. The same applies to the install script of a dependency you add to `allowBuilds`.
- `main` deploys nothing. Workers Builds watches `live`, and only the maintainer promotes. Apply a new migration to the remote D1 database by hand before the promote.
- Wrangler tracks a migration by filename only. Never edit an applied migration. Never reuse a retired filename.
- The `site` vitest project builds the whole site first. A change to one page can fail a test that does not name it.
- Buttons come only from `src/index.css`. Extend that file. Do not put a utility class on a button in markup.
- Style UI state from an attribute, for example `aria-pressed`. Do not paint classes from JavaScript.
- A new page needs an entry in `src/lib/seo.ts`.
- Pages must work without JavaScript.
- Give epoch time and ids to a function as parameters. Do not call `Date.now()` or `crypto.randomUUID()` in logic under test.
- Do not loosen an oxlint rule. Disable it in `.oxlintrc.json` with a stated reason.
- `.env` and `.dev.vars` are gitignored. Only the `*.example` files are tracked. Never commit a secret.
