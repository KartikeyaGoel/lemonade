/**
 * Do the documents still tell the truth about the build?
 *
 * PRODUCT.md §56 ends by arguing for exactly this: "a document that makes a
 * checkable claim about the build should have a test that fails when the claim
 * stops being true." Four defects across three sessions had the same shape — a
 * claim living in prose, contradicted by data, with nothing in between:
 *
 *   - FRAMEWORK.md §10 said Act 3 runs to 12 days. It runs to 6.
 *   - The framework's twelve concepts mapped to glossary ids only in prose.
 *   - §10 said the investor's slice is Act 3; the glossary said Act 4.
 *   - FRAMEWORK.md §12 called a two-register question a design divergence.
 *
 * None would ever fail a test suite, because nothing asserted the sentence.
 * This is the cheap half of the fix: every claim a document makes that is a
 * *number about the build* gets checked against the build.
 *
 * Deliberately narrow. It does not read prose, judge arguments or check
 * anything requiring taste. It matches specific numeric patterns and compares
 * them with the source of truth. A claim it cannot parse is a claim it says
 * nothing about — and it reports how many it checked, so silence from an empty
 * match is not mistaken for a pass.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** Count the top-level entries of an exported array literal. */
function countEntries(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`);
  if (start < 0) return null;
  const end = source.indexOf('\n];', start);
  if (end < 0) return null;
  return (source.slice(start, end).match(/^ {2}\{/gm) ?? []).length;
}

/* ---- the source of truth ---- */

const glossary = read('src/lib/glossary.ts');
const achievements = read('src/lib/achievements.ts');
const marketData = JSON.parse(read('src/lib/market-data.json'));

const truth = {
  words: countEntries(glossary, 'GLOSSARY'),
  badges: countEntries(achievements, 'BADGES'),
  companies: marketData.companies.length,
  stages: 5,
};

/*
 * How many `localStorage` slots this product writes.
 *
 * Counted by scanning the source for the key literals rather than by reading
 * `ALL_KEYS`, because the defect this exists for (PRODUCT.md §63) was a key
 * written by a module `ALL_KEYS` did not cover. Reading `ALL_KEYS` would agree
 * with itself and miss it again.
 *
 * PRIVACY.md is a page a teacher is invited to check, and it states this count
 * as a word — "Seven keys, and this is all of them" — which is the same trap
 * as a component with "Two days" written into it: nothing recomputes a word.
 */
const srcFiles = execSync("find src -name '*.ts' -o -name '*.tsx'", {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

truth.storageKeys = new Set(
  srcFiles.flatMap((file) => [...read(file).matchAll(/'(lemonade\.[a-z0-9.]+)'/g)].map((m) => m[1])),
).size;

/** The counts PRIVACY.md spells out in words, because English is how that page reads. */
const NUMBER_WORDS = {
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/*
 * The reading gate's own output, rather than a number typed in here — two
 * copies of the same figure is the defect this script exists to catch, and
 * writing one down would reintroduce it.
 */
const reading = execSync('node scripts/check-reading-level.mjs', {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});
truth.grade = Number(reading.match(/Average grade:\s+([\d.]+)/)?.[1]);
truth.longSentences = Number(reading.match(/Over 22 words:\s+(\d+)/)?.[1]);

/*
 * The suite size, counted statically from the test files.
 *
 * Deliberately not by running vitest. This gate is cheap and CI runs the suite
 * separately; shelling out to the whole test run from inside a documentation
 * linter would double the slowest step in the pipeline to check one number in
 * one sentence. Counting `it(` overcounts nothing and undercounts dynamically
 * generated cases, which is the safe direction for a floor claim.
 */
const testFiles = execSync("find tests -name '*.test.ts' -o -name '*.test.tsx'", {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

truth.tests = testFiles.reduce(
  (total, file) => total + (read(file).match(/^\s*it\(/gm) ?? []).length,
  0,
);

/* ---- the claims, as patterns ---- */

const DOCS = [
  'PRODUCT.md',
  'FRAMEWORK.md',
  'LEARNING.md',
  'PITCH.md',
  'TEACHING.md',
  'README.md',
  // The one document written to be audited by somebody outside the project.
  'PRIVACY.md',
];

/**
 * Each rule finds claims of one shape and says what the number should be.
 *
 * `historical: true` marks a pattern whose matches are allowed to be wrong
 * because they describe a past state on purpose — "expanded from 8 companies
 * to 24" is a true sentence about history. Those are counted and listed, never
 * failed, because a script cannot tell a record from a stale fact and pretending
 * otherwise would make this gate the thing that lies.
 */
const RULES = [
  { what: 'words', re: /\((\d+) words\)/g, expect: () => truth.words },
  { what: 'words', re: /(\d+)[- ]word glossary/g, expect: () => truth.words },
  { what: 'words', re: /glossary \((\d+) words\)/g, expect: () => truth.words },
  { what: 'badges', re: /\((\d+) badges/g, expect: () => truth.badges },
  { what: 'badges', re: /Trophy case \((\d+) badges/g, expect: () => truth.badges },
  /*
   * A floor, not an equality, and only for this one.
   *
   * The suite grows most sessions, so an exact count in a document is stale
   * the next time anybody writes a test — which would make this gate a
   * generator of busywork rather than of truth. "Over 1,100 tests" stays true
   * as the number climbs and false the moment somebody deletes a third of the
   * suite, which is the claim actually worth defending.
   */
  { what: 'tests (floor)', re: /over (\d[\d,]{2,}) tests/gi, expect: () => truth.tests, floor: true },
  { what: 'tests', re: /\*\*(\d[\d,]{2,}) tests\*\*/g, expect: () => truth.tests },
  { what: 'tests', re: /^- (\d[\d,]{2,}) tests\b/gm, expect: () => truth.tests },
  /*
   * A ceiling, not an equality, and for the same reason the test count is a
   * floor.
   *
   * The exact grade moves every time anybody writes a sentence of UI copy —
   * it went 4.7 -> 4.6 -> 4.7 across three commits in one session, and each
   * move failed this gate and got the document edited to match. That is the
   * "generator of busywork rather than of truth" its own comment warns about,
   * and worse: it trains whoever hits it to change the number without reading
   * the claim.
   *
   * What the product actually promises is a ceiling — the reading gate's own
   * target is grade 6 or below — so a document saying "under 5" is making a
   * claim that is both true and worth defending, and it fails the moment the
   * copy genuinely drifts towards being too hard for a nine-year-old.
   */
  { what: 'reading grade (ceiling)', re: /reading level under (\d+)/gi, expect: () => truth.grade, ceiling: true },
  { what: 'reading grade (ceiling)', re: /currently under \*\*(\d+)\*\*/g, expect: () => truth.grade, ceiling: true },
  /*
   * The two sentences in PRIVACY.md that count the storage slots. Spelled in
   * words, so `word: true` converts before comparing — see §63 for the seventh
   * key that made both of them false.
   */
  {
    what: 'storage keys',
    // `\s+` because the sentence wraps in the file: "Six keys, and\nthis is
    // all of them". A literal space matched nothing, and the rule sat there
    // looking like coverage while checking one sentence instead of two.
    re: /(\w+) keys, and\s+this is all of them/gi,
    expect: () => truth.storageKeys,
    word: true,
    only: ['PRIVACY.md'],
  },
  {
    what: 'storage keys',
    re: /removes all (\w+) keys/gi,
    expect: () => truth.storageKeys,
    word: true,
    only: ['PRIVACY.md'],
  },
];

/** Phrases that assert something the build contradicts outright. */
const FLAT_CLAIMS = [
  {
    phrase: 'nothing over 22 words',
    ok: () => truth.longSentences === 0,
    why: () => `${truth.longSentences} sentences are over 22 words`,
  },
  {
    phrase: 'Four acts, playable end to end',
    ok: () => truth.stages === 4,
    why: () => `the arc has ${truth.stages} stages`,
  },
];

/* ---- check ---- */

const problems = [];
let checked = 0;

for (const doc of DOCS) {
  let text;
  try {
    text = read(doc);
  } catch {
    continue;
  }

  const lineOf = (index) => text.slice(0, index).split('\n').length;

  for (const rule of RULES) {
    /*
     * `only` scopes a rule to the document that makes the claim.
     *
     * Needed the moment this gate learned to count storage keys: PRODUCT.md
     * §63 *quotes* the sentence that was wrong — "Six keys, and this is all of
     * them" — as the record of a defect, and a gate that failed on a write-up
     * of a fixed bug would be teaching us to stop writing them up.
     *
     * Narrower than `historical: true`, which excuses every match of a pattern
     * everywhere. The promise here is made by exactly one page, so that is the
     * page it is checked on.
     */
    if (rule.only && !rule.only.includes(doc)) continue;

    for (const match of text.matchAll(rule.re)) {
      const claimed = rule.word
        ? NUMBER_WORDS[match[1].toLowerCase()]
        : Number(match[1].replace(/,/g, ''));
      if (claimed === undefined) continue;
      const actual = rule.expect();
      if (actual === undefined || actual === null || Number.isNaN(actual)) continue;
      checked++;
      const wrong = rule.floor
        ? actual < claimed
        : rule.ceiling
          ? actual >= claimed
          : claimed !== actual;
      if (wrong) {
        problems.push(
          `${doc}:${lineOf(match.index)} claims ${rule.what} ` +
            `${rule.floor ? '>=' : rule.ceiling ? '<' : '='} ${claimed}, build says ${actual}`,
        );
      }
    }
  }

  for (const flat of FLAT_CLAIMS) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(flat.phrase, from);
      if (at < 0) break;
      checked++;
      if (!flat.ok()) {
        problems.push(`${doc}:${lineOf(at)} says "${flat.phrase}", but ${flat.why()}`);
      }
      from = at + flat.phrase.length;
    }
  }
}

console.log(
  `doc claims — ${checked} checked across ${DOCS.length} documents ` +
    `(${truth.words} words, ${truth.badges} badges, ${truth.companies} companies, ` +
    `${truth.storageKeys} storage keys, ` +
    `grade ${truth.grade}${truth.tests ? `, ${truth.tests} tests` : ''})`,
);

if (checked === 0) {
  console.error('\nNo claims matched at all, which means this gate is checking nothing.');
  process.exit(1);
}

if (problems.length > 0) {
  console.error('\nStale claims:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nEach is a sentence in a document that the build no longer supports.\n' +
      'Fix the document, or fix the build — but they cannot disagree.',
  );
  process.exit(1);
}

console.log('\nOK');
