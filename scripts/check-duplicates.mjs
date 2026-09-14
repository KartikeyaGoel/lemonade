/**
 * Refuses to let the same function body exist twice.
 *
 * ## The defect class this closes
 *
 * PRODUCT.md §75 is "one decision, multiple implementations", and it is the
 * single most expensive class in this project's history: a day advanced the
 * game in four places, and every measurement taken of the business stage was
 * taken against a copy that had drifted. `check-one-day.mjs` closes it for
 * days. This closes it for *everything else*, by shape rather than by name.
 *
 * It was written because a direct audit found three more live instances that
 * no existing gate looked at:
 *
 *  - **`money`, nine times.** `copy.ts` had exported one for months and was
 *    imported by a single file. Six of the nine got the sign wrong and put
 *    "you kept $-5.00" on the profit card of a losing first day.
 *  - **`daysBetween`, twice, exported under one name with two contracts** —
 *    `live.ts` clamped at zero, `ledger.ts` signed.
 *  - **`mondayOf`, twice**, three hundred lines apart in two scripts, which
 *    is the exact thing `market-rules.mjs` was created to stop.
 *
 * A fourth turned up that nobody would have grepped for: two clipboard
 * handlers, identical but for a flash of 1600ms in one and 1800ms in the
 * other. Nobody chose two durations. That is the value of a detector over a
 * search — you cannot grep for the duplicate you have not thought of.
 *
 * ## How it looks
 *
 * Every function body is normalised: comments and string contents removed,
 * numbers folded to `N`, and identifiers renamed positionally, so two clones
 * under different names and different variable names still collide. Bodies
 * under `MIN_CHARS` normalised characters are ignored — a two-line accessor
 * is not a design decision with two homes.
 *
 * ## What this would miss
 *
 * Clones that have already drifted. Two implementations that differ by a
 * statement hash differently and this says nothing, which is precisely the
 * state §75 describes *after* the damage. It catches them while they are
 * still identical, which is while they are still cheap.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Shorter than this and it is an accessor, not a decision. */
const MIN_CHARS = 60;

/**
 * Clone groups that are deliberately separate, each with the reason.
 * Matched on the set of `file:name` members, so a group that grows fails.
 */
const CLASSIFIED = [];

function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx?|mjs)$/.test(path)) out.push(path);
  }
  return out;
}

/** Comments out, so prose differences cannot hide a clone. */
const decommented = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');

const FUNCTION = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g;
const ARROW = /(?:export\s+)?const\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:async\s*)?\(/g;

/** From an open bracket, the index of its match. -1 if unbalanced. */
function closes(src, start, open, shut) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === shut) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function bodies(file) {
  const src = decommented(readFileSync(file, 'utf8'));
  const found = [];

  for (const [pattern, kind] of [
    [FUNCTION, 'function'],
    [ARROW, 'arrow'],
  ]) {
    pattern.lastIndex = 0;
    for (const m of src.matchAll(pattern)) {
      const params = closes(src, m.index + m[0].length - 1, '(', ')');
      if (params < 0) continue;

      /*
       * Between the parameters and the body there may be a return type, and
       * nothing else. An expression-bodied arrow has no body to compare and
       * must be skipped — the first version of this did not, ran its brace
       * matcher on into the *next* function, and reported `avg` and
       * `managerPrice` as clones of each other. §8: measure the instrument.
       */
      const after = src.slice(params + 1);
      const brace = kind === 'arrow' ? after.match(/^\s*=>\s*\{/) : after.match(/^\s*(?::[^;{}]{0,120})?\{/);
      if (!brace) continue;

      const open = params + 1 + brace[0].length - 1;
      const shut = closes(src, open, '{', '}');
      if (shut < 0) continue;

      found.push({
        file,
        name: m[1],
        line: src.slice(0, m.index).split('\n').length,
        body: src.slice(open, shut + 1),
      });
    }
  }
  return found;
}

/** Identifiers and literals blinded, so two clones under any names collide. */
const KEYWORDS = new Set(
  'return if else const let var for while do of in new typeof instanceof await async function null undefined true false string number boolean void never unknown any this throw try catch finally switch case break continue default export import type interface extends implements'.split(
    ' ',
  ),
);

function blind(body) {
  const seen = new Map();
  /*
   * String *contents* are kept, deliberately.
   *
   * The first version folded every literal to one token, and reported a
   * three-line `Step` in the classroom screen as a clone of a three-line
   * `Stat` in the trophy screen — two components whose entire difference is
   * their markup, which lives in the strings. Different text a child reads
   * is different behaviour. §8: the instrument first.
   */
  return body
    .replace(/\b\d[\d_.]*\b/g, 'N')
    .replace(/\b[A-Za-z_$][\w$]*\b/g, (word) => {
      if (KEYWORDS.has(word)) return word;
      if (!seen.has(word)) seen.set(word, `v${seen.size}`);
      return seen.get(word);
    })
    .replace(/\s+/g, '');
}

const all = [...files('src'), ...files('scripts')].flatMap(bodies);

const groups = new Map();
for (const fn of all) {
  const key = blind(fn.body);
  if (key.length < MIN_CHARS) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(fn);
}

const clones = [...groups.values()].filter((g) => g.length > 1);
const problems = [];
let classified = 0;

for (const group of clones) {
  const members = group.map((f) => `${f.file}:${f.name}`).sort();
  const entry = CLASSIFIED.find(
    (c) => c.members.length === members.length && c.members.every((m, i) => m === members[i]),
  );
  if (entry) {
    classified++;
    continue;
  }
  problems.push(
    `${group.length} copies of one function body:\n` +
      group.map((f) => `      ${f.file}:${f.line}  ${f.name}`).join('\n') +
      `\n      ${group[0].body.replace(/\s+/g, ' ').slice(0, 160)}\n` +
      `      Give it one home and import it, or classify it in CLASSIFIED with the reason there must be two.`,
  );
}

for (const entry of CLASSIFIED) {
  const live = clones.some((g) => {
    const members = g.map((f) => `${f.file}:${f.name}`).sort();
    return entry.members.length === members.length && entry.members.every((m, i) => m === members[i]);
  });
  if (!live) problems.push(`a CLASSIFIED group that is no longer a clone. Delete it.\n      ${entry.members.join(', ')}`);
}

console.log(
  `one decision, one home — ${all.length} function bodies compared by shape, ` +
    `${clones.length} clone groups (${classified} classified with a reason).`,
);

if (problems.length > 0) {
  console.error(`\n${problems.length} unclassified:\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}
