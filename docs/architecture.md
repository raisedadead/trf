# Architecture

This document uses ASD-STE100 Simplified Technical English.

## 1. What the system does

The Rupee Fund collects small monthly donations for Indian open source software. FOSS United Foundation operates the fund.

The system does two things:

- It shows information pages to the public.
- It collects email addresses for a mailing list.

The system takes no payment and holds no vote. That code is removed. A later wave writes it again from zero. Therefore the system stores no PAN, no address, no payment instrument and no amount.

## 2. The parts

| Part        | Technology                   | Function                                  |
| ----------- | ---------------------------- | ----------------------------------------- |
| Site        | Astro 7                      | Makes static HTML files before deployment |
| Worker      | Hono 4 on Cloudflare Workers | Answers requests to `/api/*`              |
| Database    | Cloudflare D1                | Keeps the mailing list                    |
| Client code | TypeScript in `src/scripts/` | Adds behaviour to the static HTML         |

The Worker answers two addresses, `/api/health` and `/api/waitlist`. It sends every other request to the static files. `assets.run_worker_first` in `wrangler.jsonc` names only `/api/*`, so a request for a page never reaches the Worker.

## 3. The one environment

The system deploys one Worker to one address. There is no second environment, and there is no preview.

| Item                 | Value           |
| -------------------- | --------------- |
| Branch               | `live`          |
| Address              | `rupeefund.org` |
| Worker               | `trf`           |
| Database             | `trf-rupeefund` |
| Rate-limit namespace | `7301`          |

`wrangler.jsonc` sets `workers_dev` and `preview_urls` to `false`. Both are stated, not inherited. The values reach Cloudflare on the next deploy of `trf`, not when you write them. A Worker version keeps the bindings of its Worker, so any second address for `trf` writes to the true mailing list. Cloudflare confirms the limitation: "Unlike Pages, Workers does not natively support defining different bindings in production vs. non-production builds." Refer to <https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>.

`scripts/assert-deploy-env.mjs` refuses a `wrangler.jsonc` that declares an `env` block, and refuses one that leaves either field open. A second target can only drift from the first.

You prove a change on your own machine. `wrangler dev` binds the local D1 that `pnpm db:reset` builds, and the Playwright suite runs against it. No test reaches `trf-rupeefund`.

## 4. How a person joins the mailing list

The address `POST /api/waitlist` is the only address that the public can write to.

The Worker does these steps in this sequence:

1. Compare the `Origin` header with the address of the site. If they are different, refuse.
1. Ask the rate limiter for permission. If the limiter refuses, or if the limiter fails, refuse.
1. Read the body. If the body is more than 8192 bytes, refuse. The Worker examines the `Content-Length` header first. Then it counts the bytes as it reads them, because a client can supply a header that is not correct.
1. Read the fields from the body.
1. Examine the hidden field. If it has a value, answer with success but do not write to the database.
1. Examine the name and the email address. If either one is not correct, refuse.
1. For a request that contains JSON, ask Turnstile to examine the token. If Turnstile refuses, or if Turnstile fails, refuse.
1. Write the row to the database.

The rate limiter and Turnstile always refuse when an error occurs. They never permit the write.

The `Content-Type` header selects one of two paths:

| Header                              | Client                          | Answer after success                |
| ----------------------------------- | ------------------------------- | ----------------------------------- |
| `application/json`                  | The `fetch` call in the browser | Status 200 and `{"ok":true}`        |
| `application/x-www-form-urlencoded` | A browser without JavaScript    | Status 303 to `/waitlist-confirmed` |

The second path uses status 303. Because of this, the browser does not send the data again after a refresh of the page.

**Known limitation.** Turnstile needs JavaScript. Therefore the Worker does not examine a token on the second path. A client that sets that `Content-Type` header can avoid the examination. The `Origin` comparison, the hidden field, and the rate limiter continue to give protection. The maximum damage is unwanted rows in a mailing list that a person exports manually.

## 5. The databases

The two environments have two databases and **one** migrations directory. Each database keeps its own `d1_migrations` ledger, so each one tracks what it applied.

