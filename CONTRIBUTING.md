# Contributing

This document uses ASD-STE100 Simplified Technical English.

## How to set up

```sh
pnpm install
cp .env.example .env          # refer to docs/deploy.md
printf 'dotenv\n' > .envrc && direnv allow
pnpm dev
```

## The gate

All of these commands must pass before a merge. CI runs them again:

```sh
pnpm check                    # oxlint + tsc + vitest
pnpm format                   # oxfmt — run this before you commit
```

## Conventions

- **TypeScript strict.** Write an explicit return type on each exported function. Use `unknown` with a type guard in place of `any`. If you must use `any`, write a `// reason:` comment.
- **Code that explains itself.** Do not write a comment that repeats the code. The names and the types show the contract. Write a comment only for a rule that the code cannot show.
- **Tests stay with the module.** Put `*.test.ts` next to the module. Supply epoch times and ids as parameters. Do not call `Date.now()` or `crypto.randomUUID()` in the logic that a test examines.
- **Conventional Commits.** Write the subject line only (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). Add a body only when the reason is not obvious.
- **Secrets.** Never commit a secret. Git ignores `.env` and `.dev.vars`. Git tracks only the `*.example` files.

## Worker layout

```
src/worker/
  index.ts       entry + router + scheduled()
  routes/        one handler module per endpoint group
  lib/           infra: razorpay, db, newsletter, http, validation, signature
  types.ts       shared types (Env, domain models)
  testkit.ts     shared test fakes + helpers
```

To add an endpoint, write a handler in `routes/`. Connect it in `index.ts`. Put a test next to the handler. To add a helper, write it in `lib/`. All Razorpay requests go through `lib/razorpay.ts`, which uses `fetch`. Do not use the Razorpay SDK.

## Site layout

```
src/
  pages/         Astro routes → static HTML (index, subscribe, projects, manage, thank-you, 404)
  layouts/       Base.astro (shell + <head>/SEO + header + footer + JSON-LD)
  components/    Header, Footer, Icon, PixelSprite (.astro)
  lib/           islands.ts (vanilla-DOM progressive enhancement), seo.ts (per-route meta), seasonArt.ts
  index.css      Tailwind entry + design tokens
```

To add a page, write a `.astro` file in `src/pages/`. Then add an entry to `seo.ts`. The build makes static pages only. Put all behaviour in `src/lib/islands.ts`, and load it from a `<script>` element on the page. The page must operate without JavaScript. Astro markup uses `class`, not `className`. The island logic is plain TypeScript. `src/lib/islands.test.ts` examines the logic, and the tests in `tests/site/` examine the HTML that the build makes.
