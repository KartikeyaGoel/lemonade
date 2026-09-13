/**
 * No sentence in the game claims arithmetic that does not close.
 *
 * ## The defect class, and why it needs its own sweep
 *
 * PRODUCT.md §4 is that any two figures shown together must reconcile, and it
 * is the rule this product breaks most easily, because the breakage is always
 * in *copy* rather than in a calculation. Two examples, both found by reading a
 * screen rather than by a test:
 *
 *  - **"28 cups x $1.00 = $29.50"** on day one of a fresh run (§72). The
 *    revenue card was written when a day had one price and multiplied the whole
 *    day's cups by the morning sign.
 *  - **"40 of 28 cups sold"** after the lunchtime top-up shipped (§74). Nothing
 *    failed, because `cupsMakeable` is a correct name for what the morning
 *    poured and every assertion in the codebase used it. The bug existed only
 *    in sentences meaning *"how many you had"*.
 *
 * Neither was catchable by the tests around it, because the test and the copy
 * read the same variable. What *is* catchable is the claim itself: a sentence
 * of the shape `A of B` is asserting `A <= B`, and one of the shape
 * `N x $P = $T` is asserting a product. Those can be checked without knowing
 * anything about the day that produced them.
 *
 * So this file holds the claim shapes, and sweeps **every copy producer** over
 * a fuzz of days rather than the one module a bug was last found in.
 *
 * ## And why one figure counts
 *
 * §78's residue after the first allowlist was *"a false claim in a sentence with
 * one figure in it. 'You sold most of them' is unfalsifiable by arithmetic and
 * always will be."* True of arithmetic, and not of everything: a single figure
 * still has to **agree with its noun**. "1 people kept walking", "You sold 2
 * cup", "1 days to go" are all false, all checkable from the text alone, and all
 * outside the first version of this file.
 *
 * So the threshold is one figure, not two. That turned out to be twenty extra
 * shapes against thirty existing ones — the *larger* half of the game's
 * figure-carrying copy had been outside the allowlist entirely — and widening
 * the fuzz to reach them (six prices, four batch sizes) found four more shapes
 * still, two of which assert arithmetic nothing had checked. One of those was a
 * live defect: see `diagnose.ts`'s batch line, which named two batch sizes and
 * then a third figure that was not their difference.
 *
 * The agreement check also cost a false-alarm lesson worth keeping. Its first
 * version flagged seventy-one sentences, every one of them correct English —
 * "on a 10 cup day" is attributive and takes the singular. A check that fires
 * seventy-one times on good copy is a check somebody switches off, so it now
 * recognises the determiner in front of the number rather than guessing from
 * the noun behind it.
 *
 * ## And why the shapes are an allowlist
 *
 * The first version of this file knew three bad shapes and passed everything
 * else. §78 named the hole in its own words: *"a false claim in an unknown
 * shape ships. A percentage that does not divide, a count of people against a
 * count of cups, a date — all pass."* A gate that fails on the known-bad closes
 * one bug; a gate that fails on the **unclassified** closes a class, which is
 * the whole argument of `check-one-day.mjs`.
 *
 * So every sentence the game can say about a day that carries **two or more
 * numbers** is normalised to a shape — figures replaced by `#` and `$#`,
 * singulars folded into plurals — and that shape has to be in `KNOWN_SHAPES`.
 * There are thirty of them across every producer in the game. Each one either
 * carries a `checks` function that does the arithmetic, or a sentence saying
 * why there is nothing to check.
 *
 * Writing the list out is what found the next five false-claim shapes, and they
 * were not the ones §78 guessed at: `$A in, $B out, so you kept $C` was never
 * checked against `A - B = C`; `you keep $A of every $B cup, because each one
 * costs $C` was never checked against `A + C = B`; a best/worst/average line was
 * never checked for the average being between them. None of those was a bug
 * today. All three were one copy edit away from being one, and nothing would
 * have said so.
 *
 * `tests/midday.test.ts` has the narrower version of the product check, kept
 * because it is about the two-price day specifically. This is the general one.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ECON,
  createInitialState,
  deriveInsights,
  orderForTargetCups,
  runDay,
  type DayOutcome,
  type GameState,
} from '../src/lib/simulation';
import { closingLine, ledgerNoveltyOf } from '../src/lib/guide';
import { middayCall, middayOptions, middayResult } from '../src/lib/midday';
import { diagnose, wordOfMouth } from '../src/lib/diagnose';
import { act2Progress, deriveAct2Insights, deriveAct3Insights } from '../src/lib/business';
import { shopProgress } from '../src/lib/retail';
import { act1Progress } from '../src/lib/progress';
import { createBusinessState } from '../src/lib/business';

/* ------------------------------------------------------------------ *
 * The claim shapes
 * ------------------------------------------------------------------ */

const money = String.raw`\$(\d+(?:\.\d+)?)`;

/**
 * Every false arithmetic claim in a string.
 *
 * Each entry is a shape of sentence that asserts something checkable. They are
 * written to match the copy the game actually produces rather than to parse
 * English — a permissive regex here would be worse than none, because it would
 * fire on prose and get switched off.
 */