| Directory    | Databases       | Tables     |
| ------------ | --------------- | ---------- |
| `migrations` | `trf-rupeefund` | `waitlist` |

One directory is deliberate. Two directories held two files with the same name and different content, and marker comments kept the shared block in agreement. The two copies could drift. One file cannot.

Wrangler compares only the file names of the migrations with the names in the `d1_migrations` table. Wrangler does not calculate a hash of the content. Two results follow:

- If you change a migration that Wrangler applied before, the database does not change.
- If you use a file name that the `d1_migrations` table contains, Wrangler ignores the file.

Do not use these file names again: `0002_waitlist.sql`, `0003_voting.sql`, `0004_proposal_options.sql`, `0002_waitlist_launch.sql`, `0003_voting_post_launch.sql`. The test `tests/migrations/replay.test.ts` stops the build if you use one of them.

Do not use `wrangler d1 migrations list` to prove that the schema is correct. That command reports success when the file names agree. It does not examine the tables. Query `sqlite_master` instead.

**`trf-rupeefund` holds true signups.** You cannot change `0001_init.sql` and apply it again. Each change needs a new migration file, and each migration must be additive. Two Worker versions read the one live database during a deployment, so a change that is not additive breaks the older one while it still answers the public.

The `waitlist` table:

| Column                     | Function                                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| `email`                    | Unique. A constraint refuses an address that is not in lower case.         |
| `name`                     | The name that the person supplied                                          |
| `consent_at`               | The time when the person gave permission. You cannot add this value later. |
| `source`                   | The form that the person used. The Worker permits only known values.       |
| `exported_at`              | The time of the export. An empty value means that an export is necessary.  |
| `unsubscribed_at`          | The time of a request for removal                                          |
| `created_at`, `updated_at` | The times of the first write and the last write                            |

The Worker writes with an upsert. The Worker does not use `INSERT OR IGNORE`, because that command ignores a row that does not agree with a `NOT NULL` constraint. It reports no error. The result is a loss of data that no person can see.

A request for removal is permanent for the public address. After `unsubscribed_at` has a value, the upsert does not change the row. A subsequent request cannot remove the value, cannot cause a new export, and cannot change the name. This is necessary because the address `/api/waitlist` cannot prove that the person owns the email address. To add the person again, an operator must clear the value manually.

## 6. The export

The command `pnpm list:export` makes a CSV file for a list manager.

The command selects the rows that have no value in `exported_at` and no value in `unsubscribed_at`. It writes the rows. Then it writes the time into `exported_at`.

This sequence is intentional. The list manager compares email addresses, therefore a second export of the same row is safe. A loss of a row is not safe.

The second run of the command writes only the header line. Because of this, a second import into the list manager cannot add a person who asked for removal after the first export.

## 7. Security

`public/_headers` supplies these headers for all pages:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`

The policy permits `'unsafe-inline'` for scripts. This is necessary because Bot Fight Mode is active on the zone. Cloudflare adds an inline script to each HTML answer.

The policy names the font hosts `fonts.googleapis.com` and `fonts.gstatic.com`, and the Turnstile host `challenges.cloudflare.com`. It names no payment host. `form-action` permits `'self'` only.

The test `tests/site/csp.test.ts` reads the policy and the HTML files. The test fails if a page loads an address that the policy does not permit, and it fails if the policy names a payment host again.

## 8. How to deploy

Refer to `docs/deploy.md` for the full procedure and the commands.

Cloudflare Workers Builds watches one branch. A push to `live` deploys `rupeefund.org`, and `main` deploys nothing. The repository declares no deploy script.

Only the workflow `.github/workflows/promote.yml` writes to `live`. It takes a commit that is on `main`, refuses a commit whose checks did not pass, and moves `live` forward. The GitHub environment `production` holds the run until a reviewer approves it. The update uses the GitHub API with `force: false`, so GitHub itself refuses anything that is not a fast-forward.

**Rehearse a migration on a local copy of the database, then apply it to `trf-rupeefund`, then promote.** `wrangler d1 export` gives you the copy. The promote is the only step that puts new code in front of the public, so you control the sequence.

After a promote, clear the cache of the zone. Then examine the site.
