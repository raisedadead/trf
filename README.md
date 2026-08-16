# The Rupee Fund

The Rupee Fund collects small monthly donations for Indian open source software. [FOSS United Foundation](https://fossunited.org) operates the fund.

Astro (static site) + Hono (Cloudflare Worker) + D1.

```sh
pnpm install
pnpm db:reset             # makes the local databases
pnpm preview              # the launch build, http://localhost:8787
pnpm preview:post-launch  # payments and voting, http://localhost:8788
pnpm check                # tests, types, lint
```

`pnpm dev` shows only the pages. The signup form needs `pnpm preview`.

[Architecture](docs/architecture.md) · [Deployment](docs/deploy.md)
