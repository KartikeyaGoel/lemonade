/**
 * "1 cups left to sell"
 *
 * A browser sweep read "1 days left" off the goal strip on the last day of the
 * week. Fixing that line would have been the wrong size of fix: a grep found
 * twenty more of the same shape, and most were reachable rather than
 * theoretical — one cup left is on screen near the end of almost every day,
 * one lemon spoils constantly, one person gets turned away whenever the batch
 * is one short.
 *
 * It is a small defect with a specific cost. This product is read aloud by
 * people who are learning to read, and every screen is an argument that its
 * numbers can be trusted. A child sounding out "one cups" has been given a
 * tiny reason to doubt the sentence.
 *
 * So rather than twenty fixes, one helper and this file: the count and its
 * noun are not allowed to disagree anywhere in `src`. Written as a scan
 * because the alternative is rendering every screen in every state that
 * happens to have exactly one of something, which is most states.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { plural } from '../src/components/ui';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Every word that can follow a closing brace, classified.
 *
 * This was a **blocklist** of fourteen counted nouns, and a blocklist only
 * knows the mistakes somebody already made. `companies` was not on it, so the
 * last screen of the whole arc shipped
 *
 *     Put $4760.14 into 1 real companies.
 *
 * found by playing the market stage to the end with a single holding. §87, and
 * CLAUDE.md §3: *a gate that fails on the known-bad closes one bug; a gate
 * that fails on the unclassified closes a class.*
 *
 * So it is an allowlist now. Every distinct word appearing after a `}` in
 * `src` must be in one of the two sets below, and a word in neither **fails
 * the build** until somebody decides which it is. Closing the list the first
 * time found six more live instances the blocklist had never looked at:
 * `years` (a price-to-earnings ratio of 1 is real — Chipotle had one after its
 * 50:1 split), `companies` twice more, `reasons`, `results`, and `things`.
 */

/** Words that are a noun being counted. These must go through `plural()`. */
const COUNTED = [
  'days', 'weeks', 'wks', 'cups', 'lemons', 'packs', 'stands', 'people',
  'badges', 'words', 'proposals', 'shares', 'pieces', 'members', 'customers',
  'friends', 'times', 'years', 'seasons', 'companies', 'credits', 'notes',
  'reasons', 'results', 'things', 'steps',
];

/**
 * Words that follow a `}` and are not a count of anything, with the reason.
 *
 * Mostly verbs: `${company.name} keeps 27c` is a sentence about one company,
 * and the brace before it holds a name rather than a number. Listed
 * individually because "it ends in s" cannot tell a verb from a plural, and
 * guessing is what a blocklist did.
 */
const NOT_A_COUNT: Record<string, string> = {
  is: 'verb — "${x} is …"',
  as: 'preposition, or a JSX `as` prop',
  was: 'verb',
  has: 'verb',
  does: 'verb',
  keeps: 'verb — what a company keeps of every dollar',
  takes: 'verb',
  grows: 'verb',
  sells: 'verb',
  makes: 'verb',
  earns: 'verb',
  wants: 'verb',
  comes: 'verb',
  opens: 'verb',
  costs: 'verb — "${company} costs 37 years of profit"',
  vs: 'the word between two things being compared',
  across: 'preposition',
  this: 'determiner',
  its: 'possessive',
  yes: '"would say yes" — the answer, not a count of them',
  savings: 'a mass noun — money moved *to savings*, never "3 savings"',
  sales: 'a mass noun — "$416M of sales", never "3 sales"',
  buys: 'verb — "5 more buys $5 to invest"',
  gets: 'verb',
  less: 'comparative — "earned less than the year before"',
  regulars: 'the people a count of *cups* went to, not the count itself',
  profits: 'a mass noun — "bought out of profits"',
};

/**
 * Words classified as counted, so the check below has something to be about.
 *
 * Kept as an assertion rather than a comment: a `COUNTED` list that quietly
 * emptied would make this whole file pass on nothing, which is the §8 trap.
 */
const COUNTED_MUST_NOT_SHRINK = 25;

/**
 * Counts that are constants and can never be one.
 *
 * `CUPS_PER_LEMON` is 4 and `HONEY_SERVINGS_PER_JAR` is 10, so "4 cups each"
 * is correct and rewriting it through the helper would only add noise. Listed
 * explicitly rather than pattern-matched, so that changing one of them to 1
 * fails this test instead of quietly shipping "1 cups each".
 */
