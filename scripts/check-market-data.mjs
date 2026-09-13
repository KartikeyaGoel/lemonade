#!/usr/bin/env node
/**
 * Says what is in the bundled data, and fails if it is stale or malformed.
 *
 * Worth having as its own command because "the numbers are always real" is the
 * product's load-bearing claim, and the failure mode is silent: a build with a
 * six-month-old file looks identical to a build with a fresh one.
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { describeSuspectSplit, suspectSplits } from './market-rules.mjs';
import { envOr, loadEnv } from './env.mjs';

loadEnv();

/**
 * How old the prices may be before this is a defect.
 *
 * Fourteen days. The live market marks holdings once a week, so a fortnight is
 * two marks that did not happen — at which point the part of the game that is
 * meant to never end has quietly ended.
 *
 * **Read out of `companies.ts` rather than typed here.** The app now shows the
 * same warning to the child (`pricesBehind`), so this limit is a fact with two
 * consumers — and a fact with two homes drifts, which is PRODUCT.md §62 and has
 * recurred five times. `market-rules.mjs` exists for the same reason: that rule
 * was written out twice and the two copies disagreed for months.
 *
 * A regex over source rather than an import because this is an `.mjs` script
 * and that is a `.ts` module. If the constant is ever renamed or removed this
 * throws rather than silently falling back to a default, which is the whole
 * lesson of the `?? data.fetchedAt` fallback that hid a bug in this very file.
 */
const companiesSource = await readFile(new URL('../src/lib/companies.ts', import.meta.url), 'utf8');
const declared = companiesSource.match(/export const PRICES_STALE_AFTER_DAYS = (\d+)/);
if (!declared) {
  console.error(
    'PRICES_STALE_AFTER_DAYS is not declared in src/lib/companies.ts. That constant is the one ' +
      'definition of how stale the prices may be, and both this gate and the live screen read it.',
  );
  process.exit(1);
}
/* `envOr`, not `??`: a blank line in a copied `.env.example` makes this
   `Number('')`, which is zero, and the gate then fails on data fetched today. */
const MAX_AGE_DAYS = Number(envOr('MAX_DATA_AGE_DAYS', declared[1]));

/**
 * And how old the *filings* may be.
 *
 * Much longer, because they come from a 10-K and change once a quarter. The two
 * are separate numbers because the two sources fail independently: SEC began
 * returning 403 to GitHub Actions' address ranges, `fetch-market-data.mjs` now
 * carries the previous fundamentals forward rather than writing nothing, and
 * the thing that must not go unnoticed is *how long it has been carrying them*.
 * One limit against both dates would have to be the loose one, and then a
 * fortnight of dead prices would pass.
 */
const MAX_FUNDAMENTALS_AGE_DAYS = Number(envOr('MAX_FUNDAMENTALS_AGE_DAYS', '100'));

const data = JSON.parse(await readFile(new URL('../src/lib/market-data.json', import.meta.url), 'utf8'));

const problems = [];

/**
 * How big the bundled data may be.
 *
 * It is a client bundle on a child's phone, and nothing else in this project
 * puts a number on that. Two and a half megabytes of JSON went out before
 * anybody noticed, because `fetch-market-data.mjs` carried the raw provider
 * series into the file alongside the aligned copy the app reads — every price,
 * twice. Invisible while both sources returned five years; obvious the moment
 * one of them returned twenty.
 *
 * One megabyte, against a measured 0.55 MB once the duplicate came out. A
 * ceiling rather than a figure, because the file grows when a company is added.
 */
const MAX_BYTES = 1_000_000;

const raw = await readFile(new URL('../src/lib/market-data.json', import.meta.url), 'utf8');
if (raw.length > MAX_BYTES) {
  problems.push(
    `market-data.json is ${(raw.length / 1e6).toFixed(2)} MB, over the ${(MAX_BYTES / 1e6).toFixed(1)} MB ceiling. ` +
      `It ships to a phone. Check nothing is being written twice — see the note on weeklyCloses ` +
      `in fetch-market-data.mjs.`,
  );
}

if (!Array.isArray(data.companies) || data.companies.length < 8) {
  problems.push(`expected 8 companies, found ${data.companies?.length ?? 0}`);
}
if (!Array.isArray(data.weeks) || data.weeks.length < 60) {
  problems.push(`expected at least 60 weeks of history, found ${data.weeks?.length ?? 0}`);
}
for (const company of data.companies ?? []) {
  if (company.closes?.length !== data.weeks?.length) {
    problems.push(`${company.ticker}: ${company.closes?.length} closes for ${data.weeks?.length} weeks`);
  }
  if (company.closes?.some((close) => !Number.isFinite(close) || close <= 0)) {
    problems.push(`${company.ticker}: a close is missing or not a price`);
  }
  if (!Number.isFinite(company.revenueM) || !Number.isFinite(company.sharesM) || company.sharesM <= 0) {
    problems.push(`${company.ticker}: fundamentals incomplete`);
  }
  /*
   * The raw provider series, named rather than only bounded by the size
   * ceiling — so the failure says what to do instead of just "too big".
   */
  if (company.weeklyCloses) {
    problems.push(
      `${company.ticker}: carries weeklyCloses, the raw provider series. Only \`closes\` is read ` +
        `by the app; writing both ships every price twice`,
    );
  }

  /*
   * A split that did not get applied to the share counts.
   *
   * The rule lives in `market-rules.mjs` because `tests/market.test.ts`
   * asserts the same thing, and when this was written out twice the two copies
   * disagreed — this one failed CI on six real flotations for as long as the
   * data has been in the file. See PRODUCT.md §55.
   */
  for (const suspect of suspectSplits(company)) {
    problems.push(describeSuspectSplit(suspect));
  }
}

