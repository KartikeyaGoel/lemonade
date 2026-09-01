#!/usr/bin/env node
/**
 * Fetches the real numbers the game teaches with, and writes them to
 * `src/lib/market-data.json`.
 *
 * Two sources, both free:
 *
 *  - **Fundamentals: SEC EDGAR XBRL** (`data.sec.gov`). Official, no API key,
 *    no signup, no terms problem — these are the figures the company itself
 *    filed. Revenue, net income and diluted share count come straight from the
 *    10-K. The only requirement is a real User-Agent, which the SEC asks for so
 *    they can contact whoever is hammering them.
 *  - **Weekly closes: Alpha Vantage** if `ALPHAVANTAGE_KEY` is set (official,
 *    free tier is 25 requests a day, which covers eight tickers), otherwise
 *    Yahoo's chart endpoint as a keyless fallback. Yahoo is *unofficial* and can
 *    change without notice, so it is a convenience for local runs rather than
 *    something to depend on in a deploy.
 *
 * Run it at build time, not at runtime. That way there is no key in the browser,
 * no request from a child's device to a third party, and the app stays a static
 * bundle. A scheduled daily build is what keeps it current.
 *
 *   ALPHAVANTAGE_KEY=... node scripts/fetch-market-data.mjs
 *
 * If anything fails the script exits non-zero *without* writing, so a bad
 * network day can never replace good data with half-data.
 */

import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'lib', 'market-data.json');

/** The SEC wants to know who is calling. Be honest about it. */
const UA = process.env.SEC_USER_AGENT ?? 'lemonade-edu-game (educational, contact: kartgoel@stanford.edu)';

/**
 * The eight companies, and the parts of them a data feed cannot supply:
 * what a twelve year old would recognise them for, and one qualitative line
 * they can actually reason about.
 */
