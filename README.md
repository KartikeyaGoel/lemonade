# Lemonade

A browser game where a kid runs a lemonade stand, finds the price that actually
makes money, scales it, sells it, and then buys slices of real companies with
the proceeds — reading them with exactly the same four numbers they used on
their own stand.

The thesis the whole thing hangs on: **every stock is somebody else's lemonade
stand.**

- [`PRODUCT.md`](PRODUCT.md) — what we are building and why. Read it first.
- [`LEARNING.md`](LEARNING.md) — an honest assessment of what a kid actually
  knows at the end, and what they don't.

No real money is ever involved. No accounts, no backend, no analytics, and
nothing loaded from anybody else's domain: the whole game is a static bundle,
it works with the wifi off, and every save lives in `localStorage` on the
device. [`PRIVACY.md`](PRIVACY.md) says so in a form you can hand to a school,
and tells you how to check it yourself.

- [`TEACHING.md`](TEACHING.md) — a 40-minute lesson in which a class measures a
  demand curve from its own thirty decisions. No accounts, no setup.

---

## Running it locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. Use a phone-sized viewport — it is designed
mobile-first.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | 401 unit tests over the simulation, valuation and market logic |
| `npm run data` | Re-fetch real fundamentals and prices |
| `npm run data:check` | Report what is in the bundled data, and fail if stale |

---

## The data is real

Two free sources, both fetched at **build time** and committed, so there is no
API key in the browser and nothing on a child's device ever calls a data
provider:

- **Fundamentals — [SEC EDGAR XBRL](https://data.sec.gov).** Revenue, net income
  and diluted share count straight from each company's 10-K. No key, no signup.
- **Prices — five years of real weekly adjusted closes**, on one shared date axis
  so a market-wide fall lands on every company in the same week.

Act 4 replays a real twelve-week stretch of that history, picked from the kid's
own seed, and they are never told which one. Each fiscal year is stored with the
date its 10-K became public, so the accounts shown are the ones that were
actually public that week — a price from one year over earnings from another is a
multiple nobody ever quoted.

Re-fetch by hand any time:

```bash
npm run data && npm run data:check && npm test
```

`.github/workflows/refresh-market-data.yml` does the same on a weekday schedule
and commits only if the tests still pass on the new numbers.

### Optional: an official price source

Prices use [Alpha Vantage](https://www.alphavantage.co/support/#api-key) when
`ALPHAVANTAGE_KEY` is set (free tier is 25 requests a day; this uses eight) and
fall back to an unofficial endpoint otherwise. Fine for local runs; set the key
before relying on the scheduled refresh.

Add it as a GitHub repository secret named `ALPHAVANTAGE_KEY`.

---

## Deploying to Vercel

Nothing to configure: no environment variables, no database, no build-time
secrets. Vercel detects Next.js and `next build` is the whole deploy.

**Connect the Git repository** rather than deploying only from the CLI — the
scheduled data refresh works by committing to `main`, and it needs Vercel's Git
integration to turn that commit into a deploy.

```bash
# once, from the project root
npx vercel login
npx vercel link
npx vercel --prod
```

Or import the repo at <https://vercel.com/new> and pick the defaults.

### One thing to flip when you want to be found

`src/app/layout.tsx` sets `robots: { index: false, follow: false }`, which is the
right default for a prototype. Remove it when you want the thing indexed.
