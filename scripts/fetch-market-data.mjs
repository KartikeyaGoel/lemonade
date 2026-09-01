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
    model: 'brand',
  },
  {
    ticker: 'COST',
    cik: '0000909832',
    name: 'Costco',
    emoji: '🛒',
    whatTheySell: 'Bulk groceries, memberships',
    story: 'Sells enormous amounts and keeps a sliver of each sale on purpose.',
    model: 'membership',
  },
  {
    ticker: 'CMG',
    cik: '0001058090',
    name: 'Chipotle',
    emoji: '🌯',
    whatTheySell: 'Burritos',
    story: 'Opens hundreds of new restaurants a year. Each one is a new stand.',
    model: 'many-copies',
  },
  {
    ticker: 'NKE',
    cik: '0000320187',
    name: 'Nike',
    emoji: '👟',
    whatTheySell: 'Trainers and kit',
    story: 'Everyone knows the brand, but people have been buying fewer pairs.',
    model: 'brand',
  },
  {
    ticker: 'KO',
    cik: '0000021344',
    name: 'Coca-Cola',
    emoji: '🥤',
    whatTheySell: 'Fizzy drinks, everywhere',
    story: 'Grows slowly and very reliably. Has sold the same thing for a century.',
    model: 'brand',
  },
  {
    ticker: 'RBLX',
    cik: '0001315098',
    name: 'Roblox',
    emoji: '🎮',
    whatTheySell: 'A platform for making games',
    story: 'Growing fast and loved by millions. Still spends more than it takes in.',
    model: 'platform',
  },
  {
    ticker: 'NFLX',
    cik: '0001065280',
    name: 'Netflix',
    emoji: '🎬',
    whatTheySell: 'Subscriptions to shows',
    story: 'Millions pay every month without thinking about it.',
    model: 'subscription',
  },
  {
    ticker: 'DIS',
    cik: '0001744489',
    name: 'Disney',
    emoji: '🏰',
    whatTheySell: 'Films, parks, merchandise',
    story: 'Sells a huge amount and keeps a small slice. The parks cost a fortune to run.',
    model: 'many-copies',
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
 * Pulls annual values for the first of `tags` the company actually files under.
 *
 * Two things here were learned the hard way, and both silently produced wrong
 * numbers rather than errors:
 *
 *  1. **Tag choice is not cosmetic.** Coca-Cola files no `NetIncomeLoss` at
 *     all, so assuming one tag per concept simply lost a company.
 *  2. **The SEC's `CY####` frames cannot be trusted as a filter.** They stop
 *     being assigned for some filers — Chipotle has none after CY2020 — so
 *     taking the latest framed row gave a five-year-old figure and reported it
 *     as this year's. Chipotle's net income came out as $0.4B against a true
 *     $1.54B, which then showed a P/E of 143 instead of 40.
 *
 * So annual periods are identified by the only thing that is actually
 * definitional: a reported duration of roughly a year.
 */
function annualSeries(facts, tags) {
  const gaap = facts.facts?.['us-gaap'] ?? {};
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
    const byEnd = new Map();
    for (const row of annual) {
      const existing = byEnd.get(row.end);
      if (!existing || (row.filed ?? '9999') < (existing.filed ?? '9999')) byEnd.set(row.end, row);
    }
    const sorted = [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
    return { tag, rows: sorted, byEnd };
  }
  return null;
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
function cagr(rows, years = 3) {
  if (rows.length < 2) return null;
  const span = Math.min(years, rows.length - 1);
  const last = rows[rows.length - 1].val;
  const first = rows[rows.length - 1 - span].val;
  if (!(first > 0) || !(last > 0)) {
    // One or both ends are a loss. The plain change against the magnitude of
    // the earlier figure at least keeps the sign meaningful.
    if (!first) return null;
    return Number(((last - first) / Math.abs(first) / span).toFixed(4));
  }
  return Number(((last / first) ** (1 / span) - 1).toFixed(4));
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
    const shares = annualSeries(facts, SHARE_TAGS);

    if (!revenue || !netIncome || !shares) {
      problems.push(`${company.ticker}: missing ${[!revenue && 'revenue', !netIncome && 'net income', !shares && 'shares'].filter(Boolean).join(', ')}`);
      process.stderr.write('FUNDAMENTALS FAILED\n');
      continue;
    }

    let closes;
    try {
      closes = await weeklyCloses(company.ticker);
    } catch (error) {
      problems.push(`${company.ticker}: ${error.message}`);
      process.stderr.write('PRICES FAILED\n');
      continue;
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

    const annuals = sharedEnds.map((end, index) => {
      const upTo = sharedEnds.slice(0, index + 1);
      const rowsUpTo = (series) => upTo.map((e) => series.byEnd.get(e));
      return {
        fiscalYear: end.slice(0, 4),
        fiscalYearEnd: end,
        filedOn: revenue.byEnd.get(end).filed,
        revenueM: Math.round(revenue.byEnd.get(end).val / 1_000_000),
        netIncomeM: Math.round(netIncome.byEnd.get(end).val / 1_000_000),
        sharesM: Math.round(shares.byEnd.get(end).val / 1_000_000),
        growth: cagr(rowsUpTo(netIncome)) ?? 0,
        revenueGrowth: cagr(rowsUpTo(revenue)) ?? 0,
      };
    });

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
      sharesM: Math.round(latestShares.val / 1_000_000),
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
    const { weeklyCloses, ...rest } = company;
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