const COMPANIES = [
  {
    ticker: 'AAPL',
    cik: '0000320193',
    name: 'Apple',
    emoji: '📱',
    whatTheySell: 'iPhones, Macs, and services',
    story: 'Almost everyone who owns one buys another. Hard to talk people out of.',
    tier: 1,
    model: 'brand',
  },
  {
    ticker: 'COST',
    cik: '0000909832',
    name: 'Costco',
    emoji: '🛒',
    whatTheySell: 'Bulk groceries, memberships',
    story: 'Sells enormous amounts and keeps a sliver of each sale on purpose.',
    tier: 1,
    model: 'membership',
  },
  {
    ticker: 'CMG',
    cik: '0001058090',
    name: 'Chipotle',
    emoji: '🌯',
    whatTheySell: 'Burritos',
    story: 'Opens hundreds of new restaurants a year. Each one is a new stand.',
    tier: 1,
    model: 'many-copies',
  },
  {
    ticker: 'NKE',
    cik: '0000320187',
    name: 'Nike',
    emoji: '👟',
    whatTheySell: 'Trainers and kit',
    story: 'Everyone knows the brand, but people have been buying fewer pairs.',
    tier: 1,
    model: 'brand',
  },
  {
    ticker: 'KO',
    cik: '0000021344',
    name: 'Coca-Cola',
    emoji: '🥤',
    whatTheySell: 'Fizzy drinks, everywhere',
    story: 'Grows slowly and very reliably. Has sold the same thing for a century.',
    tier: 1,
    model: 'brand',
  },
  {
    ticker: 'RBLX',
    cik: '0001315098',
    name: 'Roblox',
    emoji: '🎮',
    whatTheySell: 'A platform for making games',
    story: 'Growing fast and loved by millions. Still spends more than it takes in.',
    tier: 1,
    model: 'platform',
  },
  {
    ticker: 'NFLX',
    cik: '0001065280',
    name: 'Netflix',
    emoji: '🎬',
    whatTheySell: 'Subscriptions to shows',
    story: 'Millions pay every month without thinking about it.',
    tier: 1,
    model: 'subscription',
  },
  {
    ticker: 'DIS',
    cik: '0001744489',
    name: 'Disney',
    emoji: '🏰',
    whatTheySell: 'Films, parks, merchandise',
    story: 'Sells a huge amount and keeps a small slice. The parks cost a fortune to run.',
    tier: 1,
    model: 'many-copies',
  },
  /* ---- Tier 2: where a family's money actually goes ---- */
  {
    ticker: 'MCD',
    cik: '0000063908',
    name: "McDonald's",
    emoji: '🍟',
    tier: 2,
    whatTheySell: 'Burgers, on every corner',
    story: 'Mostly does not own the restaurants. Collects rent and a cut from the people who do.',
    model: 'many-copies',
  },
  {
    ticker: 'SBUX',
    cik: '0000829224',
    name: 'Starbucks',
    emoji: '☕',
    tier: 2,
    whatTheySell: 'Coffee, and somewhere to sit',
    story: 'Charges several times what the coffee costs, and people queue anyway.',
    model: 'brand',
  },
  {
    ticker: 'AMZN',
    cik: '0001018724',
    name: 'Amazon',
    emoji: '📦',
    tier: 2,
    whatTheySell: 'Everything, plus the computers other companies run on',
    story: 'The shopping is enormous and thin. The quiet computing business is where the profit is.',
    model: 'platform',
  },
  {
    ticker: 'WMT',
    cik: '0000104169',
    name: 'Walmart',
    emoji: '🏬',
    tier: 2,
    whatTheySell: 'Groceries and everything else, cheaply',
    story: 'Takes in more money than almost anyone and keeps two or three cents of each dollar.',
    model: 'many-copies',
  },
  {
    ticker: 'DASH',
    cik: '0001792789',
    name: 'DoorDash',
    emoji: '🛵',
    tier: 2,
    whatTheySell: 'Somebody else\'s dinner, brought to you',
    story: 'Cooks nothing. Takes a cut of the order, the delivery and the advert.',
    model: 'platform',
  },
  {
    ticker: 'DPZ',
    cik: '0001286681',
    name: "Domino's",
    emoji: '🍕',
    tier: 2,
    whatTheySell: 'Pizza, delivered',
    story: 'Sells the dough and the ovens to its own franchisees. Two businesses in one.',
    model: 'many-copies',
  },
  {
    ticker: 'LULU',
    cik: '0001397187',
    name: 'Lululemon',
    emoji: '🧘',
    tier: 2,
    whatTheySell: 'Leggings and running kit',
    story: 'Keeps a startling slice of every sale, because people will pay the sticker price.',
    model: 'brand',
  },
  {
    ticker: 'TTWO',
    cik: '0000946581',
    name: 'Take-Two',
    emoji: '🎮',
    tier: 2,
    whatTheySell: 'GTA, NBA 2K, and mobile games',
    story: 'Spends years and fortunes on one game, then finds out in a week whether it worked.',
    model: 'one-off',
  },

  /* ---- Tier 3: you cannot see these from the street ---- */
  {
    ticker: 'NVDA',
    cik: '0001045810',
    name: 'Nvidia',
    emoji: '🖥️',
    tier: 3,
    whatTheySell: 'The chips that AI runs on',
    story: 'Does not have to pick which AI company wins. It sells to all of them.',
    model: 'picks-and-shovels',
  },
  {
    ticker: 'MSFT',
    cik: '0000789019',
    name: 'Microsoft',
    emoji: '💻',
    tier: 3,
    whatTheySell: 'Office, Windows, Xbox, cloud computing',
    story: 'Turned software you bought once into software you rent forever.',
    model: 'subscription',
  },
  {
    ticker: 'GOOGL',
    cik: '0001652044',
    name: 'Alphabet',
    emoji: '🔍',
    tier: 3,
    whatTheySell: 'Search, YouTube, Android',
    story: 'You have never paid it a penny. It is one of the most profitable companies alive.',
    model: 'advertising',
  },
  /*
   * PayPal rather than Visa, which was the first choice.
   *
   * Visa reports its share count per class through XBRL dimensions rather than
   * as a plain annual fact, so the fetch could not read it — and a company
   * whose share count has to be assembled by hand is a company whose P/E this
   * game would be quietly guessing at. PayPal is the same toll booth, owns
   * Venmo, and files the ordinary way.
   */
  {
    ticker: 'PYPL',
    cik: '0001633917',
    name: 'PayPal',
    emoji: '💸',
    tier: 3,
    whatTheySell: 'Paying for things online, and Venmo',
    story: 'Moves other people\'s money and keeps a sliver of every push of the button.',
    model: 'toll-booth',
  },
  {
    ticker: 'DUOL',
    cik: '0001562088',
    name: 'Duolingo',
    emoji: '🦉',
    tier: 3,
    whatTheySell: 'Language lessons, mostly free',
    story: 'Almost everybody uses it for nothing. The business is the few who pay.',
    model: 'subscription',
  },
  {
    ticker: 'ABNB',
    cik: '0001559720',
    name: 'Airbnb',
    emoji: '🏠',
    tier: 3,
    whatTheySell: 'Somewhere to stay, owned by somebody else',
    story: 'Owns no houses. Takes a cut of every night booked in other people\'s.',
    model: 'platform',
  },
  {
    ticker: 'UBER',
    cik: '0001543151',
    name: 'Uber',
    emoji: '🚗',
    tier: 3,
    whatTheySell: 'Rides and takeaway',
    story: 'Lost money for over a decade on purpose, buying the habit before the profit.',
    model: 'platform',
  },
  {
    ticker: 'CROX',
    cik: '0001334036',
    name: 'Crocs',
    emoji: '🐊',
    tier: 3,
    whatTheySell: 'Foam clogs',
    story: 'Cheap to make, sold for a lot, and priced by the market as if it will go out of fashion.',
    model: 'brand',
  },

];

