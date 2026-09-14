/**
 * Refuses to let a second implementation of "write a number as dollars" exist.
 *
 * ## The defect class this closes
 *
 * `src/lib/copy.ts` has carried an exported `money` for months, with a comment
 * saying it exists *because* there had been three of them and one had lost its
 * dollar sign (§62). It was imported by exactly one file. Everything else in
 * `src/lib` wrote `` `$${n.toFixed(2)}` `` by hand — nine private `money`
 * helpers plus about thirty loose interpolations.
 *
 * Six of the nine got the sign wrong, and the result was on screen on **day
 * one of a losing week**, which is the most likely first week a child has:
 *
 *     "$0.00 in, $5.00 out, so you kept $-5.00."
 *
 * A browser playthrough had already found this exact shape once, in
 * `listing.ts`'s `moveReason`, and it was fixed *there*: `money` was imported
 * into the file — and the file's other private copy, 428 lines further down,
 * was left shadowing it. The instance was closed and the class was not.
 *
 * ## What this would miss
 *
 * It reads source, not output, so it cannot catch a sentence that builds
 * "$" and the digits in two separate pieces. `tests/money.test.ts` renders
 * the corpus and looks for the rendered shape; this file stops the shape
 * being written in the first place, which is the cheaper of the two.
 *
 * ## The rule
 *
 * Inside a template string, a `$` immediately before an interpolation is only
 * allowed when the interpolated thing is a **bare constant** — an identifier
 * or a dotted path, no call, no arithmetic, no `.toFixed`. Those are the
 * whole-dollar figures (`$${SHOP.fitOut}`) that are never negative and want no
 * cents. Anything computed is a runtime number and must go through `money`,
 * `moneyRound` or `moneyFromCents`.
 *
 * Anything else has to be named below with a reason. A new one that is not
 * classified fails the build.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The one home. Everything here is the implementation itself. */
const HOME = 'src/lib/copy.ts';

/**
 * Computed interpolations that are deliberately not `money`, each with the
 * reason it is not. Keyed by file, matched against the trimmed source line.
 */
const CLASSIFIED = [
  {
    file: 'src/lib/companies.ts',
    match: (line) => /\$\{sign\}\$\$\{/.test(line),
    why: 'A market cap runs to trillions, so it is written in T/B/M units with its own precision ladder. It applies the same sign rule as `money` — the sign goes before the dollar — and `money` cannot express the units.',
  },
  {
    file: 'src/components/meta/ClassroomScreen.tsx',
    match: (line) => line.includes('`$${cents / 100}`'),
    why: 'Axis ticks, from the literal array [100, 200, 300, 400]. They are whole dollars by construction and are meant to read "$1 $2 $3 $4" rather than "$1.00".',
  },
];

/** A bare constant: an identifier or a dotted path, nothing computed. */
const BARE = /^\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\}/;

function sources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

const problems = [];
let checked = 0;
let bare = 0;
let classified = 0;

for (const file of sources('src')) {
  if (file === HOME) continue;
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    /* A private formatter: a second implementation, full stop. */
    /* A *function* by one of the familiar names. A variable called `cents`
       holding a number is not a formatter; a private formatter under a name
       nobody thought of is caught by the interpolation rule below, because
       its body is a computed figure written as dollars by hand. */
    if (
      /\bfunction\s+(?:money|moneyRound|moneyFromCents|dollars|cents)\s*\(/.test(line) ||
      /\bconst\s+(?:money|moneyRound|moneyFromCents|dollars|cents)\s*=\s*\([^)]*\)\s*(?::[^=]+)?=>/.test(line)
    ) {
      problems.push(
        `${file}:${index + 1}  a second implementation of money formatting\n` +
          `    ${line.trim()}\n` +
          `    Import { money, moneyRound, moneyFromCents } from '@/lib/copy' instead. There is one home for this and it is ${HOME}.`,
      );
    }

    for (const m of line.matchAll(/\$\$\{/g)) {
      checked++;
      const rest = line.slice(m.index + 1);
      const entry = CLASSIFIED.find((c) => c.file === file && c.match(line));
      if (entry) {
        classified++;
        continue;
      }
      if (BARE.test(rest)) {
        bare++;
        continue;
      }
      problems.push(
        `${file}:${index + 1}  a computed figure written as dollars by hand\n` +
          `    ${line.trim()}\n` +
          `    Use money() / moneyRound() / moneyFromCents() from '@/lib/copy', or classify it in CLASSIFIED with the reason it cannot.`,
      );
    }
  });
}

/* An allowlist entry nobody uses is an allowlist entry that has gone stale. */
for (const entry of CLASSIFIED) {
  const text = readFileSync(entry.file, 'utf8');
  if (!text.split('\n').some((line) => entry.match(line))) {
    problems.push(
      `${entry.file}  a CLASSIFIED entry that no longer matches anything. Delete it.\n    why: ${entry.why}`,
    );
  }
}

console.log(
  `money — ${checked} hand-written dollar signs outside ${HOME}: ` +
    `${bare} whole-dollar constants, ${classified} classified with a reason.`,
);

if (problems.length > 0) {
  console.error(`\n${problems.length} unclassified:\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}
