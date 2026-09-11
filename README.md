# The Rupee Fund

The Rupee Fund collects small monthly donations for FOSS in India. It is a community initiative from FOSS United, run by volunteers. The [FOSS United Foundation](https://fossunited.org) is the fiscal host.

Astro (static site) + Hono (Cloudflare Worker) + D1.

The site shows two public pages and collects email addresses for a mailing list. It takes no payment. That code comes later, written from zero.

```sh
pnpm install
pnpm db:reset   # makes the local database
pnpm preview    # http://localhost:8787
pnpm check      # types, lint, tests
pnpm test:e2e   # Playwright
```

`pnpm dev` shows only the pages. The signup form needs `pnpm preview`.

## One site

| Branch | Site            | Deploys                      |
| ------ | --------------- | ---------------------------- |
| `main` | none            | Never                        |
| `live` | `rupeefund.org` | When the maintainer moves it |

The repository builds no beta site and no preview URL. You prove a change on your own machine with `pnpm preview`, which serves the built site against a local database.

Open your pull request against `main`. A merge reaches no public address on its own. The maintainer moves `live` forward to a commit on `main` after CI passes.

[Architecture](docs/architecture.md) · [Deployment](docs/deploy.md) · [Contributing](CONTRIBUTING.md)