const ageDays = Math.floor((Date.now() - Date.parse(data.fetchedAt)) / 86_400_000);

console.log(
  `market-data.json — ${data.companies?.length} companies, ${data.weeks?.length} weeks, ` +
    `prices to ${data.asOf}, fetched ${data.fetchedAt} (${ageDays} days ago)`,
);
console.log(`  fundamentals: ${data.fundamentalsSource}`);
console.log(`  prices:       ${data.pricesSource}`);

/*
 * Which companies the keyed source did not serve, reported and never failed on.
 *
 * Alpha Vantage's free tier is 25 requests a day and there are twenty-four
 * companies, so the scheduled run fits exactly once and any extra run that day
 * falls back per ticker. That is the design working, not a defect: the two
 * sources return the same adjusted weekly closes, measured at 261 aligned weeks
 * with a worst disagreement of 0.011%.
 *
 * So this is a provenance line, not a gate. Failing the build because a
 * provider rate-limited us today is the "cries wolf" failure mode that gets a
 * gate switched off — and the outcome that actually matters, the prices going
 * stale, is already gated above. What this protects against is nobody ever
 * finding out which source they are looking at.
 */
const fellBack = Array.isArray(data.pricesFellBack) ? data.pricesFellBack : null;
if (fellBack === null) {
  problems.push(
    'pricesFellBack is missing; the writer is not emitting it, so which companies the keyed ' +
      'price source actually served cannot be known',
  );
} else if (fellBack.length > 0) {
  console.log(
    `                — ${fellBack.length} of ${data.companies.length} came from the keyless ` +
      `fallback: ${fellBack.join(', ')}`,
  );
}

if (ageDays > MAX_AGE_DAYS) {
  problems.push(
    `prices are ${ageDays} days old (limit ${MAX_AGE_DAYS}); run \`npm run data\`, and check ` +
      `the refresh workflow — it failed silently for a fortnight once. See PRODUCT.md §79.`,
  );
}

/*
 * The filings, checked separately and reported even when they are fine.
 *
 * `fundamentalsCarried` names the companies whose numbers came out of the
 * previous file rather than from the SEC. An empty list is the good case; a
 * full list every day means the filings endpoint has been unreachable for as
 * long as `fundamentalsFetchedAt` says, and nobody has noticed.
 */
/*
 * Required, not defaulted.
 *
 * This read `data.fundamentalsFetchedAt ?? data.fetchedAt`, and the writer had
 * a bug that never emitted the field — so the check quietly measured the wrong
 * date and reported OK. A fallback that papers over a missing field is how a
 * gate stops being one.
 */
if (!data.fundamentalsFetchedAt || !Array.isArray(data.fundamentalsCarried)) {
  problems.push(
    'fundamentalsFetchedAt / fundamentalsCarried are missing; the writer is not emitting them, ' +
      'so how long the filings have been carried forward cannot be known',
  );
}
const carried = data.fundamentalsCarried ?? [];
const fundamentalsAt = data.fundamentalsFetchedAt ?? data.fetchedAt;
const fundamentalsAge = Math.floor((Date.now() - Date.parse(fundamentalsAt)) / 86_400_000);
console.log(
  `  filings:      fetched ${fundamentalsAt} (${fundamentalsAge} days ago)` +
    (carried.length > 0 ? `, carried for ${carried.length}: ${carried.join(', ')}` : ''),
);
if (fundamentalsAge > MAX_FUNDAMENTALS_AGE_DAYS) {
  problems.push(
    `filings are ${fundamentalsAge} days old (limit ${MAX_FUNDAMENTALS_AGE_DAYS}); the SEC fetch ` +
      `has been failing and the numbers are being carried forward`,
  );
}

/* ------------------------------------------------------------------ *
 * Did the *shape* of what arrived change?
 * ------------------------------------------------------------------ */