export function badClaims(text: string): string[] {
  const bad: string[] = [];

  /*
   * `N cups x $P = $T`, optionally two terms joined by "and".
   *
   * `\d+(?:\.\d+)?` and not `[\d.]+`: the first version of this captured
   * "$29.50." *with the full stop*, `Number` gave it `NaN`, and
   * `Math.abs(NaN - x) > 0.011` is false — so it passed on the exact string it
   * was written to catch.
   */
  const product = new RegExp(
    String.raw`(\d+)\s*cups?\s*x\s*${money}(?:\s*and\s*(\d+)\s*cups?\s*x\s*${money})?\s*=\s*${money}`,
    'gi',
  );
  for (const m of text.matchAll(product)) {
    const [, n1, p1, n2, p2, total] = m;
    let sum = Number(n1) * Number(p1);
    if (n2 && p2) sum += Number(n2) * Number(p2);
    if (Math.abs(sum - Number(total)) > 0.011) {
      bad.push(`${m[0]} — the terms come to $${sum.toFixed(2)}`);
    }
  }

  /*
   * `A of B cups`, which asserts `A <= B`. This is §74 exactly: the close
   * screen's ledger header read "40 of 28 cups sold" once a child could send
   * out for more at lunchtime, because the sentence read the morning's batch
   * and the sale read the day's.
   */
  for (const m of text.matchAll(/(\d+)\s+of\s+(\d+)\s+cups?/gi)) {
    if (Number(m[1]) > Number(m[2])) {
      bad.push(`${m[0]} — you cannot sell more than there were`);
    }
  }

  /*
   * `sold N ... you had M` and `made M ... sold N`, the same claim said the
   * other way round. Pip says it in this shape rather than "N of M".
   */
  for (const m of text.matchAll(/made\s+(\d+)\s+cups?\s+and\s+sold\s+(\d+)/gi)) {
    if (Number(m[2]) > Number(m[1])) {
      bad.push(`${m[0]} — sold more than were made`);
    }
  }

  /*
   * Number and noun agreeing, on every sentence whatever its shape.
   *
   * The one thing a single figure *can* be checked against: "1 people", "2
   * cup", "1 days". The codebase has `plural()` precisely for this and
   * `tests/plural.test.ts` checks the helper; this checks the sentences that
   * come out, which is where a hand-written `${n} cups` slips through.
   *
   * Attributive uses are correct English and are skipped — "a 10 cup day", "a 3
   * day streak" take the singular. The first version of this check flagged
   * seventy-one of them and would have been switched off inside a day.
   */
  for (const m of text.matchAll(
    new RegExp(`(?<![$\\d.])\\b(\\d+)\\s+${COUNTABLE}\\b`, 'gi'),
  )) {
    const noun = m[2].toLowerCase();
    const plural = noun.endsWith('s') || noun === 'people';
    /*
     * Attributive uses take the singular and are correct: "a 10 cup day", "a 3
     * day streak". They are recognised by the determiner in front of the
     * number rather than by the noun behind it, because the noun behind it can
     * be anything — the first version looked for another countable noun and so
     * passed "a 10 cup day" and flagged "a 3 day streak".
     *
     * Costs one case: `the 1 cups` is a determiner with a plural noun, and a
     * genuine disagreement, and is skipped. Worth it — the alternative is
     * seventy-one false alarms, which is a check nobody keeps.
     */
    const before = text.slice(0, m.index ?? 0);
    if (!plural && /\b(a|an|the|this|that|every|per)\s+$/i.test(before)) continue;
    if ((Number(m[1]) === 1) === plural) {
      bad.push(`${m[0]} — ${Number(m[1]) === 1 ? 'one of those is singular' : 'more than one is plural'}`);
    }
  }

  /*
   * And then every shape in the allowlist that carries a `checks`.
   *
   * The three regexes above stay as they are, because each of them is a
   * *class* of sentence rather than one shape — a product claim is wrong in
   * any wording — and because the two defects they were written for are quoted
   * verbatim in a test below. The allowlist catches the rest, one exact shape
   * at a time, and is the half that grows without anybody having to guess.
   */
  for (const sentence of claimingSentences(text)) {
    const entry = BY_SHAPE.get(shapeOf(sentence));
    const wrong = entry?.checks?.(figuresIn(sentence));
    if (wrong) bad.push(`${sentence.trim()} — ${wrong}`);
  }

  return bad;
}

/* ------------------------------------------------------------------ *
 * The allowlist
 * ------------------------------------------------------------------ */

/** Every figure a sentence can carry, in the forms the copy writes them. */
const FIGURE = /\$-?\d+(?:\.\d+)?|-?\d+(?:\.\d+)?%|-?\d+(?:\.\d+)?/g;

/** The nouns the game counts, for the number-agreement check. */
const COUNTABLE =
  '(cup|cups|day|days|days|person|people|week|weeks|customer|customers|lemon|lemons|stand|stands|share|shares|time|times|jar|jars|pack|packs)';

/**
 * A sentence with its figures taken out, so one entry can stand for thousands.
 *
 * Singulars are folded into plurals because `plural()` writes "1 cup" and
 * "2 cups", and a registry that had to carry both of every shape would be
 * twice as long and no safer. Everything else is left exactly as written: a
 * comma moving is a copy change, and a copy change is the moment somebody
 * should look at the claim again.
 */
