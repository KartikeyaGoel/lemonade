/**
 * Refuses to let a second implementation of "play a day" exist — and refuses
 * to let a *new* one be written without somebody saying which kind it is.
 *
 * ## The defect class this closes
 *
 * Every redesign of this game was followed by a fortnight of bugs found by
 * opening a screen rather than by a test going red. That had a single cause:
 * **a day advanced the game in four places.**
 *
 *  1. `page.tsx` → `settleDay` — the word queue and three counters.
 *  2. `page.tsx` → `closeDay` — the stand, the competitor, the day count.
 *  3. `page.tsx` → `settledGame` memo — a partial, for the badge pass.
 *  4. `demo.ts` → `playDay` — all of it again, and the copy
 *     `tests/arc.test.ts` walks to prove the game is finishable.
 *
 * Copy 4 was missing `advanceRival`, so every measurement ever taken of the
 * business stage was taken with the competitor switched off — including the
 * proof that the stage can be completed and the one that set `ACT2_DAYS`.
 *
 * ## Why the first version of this gate was not enough
 *
 * It held a hardcoded list of ten primitive names and failed if any was called
 * outside `src/lib/day.ts`. That is a **blocklist**, and a blocklist only knows
 * what somebody remembered to type into it. The next per-day effect — a new
 * streak, a new counter, a new deriver — would be added, called from the app,
 * and sail straight past, which is precisely the failure mode the gate exists
 * to end. The customer asked the right question: *is this fixed and it won't
 * happen again?* With a blocklist the honest answer was "this instance is".
 *
 * So it is an **allowlist** now, and it fails on the unknown rather than on the
 * known-bad.
 *
 * Every exported function in `src/lib` that returns a piece of game state or a
 * queue of words is a candidate — a shape, derived from the source, not a name
 * anybody remembered. Each has to be classified below. A new one that is not
 * classified **fails the build**, with a message asking which kind it is. The
 * only way past is to make a decision and write it down.
 *
 * | class | means | may be called from |
 * |---|---|---|
 * | `day` | advances something once per day | **`src/lib/day.ts` only** |
 * | `choice` | the child decided it | anywhere |
 * | `event` | a one-off beat: a float, a sale, a season | anywhere |
 * | `make` | a constructor | anywhere |
 * | `load` | revives a save | anywhere |
 * | `view` | derives a report, changes nothing | anywhere |
 * | `harness` | the demo/test walker, which goes through `day` | anywhere |
 *
 * PRODUCT.md §62 says *a fact with more than one home disagrees with itself.*
 * It had only ever been applied to figures on screens. This is the same rule
 * applied to behaviour. See PRODUCT.md §75.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The one module allowed to advance a day, for everything on the `Game`. */
const HOME = path.normalize('src/lib/day.ts');

/**
 * Per-day effects that are not on the `Game`, and so cannot live in
 * `settleDay` — with the single place each is allowed to be called from.
 *
 * There is one. `recordDay` advances the *career*, which is a separate save
 * slot with a separate lifetime: a new season clears the run and must not clear
 * how many days the child has turned up. `settleDay` takes a `Game` and does
 * not own that aggregate.
 *
 * So the rule for these is not "only day.ts" but **"exactly one call site"**,
 * which is the property that actually matters and is what the four copies of a
 * day violated. It found something immediately: `recordDay` had two, one in
 * `closeDay`'s Saturday branch and one on its main path.
 */
const ELSEWHERE = {
  recordDay: { file: path.normalize('src/app/page.tsx'), calls: 1 },
};

/**
 * What a candidate looks like: an exported function whose return type is game
 * state, or words owed to the child.
 *
 * Derived from the shape rather than the name, because the thing that went
 * wrong was a name nobody thought of.
 */
const STATEFUL_RETURN =
  /^(BusinessState|ShopState|OwnershipState|GameState|Game|Listing|LoanState|Loan|PortfolioState|Career|ClubState|Inbox|Ledger|RivalState|Insight)\b/;

/**
 * Every candidate, classified. Sorted by module, then by name.
 *
 * This table is documentation as much as configuration: it is the only place
 * that says, of everything in the game that can change state, which parts are
 * a *day passing* and which are a child doing something.
 */
