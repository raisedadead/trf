# Deployment

This document uses ASD-STE100 Simplified Technical English.

The system runs on the Workers Free plan. A paid plan is not necessary. Refer to [architecture](architecture.md).

## 1. The branch model

One branch feeds one site. Cloudflare Workers Builds watches it.

| Branch | Site            | Worker | Trigger                    |
| ------ | --------------- | ------ | -------------------------- |
| `main` | none            | none   | Never                      |
| `live` | `rupeefund.org` | `trf`  | The promote workflow, only |

| Setting                      | Value on `live`       |
| ---------------------------- | --------------------- |
| Build command                | `pnpm run build`      |
| Deploy command               | `npx wrangler deploy` |
| Non-production branch builds | off                   |

Collaborators open a pull request against `main`. CI runs the gate. A merge into `main` deploys nothing.

**Workers Builds is the supported way code reaches the live site.** The repository declares no deploy script, so the promote workflow is the release gate. A hand-run `wrangler deploy` is unsupported: it uploads whatever `dist` holds and runs neither sitekey guard. `pnpm wrangler rollback` stays available for an incident, because a rollback ships no new code.

Leave non-production branch builds off. Turning them on uploads a Worker version for every branch, and every version keeps the production bindings.

The repository builds no beta site and no preview URL. `wrangler.jsonc` sets `workers_dev` and `preview_urls` to `false`, and `scripts/assert-deploy-env.mjs` exits 1 on a configuration that leaves either one open, or that declares an `env` block. A Worker version keeps the bindings of its Worker, so a second address for `trf` would write to the true mailing list. Cloudflare states the limitation: "Unlike Pages, Workers does not natively support defining different bindings in production vs. non-production builds." Refer to <https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>.

Those two settings reach Cloudflare only on the next deploy of `trf`. Until a promote runs, the account keeps the preview state it holds now.

## 2. How to prove a change

You prove every change on your own machine. Nothing else is available, and nothing else touches `trf-rupeefund`.

```sh
pnpm db:reset     # build the local D1 from the migrations
pnpm preview      # build to dist-preview, then serve it with a local wrangler dev
pnpm check        # the whole gate: types, lint, astro check, vitest
pnpm test:e2e     # Playwright against the local build
```

`pnpm preview` uses Cloudflare's always-pass Turnstile test pair, so the signup form completes without a real widget. It writes to `dist-preview`, never to `dist`, because a `dist` carrying the test sitekey would reject every signup if anybody uploaded it. The site tests build there too. Only `pnpm run build` writes `dist`, and it runs both guards. `pnpm dev` shows the pages only, with no Worker and no database.

Read the rows the local database holds:

```sh
pnpm wrangler d1 execute trf-rupeefund --local --command "SELECT email, consent_at FROM waitlist"
```

## 3. How to promote to the live site

Run the workflow **Promote to live** from the Actions tab. Give it a commit, or leave the field empty to take the tip of `main`.

The workflow refuses the promote when any of these is true:

- The commit is not on `main`.
- The commit has no check run, or one of its check runs did not pass.
- The `live` branch does not exist.
- The move is not a fast-forward. GitHub refuses this itself, because the workflow sends `force: false`.

The GitHub environment `production` holds the run until a reviewer approves it. That approval is the gate.

The environment carries `can_admins_bypass: true`, which is the GitHub default. A repository administrator can therefore waive the approval. That is acceptable while the reviewer and the administrator are the same person. To make the gate bind everybody, set the field to `false`.

`live` is always a prefix of the history of `main`. You promote a commit and everything before it, or nothing. There is no cherry-pick. Keep the gap small, and promote often.

To go back, run `pnpm wrangler rollback`. Then purge the cache of the zone. Do not write to `live` by hand.

**Do not delete a Worker.** Deploy new code on top of it. If you delete the Worker, Cloudflare disconnects the custom domain, and you lose all the earlier deployments. Those deployments are your only targets for a rollback.

## 4. How to apply a migration

The deployment applies no migration. You apply each one by hand, and the sequence matters.

1. Export the live database. Apply the migration to that copy. Prove the change against it.
1. Merge the code into `main`.
1. Apply the migration to the live database.
1. Run the promote workflow.

