# Deployment

This document uses ASD-STE100 Simplified Technical English.

The system runs on the Workers Free plan. A paid plan is not necessary. Refer to [architecture](architecture.md).

## 1. How a deployment happens

Cloudflare Workers Builds watches the repository. A merge into `main` starts a build, and the build deploys the Worker. You do not run a deploy command.

| Setting        | Value                   |
| -------------- | ----------------------- |
| Build command  | `pnpm run build:launch` |
| Deploy command | `npx wrangler deploy`   |
| Trigger        | A merge into `main`     |

`pnpm run build:launch` examines the configuration before it makes the build. It stops the build if `PUBLIC_TURNSTILE_SITEKEY` has no value, if it holds the test sitekey, or if `TURNSTILE_HOSTNAMES` or `TURNSTILE_ACTION` is empty.

Work on a branch. Open a pull request. CI runs the gate. A merge deploys the result.

`pnpm deploy` does the same steps from your machine. Use it only when the automatic path does not operate.

**Do not delete the Worker.** Deploy new code on top of it. If you delete the Worker, Cloudflare disconnects `rupeefund.org`, and you lose all the earlier deployments. Those deployments are your only targets for a rollback.

To go back to an earlier version, run `pnpm wrangler rollback`. Then purge the cache of the zone.

## 2. Apply a migration before you merge the code

A merge deploys immediately. Therefore you cannot apply a migration between the merge and the deployment. There is no gap.

**Apply the migration to the remote database before you merge the code that uses it.** The migration and the code can be in the same pull request. The sequence is what is important, not the number of pull requests.

Make each migration additive. The Worker that operates before the migration must continue to operate after it. If you add a column, give it a default value or permit NULL.

A change that is not additive needs two pull requests: one that adds the new shape, and a later one that removes the old shape after all the code stops using it.

## 3. The two environments

| Item                 | Launch              | Post-launch                 |
| -------------------- | ------------------- | --------------------------- |
| Address              | `rupeefund.org`     | `preview.rupeefund.org`     |
| Worker               | `trf`               | `trf-post-launch`           |
| Database             | `trf-rupeefund`     | `trf-rupeefund-post-launch` |
| Migrations directory | `migrations/launch` | `migrations/post-launch`    |
| Tables               | `waitlist`          | `waitlist` and 6 more       |
| Worker secrets       | 1                   | 9                           |

The Worker `trf-post-launch` does not exist yet. The post-launch developers create it.

## 4. What you need first

- A Cloudflare account with the `rupeefund.org` zone.
- pnpm, at the version in `packageManager` in `package.json`. Also direnv.
- Access to the Razorpay dashboard of FOSS United Foundation, in test mode.

## 5. Secrets and variables

There are three kinds of value, and each kind has a different home.

| Kind            | Home                                      | Example                    |
| --------------- | ----------------------------------------- | -------------------------- |
| Build variable  | Workers Builds settings, in the dashboard | `PUBLIC_TURNSTILE_SITEKEY` |
| Worker secret   | `wrangler secret`                         | `TURNSTILE_SECRET`         |
| Worker variable | `vars` in `wrangler.jsonc`                | `TURNSTILE_HOSTNAMES`      |

A build variable goes into the static files. It is public. A Worker secret never leaves Cloudflare.

For local work, one `.env` file at the top of the repository holds all of them. Both direnv and wrangler read this file. Do **not** also make a `.dev.vars` file. If that file exists, wrangler ignores `.env`.

```sh
cp .env.example .env          # write the real values
printf 'dotenv\n' > .envrc && direnv allow
```

The launch build declares one required secret, `TURNSTILE_SECRET`. It declares **no** Razorpay secret, because it must deploy without one. The two wrangler commands do not agree about a required secret that has no value. `wrangler dev` only writes a warning. `wrangler deploy` stops with an error.

**Never run `wrangler secret bulk .env` against the launch Worker.** Your `.env` file holds the Razorpay keys and the five plan ids. That command puts all of them on `rupeefund.org`. The launch design exists to prevent this. Upload the one secret that the launch Worker needs:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

Use the bulk command only for the post-launch Worker, which needs all nine secrets:

```sh
pnpm wrangler secret bulk .env --env post-launch
```

Use `pnpm wrangler`, because the project pins the version. A global CLI can be too old for `secrets.required`.

### The test sitekey

Cloudflare supplies an always-pass test sitekey, `1x00000000000000000000AA`. A deployed build that uses it refuses every signup, because the Worker examines the token with the real secret.

The build therefore refuses the test sitekey twice. `scripts/assert-deploy-env.mjs` refuses the value before the build. `scripts/assert-dist-sitekey.mjs` reads `dist` after the build and refuses the literal wherever it came from. Both run inside `build:launch` and `build:post-launch`, so Cloudflare runs both.

