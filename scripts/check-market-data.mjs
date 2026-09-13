#!/usr/bin/env node
/**
 * Says what is in the bundled data, and fails if it is stale or malformed.
 *
 * Worth having as its own command because "the numbers are always real" is the
 * product's load-bearing claim, and the failure mode is silent: a build with a
 * six-month-old file looks identical to a build with a fresh one.
 */
import { readFile } from 'node:fs/promises';
import { describeSuspectSplit, suspectSplits } from './market-rules.mjs';

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
const MAX_AGE_DAYS = Number(process.env.MAX_DATA_AGE_DAYS ?? declared[1]);

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
const MAX_FUNDAMENTALS_AGE_DAYS = Number(process.env.MAX_FUNDAMENTALS_AGE_DAYS ?? 100);

const data = JSON.parse(await readFile(new URL('../src/lib/market-data.json', import.meta.url), 'utf8'));

const problems = [];
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

if (problems.length > 0) {
  console.error('\nProblems:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('\nOK.');
}
