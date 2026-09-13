/**
 * Refuses to let a second implementation of "play a day" exist.
 *
 * ## The defect class this closes
 *
 * Every redesign of this game has been followed by a fortnight of bugs found
 * by opening a screen rather than by a test going red. That has a single cause
 * and it is not carelessness about any one feature: **a day advanced the game
 * in more than one place.**
 *
 * At the point this script was written there were four.
 *
 *  1. `page.tsx`'s `settleDay` — the words and three counters.
 *  2. `page.tsx`'s `closeDay` — the stand, the competitor, the day count.
 *  3. `page.tsx`'s `settledGame` memo — a partial for the badge pass.
 *  4. `demo.ts`'s `playDay` — the copy `tests/arc.test.ts` walks to prove the
 *     game is finishable.
 *
 * Copy 4 was missing `advanceRival`. So every measurement ever taken of Stage
 * 2 was taken with the competitor switched off — including the proof that the
 * stage can be completed, and including the one in `tests/wordbudget.test.ts`
 * that set `ACT2_DAYS`. With the rival restored, the policy the arc test walked
 * finishes the stage 3 times in 10 rather than 9, and ends $56 down. The suite
 * was green throughout, because the suite was measuring a different game.
 *
 * PRODUCT.md §62 already says *a fact with more than one home disagrees with
 * itself*. That had only ever been applied to figures on screens. This applies
 * it to behaviour.
 *
 * ## What it actually enforces
 *
 * Each primitive below advances some part of the game by exactly one day.
 * Calling one is therefore a claim to be advancing a day, and there is one
 * place allowed to make that claim: `src/lib/day.ts`.
 *
 * Tests are exempt, deliberately. A unit test for `updateHandsOff` has to call
 * `updateHandsOff`, and pinning a primitive's own behaviour is the opposite of
 * duplicating the day loop. What tests must not do is *assemble* a day, and
 * that is caught by the far cheaper fact that a test which assembles one wrong
 * disagrees with the app — which is the failure mode this whole script exists
 * to make impossible for production code.
 *
 * If you are adding a new per-day effect: put it in `settleDay`, add its
 * primitive to the list below, and every caller gets it for free. If you are
 * here because this script is failing, the fix is almost never to add an
 * exemption.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The one module allowed to advance a day. */
const HOME = path.normalize('src/lib/day.ts');

/**
 * Functions that move the game on by a day.
 *
 * Each is listed with the thing it advances, so a reader can tell whether
 * something they are adding belongs here.
 */
const PRIMITIVES = [
  ['advanceRival', 'the competitor across the road'],
  ['updateHandsOff', 'the manager-run streak'],
  ['updateTwoStandDays', 'the two-stand streak'],
  ['updateShopDays', "the shop's run of good days"],
  ['repayLoan', 'a day off the loan'],
  ['recordInvestorCut', "the investor's share of the day"],
  ['deriveInsights', 'the words Stage 1 earns'],
  ['deriveAct2Insights', 'the words the stands stage earns'],
  ['deriveAct3Insights', 'the words the shop stage earns'],
  ['recurringRevenueInsight', 'the word the round earns'],
];

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}
walk('src');

/**
 * Strips comments and string literals.
 *
 * Without this the script fails on its own explanation: `day.ts` and
 * `diagnose.ts` both discuss `advanceRival` in prose, and a gate that cannot
 * be written about is a gate nobody will document.
 */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const offences = [];
for (const file of files) {
  if (path.normalize(file) === HOME) continue;
  const text = code(fs.readFileSync(file, 'utf8'));
  const lines = text.split('\n');
  for (const [name, advances] of PRIMITIVES) {
    /* A call, not a mention: the name followed by an open bracket. */
    const call = new RegExp(`\\b${name}\\s*\\(`);
    lines.forEach((line, i) => {
      if (!call.test(line)) return;
      /* Its own definition is not a call. */
      if (new RegExp(`export\\s+function\\s+${name}\\s*\\(`).test(line)) return;
      offences.push({ file, line: i + 1, name, advances });
    });
  }
}

if (offences.length > 0) {
  console.error(
    `\n${offences.length} day-advance call${offences.length === 1 ? '' : 's'} outside src/lib/day.ts\n`,
  );
  for (const o of offences) {
    console.error(`  ${o.file}:${o.line}  ${o.name}() — advances ${o.advances}`);
  }
  console.error(
    [
      '',
      'A day advances the game in exactly one place: settleDay in src/lib/day.ts.',
      'Every caller — the app, the demo harness, the tests — goes through it, so a',
      'new per-day effect cannot be added to one path and forgotten on another.',
      '',
      'That is not a style rule. advanceRival was in the app and not in the harness,',
      'and the result was that tests/arc.test.ts proved the game finishable with the',
      'competitor switched off, and ACT2_DAYS was set from a measurement of a game',
      'nobody plays. See the header of this file and PRODUCT.md §75.',
      '',
      'Move the effect into settleDay and call that instead.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(
  `one day, one place — ${PRIMITIVES.length} day-advance primitives, all called only from src/lib/day.ts`,
);
