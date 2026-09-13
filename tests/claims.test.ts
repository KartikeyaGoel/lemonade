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
 * a fuzz of days rather than the one module a bug was last found in. When the
 * next shape of false claim turns up, it goes in `badClaims` and the whole
 * sweep gets it at once.
 *
 * `tests/midday.test.ts` has the narrower version of the product check, kept
 * because it is about the two-price day specifically. This is the general one.
 */
import { describe, expect, it } from 'vitest';
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

  return bad;
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
    /* §72 and §74, verbatim. A guard that cannot fail guards nothing. */
    expect(badClaims('28 cups x $1.00 = $29.50. That is revenue')).toHaveLength(1);
    expect(badClaims('40 of 28 cups sold')).toHaveLength(1);
    expect(badClaims('You made 28 cups and sold 40')).toHaveLength(1);
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
                const bad = badClaims(text);
                expect(bad, `seed ${seed} day ${d} @${price}/${afternoon}+${topUp} · ${where}: "${text}"`).toEqual([]);
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
        expect(badClaims(shopProgress(shape.shop).goal)).toEqual([]);
      }
    }
    for (const seed of [1, 2026]) {
      let state = createInitialState(seed);
      for (let d = 0; d < ECON.TOTAL_DAYS; d += 1) {
        expect(badClaims(act1Progress(state).goal)).toEqual([]);
        state = runDay(state, { ...orderForTargetCups(state, 28), price: 1.5 }).nextState;
        if (state.status === 'finished') break;
      }
    }
  });
});
