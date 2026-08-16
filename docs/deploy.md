# Deployment

This document uses ASD-STE100 Simplified Technical English.

The system runs on the Workers Free plan. A paid plan is not necessary. Refer to [architecture](architecture.md).

Read "Start here" for the procedure that you do now. The other sections are reference material.

## Start here

The state of the account, read on 2026-08-15:

| Item                 | State                                                                |
| -------------------- | -------------------------------------------------------------------- |
| Worker `trf`         | Live. It has 10 deployments. The most recent one is from 2026-06-30. |
| `rupeefund.org`      | A custom domain. Cloudflare connects it to the Worker `trf`.         |
| Launch database      | Migrated. It has 7 tables and 0 signups.                             |
| Post-launch database | `trf-rupeefund-post-launch`. Created and migrated.                   |
| `TURNSTILE_SECRET`   | Uploaded to the Worker `trf`                                         |
| Turnstile widget     | Created. The sitekey is in `.env`.                                   |

The most recent deployment contains the old React build.

**Do not delete the Worker.** Deploy the new code on top of it. If you delete the Worker, Cloudflare disconnects `rupeefund.org`. You also lose the 10 deployments, and those deployments are your only targets for a rollback. The site stays unavailable until you deploy again. A deployment replaces every file. Nothing from the old build stays, but the edge cache keeps copies. Step 3 removes them.

**The database needs no work.** The migration is applied. The `waitlist` table exists and has 0 rows.

```sh
pnpm check && pnpm preview     # 1. complete the form one time at localhost:8787
pnpm deploy                    # 2. examines the config, makes the build, deploys
                               # 3. purge the zone cache in the dashboard — necessary
```

Purge the cache, because the live site answers with `cf-cache-status: HIT`. If you do not purge the cache, the new build can look absent.

Then examine the site:

```sh
curl -s https://rupeefund.org/api/health                              # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' https://rupeefund.org/vote   # 404 — gated
curl -sI https://rupeefund.org/ | grep -i -e content-security-policy -e strict-transport
```

Open the site. Look for `/_astro/` in the source of the page. The new build contains this text. The old React build does not contain it. Complete the form one time. Then make sure that the database has the row:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --command "SELECT email, consent_at FROM waitlist"
```

If a problem occurs, run `pnpm wrangler rollback`. Then purge the cache again.

Deploy the post-launch stage later, after the launch site operates correctly. Refer to section 6.

## Reference

Background information and the procedures that you need less often.

## 1. What you need first

- A Cloudflare account with the `rupeefund.org` zone.
- pnpm, at the version in `packageManager` in `package.json`. Also direnv.
- Access to the Razorpay dashboard of FOSS United Foundation, in test mode.

## 2. Secrets in `.env` and direnv

The project uses one `.env` file at the top of the repository. Both direnv and wrangler read this file. Do **not** also make a `.dev.vars` file. If that file exists, wrangler ignores `.env`.

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

## 3. The database

```sh
pnpm wrangler d1 create trf-rupeefund       # copy database_id into wrangler.jsonc
pnpm wrangler d1 migrations apply trf-rupeefund --local
pnpm wrangler d1 migrations apply trf-rupeefund --remote
pnpm wrangler d1 info trf-rupeefund          # examine the result
```

The `database_id` value selects the local database. If you change the value, apply the migration with `--local` again.

**The schema is one migration, `0001_init.sql`.** It stays one file until the first true signup. After that signup, you must add a new file for each change.

**Wrangler resolves a migration by the file name only.** `getUnappliedMigrations` compares the file names with the names in the `d1_migrations` table. It calculates no hash. Two results follow:

- If you change a migration that Wrangler applied before, the database does not change.
- If you use a file name that the table records, Wrangler skips the file and reports no error. The names `0002_waitlist.sql`, `0003_voting.sql` and `0004_proposal_options.sql` all existed here. Do not use them again. `tests/migrations/replay.test.ts` stops the build if you use one of them.

Never use `migrations list` as proof that the schema is correct. That command reports "No migrations to apply" when the file names agree, and it does not examine the tables. Examine the schema:

```sh
pnpm wrangler d1 execute trf-rupeefund --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

**How to make a database again before the launch.** While the database has no data, you can change `0001_init.sql` and start again. This keeps the history clean. After true signups exist, this procedure destroys data. Then you must add a new migration instead.

