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
 * Nouns a child would hear read out. Not an exhaustive English list — the ones
 * this product actually counts.
 */
const NOUNS =
  'days|weeks|cups|lemons|stands|people|badges|words|proposals|shares|members|customers|times|packs';

/**
 * Counts that are constants and can never be one.
 *
 * `CUPS_PER_LEMON` is 4 and `SUGAR_SERVINGS_PER_PACK` is 10, so "4 cups each"
 * is correct and rewriting it through the helper would only add noise. Listed
 * explicitly rather than pattern-matched, so that changing one of them to 1
 * fails this test instead of quietly shipping "1 cups each".
 */
const NEVER_ONE = [
  'ECON.CUPS_PER_LEMON',
  'ECON.SUGAR_SERVINGS_PER_PACK',
  'ECON.TOTAL_DAYS',
  'MARKET_WEEKS',
  'HOLD_WEEKS',
  'LOAN.days',
  'SHOP.capacity',
  'HANDS_OFF_DAYS_REQUIRED',
  'GROWING_MULTIPLE',
  'GLOSSARY.length',
  'MAX_MEMBERS',
];

/**
 * Ways a line can already be right without calling `plural`.
 *
 * `=== 1 ?` is the hand-written version, which a few sites had before the
 * helper existed and which reads better where the two branches differ by more
 * than an "s" — "a stand" against "3 stands". `.toFixed(1)` can never produce
 * a bare "1": it produces "1.0", and "1.0 times weekly profit" is correct.
 */
const ALREADY_AGREES = [/=== 1 \?/, /\.toFixed\(1\)\}\s/];

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
    /*
     * Matches a closing brace followed by a counted noun — which is what both
     * `{n} cups` in JSX and `${n} cups` in a template literal look like by the
     * time they reach the file.
     *
     * `(?!\s*=)` excludes the noun being a **JSX attribute name** rather than
     * prose. `<GradePicker grade={grade} lemons={n} />` closes a brace and is
     * followed by the word "lemons", and no child will ever read it. Prose
     * never contains `lemons=`, so the exclusion cannot hide a real offender —
     * and without it the only way to pass this gate is to avoid naming a prop
     * after the thing it counts.
     */
    const pattern = new RegExp(`\\}\\s+(${NOUNS})\\b(?!\\s*=)`, 'g');
    const offenders: string[] = [];

    for (const file of sourceFiles('src')) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!pattern.test(line)) return;
        pattern.lastIndex = 0;
        if (NEVER_ONE.some((constant) => line.includes(constant))) return;
        if (ALREADY_AGREES.some((allowed) => allowed.test(line))) return;
        offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }

    expect(
      offenders,
      `these print a bare plural after a count — use plural() from ui.tsx:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