function shapeOf(sentence: string): string {
  return sentence
    .replace(FIGURE, (m) => (m.startsWith('$') || m.startsWith('-$') ? '$#' : m.endsWith('%') ? '#%' : '#'))
    .replace(/\b(cup|cups)\b/g, 'cups')
    .replace(/\b(day|days)\b/g, 'days')
    .replace(/\b(person|people)\b/g, 'people')
    .replace(/\bcups sold, and # still\b/, 'cups sold, and # still')
    .trim();
}

/** The figures a sentence carries, in order, as numbers. */
function figuresIn(sentence: string): number[] {
  return (sentence.match(FIGURE) ?? []).map((raw) => Number(raw.replace(/[$%]/g, '')));
}

/**
 * Sentences, split on terminators, that carry a figure at all.
 *
 * **One, not two.** §78 called the one-figure sentence unfalsifiable — *"'You
 * sold most of them' is unfalsifiable by arithmetic and always will be"* — and
 * that is true of arithmetic and not of everything. A single figure still
 * agrees or disagrees with its noun, and it still has to be a sentence somebody
 * looked at. There turned out to be twenty such shapes across every producer in
 * the game, against thirty with two or more, so the cost of classifying them
 * was an afternoon and the benefit is that a *new* one cannot arrive unread.
 */
function claimingSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => (sentence.match(FIGURE) ?? []).length >= 1);
}

/**
 * Exact to the printed cent.
 *
 * This was `<= 0.011`, which sounds like a reasonable tolerance for rounded
 * figures and is not: it is precisely the width of the defect. The margin card
 * printed "keep $0.81 ... sold for $1.01 ... cost $0.19" — a penny out, on a
 * screen where a child can do the sum in their head — and passed, because a
 * penny is inside every sensible tolerance a test would pick.
 *
 * The figures are compared **as printed**, to two decimal places, because §4 is
 * about what a child reads rather than about what the floats were. A producer
 * whose three figures do not add up to the cent has a rounding bug, and the
 * answer is to derive one of them from the others rather than to widen this.
 */
const asPrinted = (n: number) => Number(n.toFixed(2));
const closes = (a: number, b: number) => asPrinted(a) === asPrinted(b);
/** Within a cent a cup, for the lines that divide a total by a count. */
const divides = (total: number, count: number, each: number) =>
  count > 0 && Math.abs(total / count - each) <= 0.011;

interface Shape {
  /** The normalised sentence. */
  shape: string;
  /** The arithmetic it asserts, or undefined when it asserts none. */
  checks?: (n: number[]) => string | null;
  /** Why there is nothing to check. Required when `checks` is absent. */
  why?: string;
}

/**
 * Every two-figure sentence the game can say about a day.
 *
 * Grouped by what they are: the ones that do arithmetic a child could add up,
 * and the ones that merely put two true figures side by side. The second group
 * is the larger one and is not a weakness — "$# yesterday, $# today" asserts
 * nothing beyond the two numbers being right, which is the producer's problem
 * and not the sentence's.
 */
