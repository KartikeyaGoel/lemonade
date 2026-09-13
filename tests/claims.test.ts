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

/** Sentences, split on terminators, that carry enough figures to make a claim. */
function claimingSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => (sentence.match(FIGURE) ?? []).length >= 2);
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
    checks: ([cups, cost, each, morning]) => {
      if (!divides(cost, cups, each)) return `$${cost} for ${cups} cups is $${(cost / cups).toFixed(2)} a cup`;
      return each > morning ? null : 'sending out at lunchtime is meant to cost more than the morning did';
    },
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
  { shape: '$# yesterday, $# today.', why: 'two figures from two days' },
  { shape: '# people read $# and kept walking.', why: 'a headcount and the price they read' },
  { shape: '# people looked at $# and kept walking.', why: 'as above' },
  {
    shape: 'You changed the sign at lunchtime: $# in the morning, $# after.',
    why: 'the two prices, which is the whole content',
  },
  { shape: 'Buy # more cups — $#', why: 'a button: a count and what it costs' },
  {
    shape: '# more people wanted a cups, which is about $# of profit you could not collect.',
    why: 'the margin that connects them is not in the sentence',
  },
  { shape: '# people wanted one and you had #.', why: 'demand against supply, and either may be larger' },
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
        for (const price of [0.75, 1.5, 2.5]) {
          for (const afternoon of [undefined, 1, 2.75]) {
            for (const topUp of [0, ECON.TOPUP_CUPS]) {
              const order = orderForTargetCups(state, 28);
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
