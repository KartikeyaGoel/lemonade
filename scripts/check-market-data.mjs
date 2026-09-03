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

const MAX_AGE_DAYS = Number(process.env.MAX_DATA_AGE_DAYS ?? 14);

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
  problems.push(`data is ${ageDays} days old (limit ${MAX_AGE_DAYS}); run \`npm run data\``);
}

if (problems.length > 0) {
  console.error('\nProblems:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('\nOK.');
}