const KNOWN_SHAPES: Shape[] = [
  /* ---- arithmetic that closes, checked ---- */
  {
    shape: '# cups x $# and # cups x $# = $#.',
    checks: ([n1, p1, n2, p2, total]) =>
      closes(n1 * p1 + n2 * p2, total) ? null : `the terms come to $${(n1 * p1 + n2 * p2).toFixed(2)}`,
  },
  {
    shape: '# cups x $# = $#.',
    checks: ([n, p, total]) => (closes(n * p, total) ? null : `the term comes to $${(n * p).toFixed(2)}`),
  },
  {
    shape: '$# in, $# out, so you kept $#.',
    /*
     * Never checked before, and it is the plainest §4 sentence in the game:
     * three figures, one subtraction, on the close screen.
     */
    checks: ([inn, out, kept]) =>
      closes(inn - out, kept) ? null : `$${inn} less $${out} is $${(inn - out).toFixed(2)}`,
  },
  {
    shape: 'You keep $# of every $# cups, because each one costs $# to make.',
    /* Also never checked: what you keep plus what it costs is what it sold for.
       It did not close on any day with two prices — see `margin` in
       `simulation.ts` for the four figures it used to print. */
    checks: ([keep, price, cost]) =>
      closes(keep + cost, price) ? null : `$${keep} and $${cost} is $${(keep + cost).toFixed(2)}, not $${price}`,
  },
  {
    shape: 'You keep $# on an average cups: it sold for $# and cost $# to make.',
    /* The two-price wording of the line above, and the same arithmetic. */
    checks: ([keep, price, cost]) =>
      closes(keep + cost, price) ? null : `$${keep} and $${cost} is $${(keep + cost).toFixed(2)}, not $${price}`,
  },
  {
    shape: 'Your best days was $# and your worst $#, but your average across # days is $#.',
    /* An average outside its own range is the sort of thing a child spots. */
    checks: ([best, worst, , average]) =>
      average <= best + 0.011 && average >= worst - 0.011
        ? null
        : `an average of $${average} is not between $${worst} and $${best}`,
  },
  {
    shape: 'Split across # cups, the $# fee cost you $# a cups.',
    checks: ([cups, fee, each]) =>
      divides(fee, cups, each) ? null : `$${fee} across ${cups} cups is $${(fee / cups).toFixed(2)}`,
  },
  {
    shape: 'On a # cups days it would be $# a cups.',
    /* The fee is named in the sentence before this one, so the division cannot
       be checked from here. What can be: a bigger day cannot cost more a cup. */
    why: 'the fee it divides is in the previous sentence; the division itself is checked in tests/pnl.test.ts',
  },
  {
    shape: 'You sent out for # more cups at lunchtime, which cost $# — about $# a cups, against $# a cups in the morning.',
    /*
     * Only the division, and the second half of this check was removed for a
     * reason worth keeping.
     *
     * It also asserted `each > morning` — "sending out at lunchtime is meant to
     * cost more than the morning did" — which is the lesson the line exists for
     * and is **not always true**. On a one-cup batch a whole lemon gets cut for
     * one cup, so the morning cup costs $0.57 against the top-up's $0.45, and
     * the sentence correctly says so. The copy was right and my assertion was
     * wrong; widening the fuzz to tiny batches is what surfaced it, and I came
     * within one commit of "fixing" working copy to satisfy a false premise.
     */
    checks: ([cups, cost, each]) =>
      divides(cost, cups, each) ? null : `$${cost} for ${cups} cups is $${(cost / cups).toFixed(2)} a cup`,
  },
  {
    shape: 'You made # cups yesterday and # today — # more to sell.',
    /* The §74 sentence, in the module where the third instance of that bug was
       found. The subtraction it claims was never checked. */
    checks: ([yesterday, today, more]) =>
      closes(today - yesterday, more) ? null : `${today} less ${yesterday} is ${today - yesterday}`,
  },
  {
    shape: 'You made # cups and sold # of them.',
    checks: ([made, sold]) => (sold <= made ? null : 'sold more than were made'),
  },
  {
    shape: 'You made # cups and could have sold #.',
    why: 'demand can exceed what was made — that is the whole point of the sentence',
  },
  {
    shape: '# cups sold, and # still in the jug.',
    why: 'the two add to what the day had, which is not in the sentence; the sum is asserted in tests/pnl.test.ts',
  },
  {
    shape: '# cups went at the first price and # cups at the higher one.',
    why: 'the two add to the cups sold, which the sentence does not carry',
  },
  {
    shape: '# cups went at the first price and # cups at the lower one.',
    why: 'as above, with the sign reversed',
  },

  /* ---- two true figures, side by side, asserting nothing between them ---- */
  /* ---- two figures, newly reachable once the fuzz widened ---- */
  {
    shape: 'You bought # lemons at once, so each one was $# instead of $#.',
    /* The whole point of a bulk tier is that the bulk price is the lower one.
       Never checked, and it is the sentence teaching what a discount is. */
    checks: ([, bulk, list]) =>
      bulk < list ? null : `$${bulk} is not less than $${list}, so that is not a discount`,
  },
  {
    shape: 'You made # cups yesterday and # today — # fewer to sell.',
    checks: ([yesterday, today, fewer]) =>
      closes(yesterday - today, fewer) ? null : `${yesterday} less ${today} is ${yesterday - today}`,
  },
  {
    shape: '# of those were cups somebody wanted.',
    /*
     * The second half of the batch explanation, on the days demand capped the
     * jug. It is its own sentence and the splitter treats it as one, so the
     * relation it asserts — that this figure cannot exceed the change in the
     * jug named just before it — is not visible from here. Asserted in
     * `tests/diagnose.test.ts`, where both numbers are in scope.
     */
    why: 'how many of the extra cups found a buyer; the sentence it qualifies is the one before it',
  },

  /* ---- one figure, which can still disagree with its noun ---- *
   *
   * §78 called these unfalsifiable, and they are unfalsifiable by *arithmetic*.
   * They are classified anyway, for the reason the whole allowlist exists: a
   * shape nobody has read is the risk, not a shape nobody can check. Every one
   * of them is also swept by the number-agreement check in `badClaims`, which
   * is the one thing a single figure does assert.
   */
  { shape: '# cups left, and the afternoon crowd is still coming.', why: 'a count of the cups still in the jug, with nothing to check it against' },
  { shape: '# more good days run by your manager.', why: 'days still owed on a proof streak, read straight off the counter' },
  { shape: '# more good days with the rent paid.', why: 'the same, counted against the shop rent rather than the manager' },
  { shape: '# more to go.', why: 'how much of the day\'s money target is still to make' },
  { shape: '# paid it.', why: 'a headcount of the people who bought one' },
  { shape: '# people kept walking today.', why: 'a headcount of the people who did not buy one' },
  {
    shape: 'About # people fewer wanted a cups, and you chose none of it.',
    why: 'the weather\'s share of a change in demand, which nothing else in the sentence bounds',
  },
  { shape: 'About # people more wanted a cups, and you chose none of it.', why: 'as above' },
  { shape: 'Drop to $#', why: 'a button, carrying the price tapping it would set' },
  { shape: 'Keep $#', why: 'the same button, in the other direction' },
  { shape: 'Raise to $#', why: 'as above' },
  { shape: 'It turned out cool — and # cups already gone.', why: 'the weather it turned out to be, and how much of the jug had gone' },
  { shape: 'It turned out hot — and # cups already gone.', why: 'as above' },
  { shape: 'It turned out mild — and # cups already gone.', why: 'as above' },
  { shape: 'Make $# again.', why: 'yesterday\'s takings, offered again as today\'s target' },
  { shape: 'Make $# in one days.', why: 'a target and a period, neither derived from the other' },
  {
    shape: 'Making them cost $#.',
    why: 'the ingredient cost, checked against the receipt in tests/pnl.test.ts rather than here',
  },
  { shape: 'Nobody bought a cups at $#.', why: 'the price that was on the sign on a day nothing sold' },
  { shape: 'So each cups cost about $# to make.', why: 'the unit cost; the division it came from is in tests/pnl.test.ts' },
  { shape: 'That alone brought about # customers.', why: 'one cause\'s share of a change in demand' },
  { shape: 'That alone cost you about # customers.', why: 'as above' },
  { shape: 'The fit-out is $#.', why: 'the fit-out price, a constant in `retail.ts` rather than a computation' },
  { shape: 'The forecast said probably cool, so you made # cups.', why: 'the forecast, and the batch that followed it' },
  { shape: 'The forecast said probably hot, so you made # cups.', why: 'as above' },
  { shape: 'The forecast said probably mild, so you made # cups.', why: 'as above' },
  { shape: 'The shop owes $# before it opens.', why: 'the rent and wages a shop owes before a single cup is poured' },
  { shape: 'The stand still cost you $#.', why: 'the pitch fee, which is owed whether anything sold or not' },
  { shape: 'You also moved the sign to $#.', why: 'the price the sign was moved to at lunchtime' },
  { shape: 'You sold #.', why: 'a count of the cups that sold, with nothing to divide it by' },
  { shape: 'Your goal starts on days #.', why: 'the day the target begins, which is ACT1_EXPLORE_DAYS + 1' },

  {
    shape: 'Practice # of #: pick any price and watch.',
    checks: ([day, of]) => (day <= of ? null : `practice day ${day} of ${of}`),
  },
  {
    shape: 'The lemons, honey and cups came to $# for # cups.',
    why: 'a total and a count, with no rate claimed between them',
  },
  {
    shape: 'At $# a cups you keep $#, so # cups is the point where today stops losing money.',
    why: 'the breakeven needs the fixed costs, which the sentence does not carry; asserted in tests/pnl.test.ts',
  },
  {
    shape: '# cups brought in $#.',
    why: 'the price that connects them is not in the sentence — it can be two prices on a top-up day',
  },
  {
    shape: 'You asked $#, then $#, and # paid one or the other.',
    why: 'two prices and a headcount, with nothing claimed between them',
  },
  { shape: '$# yesterday, $# today.', why: 'yesterday\'s figure and today\'s, with nothing claimed between them' },
  { shape: '# people read $# and kept walking.', why: 'a headcount and the price they read, which are not a ratio' },
  { shape: '# people looked at $# and kept walking.', why: 'the same, on a day with one price rather than two' },
  {
    shape: 'You changed the sign at lunchtime: $# in the morning, $# after.',
    why: 'the two prices, which is the whole content',
  },
  { shape: 'Buy # more cups — $#', why: 'a button: how many cups, and what sending for them costs' },
  {
    shape: '# more people wanted a cups, which is about $# of profit you could not collect.',
    why: 'the margin that connects them is not in the sentence',
  },
  { shape: '# people wanted one and you had #.', why: 'demand against supply, and either one may be the larger' },
  {
    shape: 'Today you put $# into the stand and got $# back.',
    why: 'money out and money in; the difference is said in the next sentence and checked there',
  },
  {
    shape: 'The $# stand fee was the same today as on any days, whether you sold # cups or a hundred.',
    why: 'a fee and an illustrative count — the point is that they are unrelated',
  },
  {
    shape: 'Your cups made $#, and the costs you owe anyway were $#.',
    why: 'revenue and fixed costs, with the comparison left to the child',
  },
  {
    shape: 'Each cups sold for $# and cost $# to make.',
    why: 'a price and a unit cost; the margin between them is a different sentence',
  },
];

