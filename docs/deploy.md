# Deployment

This document uses ASD-STE100 Simplified Technical English.

The system runs on the Workers Free plan. A paid plan is not necessary. Refer to [architecture](architecture.md).

## 1. The branch model

Two branches feed two sites. Cloudflare Workers Builds watches both.

| Branch | Site                 | Worker     | Trigger                    |
| ------ | -------------------- | ---------- | -------------------------- |
| `main` | `beta.rupeefund.org` | `trf-beta` | Every push                 |
| `live` | `rupeefund.org`      | `trf`      | The promote workflow, only |

| Setting        | Value on `main`                  | Value on `live`         |
| -------------- | -------------------------------- | ----------------------- |
| Build command  | `pnpm run build:beta`            | `pnpm run build:launch` |
| Deploy command | `npx wrangler deploy --env beta` | `npx wrangler deploy`   |

Collaborators open a pull request against `main`. CI runs the gate. A merge deploys beta, and nothing reaches the public.

## 2. How to promote to the live site

Run the workflow **Promote to live** from the Actions tab. Give it a commit, or leave the field empty to take the tip of `main`.

The workflow refuses the promote when any of these is true:

- The commit is not on `main`.
- The commit has no check run, or one of its check runs did not pass.
- The `live` branch does not exist.
- The move is not a fast-forward. GitHub refuses this itself, because the workflow sends `force: false`.

The GitHub environment `production` holds the run until a reviewer approves it. That approval is the gate.

`live` is always a prefix of the history of `main`. You promote a commit and everything before it, or nothing. There is no cherry-pick. Keep the gap small, and promote often.

To go back, run `pnpm wrangler rollback`. Then purge the cache of the zone. Do not write to `live` by hand.

**Do not delete a Worker.** Deploy new code on top of it. If you delete the Worker, Cloudflare disconnects the custom domain, and you lose all the earlier deployments. Those deployments are your only targets for a rollback.

## 3. How to apply a migration

The deployment applies no migration. You apply each one by hand, and the sequence matters.

1. Apply the migration to the beta database.
1. Merge the code into `main`. Beta deploys. Prove the change there.
1. Apply the migration to the live database.
1. Run the promote workflow.

```sh
pnpm wrangler d1 migrations apply trf-rupeefund-beta --env beta --remote
pnpm wrangler d1 migrations apply trf-rupeefund --remote
```

**Make each migration additive.** During a deployment two Worker versions read the one live database. The Worker that operates before the migration must continue to operate after it. If you add a column, give it a default value or permit NULL.

A change that is not additive needs two promotes: one that adds the new shape, and a later one that removes the old shape after all the code stops using it.

## 4. What you need first

- A Cloudflare account with the `rupeefund.org` zone.
- pnpm, at the version in `packageManager` in `package.json`. Also direnv.

## 5. Secrets and variables

There are three kinds of value, and each kind has a different home.

| Kind            | Home                                      | Example                    |
| --------------- | ----------------------------------------- | -------------------------- |
| Build variable  | Workers Builds settings, in the dashboard | `PUBLIC_TURNSTILE_SITEKEY` |
| Worker secret   | `wrangler secret`                         | `TURNSTILE_SECRET`         |
| Worker variable | `vars` in `wrangler.jsonc`                | `TURNSTILE_HOSTNAMES`      |

A build variable goes into the static files. It is public. A Worker secret never leaves Cloudflare.

Each environment has its own Turnstile widget, therefore its own sitekey and its own secret. Set the sitekey in the Workers Builds settings of that project. Set the secret against that Worker:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
pnpm wrangler secret put TURNSTILE_SECRET --env beta
```

Set `PUBLIC_SITE_ENV` to `beta` in the beta Workers Builds settings. Leave it unset for live. `build:beta` supplies it too, so a build from your machine agrees with a build from Cloudflare.

For local work, one `.env` file at the top of the repository holds all of them. Both direnv and wrangler read this file. Do **not** also make a `.dev.vars` file. If that file exists, wrangler ignores `.env`.

```sh
cp .env.example .env          # write the real values
printf 'dotenv\n' > .envrc && direnv allow
```

### The test sitekey

Cloudflare supplies an always-pass test sitekey, `1x00000000000000000000AA`. A deployed build that uses it refuses every signup, because the Worker examines the token with the real secret.

The build therefore refuses the test sitekey twice. `scripts/assert-deploy-env.mjs` refuses the value before the build. `scripts/assert-dist-sitekey.mjs` reads `dist` after the build and refuses the literal wherever it came from. Both run inside `build:launch` and `build:beta`, so Cloudflare runs both.

To use the test sitekey on purpose, set `PUBLIC_ALLOW_TEST_SITEKEY=true` and call `astro build` directly. The local preview scripts and the site tests do this. The CI build jobs do not: they supply a stand-in sitekey and run the same command as Cloudflare, so both guards operate. **Never set the opt-in in the Workers Builds settings.**

### The robots guard

`scripts/apply-site-env.mjs` runs after `astro build`. For a beta build it writes `Disallow: /` into `dist/robots.txt` and adds `X-Robots-Tag: noindex, nofollow` to the sitewide block of `dist/_headers`. For a live build it refuses a `dist` that carries either one.

`scripts/assert-deploy-env.mjs` refuses a build where `PUBLIC_SITE_ENV` and the target do not agree. Without it, a live build could hide `rupeefund.org` from every search engine.

## 6. The databases

The two environments share one migrations directory, `migrations/`. Each database has its own ledger, so `wrangler d1 migrations apply` gives each one only the files it has not applied.

```sh
pnpm wrangler d1 migrations apply trf-rupeefund --remote
pnpm wrangler d1 migrations apply trf-rupeefund-beta --env beta --remote
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

