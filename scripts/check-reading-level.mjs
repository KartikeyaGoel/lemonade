#!/usr/bin/env node
/**
 * Is the writing actually readable by the child it is written for?
 *
 * Everything else in this project is verified — the accounts, the prices, the
 * backtests, the claim that a kid understands something. The words were not,
 * and words are the part a child hits first. A game pitched at eleven-year-olds
 * whose copy sits at a fifteen-year-old's reading level has locked out the
 * bottom half of its audience before anybody presses a button, and it will look
 * exactly like a game that "did not engage them".
 *
 * So this is a build check rather than a one-off audit.
 *
 * The measure is Flesch–Kincaid grade level, which is crude — it counts
 * syllables and sentence length and knows nothing about whether a word is
 * familiar — but crude in a useful direction here: it punishes long sentences
 * and long words, which are the two things that actually stop a kid reading.
 * The target is grade 6 or below for anything a child reads, because the
 * audience is 10–13 and a slow reader in that band is at about grade 4.
 *
 *   node scripts/check-reading-level.mjs          # summary, exits non-zero on failure
 *   node scripts/check-reading-level.mjs --worst  # the sentences to fix, worst first
 *
 * Deliberately excludes the parent and teacher views: those are written for
 * adults, and dumbing them down would make them less trustworthy, not more.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TARGET_GRADE = 6;
/** Past this a sentence has more clauses than a ten-year-old will hold. */
const TOO_LONG = 22;
const RAMBLE_ALLOWED = 0.03;
const HARD_SYLLABLES = 3;

/**
 * Long words a ten-year-old already has, or that the game teaches on purpose.
 *
 * Kept deliberately short. Anything not on it shows up in `--words`, which is a
 * list to read rather than a test to pass — no formula can tell "capacity",
 * which this game exists to teach, from "consequently", which slipped in.
 */
const FAMILIAR = new Set([
  'lemonade', 'company', 'companies', 'business', 'businesses', 'customer', 'customers',
  'money', 'everybody', 'everything', 'anything', 'nobody', 'somebody', 'yesterday',
  'tomorrow', 'another', 'together', 'family', 'expensive', 'remember', 'different',
  'investor', 'investors', 'investing', 'investment', 'revenue', 'capacity', 'profit',
  'dividend', 'diversify', 'portfolio', 'competition', 'valuation', 'compounding',
  'subscription', 'volatility', 'liability', 'elasticity',
]);

/**
 * Fields written for an adult, inside files a child otherwise reads.
 *
 * The glossary's grown-up gloss is the clearest case: every word card has a
 * kid line and then the sentence a parent would recognise. Holding the second
 * one to a ten-year-old's reading level would flatten exactly the thing that
 * makes the card worth showing an adult.
 */
const FOR_GROWN_UPS = /^grownUp/;