```sh
pnpm wrangler d1 export trf-rupeefund --remote --output /tmp/trf-backup.sql
pnpm wrangler d1 migrations apply trf-rupeefund --remote
```

**Make each migration additive.** During a deployment two Worker versions read the one live database. The Worker that operates before the migration must continue to operate after it. If you add a column, give it a default value or permit NULL.

A change that is not additive needs two promotes: one that adds the new shape, and a later one that removes the old shape after all the code stops using it.

## 5. What you need first

- A Cloudflare account with the `rupeefund.org` zone.
- pnpm, at the version in `packageManager` in `package.json`. Also direnv.

## 6. Secrets and variables

There are three kinds of value, and each kind has a different home.

| Kind               | Home                       | Example               |
| ------------------ | -------------------------- | --------------------- |
| Public build value | The repository             | `TURNSTILE_SITEKEY`   |
| Worker secret      | `wrangler secret`          | `TURNSTILE_SECRET`    |
| Worker variable    | `vars` in `wrangler.jsonc` | `TURNSTILE_HOSTNAMES` |

**The Workers Builds settings hold no variable.** The Turnstile sitekey is public and is baked into every page, so it lives in `src/lib/turnstile.ts` where a diff shows it. No build depends on a dashboard field that a person can forget to set. `TURNSTILE_SECRET` is the one value Cloudflare holds, and a Worker secret never leaves Cloudflare.

To rotate the sitekey, change the constant in `src/lib/turnstile.ts`, then promote. `scripts/assert-deploy-env.mjs` exits 1 when that constant is absent or is a Cloudflare dummy.

One Turnstile widget serves the site. Its domain list holds `rupeefund.org` and nothing else. Its sitekey is the constant in `src/lib/turnstile.ts`. Set its secret against the Worker:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

For local work, one `.env` file at the top of the repository holds all of them. Both direnv and wrangler read this file. Do **not** also make a `.dev.vars` file. If that file exists, wrangler ignores `.env`.

```sh
cp .env.example .env          # write the real values
printf 'dotenv\n' > .envrc && direnv allow
```

### The test sitekey

Cloudflare supplies an always-pass test sitekey, `1x00000000000000000000AA`. A deployed build that uses it refuses every signup, because the Worker examines the token with the real secret.

**Local work uses the test sitekey.** `.env.example` ships it, with `PUBLIC_ALLOW_TEST_SITEKEY=true` beside it. Keep it that way. A real sitekey on `localhost` renders the production widget, which raises the risk score of your own address until Turnstile shows you the interactive checkbox on every load. It also obliges the production widget to allow `localhost` as a domain, and that lets anybody mint a token against your sitekey from their own machine.

The build refuses the test sitekey twice. `scripts/assert-deploy-env.mjs` refuses the value before the build. `scripts/assert-dist-sitekey.mjs` reads `dist` after the build and refuses the literal wherever it came from. Both run inside `scripts/build.mjs`, which every build goes through, so Cloudflare runs both.

To use the test sitekey on purpose, set `PUBLIC_ALLOW_TEST_SITEKEY=true` and call `astro build` directly. The local preview script and the site tests do this. The CI build job supplies no sitekey at all, so it builds exactly what Cloudflare builds and both guards operate. **Never set the opt-in in the Workers Builds settings.**

## 7. The database

`migrations/` holds every migration. The database has its own ledger, so `wrangler d1 migrations apply` gives it only the files it has not applied.

```sh
pnpm wrangler d1 migrations apply trf-rupeefund --remote
```

For local work, `pnpm db:reset` makes the local database again from zero.

**Wrangler resolves a migration by the file name only.** `getUnappliedMigrations` compares the file names with the names in the `d1_migrations` table. It calculates no hash. Two results follow:

- If you change a migration that Wrangler applied before, the database does not change.
- If you use a file name that the table records, Wrangler skips the file and reports no error. The names `0002_waitlist.sql`, `0003_voting.sql`, `0004_proposal_options.sql`, `0002_waitlist_launch.sql` and `0003_voting_post_launch.sql` all existed here. Do not use them again. `tests/migrations/replay.test.ts` stops the build if you use one of them.

Never use `migrations list` as proof that the schema is correct. That command reports "No migrations to apply" when the file names agree, and it does not examine the tables. Examine the schema:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

