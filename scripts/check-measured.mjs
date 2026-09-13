#!/usr/bin/env node
/**
 * Does every number that costs a child time have a run behind it?
 *
 * ## The bug class this closes
 *
 * PRODUCT.md §76 names it: **a number that is right everywhere in the code and
 * wrong in the world.** `ACT2_DAYS = 16` was referenced by nine test files,
 * printed consistently on every screen, and set from a measurement taken in a
 * game with the competitor switched off. Nothing was inconsistent. A child put
 * the game down.
 *
 * `MARKET_WEEKS = 12` was the same shape, agreed with by six test files and
 * measured by none, in the stage the pilot reached next.
 *
 * A unit test that references a constant is not a measurement. It asserts that
 * the code agrees with the number, which is exactly what was already true when
 * sixteen days was wrong. What catches this is a test that **plays the thing
 * and reports how long it took** — and the only way to keep those from rotting
 * is to make a pace constant without one fail the build.
 *
 * ## How it works
 *
 * An allowlist, like `check-one-day.mjs`, because a gate that fails on the
 * known-bad closes one bug and a gate that fails on the *unclassified* closes a
 * class (CLAUDE.md §3).
 *
 *  1. Find every exported numeric constant whose name says it is about elapsed
 *     time or repetition — days, weeks, tries, hits, rounds, "required",
 *     "every" — plus an explicit list of paces whose names do not say so.
 *  2. Every one of them must appear in the registry below, classified either as
 *     a **pace** (it decides how long a child spends) or with a written reason
 *     it is not one.
 *  3. Every pace must be named in at least one measurement file — a test that
 *     plays the game and reports a duration, not one that asserts a constant
 *     equals itself.
 *
 * ## What it misses, stated because a gate that cannot say is not one
 *
 * A constant that costs a child days and is named something like `SLICE` or
 * `LIMIT` is not discovered, so it is never asked for. The explicit list below
 * is the patch for that and it needs a human to notice. The narrower risk is
 * covered: anything named after time has to be classified, and a new one always
 * fails first.
 *
 * It also cannot tell a good measurement from a lazy one. It checks that the
 * constant is *named* in a file whose job is measuring; whether the measurement
 * is honest is the reviewer's problem, which is why each one is written with its
 * figures in the comment.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');

/**
 * Tests that play the game and report what happened.
 *
 * Deliberately short. Adding a file here is a claim that it *measures* rather
 * than asserts, and the whole gate is worth nothing if a unit test can be
 * parked on the list to satisfy it.
 */
const MEASUREMENT_FILES = [
  'tests/arclength.test.ts',
  'tests/endless.test.ts',
  'tests/wordbudget.test.ts',
  'tests/readiness.test.ts',
  'tests/pacing.test.ts',
];

/** Names that mean "this is about elapsed time or repetition". */
const LOOKS_LIKE_A_PACE = /DAY|WEEK|TRIES|HITS|EVERY|REQUIRED|TIMES|ENOUGH|ROUND/;

/**
 * Paces the name test cannot see.
 *
 * `WORD_BACKLOG` is how many earned words may sit unspoken, which is a ration
 * measured in days by every screen that reads it.
 */
const ALSO_A_PACE = ['day.ts:WORD_BACKLOG'];

/**
 * Every candidate, classified.
 *
 * `true` means it is a pace and must be measured. A string means it is not one,
 * and the string is the reason — written down rather than implied, because the
 * next person to read this needs to know it was considered.
 */