To use the test sitekey on purpose, set `PUBLIC_ALLOW_TEST_SITEKEY=true` and call `astro build` directly. The local preview scripts and the site tests do this. The CI build jobs do not: they supply a stand-in sitekey and run the same command as Cloudflare, so both guards operate. **Never set the opt-in in the Workers Builds settings.**

## 6. The databases

Each environment has its own database and its own migrations directory. The `migrations_dir` key in `wrangler.jsonc` selects the directory. One `wrangler d1 migrations apply` command reads only the directory of the environment that you name.

```sh
pnpm wrangler d1 migrations apply trf-rupeefund --remote
pnpm wrangler d1 migrations apply trf-rupeefund-post-launch --env post-launch --remote
```

For local work, `pnpm db:reset` makes both databases again from zero.

The two directories each hold one file, `0001_init.sql`. The two files have the same name and different content. This is correct, because each database has its own ledger.

Both files contain the `waitlist` table. The two copies must stay the same. Marker comments (`-- >>> shared: waitlist`) delimit the block, and `tests/migrations/replay.test.ts` fails the build if the two copies are different.

**Wrangler resolves a migration by the file name only.** `getUnappliedMigrations` compares the file names with the names in the `d1_migrations` table. It calculates no hash. Two results follow:

- If you change a migration that Wrangler applied before, the database does not change.
- If you use a file name that the table records, Wrangler skips the file and reports no error. The names `0002_waitlist.sql`, `0003_voting.sql`, `0004_proposal_options.sql`, `0002_waitlist_launch.sql` and `0003_voting_post_launch.sql` all existed here. Do not use them again. `tests/migrations/replay.test.ts` stops the build if you use one of them.

Never use `migrations list` as proof that the schema is correct. That command reports "No migrations to apply" when the file names agree, and it does not examine the tables. Examine the schema:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

The launch database must show only `waitlist`, together with the Cloudflare tables `_cf_KV`, `d1_migrations` and `sqlite_sequence`.

**How to make a database again before the launch.** While the database has no data, you can change `0001_init.sql` and start again. This keeps the history clean. After true signups exist, this procedure destroys data. Then you must add a new migration instead.

```sh
pnpm wrangler d1 export trf-rupeefund --remote --output /tmp/trf-pre.sql   # always do this first
pnpm wrangler d1 execute trf-rupeefund --remote --command "
  DROP TABLE IF EXISTS waitlist;
  DELETE FROM d1_migrations;"
pnpm wrangler d1 migrations apply trf-rupeefund --remote
```

Run `SELECT COUNT(*) FROM waitlist` before this procedure. If the count is not zero, stop.

For the post-launch database, drop the tables in this sequence, because `ballots` and `vote_tokens` refer to `proposals`: `ballots`, `vote_tokens`, `proposals`, `waitlist`, `contributors`, `metrics_cache`, `processed_events`.

## 7. How to verify a deployment

Purge the zone cache first. The live site answers with `cf-cache-status: HIT`, and without a purge the new build can look absent.

```sh
curl -s https://rupeefund.org/api/health                              # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' https://rupeefund.org/vote   # 404 — gated
curl -s https://rupeefund.org/subscribe | grep -o 'data-sitekey="[^"]*"'
curl -sI https://rupeefund.org/ | grep -i -e content-security-policy -e strict-transport
```

The sitekey must be the real one. If it is `1x00000000000000000000AA`, the build variable is absent from the Workers Builds settings and no visitor can sign up with JavaScript.

Complete the form one time. Then make sure that the database has the row:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --command "SELECT email, consent_at FROM waitlist"
```

## 8. Razorpay plans and the webhook

Make the 5 monthly plans. The command finds the rupee-fund plans that exist and uses them again.

```sh
pnpm plans:create             # prints RZP_PLAN_* lines → copy them into .env
```

Register the webhook in the Razorpay dashboard:

- Address: `https://preview.rupeefund.org/api/webhook/razorpay`. The launch Worker answers 404 for this path, therefore the webhook must use the post-launch host.
- Events: `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`
- Secret: select a strong text. Write it as `RAZORPAY_WEBHOOK_SECRET` in `.env`.

Set the Razorpay callback address to `https://preview.rupeefund.org/thank-you`. The launch host answers 404 for `/thank-you`. That page shows only a pending state. The true result of the payment comes later from the webhook, and never from the callback.

## 9. How to change to live keys

Variables and secrets control all of these values. To go live, or to give the project to a different owner, you change the keys. You change no code.

1. In `.env`, replace each `rzp_test_` value with the `rzp_live_` value. This includes the key id, the key secret and the webhook secret.