/** Revenue is filed under different tags depending on the company. */
const REVENUE_TAGS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueNet',
];

const NET_INCOME_TAGS = [
  'NetIncomeLoss',
  'ProfitLoss',
  // Coca-Cola files this one and not `NetIncomeLoss`.
  'NetIncomeLossAvailableToCommonStockholdersBasic',
  'IncomeLossFromContinuingOperations',
];

/** EPS is computed on diluted weighted-average shares, so use the same figure. */
const SHARE_TAGS = [
  'WeightedAverageNumberOfDilutedSharesOutstanding',
  'WeightedAverageNumberOfSharesOutstandingBasic',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

/** Everything a company has ever filed, in one request. */
async function companyFacts(cik) {
  return getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
}

const DAY_MS = 86_400_000;

function spanDays(row) {
  if (!row.start || !row.end) return 0;
  return Math.round((Date.parse(row.end) - Date.parse(row.start)) / DAY_MS);
}

/**
 * Pulls annual values for a concept, merging across the tags a company uses.
 *
 * Four things here were learned the hard way, and every one of them silently
 * produced a wrong number rather than an error:
 *
 *  1. **Tag choice is not cosmetic.** Coca-Cola files no `NetIncomeLoss` at
 *     all, so assuming one tag per concept simply lost a company.
 *  2. **The SEC's `CY####` frames cannot be trusted as a filter.** They stop
 *     being assigned for some filers — Chipotle has none after CY2020 — so
 *     taking the latest framed row gave a five-year-old figure and reported it
 *     as this year's. Chipotle's net income came out as $0.4B against a true
 *     $1.54B, which then showed a P/E of 143 instead of 40.
 *  3. **A company can change which tag it reports under, mid-history.** Nvidia
 *     filed revenue as `RevenueFromContractWithCustomerExcludingAssessedTax`
 *     until FY2022 and as `Revenues` after it. Taking the first tag that exists
 *     *at all* pinned Nvidia to 2022 and priced a 2026 share against 2022
 *     earnings: a P/E of 571. So the tags are merged, best tag first, and each
 *     year takes the highest-priority tag that actually reported it.
 *  4. **Not every filer scales share counts the same way.** McDonald's reports
 *     741,000,000 shares in one year and 716.4 in another — the same fact, one
 *     raw and one already in millions, both tagged in the `shares` unit. Divide
 *     the second by a million and the company has no shares, its earnings per
 *     share are astronomical, and its P/E rounds to zero. Which is what the
 *     game showed.
 *
 * So annual periods are identified by the only thing that is actually
 * definitional — a reported duration of roughly a year — and every value is
 * normalised before it is used.
 */

/**
 * A share count on the same scale as everybody else's.
 *
 * Ten million is the dividing line and it is not arbitrary: no company on this
 * roster has ever had fewer than a hundred million shares, and none has more
 * than ten million *million*. Anything under the line was filed in millions
 * already and has to be put back.
 */
const SHARES_ALREADY_IN_MILLIONS_BELOW = 10_000_000;

function normaliseShares(value) {
  return value < SHARES_ALREADY_IN_MILLIONS_BELOW ? value * 1_000_000 : value;
}

function annualSeries(facts, tags, { shares = false } = {}) {
  const gaap = facts.facts?.['us-gaap'] ?? {};

  /** Period end → the row to use, filled best-tag-first. */
  const byEnd = new Map();
  const tagsUsed = [];

  for (const tag of tags) {
    const concept = gaap[tag];
    if (!concept) continue;

    const units = Object.values(concept.units ?? {}).find(Array.isArray) ?? [];
    const annual = units.filter((row) => {
      if (row.form !== '10-K') return false;
      const days = spanDays(row);
      return days >= 340 && days <= 400;
    });
    if (annual.length === 0) continue;

    let contributed = false;
    for (const row of annual) {
      /*
       * Keyed by period end, keeping the *earliest* filing that reported it.
       *
       * A 10-K restates the two prior years as comparatives, so the same fiscal
       * year shows up in three different filings. Keeping the latest one made
       * FY2017 look like it was published in 2019 — which then let the game show
       * a kid replaying 2022 a set of accounts nobody had yet. The first filing
       * is the date the figure actually became public, which is the only date
       * that matters for "what could they have known".
       */
      const value = shares ? normaliseShares(row.val) : row.val;
      const existing = byEnd.get(row.end);
      // A higher-priority tag already claimed this year: leave it alone.
      if (existing && existing.tag !== tag) continue;
      if (!existing || (row.filed ?? '9999') < (existing.filed ?? '9999')) {
        byEnd.set(row.end, { ...row, val: value, tag });
        contributed = true;
      }
    }
    if (contributed) tagsUsed.push(tag);
  }

  if (byEnd.size === 0) return null;
  const sorted = [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
  return { tag: tagsUsed.join(' + '), rows: sorted, byEnd };
}

/**
 * The most recent year end that all three concepts actually report.
 *
 * Without this the three could land on different years — the exact failure that
 * paired this year's revenue with a figure from 2020 — and the resulting P/E
 * would be arithmetically fine and completely wrong.
 */
function latestSharedYearEnd(series) {
  const [first, ...rest] = series;
  const shared = [...first.byEnd.keys()].filter((end) =>
    rest.every((other) => other.byEnd.has(end)),
  );
  return shared.sort().pop() ?? null;
}

/** Weekly closes, newest last. */
async function weeklyCloses(ticker) {
  const key = process.env.ALPHAVANTAGE_KEY;

  if (key) {
    const payload = await getJson(
      `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${ticker}&apikey=${key}`,
    );
    const series = payload['Weekly Adjusted Time Series'];
    if (!series) {
      throw new Error(
        `Alpha Vantage returned no series for ${ticker}: ${JSON.stringify(payload).slice(0, 200)}`,
      );
    }
    return Object.entries(series)
      .map(([date, row]) => ({ date, close: Number(row['5. adjusted close']) }))
      .filter((row) => Number.isFinite(row.close) && row.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Keyless fallback. Unofficial: fine for a local run, not for a deploy.
  const payload = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5y&interval=1wk`,
    { 'User-Agent': 'Mozilla/5.0' },
  );
  const result = payload.chart?.result?.[0];
  const stamps = result?.timestamp ?? [];
  const closes = result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? [];
  const rows = [];
  for (let i = 0; i < stamps.length; i++) {
    const close = closes[i];
    if (!Number.isFinite(close) || close <= 0) continue;
    rows.push({ date: new Date(stamps[i] * 1000).toISOString().slice(0, 10), close: Number(close.toFixed(4)) });
  }
  if (rows.length === 0) throw new Error(`No closes for ${ticker}`);
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Every stock split in the window, so share counts can be put on the same
 * footing as the prices.
 *
 * This exists because of a bug that made it all the way onto the screen.
 * Closes are *adjusted* — a 50-for-1 split is applied retroactively to every
 * price before it, which is what makes a five-year chart a straight line rather
 * than a cliff. Share counts out of a 10-K are not adjusted: they are what the
 * company reported at the time. Divide an adjusted price by earnings per
 * unadjusted share and the P/E comes out wrong by exactly the split factor.
 *
 * Chipotle split 50:1 in June 2024, so a 2023 week showed a price-to-earnings
 * ratio of 1. The game told a kid that Chipotle earned back its whole share
 * price in a single year. Nothing in the product is worse than a number that is
 * confidently wrong, because the entire claim being made is that these are
 * real.
 *
 * Returns `[{ date, factor }]`, oldest first. Empty when a company never split,
 * which is most of them.
 */
async function splitsFor(ticker) {
  // Everything, not a window. Fundamentals reach back further than the price
  // series does, and a split older than the window still has to be applied to
  // the share counts that predate it — Netflix split 7:1 in 2015.
  const payload = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=max&interval=1mo&events=split`,
    { 'User-Agent': 'Mozilla/5.0' },
  );
  const events = payload.chart?.result?.[0]?.events?.splits ?? {};
  return Object.values(events)
    .map((event) => ({
      date: new Date(event.date * 1000).toISOString().slice(0, 10),
      factor: Number(event.numerator) / Number(event.denominator),
    }))
    .filter((split) => Number.isFinite(split.factor) && split.factor > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Shares as they would have been counted on today's basis.
 *
 * A figure reported before a split has to be multiplied by every split that has
 * happened since, which is exactly what the price series already had done to
 * it.
 *
 * Keyed on the **filing date**, not the fiscal year end, and the difference is
 * not academic. A 10-K published after a split restates the prior years on the
 * new basis itself. Walmart's year ended 31 January 2024, split three-for-one
 * on 26 February, and filed in March already showing 8.1 billion shares —
 * adjusting on the year end would have multiplied an adjusted figure by three
 * again and given Walmart 24 billion shares and a third of its real P/E. The
 * filing date is when the number was written down, so it is the only date that
 * says which basis it was written on.
 */
function sharesOnTodaysBasis(reported, filedOn, splits) {
  const factor = splits
    .filter((split) => split.date > filedOn)
    .reduce((total, split) => total * split.factor, 1);
  return reported * factor;
}

/**
 * Compound annual growth over up to three years.
 *
 * Year-on-year was the obvious choice and it is a bad signal on real data.
 * Disney's net income roughly doubled in one recovery year, which came out as
 * "growing 149% a year" and made it look like the obvious buy; Chipotle's last
 * two years were almost identical, which came out as 0% and made a business
 * that has nearly doubled in three years look stagnant. Neither is what a kid
 * should be reasoning from.
 *
 * Falls back to the plain change when there are not enough years, and returns
 * null rather than a nonsense figure when the starting value is not positive —
 * a CAGR through zero or through a loss is not a rate of anything.
 */
/**
 * A growth rate that is allowed to say "I don't know".
 *
 * Growth from a base near zero is not a large number, it is an undefined one.
 * Amazon lost money in 2022 and made $78B in 2025, which came out of the naive
 * formula as "growing 984% a year" and sat on the card next to Coca-Cola's 11%
 * as though the two were comparable quantities. A kid reading that has been
 * handed a reason to buy, and the reason is an artefact of dividing by
 * something close to zero.
 *
 * So: when the earlier end is a loss or a rounding error next to the later one,
 * this walks the window in and tries a shorter span. If no span has a sound
 * base, it returns null, and the card falls back to revenue growth — which for
 * a company whose profit has just turned positive is the honest figure anyway.
 */
function cagr(rows, years = 3) {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1].val;

  for (let span = Math.min(years, rows.length - 1); span >= 1; span--) {
    const first = rows[rows.length - 1 - span].val;
    // A base at or below zero has no growth rate, and a base under a twentieth
    // of the current figure produces a percentage nobody can reason about.
    if (!(first > 0) || !(last > 0)) continue;
    if (first < Math.abs(last) / 20) continue;
    return Number(((last / first) ** (1 / span) - 1).toFixed(4));
  }
  return null;
}

/** Weekly standard deviation of returns, which is what the game calls volatility. */
function volatilityFrom(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1].close;
    if (prev > 0) returns.push(closes[i].close / prev - 1);
  }
  if (returns.length < 8) return 0.03;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  return Number(Math.sqrt(variance).toFixed(4));
}

async function main() {
  const out = { companies: [] };
  const problems = [];

  for (const company of COMPANIES) {
    process.stderr.write(`${company.ticker} … `);

    let facts;
    try {
      facts = await companyFacts(company.cik);
    } catch (error) {
      problems.push(`${company.ticker}: SEC facts — ${error.message}`);
      process.stderr.write('SEC FAILED\n');
      continue;
    }

    const revenue = annualSeries(facts, REVENUE_TAGS);
    const netIncome = annualSeries(facts, NET_INCOME_TAGS);
    const shares = annualSeries(facts, SHARE_TAGS, { shares: true });

    if (!revenue || !netIncome || !shares) {
      problems.push(`${company.ticker}: missing ${[!revenue && 'revenue', !netIncome && 'net income', !shares && 'shares'].filter(Boolean).join(', ')}`);
      process.stderr.write('FUNDAMENTALS FAILED\n');
      continue;
    }

    let closes;
    let splits;
    try {
      closes = await weeklyCloses(company.ticker);
      splits = await splitsFor(company.ticker);
    } catch (error) {
      problems.push(`${company.ticker}: ${error.message}`);
      process.stderr.write('PRICES FAILED\n');
      continue;
    }
    if (splits.length > 0) {
      process.stderr.write(`splits ${splits.map((s) => `${s.factor}x ${s.date}`).join(', ')} `);
    }

    /*
     * Every fiscal year, not just the newest one.
     *
     * Act 4 replays a real week from the past, and dividing a price from that
     * week by *this* year's earnings produces a P/E that nobody ever quoted —
     * and hands the kid hindsight they would not have had. So each annual
     * period is emitted with the date its 10-K was filed, and the game uses
     * whichever one was actually public on the week being replayed.
     */
    const sharedEnds = [...revenue.byEnd.keys()]
      .filter((end) => netIncome.byEnd.has(end) && shares.byEnd.has(end))
      .sort();

    let annuals = sharedEnds.map((end, index) => {
      const upTo = sharedEnds.slice(0, index + 1);
      const rowsUpTo = (series) => upTo.map((e) => series.byEnd.get(e));
      return {
        fiscalYear: end.slice(0, 4),
        fiscalYearEnd: end,
        filedOn: revenue.byEnd.get(end).filed,
        revenueM: Math.round(revenue.byEnd.get(end).val / 1_000_000),
        netIncomeM: Math.round(netIncome.byEnd.get(end).val / 1_000_000),
        sharesM: Math.round(
          sharesOnTodaysBasis(
            shares.byEnd.get(end).val,
            shares.byEnd.get(end).filed ?? end,
            splits,
          ) / 1_000_000,
        ),
        growth: cagr(rowsUpTo(netIncome)) ?? 0,
        revenueGrowth: cagr(rowsUpTo(revenue)) ?? 0,
      };
    });

    /*
     * Only the years the game can actually read.
     *
     * Act 4 replays five years of prices, so an as-of date can never reach
     * further back than that. Carrying nineteen years of accounts per company
     * tripled the bundle for data nobody sees and kept a decade of old stock
     * splits in play — Nvidia's 2011 share count came out as twenty-three
     * trillion. Eight years is the window plus generous margin.
     */
    const KEEP_YEARS = 8;
    if (annuals.length > KEEP_YEARS) annuals.splice(0, annuals.length - KEEP_YEARS);

    const yearEnd = latestSharedYearEnd([revenue, netIncome, shares]);
    if (!yearEnd) {
      problems.push(`${company.ticker}: no year end reported by all three concepts`);
      process.stderr.write('MISMATCHED YEARS\n');
      continue;
    }

    const latestRevenue = revenue.byEnd.get(yearEnd);
    const latestIncome = netIncome.byEnd.get(yearEnd);
    const latestShares = shares.byEnd.get(yearEnd);

    out.companies.push({
      ticker: company.ticker,
      cik: company.cik,
      name: company.name,
      emoji: company.emoji,
      tier: company.tier,
      whatTheySell: company.whatTheySell,
      story: company.story,
      model: company.model,

      fiscalYear: yearEnd.slice(0, 4),
      fiscalYearEnd: yearEnd,
      filedOn: latestRevenue.filed,
      /** Every fiscal year, oldest first, each with the date it became public. */
      annuals,
      revenueM: Math.round(latestRevenue.val / 1_000_000),
      netIncomeM: Math.round(latestIncome.val / 1_000_000),
      sharesM: Math.round(
        sharesOnTodaysBasis(latestShares.val, latestShares.filed ?? yearEnd, splits) / 1_000_000,
      ),
      revenueTag: revenue.tag,
      netIncomeTag: netIncome.tag,
      sharesTag: shares.tag,

      /** Profit growth: a three-year CAGR, so one odd year cannot dominate. */
      growth: cagr(netIncome.rows.filter((row) => row.end <= yearEnd)) ?? 0,
      /**
       * Revenue growth, which is the only growth figure that means anything for
       * a company that does not make a profit yet.
       */
      revenueGrowth: cagr(revenue.rows.filter((row) => row.end <= yearEnd)) ?? 0,
      volatility: volatilityFrom(closes.slice(-104)),

      /** Newest last. Realigned onto a shared date axis below. */
      weeklyCloses: closes,
    });

    process.stderr.write('ok\n');
    // The SEC asks for no more than ten requests a second; this is far under.
    await sleep(400);
  }

  if (problems.length > 0) {
    console.error('\nRefusing to write. Problems:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  /*
   * One shared date axis.
   *
   * The game replays a hidden stretch of real history, and a market-wide fall
   * has to land on every company in the same week or the whole point is lost —
   * a kid would see one holding drop while another rose on a different date and
   * conclude the market is noise rather than that it moves together. So the
   * axis is the intersection of the dates every company actually has, and each
   * company's closes are an array aligned to it.
   */
  const dateSets = out.companies.map((c) => new Set(c.weeklyCloses.map((row) => row.date)));
  const weeks = out.companies[0].weeklyCloses
    .map((row) => row.date)
    .filter((date) => dateSets.every((set) => set.has(date)))
    .sort();

  if (weeks.length < 60) {
    console.error(`\nRefusing to write: only ${weeks.length} weeks are common to all companies.`);
    process.exitCode = 1;
    return;
  }

  const companies = out.companies.map((company) => {
    const byDate = new Map(company.weeklyCloses.map((row) => [row.date, row.close]));
    const closes = weeks.map((date) => byDate.get(date));
    const { ...rest } = company;
    return { ...rest, closes, price: closes[closes.length - 1] };
  });

  const payload = {
    /** Date of the most recent weekly close in the file. */
    asOf: weeks[weeks.length - 1],
    fundamentalsSource: 'SEC EDGAR XBRL company facts (10-K filings)',
    pricesSource: process.env.ALPHAVANTAGE_KEY
      ? 'Alpha Vantage TIME_SERIES_WEEKLY_ADJUSTED'
      : 'Yahoo Finance chart endpoint (unofficial)',
    fetchedAt: new Date().toISOString().slice(0, 10),
    /** Shared weekly date axis, oldest first. */
    weeks,
    companies,
  };

  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(
    `\nWrote ${path.relative(process.cwd(), OUT)} — ${weeks.length} shared weeks, ${weeks[0]} to ${payload.asOf}`,
  );

  // A quick sanity read, so a broken write is obvious immediately.
  const written = JSON.parse(await readFile(OUT, 'utf8'));
  for (const company of written.companies) {
    const eps = company.netIncomeM / company.sharesM;
    const pe = eps > 0 ? (company.price / eps).toFixed(1) : 'none';
    console.error(
      `  ${company.ticker.padEnd(5)} FY${company.fiscalYear}  rev $${(company.revenueM / 1000).toFixed(1)}B ` +
        `(${(company.revenueGrowth * 100).toFixed(0)}%/yr)  net $${(company.netIncomeM / 1000).toFixed(1)}B ` +
        `(${(company.growth * 100).toFixed(0)}%/yr)  P/E ${pe}  $${company.price.toFixed(2)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