The database must show only `waitlist`, together with the Cloudflare tables `_cf_KV`, `d1_migrations` and `sqlite_sequence`.

**`trf-rupeefund` holds true signups.** You cannot make it again. Export first, then add a new migration for each change:

```sh
pnpm wrangler d1 export trf-rupeefund --remote --output /tmp/trf-backup.sql
```

## 8. How to verify a deployment

Purge the zone cache first. The live site answers with `cf-cache-status: HIT`, and without a purge the new build can look absent.

```sh
curl -s https://rupeefund.org/api/health                       # {"ok":true}
curl -s https://rupeefund.org/robots.txt                       # Allow: /
curl -s https://rupeefund.org/subscribe | grep -o 'data-sitekey="[^"]*"'
curl -sI https://rupeefund.org/ | grep -i -e content-security-policy -e strict-transport
```

The sitekey must be the real one. If it is `1x00000000000000000000AA`, somebody deployed a `dist` that a preview build wrote, and no visitor can sign up with JavaScript. `pnpm run build` cannot produce that, because `scripts/assert-dist-sitekey.mjs` reads `dist` and exits 1 on the literal.

Complete the form one time. Then make sure that the database has the row:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --command "SELECT email, consent_at FROM waitlist"
```

## 9. How to remove a person from the list

The build has no sender. Therefore a request for removal comes by email to `foundation@fossunited.org`. The signup form shows this address. There is no automatic endpoint for removal. A person does this work.

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --command \
  "UPDATE waitlist SET unsubscribed_at = unixepoch() * 1000, updated_at = unixepoch() * 1000
   WHERE email = 'someone@example.com' AND unsubscribed_at IS NULL"
```

The command marks the row. It does not delete the row. This is intentional, and the mark is **permanent**. `list:export` ignores a row that has a value in `unsubscribed_at`. The signup upsert does not change a row that has this value. Therefore no subsequent POST can cancel the removal. This is true for the person and for all other persons who know the address. If you delete the row instead, the next signup adds it again and the next export sends it again.

To add the person again, clear the value manually. The form cannot do this.

Make sure that the command had an effect:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --json --command \
  "SELECT email, unsubscribed_at FROM waitlist WHERE email = 'someone@example.com'"
```

## 10. How to export the list

```sh
pnpm list:export --remote --dry-run   # prints the CSV, changes nothing
pnpm list:export --remote > list.csv  # prints the CSV and writes exported_at
```

The export is incremental. The command sends each row one time only. Because of this, a second import cannot add a person again who asked for removal in the list manager after the first export.

The exporter is `scripts/list-export.mts`. Node removes the types when it runs the file. Node does this without a flag from v22.18.0 and from v23.6.0, so an older Node stops the command with `ERR_UNKNOWN_FILE_EXTENSION`. The `engines` field in `package.json` states this floor. CI and Cloudflare Workers Builds do not run this command.

## 11. How to give the project to a different account

Variables and secrets control every value. You change no code.

1. Make the database with `pnpm wrangler d1 create`. Copy the `database_id` into `wrangler.jsonc`.
1. Apply `migrations/0001_init.sql` to it.
1. Make one Turnstile widget for `rupeefund.org`. Put its sitekey in `src/lib/turnstile.ts`, and set its secret with `wrangler secret put`.
1. Add the `rupeefund.org` custom domain to the zone of that account.

## Required keys

| key                         | home                   | source                                                                                                                                                                                                      |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SITEKEY`         | `src/lib/turnstile.ts` | Cloudflare dashboard → Turnstile. One widget. Public, and committed. The build exits 1 when it is absent or is a dummy.                                                                                     |
| `PUBLIC_TURNSTILE_SITEKEY`  | `.env`, local only     | An override for local work. Absent in CI and in the Workers Builds settings. The build exits 1 on a dummy value without the opt-in below.                                                                   |
| `PUBLIC_ALLOW_TEST_SITEKEY` | `.env`, local only     | Set it to `true` for local work only. Never set it in the Workers Builds settings.                                                                                                                          |
| `TURNSTILE_SECRET`          | Worker secret          | The same widget. `secrets.required` lists it, therefore the deploy stops without it. Without it, siteverify answers `missing-input-secret` and the handler answers 403 to each signup that uses JavaScript. |
