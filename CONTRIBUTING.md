# Contributing

## How to set up

```sh
pnpm install
cp .env.example .env
printf 'dotenv\n' > .envrc && direnv allow
pnpm db:reset
pnpm preview
```

`pnpm dev` shows the pages with no Worker and no database. The signup form needs `pnpm preview`.

## The gate

Run these before you open a pull request. CI runs them again.

```sh
pnpm format       # oxfmt, then Prettier for .astro
pnpm check        # typecheck, lint, astro check, vitest
pnpm test:e2e     # Playwright against the local build
```

CI also runs `pnpm run build`, the same command Workers Builds runs on `live`. That build refuses the Turnstile test sitekey and an open preview setting. Keep those guards in `scripts/build.mjs`.

Do not make a rule less strict to pass the gate. If a rule is wrong for this repository, turn it off in `.oxlintrc.json` and say why in the pull request.

## How to deliver a change

1. Make a branch.
1. Commit your work. Run the gate first.
1. Open a pull request against `main`.
1. Get a review. Then merge.

A merge deploys nothing. Only the maintainer promotes, by a fast-forward of `live`. Refer to `docs/deploy.md` section 3.

A change to the database needs a new additive migration file. Never change a migration that has run, and never reuse a file name. Refer to `docs/deploy.md` section 4.

## Conventions

- **TypeScript strict.** Write an explicit return type on each exported function. Use `unknown` with a type guard, not `any`.
- **No comments that repeat the code.** The names and the types show the contract.
- **Tests stay with the module.** Put `*.test.ts` next to the module. Pass times and ids as parameters, so a test can supply them.
- **Conventional Commits.** Subject line only: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- **Secrets.** Never commit a secret. Git ignores `.env`.

## Layout

```
src/
  pages/         one .astro file per route
  layouts/       Base.astro: shell, <head>, header, footer
  components/    Header, Footer, Icon, SocialIcon
  scripts/       one browser script per page that needs one (subscribe)
  lib/           launch.ts (copy), seo.ts (per-route meta), turnstile.ts
  index.css      Tailwind entry, tokens, shared classes
  worker/
    index.ts     entry and router
    routes/      one handler per endpoint
    lib/         db, http, turnstile, validation
    types.ts     Env, WaitlistEntry, Repo
    testkit.ts   test fakes
migrations/      one additive SQL file per schema change
scripts/         build guards and the list exporter
tests/           site, migrations, deploy, and e2e suites
```

To add a page, write a `.astro` file in `src/pages/` and add an entry to `seo.ts`. The build fails without one. The page must work with no JavaScript. Put page behaviour in `src/scripts/<page>.ts` with a test beside it.

To add an endpoint, write a handler in `src/worker/routes/` and connect it in `index.ts`. Keep it under `/api/`. Cloudflare serves any other path from the static files, so the Worker never sees it.

Every button uses the classes in `src/index.css`: `btn` with `btn-primary` or `btn-secondary`, and `btn-lg` or `btn-block` for size. Do not add spacing or width utilities to a button in the markup. If you need a new size, add a modifier to `index.css`.