Each database must show only `waitlist`, together with the Cloudflare tables `_cf_KV`, `d1_migrations` and `sqlite_sequence`.

**`trf-rupeefund` holds true signups.** You cannot make it again. Export first, then add a new migration for each change:

```sh
pnpm wrangler d1 export trf-rupeefund --remote --output /tmp/trf-backup.sql
```

The beta database holds test data only. You may make it again at any time.

## 7. How to verify a deployment

Purge the zone cache first. The live site answers with `cf-cache-status: HIT`, and without a purge the new build can look absent.

```sh
curl -s https://rupeefund.org/api/health                       # {"ok":true}
curl -s https://rupeefund.org/robots.txt                       # Allow: /
curl -s https://beta.rupeefund.org/robots.txt                  # Disallow: /
curl -sI https://beta.rupeefund.org/ | grep -i x-robots-tag    # noindex, nofollow
curl -s https://rupeefund.org/subscribe | grep -o 'data-sitekey="[^"]*"'
curl -sI https://rupeefund.org/ | grep -i -e content-security-policy -e strict-transport
```

The sitekey must be the real one. If it is `1x00000000000000000000AA`, the build variable is absent from the Workers Builds settings and no visitor can sign up with JavaScript.

Complete the form one time on each host. Then make sure that the correct database has the row, and that the other one does not:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --command "SELECT email, consent_at FROM waitlist"
pnpm wrangler d1 execute trf-rupeefund-beta --env beta --remote --command "SELECT email FROM waitlist"
```

## 8. How to remove a person from the list

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

## 9. How to export the list

```sh
pnpm list:export --remote --dry-run   # prints the CSV, changes nothing
pnpm list:export --remote > list.csv  # prints the CSV and writes exported_at
```

The export is incremental. The command sends each row one time only. Because of this, a second import cannot add a person again who asked for removal in the list manager after the first export.

The exporter is `scripts/list-export.mts`. Node removes the types when it runs the file. Node does this without a flag from v22.18.0 and from v23.6.0, so an older Node stops the command with `ERR_UNKNOWN_FILE_EXTENSION`. The `engines` field in `package.json` states this floor. CI and Cloudflare Workers Builds do not run this command.

## 10. How to give the project to a different account

Variables and secrets control every value. You change no code.

1. Make the two databases with `pnpm wrangler d1 create`. Copy each `database_id` into `wrangler.jsonc`.
1. Apply `migrations/0001_init.sql` to both.
1. Make a Turnstile widget for each host. Set each sitekey in the Workers Builds settings, and each secret with `wrangler secret put`.
1. Add the `rupeefund.org` and `beta.rupeefund.org` custom domains to the zone of that account.

## Required keys

| key                         | home           | source                                                                                                                                                                                                      |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_TURNSTILE_SITEKEY`  | Build variable | Cloudflare dashboard → Turnstile → Add widget. One widget per host. The build refuses to start without it, and refuses the test sitekey.                                                                    |
| `PUBLIC_SITE_ENV`           | Build variable | `beta` in the beta Workers Builds settings. Unset for live. The build refuses a value that does not agree with the target.                                                                                  |
| `PUBLIC_ALLOW_TEST_SITEKEY` | Build variable | Set it to `true` for a local preview or a CI build only. Never set it in the Workers Builds settings.                                                                                                       |
| `TURNSTILE_SECRET`          | Worker secret  | The same widget. `secrets.required` lists it, therefore the deploy stops without it. Without it, siteverify answers `missing-input-secret` and the handler answers 403 to each signup that uses JavaScript. |