const CLASS = {
  'business.ts': {
    advanceRival: 'day',
    closeStand: 'choice',
    createBusinessState: 'make',
    deriveAct2Insights: 'day',
    deriveAct3Insights: 'day',
    moveTo: 'choice',
    toggleStaff: 'choice',
    updateHandsOff: 'day',
    updateTwoStandDays: 'day',
  },
  'career.ts': {
    beginSeason: 'event',
    createCareer: 'make',
    recordAnnounced: 'choice',
    recordBadges: 'event',
    recordChallenge: 'event',
    recordClubWeek: 'event',
    recordClubWin: 'event',
    recordCoached: 'choice',
    recordDay: 'day',
    recordSeason: 'event',
    recordStudied: 'choice',
    recordWords: 'event',
  },
  'club.ts': { createClub: 'make', decodeClub: 'load', reviveClub: 'load' },
  'demo.ts': {
    demoGame: 'harness',
    playDay: 'harness',
    throughActOne: 'harness',
    throughSale: 'harness',
  },
  'glossary.ts': {
    /*
     * One `Insight` each, all fired by a beat rather than by a day: an equity
     * deal, a multiple being read, a float, a thesis being scored. The one
     * exception is the round's word, which a day earns the first time somebody
     * on the round is served.
     */
    businessModelInsight: 'event',
    diversificationInsight: 'event',
    drawdownInsight: 'event',
    equityInsight: 'event',
    luckInsight: 'event',
    multipleInsight: 'event',
    multipleInsightFor: 'event',
    peRatioInsight: 'event',
    recurringRevenueInsight: 'day',
    thesisInsight: 'event',
    unrecorded: 'view',
  },
  'ledger.ts': { createLedger: 'make', record: 'choice', spend: 'choice' },
  'listing.ts': {
    createListing: 'make',
    deriveListingInsights: 'event',
    listCompany: 'event',
  },
  'live.ts': { createLivePortfolio: 'make', rehydrate: 'load' },
  'market.ts': { createPortfolio: 'make', markResearched: 'choice' },
  'messages.ts': {
    block: 'choice',
    createInbox: 'make',
    deliver: 'event',
    openThread: 'choice',
    report: 'choice',
  },
  'ownership.ts': {
    acceptBuyout: 'event',
    acceptEquity: 'choice',
    createOwnershipState: 'make',
    declineEquity: 'choice',
    recordDealChoice: 'choice',
    recordInvestorCut: 'day',
  },
  'progress.ts': {
    beginAct2: 'event',
    beginAct3: 'event',
    beginAct4: 'event',
    beginWeekend: 'event',
    createChallengeGame: 'make',
    createGame: 'make',
    endWeekend: 'event',
    seasonRecord: 'event',
  },
  'retail.ts': {
    createShopState: 'make',
    hireShopStaff: 'choice',
    letShopStaffGo: 'choice',
    loanQuote: 'choice',
    repayLoan: 'day',
    updateShopDays: 'day',
  },
  'simulation.ts': { createInitialState: 'make', deriveInsights: 'day' },
  'storage.ts': {
    loadCareer: 'load',
    loadGame: 'load',
    loadInbox: 'load',
    loadLedger: 'load',
    loadLive: 'load',
  },
};

const VALID = new Set(['day', 'choice', 'event', 'make', 'load', 'view', 'harness']);

/* ------------------------------------------------------------------ *
 * Read the source
 * ------------------------------------------------------------------ */

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
 * be written about is a gate nobody documents.
 */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const problems = [];