1. Make the live plans. The script refuses live keys if you do not supply `--live`:

   ```sh
   node --env-file=.env scripts/create-plans.mjs --live   # copy the new RZP_PLAN_* into .env
   ```

1. Upload the secrets and deploy:

   ```sh
   pnpm wrangler secret bulk .env --env post-launch
   PUBLIC_LAUNCH_LIVE=true pnpm deploy:post-launch
   ```

1. Register the webhook in the Razorpay dashboard again, in **live** mode. Use the same address, the same events and the same secret as section 8.

1. Run `curl https://rupeefund.org/api/health`. The answer is `{ ok: true }`. The answer contains no `mode` field. To examine the mode, look at the start of the key in the Cloudflare secret store.

To give the project to a different Cloudflare account, do these steps also. Make a new database with `pnpm wrangler d1 create trf-rupeefund`. Copy the new `database_id` into `wrangler.jsonc`. Apply the migration. Then add the `rupeefund.org` custom domain to the zone of that account.

## 10. How to remove a person from the list

The launch build has no sender. Therefore a request for removal comes by email to `foundation@fossunited.org`. The signup form shows this address. There is no automatic endpoint for removal. A person does this work.

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

## 11. How to export the list

```sh
pnpm list:export --remote --dry-run   # prints the CSV, changes nothing
pnpm list:export --remote > list.csv  # prints the CSV and writes exported_at
```

The export is incremental. The command sends each row one time only. Because of this, a second import cannot add a person again who asked for removal in the list manager after the first export.

The exporter is `scripts/list-export.mts`. Node removes the types when it runs the file. Node does this without a flag from v22.18.0 and from v23.6.0, so an older Node stops the command with `ERR_UNKNOWN_FILE_EXTENSION`. The `engines` field in `package.json` states this floor. CI and Cloudflare Workers Builds do not run this command.

## 12. Voting in the post-launch stage

The file `migrations/post-launch/0001_init.sql` makes the voting tables `proposals`, `ballots` and `vote_tokens`. The launch database does not have them. Apply the migration to the post-launch database:

```sh
pnpm wrangler d1 migrations apply trf-rupeefund-post-launch --env post-launch --remote
```

There is no administration page for proposals. You add a proposal with SQL. The `options` column holds a JSON array of `{key,label}` items. The `choice` value of a ballot must agree with one `key`. The `opens_at` and `closes_at` columns hold epoch milliseconds. They control the open state and the closed state.

```sh
pnpm wrangler d1 execute trf-rupeefund-post-launch --remote --env post-launch --command "
  INSERT INTO proposals (slug, title, body, options, opens_at, closes_at, created_at)
  VALUES ('season-1', 'Season 1 grants', 'Which projects should Season 1 fund?',
    '[{\"key\":\"project-a\",\"label\":\"Project A\"},{\"key\":\"project-b\",\"label\":\"Project B\"}]',
    1727308800000, 1729987200000, 1727308800000);"
```

The system does not keep a counter of the payments. It asks Razorpay for `paid_count` at the time of the link request and again at the time of the vote. A person can vote if `paid_count` is 10 or more. The results stay hidden until `closes_at`. After that time, `GET /api/vote/results/:slug` gives the totals.

**The mailer.** The magic-link function uses the same `Mailer` interface as the newsletter. `createMailer()` is a stub and sends nothing. `POST /api/vote/request-link` shows the token in its answer only when the Razorpay key id starts with `rzp_test_`. With a live key it sends no email. Add a true provider in `src/worker/lib/newsletter.ts` before you make voting available to the public.

## Required keys

| key                                      | home           | source                                                                                                                                                                                                                                           |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_TURNSTILE_SITEKEY`               | Build variable | Cloudflare dashboard → Turnstile → Add widget. **Necessary for the launch.** The build refuses to start without it, and refuses the test sitekey.                                                                                                |
| `PUBLIC_ALLOW_TEST_SITEKEY`              | Build variable | Set it to `true` for a local preview or a CI build only. Never set it in the Workers Builds settings.                                                                                                                                            |
| `TURNSTILE_SECRET`                       | Worker secret  | The same widget. **Necessary for the launch.** `secrets.required` lists it, therefore `wrangler deploy` stops without it. Without it, siteverify answers `missing-input-secret` and the handler answers 403 to each signup that uses JavaScript. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Worker secret  | Razorpay dashboard, test mode                                                                                                                                                                                                                    |
| `RAZORPAY_WEBHOOK_SECRET`                | Worker secret  | The text that you selected for the webhook                                                                                                                                                                                                       |
| `RZP_PLAN_10/50/100/500/1000`            | Worker secret  | The output of `pnpm plans:create`                                                                                                                                                                                                                |
