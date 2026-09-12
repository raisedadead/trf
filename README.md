# The Rupee Fund

The Rupee Fund collects small monthly contributions for FOSS in India. It is a community initiative from FOSS United, run by volunteers. The [FOSS United Foundation](https://fossunited.org) is the fiscal host.

The site is static HTML from Astro. A Cloudflare Worker, written with Hono, answers the signup form and writes to a D1 database. The site takes no payment. It collects a mailing list and the intent of each person: an amount, a duration, a question, and a yes or no for monthly updates.

## Quick start

```sh
pnpm install
pnpm db:reset    # makes the local database
pnpm preview     # http://localhost:8787, with the signup form
pnpm check       # types, lint, tests
pnpm test:e2e    # Playwright
```

`pnpm dev` shows the pages only. The signup form needs `pnpm preview`.

## One site

| Branch | Site            | Deploys                      |
| ------ | --------------- | ---------------------------- |
| `main` | none            | never                        |
| `live` | `rupeefund.org` | when the maintainer moves it |

Open a pull request against `main`. A merge deploys nothing. The maintainer fast-forwards `live` to a commit on `main` after CI passes. There is no beta site and no preview URL. You prove a change on your own machine.

[Architecture](docs/architecture.md) · [Deployment](docs/deploy.md) · [Contributing](CONTRIBUTING.md)