/* 1. Every candidate is classified, and classified with something real. */
const candidates = new Map();
for (const file of files.filter((f) => f.startsWith(path.normalize('src/lib/')))) {
  const short = path.basename(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(
    /export function ([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*:\s*([^{]+)\{/g,
  )) {
    const [, name, , ret] = m;
    if (!STATEFUL_RETURN.test(ret.trim())) continue;
    const kind = CLASS[short]?.[name];
    candidates.set(`${short}:${name}`, kind);
    if (!kind) {
      problems.push({
        kind: 'unclassified',
        where: `${file}`,
        name,
        detail: `returns ${ret.trim().split('\n')[0]}`,
      });
    } else if (!VALID.has(kind)) {
      problems.push({ kind: 'bad-class', where: file, name, detail: `"${kind}" is not a class` });
    }
  }
}

/* 2. Every `day` primitive has exactly one home, and it is the right one. */
const perDay = [...candidates.entries()]
  .filter(([, kind]) => kind === 'day')
  .map(([key]) => key.split(':')[1]);

for (const name of perDay) {
  const allowed = ELSEWHERE[name] ?? { file: HOME, calls: Infinity };
  const sites = [];
  for (const file of files) {
    const lines = code(fs.readFileSync(file, 'utf8')).split('\n');
    const call = new RegExp(`\\b${name}\\s*\\(`);
    const define = new RegExp(`export\\s+function\\s+${name}\\s*\\(`);
    lines.forEach((line, i) => {
      if (call.test(line) && !define.test(line)) sites.push({ file, line: i + 1 });
    });
  }
  const wrong = sites.filter((s) => path.normalize(s.file) !== allowed.file);
  for (const s of wrong) {
    problems.push({
      kind: 'called-outside',
      where: `${s.file}:${s.line}`,
      name,
      detail: `only ${allowed.file} may call this`,
    });
  }
  const right = sites.filter((s) => path.normalize(s.file) === allowed.file);
  if (right.length > allowed.calls) {
    problems.push({
      kind: 'too-many',
      where: right.map((s) => `${s.file}:${s.line}`).join(', '),
      name,
      detail: `${right.length} call sites, and a per-day effect gets ${allowed.calls}`,
    });
  }
}

/* 3. The table has no entries for things that no longer exist. */
for (const [short, names] of Object.entries(CLASS)) {
  for (const name of Object.keys(names)) {
    if (!candidates.has(`${short}:${name}`)) {
      problems.push({
        kind: 'stale',
        where: `scripts/check-one-day.mjs`,
        name: `${short}:${name}`,
        detail: 'classified here but no longer a stateful export',
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (problems.length > 0) {
  const unclassified = problems.filter((p) => p.kind === 'unclassified');
  const outside = problems.filter((p) => p.kind === 'called-outside');
  const stale = problems.filter((p) => p.kind === 'stale');
  const bad = problems.filter((p) => p.kind === 'bad-class');

  if (unclassified.length > 0) {
    console.error(`\n${unclassified.length} state-advancing export(s) nobody has classified:\n`);
    for (const p of unclassified) console.error(`  ${p.where}  ${p.name}() — ${p.detail}`);
    console.error(
      [
        '',
        'Every function that changes game state has to say which kind it is, in the',
        'table at the top of scripts/check-one-day.mjs. The one that matters is `day`:',
        'something that advances once per day, which only src/lib/day.ts may call.',
        '',
        'This is an allowlist on purpose. The previous version of this gate held a',
        'list of ten names and so could only catch the ten mistakes already made —',
        'the next per-day effect would have been added to the app and sailed past.',
        '',
        'If it advances once a day: classify it `day` and call it from settleDay.',
        'If the child decided it: `choice`. A one-off beat: `event`. See the table.',
        '',
      ].join('\n'),
    );
  }
  const many = problems.filter((p) => p.kind === 'too-many');
  if (many.length > 0) {
    console.error(`\n${many.length} per-day effect(s) with more than one call site:\n`);
    for (const p of many) console.error(`  ${p.name}() — ${p.detail}\n    ${p.where}`);
    console.error(
      [
        '',
        'One per-day effect, one call site. Two call sites is the shape of the bug',
        'this gate exists for, at a smaller scale: nothing keeps them in step, and',
        'the next edit goes to whichever one the author was looking at.',
        '',
      ].join('\n'),
    );
  }
  if (outside.length > 0) {
    console.error(`\n${outside.length} per-day call(s) outside src/lib/day.ts:\n`);
    for (const p of outside) console.error(`  ${p.where}  ${p.name}()`);
    console.error(
      [
        '',
        'A day advances the game in exactly one place: settleDay in src/lib/day.ts.',
        'Every caller — the app, the demo harness, the tests — goes through it, so a',
        'new per-day effect cannot be added to one path and forgotten on another.',
        '',
        'advanceRival was in the app and not in the harness, and the result was that',
        'tests/arc.test.ts proved the game finishable with the competitor switched',
        'off, and ACT2_DAYS was set from a measurement of a game nobody plays.',
        '',
      ].join('\n'),
    );
  }
  if (stale.length > 0) {
    console.error(`\n${stale.length} stale entr(y/ies) in the table:\n`);
    for (const p of stale) console.error(`  ${p.name} — ${p.detail}`);
    console.error('\nDelete it, or restore the export it was about.\n');
  }
  if (bad.length > 0) {
    for (const p of bad) console.error(`  ${p.where} ${p.name}: ${p.detail}`);
  }
  process.exit(1);
}

const byKind = {};
for (const kind of candidates.values()) byKind[kind] = (byKind[kind] ?? 0) + 1;
const summary = Object.entries(byKind)
  .sort()
  .map(([k, n]) => `${n} ${k}`)
  .join(' · ');
console.log(
  `one day, one place — ${candidates.size} state-advancing exports classified (${summary}); ` +
    `every 'day' called only from src/lib/day.ts`,
);