const NEVER_ONE = [
  'ECON.CUPS_PER_LEMON',
  'ECON.HONEY_SERVINGS_PER_JAR',
  'ECON.TOTAL_DAYS',
  'MARKET_WEEKS',
  'HOLD_WEEKS',
  'LOAN.days',
  'SHOP.capacity',
  'HANDS_OFF_DAYS_REQUIRED',
  'GROWING_MULTIPLE',
  'GLOSSARY.length',
  'MAX_MEMBERS',
  /* A flotation always cuts the company into `SHARES = 1000` pieces, and the
     smallest slice anybody may float is a tenth of it, so neither the count
     nor the sold count can be one. */
  'listing.shares',
  'offer.shares',
  'plan.sharesSold',
  'ending.shares',
  /* Four readiness criteria, and a top-up step of five dollars. */
  'readiness.criteria.length',
  'TOPUP_STEP',
  'DIVERSIFIED_MIN_HOLDINGS',
  'CREDITS_PER_DOLLAR} credits is',
  'SHOP.staffCapacity',
  'HELPER_CAPACITY',
];

/**
 * Ways a line can already be right without calling `plural`.
 *
 * `=== 1 ?` is the hand-written version, which a few sites had before the
 * helper existed and which reads better where the two branches differ by more
 * than an "s" — "a stand" against "3 stands". `.toFixed(1)` can never produce
 * a bare "1": it produces "1.0", and "1.0 times weekly profit" is correct.
 */
const ALREADY_AGREES = [
  /=== 1 \?/,
  /\.toFixed\(1\)\}\s/,
  /> 1 \?/,
  /*
   * "Day 3 results" — the number counts *days*, and the results are the day's.
   * The only shape where the word after the brace is not what is being
   * counted, so it is matched rather than excused by word, and a second one
   * would have to be added here deliberately.
   */
  /Day \{[^}]+\} results/,
  /*
   * "Picked Bayview from the stands for sale" — the brace holds a *name*, and
   * the stands are the ones on offer rather than a count of anything.
   */
  /chosen\.name\} from the stands/,
];

describe('plural()', () => {
  it('agrees with its count', () => {
    expect(plural(1, 'cup')).toBe('1 cup');
    expect(plural(0, 'cup')).toBe('0 cups');
    expect(plural(2, 'cup')).toBe('2 cups');
  });

  it('takes an irregular plural', () => {
    expect(plural(1, 'person', 'people')).toBe('1 person');
    expect(plural(3, 'person', 'people')).toBe('3 people');
  });

  it('is not fooled by a number that only looks like one', () => {
    expect(plural(1.5, 'cup')).toBe('1.5 cups');
    expect(plural(-1, 'cup')).toBe('-1 cups');
  });
});

describe('no screen may disagree with its own count', () => {
  it('interpolates every counted noun through plural()', () => {
    /* Only a word that *looks* plural. Requiring every English word after an
       interpolation to be classified is noise — "of", "and", "each" follow one
       constantly and none of them can disagree with a number. A trailing `s`
       plus the irregulars this product actually counts is the whole signal,
       and it is what turned up `companies`. */
    /*
     * Up to two adjectives may sit between the count and the noun, and this is
     * not hypothetical: the defect that prompted the rewrite was
     * `${summary.holdingsCount} real companies`, where the word right after the
     * brace is "real". A pattern anchored on the first word missed it, which a
     * mutation test caught — restoring the defect passed the rebuilt gate.
     */
    const pattern = /\}\s+(?:[a-z][a-z-]*\s+){0,2}?([a-z][a-z-]*(?:s|people|children))\b(?!\s*=)/g;
    const offenders: string[] = [];
    const unclassified: string[] = [];

    for (const file of sourceFiles('src')) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        /* A named-import list closes a brace and is followed by `from`. Never
           prose, and skipped wholesale rather than by excusing the word, so
           that `from` in a sentence would still have to be classified. */
        if (/^\s*(?:import|export)\b/.test(line) || /\}\s+from\s+'/.test(line)) return;
        for (const match of line.matchAll(pattern)) {
          const word = match[1];
          if (word in NOT_A_COUNT) continue;
          if (!COUNTED.includes(word)) {
            /* The half that closes the class: a word nobody has judged. */
            unclassified.push(`${file}:${i + 1}  "${word}"  ${line.trim().slice(0, 70)}`);
            continue;
          }
          if (NEVER_ONE.some((constant) => line.includes(constant))) continue;
          if (ALREADY_AGREES.some((allowed) => allowed.test(line))) continue;
          offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }

    expect(COUNTED.length, 'the counted-noun list has shrunk').toBeGreaterThanOrEqual(
      COUNTED_MUST_NOT_SHRINK,
    );
    expect(
      unclassified,
      'a word after a count that nothing has classified. Add it to COUNTED if a ' +
        'child reads it as "N of them", or to NOT_A_COUNT with the reason it is ' +
        `not a count:\n${unclassified.join('\n')}`,
    ).toEqual([]);

    expect(
      offenders,
      `these print a bare plural after a count — use plural() from ui.tsx:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