/** Adult audience on purpose. */
const NOT_FOR_KIDS = [
  'src/lib/parent.ts',
  'src/components/acts/ParentScreen.tsx',
  'src/lib/teacher.ts',
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/**
 * Pulls out the sentences a child actually reads.
 *
 * Two sources: quoted strings that look like prose, and text sitting directly
 * between JSX tags. Everything else in a component file — class names, ids,
 * imports — is filtered out by the "looks like prose" test rather than by
 * parsing, which keeps this short enough that people will actually run it.
 */
function copyFrom(source) {
  const found = [];

  // Comments first, or their prose gets scored as copy.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  /*
   * Quoted strings, never spanning a line: a string literal cannot, and letting
   * the match run across newlines swallows whole object literals.
   *
   * The property name in front of a string is captured so the adult-facing
   * fields can be dropped. `grownUpLine` in the glossary is the second half of
   * every word card and is written for a parent reading over a shoulder —
   * simplifying it would make the game worse, not more accessible.
   */
  for (const match of code.matchAll(
    /(?:(\w+)\s*:\s*)?(?:'((?:[^'\\\n]|\\.){12,})'|"((?:[^"\\\n]|\\.){12,})")/g,
  )) {
    if (match[1] && FOR_GROWN_UPS.test(match[1])) continue;
    found.push(match[2] ?? match[3]);
  }
  // Text sitting directly between JSX tags.
  for (const match of code.matchAll(/>\s*([A-Za-z][^<>{}\n]{12,})\s*</g)) {
    found.push(match[1]);
  }
  return found
    .map((text) =>
      text
        .replace(/\\'/g, "'")
        // JSX escapes an apostrophe as an entity, and `&apos;` scored as a
        // two-syllable word in the middle of every contraction.
        .replace(/&apos;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim(),
    )
    .filter(isProse);
}

/**
 * A token that is code rather than English.
 *
 * Written as a token test rather than a whole-string test because the failure
 * mode is one Tailwind class hiding in a sentence, and a whole-string heuristic
 * either lets that through or throws away real copy with a hyphen in it.
 */
const TAILWIND =
  /^(flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|uppercase|lowercase|capitalize|truncate|grayscale|italic|antialiased|tabular-nums|animate-\S+|(?:font|text|bg|border|rounded|shadow|ring|opacity|tracking|leading|whitespace|overflow|justify|items|self|col|row|gap|space|aspect|min|max|inset|top|bottom|left|right|[whzpm]|p[xytblr]|m[xytblr])-\S*)$/;

function isCode(token) {
  if (TAILWIND.test(token)) return true;
  // camelCase, snake_case, brackets, arrows, template holes, paths, urls.
  return /[a-z][A-Z]|[_$[\]{}<>|\\]|=>|::|https?:|@\/|\.\//.test(token);
}

/** A sentence a kid reads, as opposed to a class name or an object literal. */
function isProse(text) {
  if (!/\s/.test(text)) return false;
  if (!/[a-z]/.test(text)) return false;

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.some(isCode)) return false;
  // A trailing or leading comma is the signature of a fragment of a literal.
  if (/^[,;:]|[,;:]$/.test(text.trim())) return false;
  // `key: value` pairs, which read as sentences and are not.
  if (/^[a-z][a-zA-Z]*:\s/.test(text.trim())) return false;

  // Needs at least four real words, and at least one of them not capitalised —
  // a run of capitals is a label, not a sentence.
  const words = tokens.filter((w) => /^[a-zA-Z][a-zA-Z'’-]*$/.test(w));
  if (words.length < 4) return false;
  return words.some((w) => /^[a-z]/.test(w));
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+|—\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:es|ed|[^lst])e$/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * How hard one sentence is, as a grade level.
 *
 * Flesch–Kincaid below about eight words is nonsense: the formula's
 * words-per-sentence term assumes a sentence, and "Identical weather, different
 * decisions." scores grade 21 purely for being four long words with a full stop
 * after them. Running the first version of this check produced a top-ten list
 * made almost entirely of that artefact, which would have sent me off
 * rewriting perfectly readable headlines.
 *
 * So: Flesch–Kincaid where it is valid, and for anything shorter, the part of
 * the formula that still means something — the syllable load — with the
 * sentence-length term held at a neutral eight words.
 */
const FK_VALID_FROM = 8;

function grade(sentence) {
  const words = sentence.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length === 0) return 0;
  const syl = words.reduce((sum, word) => sum + syllables(word), 0);
  const length = Math.max(FK_VALID_FROM, words.length);
  return 0.39 * length + 11.8 * (syl / words.length) - 15.59;
}

const files = walk(join(ROOT, 'src')).filter(
  (file) => !NOT_FOR_KIDS.some((skip) => file.endsWith(skip)),
);

const scored = [];
const hardWords = new Map();
for (const file of files) {
  for (const line of copyFrom(readFileSync(file, 'utf8'))) {
    for (const sentence of sentences(line)) {
      const words = sentence.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
      scored.push({
        file: relative(ROOT, file),
        sentence,
        words: words.length,
        grade: grade(sentence),
      });
      for (const word of words) {
        const bare = word.toLowerCase().replace(/[^a-z']/g, '');
        if (bare.length > 0 && syllables(bare) >= HARD_SYLLABLES && !FAMILIAR.has(bare)) {
          hardWords.set(bare, (hardWords.get(bare) ?? 0) + 1);
        }
      }
    }
  }
}

/*
 * Two failure modes, measured separately, because one number cannot see both.
 *
 * Long sentences are what actually stop a ten-year-old: they run out of working
 * memory before the clause resolves. Flesch–Kincaid measures that well, and is
 * only meaningful on sentences long enough to have structure.
 *
 * Hard words are the other one, and the formula cannot separate a hard word the
 * game is deliberately teaching — revenue, margin, capacity — from a hard word
 * that slipped in. Nothing can, so this reports them rather than failing on
 * them: the list is short enough to read, and reading it is the job.
 */
const real = scored.filter((item) => item.words >= FK_VALID_FROM);
const average = real.reduce((sum, item) => sum + item.grade, 0) / real.length;
const rambling = scored.filter((item) => item.words > TOO_LONG);

if (process.argv.includes('--worst')) {
  console.log('Longest sentences:\n');
  for (const item of [...scored].sort((a, b) => b.words - a.words).slice(0, 15)) {
    console.log(`${String(item.words).padStart(3)} words  ${item.file}\n           ${item.sentence}\n`);
  }
  console.log('Hardest sentences that are long enough to judge:\n');
  for (const item of [...real].sort((a, b) => b.grade - a.grade).slice(0, 15)) {
    console.log(`grade ${item.grade.toFixed(1)}  ${item.file}\n           ${item.sentence}\n`);
  }
}

if (process.argv.includes('--words')) {
  console.log('Three-syllable-plus words the kid is not being taught:\n');
  for (const [word, count] of [...hardWords].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`${String(count).padStart(3)}  ${word}`);
  }
  console.log('');
}

console.log(`Sentences:            ${scored.length}`);
console.log(`Long enough to score: ${real.length}`);
console.log(`Average grade:        ${average.toFixed(1)}  (target ${TARGET_GRADE} or below)`);
console.log(`Over ${TOO_LONG} words:        ${rambling.length}  (${((rambling.length / scored.length) * 100).toFixed(1)}%, at most ${RAMBLE_ALLOWED * 100}%)`);
console.log(`Unfamiliar hard words: ${hardWords.size} distinct`);

let failed = false;
if (average > TARGET_GRADE) {
  console.error(`\nFAIL: average reading grade ${average.toFixed(1)} is above ${TARGET_GRADE}.`);
  failed = true;
}
if (rambling.length / scored.length > RAMBLE_ALLOWED) {
  console.error(
    `\nFAIL: ${rambling.length} sentences run past ${TOO_LONG} words. A kid this age loses the thread.`,
  );
  failed = true;
}
if (failed) {
  console.error('Run with --worst to see what to rewrite, or --words for the vocabulary.');
  process.exit(1);
}
console.log('\nOK');
