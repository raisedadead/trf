# Architecture

This document uses ASD-STE100 Simplified Technical English.

## 1. What the system does

The Rupee Fund collects small monthly donations for Indian open source software. FOSS United Foundation operates the fund.

The system does two things:

- It shows information pages to the public.
- It collects email addresses for a mailing list.

Razorpay holds all payment data. The system stores only the data that Razorpay cannot supply. The system does not store a PAN, an address, a payment instrument, or an amount.

## 2. The parts

| Part        | Technology                         | Function                                                            |
| ----------- | ---------------------------------- | ------------------------------------------------------------------- |
| Site        | Astro 7                            | Makes static HTML files before deployment                           |
| Worker      | Hono 4 on Cloudflare Workers       | Answers requests to `/api/*` and controls which pages are available |
| Database    | Cloudflare D1                      | Keeps the mailing list                                              |
| Client code | TypeScript in `src/lib/islands.ts` | Adds behaviour to the static HTML                                   |

The Worker sends all other requests to the static files.

## 3. The two stages

The product goes to the public in two stages. One set of code makes both stages. A variable selects the stage. The stages do not use different branches.

| Item                  | Launch stage    | Post-launch stage           |
| --------------------- | --------------- | --------------------------- |
| Address               | `rupeefund.org` | `preview.rupeefund.org`     |
| Worker                | `trf`           | `trf-post-launch`           |
| Database              | `trf-rupeefund` | `trf-rupeefund-post-launch` |
| `POST_LAUNCH_ENABLED` | not set         | `true`                      |
| `PUBLIC_LAUNCH_LIVE`  | not set         | `true`                      |
| Razorpay keys         | none            | necessary                   |

The launch stage shows the information pages and the form for the mailing list. The post-launch stage also shows the payment pages and the voting pages.

`POST_LAUNCH_ENABLED` controls the Worker. If you do not set this variable, the Worker sends status 404 for these addresses:

- `/api/subscribe`, `/api/subscribe/verify`, `/api/webhook/razorpay`
- `/api/vote/*`, `/api/metrics`, `/api/dataset`, `/api/unsubscribe`
- `/vote`, `/manage`, `/thank-you`

The three page addresses are in `assets.run_worker_first` in `wrangler.jsonc`. This list makes the Worker examine these addresses. If you remove an address from the list, Cloudflare sends the file directly and the Worker cannot block it.

`PUBLIC_LAUNCH_LIVE` controls the content of one page. On `/subscribe`, it selects the form for the mailing list or the form for payment. Set both variables together, or set neither variable.

The HTML files for the blocked pages stay in the `dist` directory. The Worker prevents access to them. The files are not absent.

## 4. How a person joins the mailing list

The address `POST /api/waitlist` is the only address that the public can write to. This address is always available. The Worker does not block it in the launch stage.

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

## 5. The database

The database has one migration file, `migrations/0001_init.sql`. It makes all seven tables.

Wrangler compares only the file names of the migrations with the names in the `d1_migrations` table. Wrangler does not calculate a hash of the content. Two results follow:

- If you change a migration that Wrangler applied before, the database does not change.
- If you use a file name that the `d1_migrations` table contains, Wrangler ignores the file.

Do not use these file names again: `0002_waitlist.sql`, `0003_voting.sql`, `0004_proposal_options.sql`, `0002_waitlist_launch.sql`, `0003_voting_post_launch.sql`. The test `tests/migrations/replay.test.ts` stops the build if you use one of them.

Do not use `wrangler d1 migrations list` to prove that the schema is correct. That command reports success when the file names agree. It does not examine the tables. Query `sqlite_master` instead.

The databases contain no data now. Therefore you can change `0001_init.sql` and apply it again. **After the first true signup, you must add a new migration file for each change.**

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

A blocked page gives status 404 and the same headers as all other pages.

The site loads fonts from `fonts.googleapis.com` and `fonts.gstatic.com`. The policy permits these two addresses. The policy also permits the addresses for Turnstile and Razorpay, because one `_headers` file goes to both stages.

The test `tests/site/csp.test.ts` reads the policy and the HTML files. The test fails if a page loads an address that the policy does not permit.

## 8. How to deploy

Refer to `docs/deploy.md` for the full procedure and the commands.

The important sequence:

1. Apply the migration to the database.
1. Deploy the Worker.
1. Clear the cache of the zone.
1. Examine the site.

Apply the migration first, because `/api/waitlist` is available immediately after the deployment.

`pnpm deploy` examines the configuration before it makes the build. It stops if `PUBLIC_TURNSTILE_SITEKEY` has no value or has the example value from Cloudflare. Wrangler stops the deployment if `TURNSTILE_SECRET` has no value. Without these two values, the Worker refuses each signup that uses JavaScript.