/**
 * The file against the last committed version of itself.
 *
 * Everything above checks that the data is well formed and recent. None of it
 * would notice the actual risk of an unofficial endpoint, which is not a 404 —
 * a 404 fails loudly and the script refuses to write. It is the endpoint
 * quietly starting to return **something else**: unadjusted closes instead of
 * adjusted, a different interval, the wrong ticker, prices in another currency.
 * Every one of those produces a file that passes every check in this script and
 * is wrong in the way the product cannot survive, because "the numbers are
 * always real" is the load-bearing claim.
 *
 * `pricesSource` still reads "Yahoo Finance chart endpoint (unofficial)"
 * because `ALPHAVANTAGE_KEY` is not set as a repository secret, and the fetch
 * script's own note says Yahoo "can change without notice, so it is a
 * convenience for local runs rather than something to depend on in a deploy".
 * It is what the deploy depends on. Setting the secret is the real fix and it
 * needs somebody with an account; this is what can be done without one.
 *
 * **The invariant is that history is not rewritten.** A weekly close from 2023
 * is a fact. Measured across the current file and its predecessor: 6,288 shared
 * rows, **zero** changed. The one legitimate exception is an adjustment — a
 * split or a dividend rescales every row before it by one constant factor — so
 * a handful of distinct ratios is allowed and a scatter of them is not.
 *
 * Deliberately tight enough to have no false positives and loose enough to
 * survive a real corporate action, because a gate that cries wolf on the weekly
 * cron is a gate somebody switches off. That is how the refresh came to fail in
 * silence for a fortnight in the first place.
 */
function previousCommitted() {
  try {
    const raw = execFileSync('git', ['show', 'HEAD:src/lib/market-data.json'], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const before = previousCommitted();
if (!before) {
  console.log('  shape:        no committed version to compare against (skipped)');
} else {
  if (before.asOf > data.asOf) {
    problems.push(`asOf went backwards: ${before.asOf} -> ${data.asOf}`);
  }
  /*
   * Proportional, not a fixed slack of two.
   *
   * The window is five years of weeks and the two providers reach back slightly
   * differently — 262 against 267 — so a fixed slack failed on a legitimate
   * source switch. A tenth still catches the thing this is for, which is a
   * collapse: 262 weeks becoming 24 is a broken fetch, and 262 becoming 257 is
   * a Tuesday.
   */
  if (data.weeks.length < before.weeks.length * 0.9) {
    problems.push(
      `the price history shrank from ${before.weeks.length} weeks to ${data.weeks.length}; ` +
        `the window rolls, it does not collapse`,
    );
  }

  /*
   * Compared by **week**, not by date.
   *
   * This keyed on the exact date string, and the first run on the official
   * feed walked straight through it: Alpha Vantage stamps the last trading day
   * of the week and Yahoo stamps the first, so switching source moved every
   * date by a few days and left **one** shared row out of 267. The gate
   * cheerfully reported "24 weeks shared with the last commit, 0 rewritten"
   * and passed — having checked almost nothing, on precisely the kind of
   * change it exists to notice.
   *
   * A week is the unit the data is in, so a week is the unit to compare in.
   * Both stamps collapse to the Monday of their week.
   */
  const mondayOf = (iso) => {
    const at = Date.parse(`${iso}T00:00:00Z`);
    if (Number.isNaN(at)) return iso;
    const day = new Date(at).getUTCDay();
    /* Sunday is 0, and belongs to the week that started six days earlier. */
    const back = day === 0 ? 6 : day - 1;
    return new Date(at - back * 86_400_000).toISOString().slice(0, 10);
  };

  const wasAt = new Map(before.weeks.map((date, index) => [mondayOf(date), index]));
  const wasClose = new Map(before.companies.map((company) => [company.ticker, company.closes]));
  for (const company of before.companies) {
    if (!data.companies.some((now) => now.ticker === company.ticker)) {
      problems.push(`${company.ticker} has gone from the file; the snapshot does not lose companies`);
    }
  }

  let shared = 0;
  let rewritten = 0;
  const ratios = new Map();
  for (const company of data.companies) {
    const was = wasClose.get(company.ticker);
    if (!was) continue;
    data.weeks.forEach((date, index) => {
      const then = wasAt.get(mondayOf(date));
      if (then === undefined) return;
      const a = was[then];
      const b = company.closes[index];
      if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return;
      shared += 1;
      /*
       * The newest row is the week in progress, so its close moves legitimately
       * every day until the week closes. Everything older is a settled fact.
       */
      if (index >= data.weeks.length - 1) return;
      const ratio = b / a;
      if (Math.abs(ratio - 1) <= 0.005) return;
      rewritten += 1;
      const key = ratio.toFixed(3);
      ratios.set(key, (ratios.get(key) ?? 0) + 1);
      if (ratio > 10 || ratio < 0.1) {
        problems.push(
          `${company.ticker} ${date}: ${a} became ${b}. A hundredfold move in a settled week is ` +
            `a different series, not a price change — check what the endpoint returned`,
        );
      }
    });
  }

  const spread = [...ratios.keys()].length;
  console.log(
    `  shape:        ${shared} weeks shared with the last commit, ${rewritten} rewritten` +
      (spread > 0 ? ` across ${spread} adjustment ratio${spread === 1 ? '' : 's'}` : ''),
  );
  if (rewritten > shared * 0.05 && spread > 3) {
    problems.push(
      `${rewritten} of ${shared} settled weekly closes changed, across ${spread} different ` +
        `ratios. A split or a dividend rescales a whole stretch by one factor; a scatter of ` +
        `ratios means the endpoint is returning a different series than it was. ` +
        `See PRODUCT.md §79.`,
    );
  }
}

if (problems.length > 0) {
  console.error('\nProblems:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('\nOK.');
}
