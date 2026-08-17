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
pnpm check                    # wrangler types + oxlint + tsc + astro check + vitest
pnpm format                   # oxfmt, then Prettier for .astro — run this before you commit
pnpm test:e2e                 # Playwright, against the launch build
```

`pnpm check` runs five steps, and each one covers a different part of the code:

| Step                         | What it examines                                                     |
| ---------------------------- | -------------------------------------------------------------------- |
| `wrangler types`             | Writes `worker-configuration.d.ts`, which `tsc` then reads.          |
| `oxlint`                     | All TypeScript. Configuration is in `.oxlintrc.json`.                |
| `tsc -b tsconfig.build.json` | Three projects: `src/lib`, `src/worker`, and `tests` with `scripts`. |
| `astro check`                | The TypeScript inside `.astro` files, which `tsc` does not examine.  |
| `vitest`                     | Five projects: `web`, `worker`, `site`, `migrations` and `deploy`.   |

Git ignores `worker-configuration.d.ts`, so a fresh checkout does not have it. `tsc -b tsconfig.build.json` reads different types when the file is absent. Therefore `check` and `typecheck` write the file first. Do not call it on its own.

There are two TypeScript entry points, and they answer different questions.

`tsconfig.json` is the editor project. It covers `.astro`, `src`, `tests` and `scripts` under one set of options, so every file your editor opens belongs to a real project. `astro check` reads it too. Without it, `.astro` files fall into an inferred project, and `astro check` reports no error whatever the code says.

`tsconfig.json` excludes `src/worker`, and `src/worker/tsconfig.json` covers that directory instead. Worker code runs on workerd, not in a browser, so it needs `@cloudflare/workers-types` rather than the DOM library. Under the DOM library the workerd `Response` and the standard `Response` disagree, and `astro check` then reports the asset fallthrough in `src/worker/index.ts` as an error. The worker files stay under the same options `tsc -b` applies, because `src/worker/tsconfig.json` extends `tsconfig.worker.json`.

`tsconfig.build.json` is the solution file for the three strict per-target projects — `src/lib`, `src/worker`, and `tests` with `scripts`. It is the authority, because each project sets its own `lib` and `types`. `pnpm check` runs it.

Do not add `references` to `tsconfig.json`. The three projects set `noEmit`, which a referenced project may not do, so any bare `tsc` then fails with TS6306 and TS6310.

The `site` project makes a build first, then reads the HTML in `dist`. Because of this, a change to a page can fail a test that does not name that page.

Do not make a rule less strict to make the gate pass. If a rule is wrong for this repository, turn it off in `.oxlintrc.json` and give the reason here.

Two rules are off, and each one is off for the same reason: it reports a pattern that this repository uses on purpose.

| Rule                                  | Why it is off                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `vitest/no-conditional-expect`        | The validation tests narrow a discriminated union before they examine the result. |
| `vitest/require-mock-type-parameters` | The DOM test helpers use untyped `vi.fn()` stubs.                                 |

The `rules` block lists only the deltas from the two categories. Run `pnpm exec oxlint --print-config` to read the resolved set. Do not re-state a severity a category already gives.

## Formatting

Two formatters run, and they never touch the same file.

| Formatter  | Files                                                   | Configuration      |
| ---------- | ------------------------------------------------------- | ------------------ |
| `oxfmt`    | TypeScript, JavaScript, JSON, CSS, HTML, Markdown, YAML | `.oxfmtrc.json`    |
| `prettier` | `.astro` only                                           | `.prettierrc.json` |

`oxfmt` does not parse `.astro`, so Prettier covers those files with `prettier-plugin-astro`. `.prettierignore` lists every language `oxfmt` owns, which stops Prettier from reformatting a file `oxfmt` has already formatted.

`oxfmt` reads `.prettierignore` too, and it would then skip every file it owns. The `format` and `format:check` scripts therefore pass `--ignore-path .gitignore` to `oxfmt`. Keep that flag.

Both formatters use a print width of 100. `.editorconfig` states the same width, so an editor that formats on save produces the same output as `pnpm format`. A default Prettier install wraps at 80 and rewrites every `.astro` file in the repository.

`.vscode/settings.json` binds the two formatters for VS Code, Cursor and Windsurf: `oxc-project.oxc-vscode` for every file, and `astro-build.astro-vscode` for `.astro`. On another editor, bind the same two formatters yourself.

## What CI runs

| Job     | What it protects                                                               |
| ------- | ------------------------------------------------------------------------------ |
| `check` | The gate, plus a guard that refuses the retired pre-launch vocabulary.         |
| `build` | The same commands Cloudflare Workers Builds runs, for both stages.             |
| `e2e`   | Playwright against the launch build. A failed run keeps its report for 7 days. |

The `build` job matters most. Workers Builds deploys with `pnpm run build:launch`, not `pnpm build`, so CI runs that exact command.

`build:launch` and `build:post-launch` each run two guards around `astro build`:

| Guard                             | When it runs     | What it refuses                                                          |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `scripts/assert-deploy-env.mjs`   | before the build | An unsafe environment or an unsafe `wrangler.jsonc`.                     |
| `scripts/assert-dist-sitekey.mjs` | after the build  | A `dist` that baked in the always-pass test sitekey, or an empty `dist`. |

Both guards therefore protect the real deploy, not only CI. Keep them in the build command. Do not move either one into the workflow.

## How to deliver a change

Do not commit to `main`. A merge into `main` deploys `rupeefund.org` immediately, through Cloudflare Workers Builds.

1. Make a branch.
1. Commit your work. Run `pnpm check` and `pnpm format` first.
1. Open a pull request. GitHub CI runs the gate, and Workers Builds makes a build for the branch.
1. Get a review. Then merge. The merge deploys.

**If your change needs a new migration, apply it to the remote database before you merge.** There is no gap between the merge and the deployment. Refer to `docs/deploy.md` section 2.

Preview URLs are not available yet. `wrangler.jsonc` does not set `preview_urls`, and the default value is `false`. A preview URL would use the **production** database, because a versioned preview keeps the bindings of the Worker. The `preview_database_id` key does not help, because wrangler uses it only for `wrangler dev`. The post-launch Worker is the correct place for previews.

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
  components/    Header, Footer, Icon (.astro)
  scripts/       one vanilla-DOM script per page (subscribe, vote, share)
  lib/           launch.ts (launch copy + seasons), seo.ts (per-route meta), turnstile.ts
  index.css      Tailwind entry + design tokens + shared classes
```

To add a page, write a `.astro` file in `src/pages/`. Then add an entry to `seo.ts`. The build makes static pages only. Put the behaviour of a page in its own `src/scripts/<page>.ts`, and load it from a `<script>` element on that page. The page must operate without JavaScript. Astro markup uses `class`, not `className`. Write a class string once in the markup. If the same string appears three times, or on two pages, make it a class in `src/index.css`. Read element state from an attribute such as `aria-pressed`, and style that attribute in CSS. Do not paint classes from JavaScript. Each script has a test beside it, and the tests in `tests/site/` examine the HTML that the build makes.