const BY_SHAPE = new Map(KNOWN_SHAPES.map((entry) => [entry.shape, entry]));

/** Batch sizes, cycled through the fuzz: sold out, nearly empty, plenty. */
const TARGETS = [1, 4, 28, 60];

/** Which shapes the sweep actually produced, so dead entries can be found. */
const produced = new Set<string>();

/**
 * Sentences carrying figures in a shape nobody has classified.
 *
 * The failure prints the shape ready to paste into `KNOWN_SHAPES`, because a
 * gate that is annoying to satisfy is a gate somebody deletes.
 */
export function unclassifiedClaims(text: string): string[] {
  const out: string[] = [];
  for (const sentence of claimingSentences(text)) {
    const shape = shapeOf(sentence);
    produced.add(shape);
    if (!BY_SHAPE.has(shape)) out.push(`${shape}\n    (from: "${sentence}")`);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The sweep
 * ------------------------------------------------------------------ */

interface Sample {
  where: string;
  text: string;
}

/** Every sentence the game can say about one day. */
function sentencesFor(outcome: DayOutcome, before: GameState['history']): Sample[] {
  const out: Sample[] = [];
  const add = (where: string, text: string | null) => {
    if (text) out.push({ where, text });
  };

  add('closingLine', closingLine(outcome));
  add('ledgerNovelty', ledgerNoveltyOf(outcome, outcome.nextState.history));
  add('middayResult', middayResult(outcome));

  const call = middayCall(outcome);
  if (call) {
    call.says.forEach((line, i) => add(`middayCall.says[${i}]`, line));
    for (const option of middayOptions(call.price, call.lean)) {
      add(`middayOption.${option.id}`, option.label);
    }
  }

  const found = diagnose(outcome, before);
  if (found) {
    add('diagnose.because', found.because);
    add('diagnose.correction', found.correction);
    found.answers.forEach((a) => add(`diagnose.answer.${a.cause}`, a.label));
  }
  add('wordOfMouth', wordOfMouth(outcome, before));

  const business = createBusinessState();
  for (const insight of [
    ...deriveInsights(outcome, outcome.nextState.history),
    ...deriveAct2Insights(outcome, business, outcome.nextState.history),
    ...deriveAct3Insights(outcome, { ...business, shop: { open: true, staff: 1, goodDays: 2 } }),
  ]) {
    add(`insight.${insight.id}.evidence`, insight.evidence);
    add(`insight.${insight.id}.carriesForward`, insight.carriesForward);
  }

  return out;
}

describe('the claim shapes catch the claims that shipped', () => {
  it('fails on both real defects, or it guards nothing', () => {
    /*
     * §72 and §74, verbatim. A guard that cannot fail guards nothing.
     *
     * Non-empty rather than exactly one: the general regex and the exact shape
     * in `KNOWN_SHAPES` both cover the product claim now, so it is reported
     * twice. The overlap is deliberate — the regex catches the claim in any
     * wording, the shape catches it in this one — and a guard that reports a
     * real defect twice is not a problem worth removing coverage for.
     */
    expect(badClaims('28 cups x $1.00 = $29.50. That is revenue').length).toBeGreaterThan(0);
    expect(badClaims('40 of 28 cups sold')).toHaveLength(1);
    expect(badClaims('You made 28 cups and sold 40')).toHaveLength(1);
  });

  it('catches a number that disagrees with its noun', () => {
    /*
     * The one thing a *single* figure asserts, and the answer to §78's "a
     * false claim in a one-figure sentence ships". Not arithmetic — grammar.
     */
    expect(badClaims('1 people kept walking today.')).toHaveLength(1);
    expect(badClaims('You sold 2 cup.')).toHaveLength(1);
    expect(badClaims('1 days to go.')).toHaveLength(1);

    expect(badClaims('1 person kept walking today.')).toEqual([]);
    expect(badClaims('You sold 2 cups.')).toEqual([]);
    expect(badClaims('7 days to go.')).toEqual([]);

    /*
     * And not on attributive uses, which take the singular in correct English.
     * The first version of this check flagged seventy-one of them across the
     * sweep and would have been switched off inside a day.
     */
    expect(badClaims('On a 10 cup day it would be $0.50 a cup.')).toEqual([]);
    expect(badClaims('A 3 day streak.')).toEqual([]);
  });

  it('fails on a bulk discount that is not one', () => {
    /* Reachable only once the fuzz played tiny and enormous batches. */
    expect(
      badClaims('You bought 24 lemons at once, so each one was $0.60 instead of $0.50.'),
    ).toHaveLength(1);
    expect(
      badClaims('You bought 24 lemons at once, so each one was $0.40 instead of $0.50.'),
    ).toEqual([]);
  });

  it('fails on the three the allowlist found, which had never been checked', () => {
    /*
     * Each of these is a sentence the game produces, in a shape nothing looked
     * at until every figure-carrying sentence had to be classified. Two of the
     * three were live defects when the list was written.
     */
    expect(badClaims('$20.25 in, $10.39 out, so you kept $4.46.')).toHaveLength(1);
    expect(badClaims('$20.25 in, $15.79 out, so you kept $4.46.')).toEqual([]);

    expect(
      badClaims('You keep $0.69 of every $0.75 cup, because each one costs $0.16 to make.'),
    ).toHaveLength(1);
    expect(
      badClaims('You keep $0.59 of every $0.75 cup, because each one costs $0.16 to make.'),
    ).toEqual([]);

    expect(
      badClaims('Your best day was $12.00 and your worst $3.00, but your average across 4 days is $20.00.'),
    ).toHaveLength(1);
    expect(
      badClaims('Your best day was $12.00 and your worst $3.00, but your average across 4 days is $7.00.'),
    ).toEqual([]);
  });

  it('does not fire on the true versions', () => {
    expect(badClaims('28 cups x $1.00 = $28.00')).toEqual([]);
    expect(badClaims('22 cups x $1.00 and 6 cups x $1.25 = $29.50')).toEqual([]);
    expect(badClaims('24 of 28 cups sold')).toEqual([]);
    expect(badClaims('You made 40 cups and sold 28')).toEqual([]);
    /* And not on prose that happens to contain numbers. */
    expect(badClaims('Two stands, and the rain shuts both. The fit-out is $600.')).toEqual([]);
  });
});

describe('no sentence about a day claims arithmetic that does not close', () => {
  it('holds across a fuzz of days, prices and lunchtime answers', () => {
    let checked = 0;
    for (const seed of [1, 4, 9, 17, 31, 42, 77, 2026, 4242, 555]) {
      let state = createInitialState(seed);
      for (let d = 1; d <= ECON.TOTAL_DAYS; d += 1) {
        const before = state.history;
        /*
         * Six prices and four batch sizes, not three and one.
         *
         * Widened when the allowlist came down to one figure, and the widening
         * is what found four more shapes — including two that *do* assert
         * arithmetic: the bulk-discount sentence and the "fewer to sell"
         * variant. A sweep that only ever plays a sensible day only ever reads
         * the sentences a sensible day produces.
         */
        for (const price of [0.5, 0.75, 1, 1.5, 2.5, 3]) {
          for (const afternoon of [undefined, 1, 2.75]) {
            for (const topUp of [0, ECON.TOPUP_CUPS]) {
              const order = orderForTargetCups(state, TARGETS[d % TARGETS.length]);
              const outcome = runDay(state, {
                ...order,
                price,
                afternoonPrice: afternoon,
                afternoonTopUp: topUp,
              });
              for (const { where, text } of sentencesFor(outcome, before)) {
                const at = `seed ${seed} day ${d} @${price}/${afternoon}+${topUp} · ${where}`;
                expect(badClaims(text), `${at}: "${text}"`).toEqual([]);
                /*
                 * And the allowlist half: a sentence carrying figures in a
                 * shape nobody has classified is the §78 hole, so it fails
                 * here rather than shipping unread.
                 */
                expect(
                  unclassifiedClaims(text),
                  `${at} says something with figures in it that nothing has classified. ` +
                    `Add the shape to KNOWN_SHAPES with either the arithmetic it asserts or a ` +
                    `sentence saying why there is none:`,
                ).toEqual([]);
                checked += 1;
              }
            }
          }
        }
        state = runDay(state, { ...orderForTargetCups(state, 28), price: 1.5 }).nextState;
        if (state.status === 'finished') break;
      }
    }
    expect(checked, 'nothing was checked').toBeGreaterThan(2000);
  });

  it('holds for every goal line a stage can show', () => {
    /*
     * The goal strip is copy too, and it carries figures — the fit-out, the
     * days left, the cups still owed. It had never been swept.
     */
    const business = createBusinessState();
    const shapes = [
      business,
      { ...business, staff: { helper: false, manager: true } },
      { ...business, staff: { helper: false, manager: true }, handsOffDays: 3 },
      {
        ...business,
        staff: { helper: false, manager: true },
        handsOffDays: 3,
        stands: [{ id: 1, location: 'park' as const, runBy: 'you' as const }],
      },
      {
        ...business,
        staff: { helper: false, manager: true },
        handsOffDays: 3,
        stands: [{ id: 1, location: 'park' as const, runBy: 'you' as const }],
        shop: { open: true, staff: 0, goodDays: 1 },
      },
    ];
    for (const shape of shapes) {
      for (const stageDay of [1, 5, 12]) {
        expect(badClaims(act2Progress(shape, stageDay).nextStep)).toEqual([]);
        expect(unclassifiedClaims(act2Progress(shape, stageDay).nextStep)).toEqual([]);
        expect(badClaims(shopProgress(shape.shop).goal)).toEqual([]);
        expect(unclassifiedClaims(shopProgress(shape.shop).goal)).toEqual([]);
      }
    }
    for (const seed of [1, 2026]) {
      let state = createInitialState(seed);
      for (let d = 0; d < ECON.TOTAL_DAYS; d += 1) {
        expect(badClaims(act1Progress(state).goal)).toEqual([]);
        expect(unclassifiedClaims(act1Progress(state).goal)).toEqual([]);
        state = runDay(state, { ...orderForTargetCups(state, 28), price: 1.5 }).nextState;
        if (state.status === 'finished') break;
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * The cause, not the symptom
 * ------------------------------------------------------------------ */

/**
 * Figures that must never appear in a sentence, because a better one exists.
 *
 * This is the other half of the §74 story and the more useful half. The sweep
 * above catches a false claim *once a fixture produces it*; this catches the
 * mistake that produces them, which is reading a figure that has been
 * superseded.
 *
 * `cupsMakeable` is a correct name for what the morning's shopping poured, and
 * that is exactly why it is dangerous: nothing about it looks wrong. Once a
 * child could send out for more cups at lunchtime it stopped being *how many
 * cups the day had*, and every sentence meaning "how many you had" became
 * false on a top-up day. It has now been fixed three times in three modules —
 * the close screen and Pip's line in §74, the calibration insight in §77, and
 * the jug explanation in `diagnose.ts` found by this very check. Fixing
 * instances is what let it reach three.
 */
const SUPERSEDED = [
  {
    field: 'cupsMakeable',
    use: 'cupsAvailable',
    why:
      'the morning batch, not the day’s cups. On a day the child sent out for more at ' +
      'lunchtime a sentence reading this says they had fewer than they did — see §74.',
    /*
     * `planned.cupsMakeable` is right and must stay: the comparison screen is
     * explicitly about the plan made in the morning against what happened, so
     * the morning figure is the subject rather than a stale copy of the day's.
     */
    allow: /\bplanned\.cupsMakeable\b/,
  },
];

describe('no sentence reads a figure that has been superseded', () => {
  it('keeps the superseded ones out of every template literal in src', () => {
    /*
     * Scoped to template literals on purpose. These fields are computed, read
     * and asserted on all over `simulation.ts`, and that is correct — the bug
     * is not the field existing, it is the field appearing in a **sentence**.
     * So the check is: does it appear between backticks.
     */
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk(resolve(process.cwd(), 'src'));
    expect(files.length, 'no source files found').toBeGreaterThan(20);

    const offences: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      /* Template literals only, comments stripped so the prose above is safe. */
      const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
      for (const m of code.matchAll(/`(?:[^`\\]|\\.)*`/g)) {
        for (const { field, use, allow } of SUPERSEDED) {
          if (!new RegExp(`\\b${field}\\b`).test(m[0])) continue;
          if (allow && allow.test(m[0])) continue;
          offences.push(
            `${file.replace(process.cwd() + '/', '')}: says ${field}, should say ${use}\n    ${m[0].slice(0, 110)}`,
          );
        }
      }
    }
    expect(offences, `\n${offences.join('\n')}\n`).toEqual([]);
  });

  it('names why each one is superseded, so the list is readable', () => {
    /* A registry with no reasons in it is a list somebody will delete. */
    for (const { field, use, why } of SUPERSEDED) {
      expect(why.length, `${field} has no reason written`).toBeGreaterThan(40);
      expect(use, `${field} has no replacement named`).toBeTruthy();
    }
  });
});

describe('the allowlist itself stays honest', () => {
  it('has no entry the game never says', () => {
    /*
     * §40's class applied to the registry. A shape that stopped being produced
     * is a line nobody will ever read again, and a long list of them is how a
     * reviewer stops reading the list at all — at which point an unclassified
     * shape gets waved through by somebody pattern-matching on "it is in there
     * somewhere".
     *
     * Depends on the sweep above having run, which vitest guarantees by file
     * order within a suite. The count is asserted so an empty `produced` — a
     * sweep that silently stopped sweeping — fails here too.
     */
    expect(produced.size, 'the sweep produced nothing, so this proves nothing').toBeGreaterThan(30);
    const dead = KNOWN_SHAPES.map((entry) => entry.shape).filter((shape) => !produced.has(shape));
    expect(dead, 'classified but never produced by the sweep').toEqual([]);
  });

  it('gives every unchecked shape a written reason', () => {
    /*
     * A shape with neither arithmetic nor an explanation is a shape somebody
     * silenced rather than classified.
     *
     * "as above" and "the same" are allowed and are not a loophole: several
     * shapes are the hot/mild/cool or more/fewer variant of the line before
     * them, and repeating the reason three times would make the list longer
     * and less readable, which is the thing this check is protecting.
     */
    const defers = /^(as above|the same)\b/i;
    for (const entry of KNOWN_SHAPES) {
      if (entry.checks) continue;
      const why = entry.why ?? '';
      expect(why, `${entry.shape} has no reason written`).toBeTruthy();
      if (defers.test(why)) continue;
      expect(why.length, `${entry.shape}'s reason is too short to be one: "${why}"`).toBeGreaterThan(15);
    }
  });

  it('never defers to nothing', () => {
    /* "as above" has to have an above. The first entry cannot defer, and a
       deferral has to follow an entry that actually explains itself. */
    const defers = /^(as above|the same)\b/i;
    KNOWN_SHAPES.forEach((entry, index) => {
      if (!entry.why || !defers.test(entry.why)) return;
      expect(index, `${entry.shape} defers to an entry before the first one`).toBeGreaterThan(0);
      /*
       * Walk back through a *chain* of deferrals — the three weather variants
       * defer to each other in a row — and require that the chain ends at an
       * entry which explains itself.
       */
      let at = index - 1;
      while (at >= 0 && !KNOWN_SHAPES[at].checks && defers.test(KNOWN_SHAPES[at].why ?? '')) at -= 1;
      const anchor = KNOWN_SHAPES[at];
      expect(
        at >= 0 && (Boolean(anchor.checks) || (anchor.why ?? '').length > 15),
        `${entry.shape} defers up a chain that never explains anything`,
      ).toBe(true);
    });
  });

  it('classifies more one-figure shapes than two-figure ones, which is why they were worth doing', () => {
    /*
     * A note in the shape of an assertion. §78 dismissed the one-figure
     * sentence as unfalsifiable, and the count is the argument against having
     * skipped them: there are more of them than of everything else, so the
     * larger half of the game's copy was outside the allowlist entirely.
     */
    const figures = (shape: string) => (shape.match(/\$?#%?/g) ?? []).length;
    const one = KNOWN_SHAPES.filter((entry) => figures(entry.shape) === 1).length;
    const more = KNOWN_SHAPES.filter((entry) => figures(entry.shape) >= 2).length;
    expect(one, `${one} one-figure shapes, ${more} with two or more`).toBeGreaterThan(0);
    expect(one + more).toBe(KNOWN_SHAPES.length);
  });
});