const CLASSIFIED = {
  /* ---- paces: how long a child spends, or how many times they must do it ---- */
  'business.ts:ACT2_DAYS': true,
  'business.ts:HANDS_OFF_DAYS_REQUIRED': true,
  'retail.ts:SHOP_DAYS_REQUIRED': true,
  'simulation.ts:TOTAL_DAYS': true,
  'simulation.ts:ACT1_TARGET_HITS': true,
  'simulation.ts:ACT1_EXPLORE_DAYS': true,
  'day.ts:WEEKLY_EVERY': true,
  'day.ts:WORDS_PER_DAY': true,
  'day.ts:WORD_BACKLOG': true,
  'market.ts:MARKET_WEEKS': true,
  'challenge.ts:CHALLENGE_DAYS': true,

  /* ---- not paces, with the reason ---- */
  'bench.ts:MAX_TRIES':
    'how many goes at one bench puzzle, which ends when the child gets it or gives up — it bounds a screen, not the game',
  'business.ts:TWO_STAND_DAYS_REQUIRED':
    'profitable days with two stands, read only by the `chain-of-two` badge. It gated the act before the shop was merged into it and now gates nothing, which is what this gate found',
  'business.ts:RIVAL_APPEARS_ON_DAY':
    'when the competitor turns up inside a stage whose length is set elsewhere; it changes what a day is like, not how many there are',
  'business.ts:RIVAL_FOLLOWS_AFTER_PARK_DAYS':
    'the same, one rung later — the rival moving pitch is an event in the stage, not a gate on leaving it',
  'classroom.ts:ENOUGH_FOR_A_CURVE':
    'how many points a demand curve needs before it is worth drawing; a property of the maths, not of the calendar',
  'companies.ts:PRICES_STALE_AFTER_DAYS':
    'how old the bundled prices may be before the app says so — about our pipeline, not about the child. Measured in tests/live.test.ts against the gate that shares it',
  'credits.ts:HELD_A_WHILE_WEEKS':
    'how long a holding must be left alone to earn the patience credit; a reward threshold, and it never blocks anything',
  'guide.ts:LEDGER_OPEN_DAYS':
    'when Pip mentions the ledger. A beat, skippable, and it gates nothing',
  'guide.ts:STALL_DAY':
    'the day Pip offers help to a child who has stopped getting anywhere; it adds a line, never a day',
  'ledger.ts:DAY_CAP':
    'the most credits one day can pay. Money, not time',
  'listing.ts:PUBLIC_PREMIUM_WEEKS':
    'how long a flotation premium lasts in the share price; an economic decay, and the stage ends on a marked week either way',
  'midday.ts:MIDDAY_STEP_CENTS':
    'the size of a price step at lunchtime. Cents',
  'notify.ts:MAX_A_DAY':
    'the most we ever say to a child in a day. A cap on our chattiness',
  'ownership.ts:EQUITY_OFFER_WEEKS':
    'how long an investor leaves an offer on the table; pressure inside a decision, not a gate on reaching it',
  'ownership.ts:HOLD_WEEKS':
    'the lock-up on a sale, which is a fact about the deal a child is reading rather than time they have to spend',
  'progress.ts:STEADY_ENOUGH_CENTS':
    'how still a price counts as steady. Cents',
  'progress.ts:WEEKEND_FLOAT':
    'the working capital a weekend takes out of the account. Dollars',
  'simulation.ts:LEMON_SHELF_LIFE_DAYS':
    'how long a lemon lasts, which is the spoilage lesson; it costs money rather than days',
};

/* ---- discover ---- */

const DECLARED =
  /(?:export const |^ {2})([A-Z][A-Z0-9_]*)\s*(?::\s*number)?\s*[:=]\s*(-?[\d_.]+(?:\s*\/\s*\d+)?)\s*[,;]/gm;

const found = new Map();
for (const file of readdirSync(new URL('src/lib', root)).filter((f) => f.endsWith('.ts'))) {
  const source = read(`src/lib/${file}`);
  for (const match of source.matchAll(DECLARED)) {
    const key = `${file}:${match[1]}`;
    if (LOOKS_LIKE_A_PACE.test(match[1]) || ALSO_A_PACE.includes(key)) {
      found.set(key, match[2]);
    }
  }
}

const measurements = Object.fromEntries(
  MEASUREMENT_FILES.map((file) => [file, read(file)]),
);

/* ---- check ---- */

const problems = [];
let paces = 0;

for (const [key, value] of [...found].sort()) {
  const verdict = CLASSIFIED[key];
  if (verdict === undefined) {
    problems.push(
      `${key} = ${value} is not classified. It looks like it decides how long a child spends. ` +
        `Add it to CLASSIFIED in ${path.basename(new URL(import.meta.url).pathname)}: \`true\` if ` +
        `it is a pace and it needs a measurement, or a sentence saying why it is not one.`,
    );
    continue;
  }
  if (verdict !== true) continue;

  paces += 1;
  const name = key.split(':')[1];
  const measured = MEASUREMENT_FILES.filter((file) =>
    new RegExp(`\\b${name}\\b`).test(measurements[file]),
  );
  if (measured.length === 0) {
    problems.push(
      `${key} = ${value} decides how long a child spends and no measurement names it. ` +
        `A unit test is not enough — ACT2_DAYS = 16 had nine of them. Play it in one of: ` +
        `${MEASUREMENT_FILES.join(', ')}.`,
    );
  }
}

for (const key of Object.keys(CLASSIFIED)) {
  if (!found.has(key)) {
    problems.push(`${key} is classified but no longer exists. Remove it, so the list stays readable.`);
  }
}

const notPaces = [...found].filter(([key]) => CLASSIFIED[key] !== undefined && CLASSIFIED[key] !== true).length;
console.log(
  `measured paces — ${found.size} time-shaped constants found: ${paces} pace the game and are ` +
    `measured by a run, ${notPaces} classified as something else with a reason`,
);

if (problems.length > 0) {
  console.error('\nProblems:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('\nOK   (every number that costs a child time has a run behind it)');
}