```sh
pnpm wrangler d1 export trf-rupeefund --remote --output /tmp/trf-pre.sql   # always do this first
pnpm wrangler d1 execute trf-rupeefund --remote --command "
  DROP TABLE IF EXISTS ballots; DROP TABLE IF EXISTS vote_tokens; DROP TABLE IF EXISTS proposals;
  DROP TABLE IF EXISTS waitlist; DROP TABLE IF EXISTS processed_events;
  DROP TABLE IF EXISTS metrics_cache; DROP TABLE IF EXISTS contributors;
  DELETE FROM d1_migrations;"
pnpm wrangler d1 migrations apply trf-rupeefund --remote
```

Run `SELECT COUNT(*) FROM waitlist` before this procedure. If the count is not zero, stop.

## 4. Razorpay plans and the webhook

Make the 5 monthly plans. The command finds the rupee-fund plans that exist and uses them again.

```sh
pnpm plans:create             # prints RZP_PLAN_* lines → copy them into .env
```

Register the webhook in the Razorpay dashboard:

- Address: `https://preview.rupeefund.org/api/webhook/razorpay`. The launch Worker answers 404 for this path, therefore the webhook must use the post-launch host.
- Events: `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`
- Secret: select a strong text. Write it as `RAZORPAY_WEBHOOK_SECRET` in `.env`.

Set the Razorpay callback address to `https://preview.rupeefund.org/thank-you`. The launch host answers 404 for `/thank-you`. That page shows only a pending state. The true result of the payment comes later from the webhook, and never from the callback.

## 5. How to deploy — the usual sequence

The procedure in "Start here" needs no migration, because the schema is applied. A future deployment can change the schema. Then the sequence is important. The address `/api/waitlist` is live and writes to the `waitlist` table, therefore the table must exist before the new Worker.

```sh
pnpm wrangler d1 export trf-rupeefund --remote --output /tmp/trf-pre.sql   # make a backup first
pnpm wrangler d1 migrations apply trf-rupeefund --remote
pnpm wrangler d1 execute trf-rupeefund --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"       # examine the tables
pnpm deploy
```

Purge the zone cache after each deployment. Then run the commands in "Start here" again.

## 6. How to change to live keys

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

1. Register the webhook in the Razorpay dashboard again, in **live** mode. Use the same address, the same events and the same secret as section 4.

1. Run `curl https://rupeefund.org/api/health`. The answer is `{ ok: true }`. The answer contains no `mode` field. To examine the mode, look at the start of the key in the Cloudflare secret store.

To give the project to a different Cloudflare account, do these steps also. Make a new database with `pnpm wrangler d1 create trf-rupeefund`. Copy the new `database_id` into `wrangler.jsonc`. Apply the migration. Then add the `rupeefund.org` custom domain to the zone of that account.

## 7. How to remove a person from the list

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

## 8. How to export the list

```sh
pnpm list:export --remote --dry-run   # prints the CSV, changes nothing
pnpm list:export --remote > list.csv  # prints the CSV and writes exported_at
```

The export is incremental. The command sends each row one time only. Because of this, a second import cannot add a person again who asked for removal in the list manager after the first export.

## 9. Voting in the post-launch stage

The file `0001_init.sql` makes the voting tables `proposals`, `ballots` and `vote_tokens`. The `d1 migrations apply` command in section 3 makes them. No other action is necessary.

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

| key                                      | source                                                                                                                                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_TURNSTILE_SITEKEY`               | Cloudflare dashboard → Turnstile → Add widget. **Necessary for the launch.** The build reads it and puts it into the static files. `pnpm deploy` refuses to make the build without it.                                                                               |
| `TURNSTILE_SECRET`                       | The same widget. **Necessary for the launch.** It is a Worker secret, and `secrets.required` lists it, therefore `wrangler deploy` stops without it. Without it, siteverify answers `missing-input-secret` and the handler refuses each signup that uses JavaScript. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay dashboard, test mode                                                                                                                                                                                                                                        |
| `RAZORPAY_WEBHOOK_SECRET`                | The text that you selected for the webhook                                                                                                                                                                                                                           |
| `RZP_PLAN_10/50/100/500/1000`            | The output of `pnpm plans:create`                                                                                                                                                                                                                                    |
