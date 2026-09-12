/**
 * One question at the end of a day, and the four ways it could be unfair.
 *
 * This is the first thing in the product that *marks a child right or wrong*,
 * so the bar is higher than for anything that only describes. Four properties:
 *
 *  1. **Answerable from the screen.** The right answer is decided by the two
 *     days' own figures, never by an opinion about them.
 *  2. **Every option reachable.** A distractor that can never be correct is
 *     unfair in both directions — a child who notices is right to stop
 *     considering it, and one who picks it is marked wrong about something that
 *     may well have happened.
 *  3. **The position is never the answer.** Same four, same order, always.
 *  4. **Silent when there is nothing to ask.** A question whose answer is
 *     arguable teaches a child to stop trusting the question.
 *
 * The first version failed (2) twice over. As a ranking by priority the weather
 * was never once the answer in 280 days; as a share of the day, price won 241
 * of 280, because a refusal rate is structurally about a half at any sensible
 * price. Both are recorded in `diagnose.ts`, and this file is what would catch
 * the third try.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAY_PARAMS,
  createInitialState,
  orderForTargetCups,
  runDay,
  type DayOutcome,
  type GameState,
  type LemonGrade,
} from '../src/lib/simulation';
import {
  WORTH_ASKING_CUPS,
  changesSince,
  diagnose,
  wordOfMouth,
  type Cause,
} from '../src/lib/diagnose';
import { demoGame } from '../src/lib/demo';
import { beginWeekend } from '../src/lib/progress';

const ONGOING = { ...DEFAULT_DAY_PARAMS, lastDay: null };

/** Play a day at these dials and hand back the outcome and the prior history. */
function play(
  state: GameState,
  price: number,
  cups: number,
  grade: LemonGrade = 'regular',
): { outcome: DayOutcome; before: GameState['history'] } {
  const before = state.history;
  const outcome = runDay(state, { ...orderForTargetCups(state, cups), price, grade }, ONGOING);
  return { outcome, before };
}

/** Two days in a row on one seed, with whatever changed between them. */
function twoDays(
  seed: number,
  one: { price: number; cups: number; grade?: LemonGrade },
  two: { price: number; cups: number; grade?: LemonGrade },
) {
  const first = play(createInitialState(seed), one.price, one.cups, one.grade ?? 'regular');
  const second = play(first.outcome.nextState, two.price, two.cups, two.grade ?? 'regular');
  return second;
}

describe('the question at the end of a day', () => {
  it('says nothing on the first day, because there is no yesterday', () => {
    const { outcome, before } = play(createInitialState(3), 1.5, 32);
    expect(before).toHaveLength(0);
    expect(diagnose(outcome, before)).toBeNull();
  });

  it('offers the same four in the same order, every time', () => {
    /*
     * Property 3. If the right answer moved around, a child could learn the
     * *position* instead of reading the day — and if the options were filtered
     * to the ones that happened, the set itself would give the answer away.
     */
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const { outcome, before } = twoDays(
        seed,
        { price: 1.2, cups: 28 },
        { price: 1.8, cups: 36, grade: 'organic' },
      );
      const found = diagnose(outcome, before);
      if (!found) continue;
      seen.add(found.answers.map((a) => a.cause).join(','));
      expect(found.answers).toHaveLength(4);
      expect(found.answers.some((a) => a.cause === found.cause)).toBe(true);
    }
    expect(seen.size, 'the options were not in a fixed order').toBe(1);
    expect([...seen][0]).toBe('price,batch,quality,weather');
  });

  it('can be answered by each of the four, so no option is a free elimination', () => {
    /*
     * Property 2, and the one both earlier versions failed. Each case changes
     * one thing on purpose and holds the rest, which is exactly the experiment
     * `bench.ts` wants a child doing.
     */
    const found = new Set<Cause>();

    for (let seed = 1; seed <= 60; seed++) {
      // Only the sign moved.
      const sign = twoDays(seed, { price: 1.0, cups: 32 }, { price: 2.4, cups: 32 });
      const a = diagnose(sign.outcome, sign.before);
      if (a) found.add(a.cause);

      // Only the jug moved.
      const jug = twoDays(seed, { price: 1.5, cups: 16 }, { price: 1.5, cups: 48 });
      const b = diagnose(jug.outcome, jug.before);
      if (b) found.add(b.cause);

      // Only the recipe moved.
      const recipe = twoDays(
        seed,
        { price: 1.5, cups: 32, grade: 'value' },
        { price: 1.5, cups: 32, grade: 'organic' },
      );
      const c = diagnose(recipe.outcome, recipe.before);
      if (c) found.add(c.cause);

      // Nothing the child controls moved, so anything left is the sky.
      const sky = twoDays(seed, { price: 1.5, cups: 32 }, { price: 1.5, cups: 32 });
      const d = diagnose(sky.outcome, sky.before);
      if (d) found.add(d.cause);
    }

    for (const cause of ['price', 'batch', 'quality', 'weather'] as Cause[]) {
      expect(found.has(cause), `${cause} can never be the answer`).toBe(true);
    }
  });

  it('names the thing the child actually changed, when they changed only one', () => {
    /*
     * Property 1, at its sharpest. Holding the price and the recipe and moving
     * the jug by two dozen cups must not be attributed to the weather.
     */
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const jug = twoDays(seed, { price: 1.5, cups: 16 }, { price: 1.5, cups: 48 });
      const moved = changesSince(jug.outcome, jug.before[jug.before.length - 1]);
      // The jug really did move more than the sky on this pair.
      if (Math.abs(moved.batch) <= Math.abs(moved.weather)) continue;
      expect(diagnose(jug.outcome, jug.before)!.cause, `seed ${seed}`).toBe('batch');
      checked++;
    }
    expect(checked, 'no pair actually isolated the jug').toBeGreaterThan(10);
  });

  it('attributes nothing to a dial that did not move', () => {
    /*
     * The decomposition is exact rather than a ranking, so a price that stayed
     * put contributes exactly zero — not "a small amount". If this ever drifts,
     * a child who held their price would be told the sign decided the day.
     */
    for (let seed = 1; seed <= 20; seed++) {
      const same = twoDays(seed, { price: 1.5, cups: 32 }, { price: 1.5, cups: 32 });
      const moved = changesSince(same.outcome, same.before[same.before.length - 1]);
      expect(moved.price, `seed ${seed}: price`).toBe(0);
      expect(moved.quality, `seed ${seed}: recipe`).toBe(0);
    }
  });

  it('stays quiet when the two days were really the same day', () => {
    /*
     * Property 4. Same dials, same weather — nothing to attribute, and a
     * question with no answer is worse than no question.
     */
    let quiet = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const same = twoDays(seed, { price: 1.5, cups: 32 }, { price: 1.5, cups: 32 });
      const moved = changesSince(same.outcome, same.before[same.before.length - 1]);
      const biggest = Math.max(...Object.values(moved).map(Math.abs));
      if (biggest >= WORTH_ASKING_CUPS) continue;
      expect(diagnose(same.outcome, same.before), `seed ${seed}`).toBeNull();
      quiet++;
    }
    expect(quiet, 'no two days were ever alike enough to test this').toBeGreaterThan(0);
  });

  it('carries both days’ profit, which is what they asked for', () => {
    /*
     * "Most kids who played the game, asked laksh how much money he made in day
     * 1 and day 2 — so a compare option might be great." They invented it; this
     * is it, on the screen where the second number arrives.
     */
    const { outcome, before } = twoDays(7, { price: 1.2, cups: 28 }, { price: 1.8, cups: 36 });
    const found = diagnose(outcome, before)!;
    expect(found.yesterdayProfit).toBe(before[before.length - 1].profit);
    expect(found.todayProfit).toBe(outcome.profit);
  });

  it('never tells the child what to do about it', () => {
    /*
     * `guide.ts`'s rule. A diagnosis is the easiest place in the product to
     * slip into advice, because the fix is usually obvious from the figure —
     * and a child who is told the fix has learned to follow instructions.
     */
    const advice = /\b(you should|try|raise|lower|charge more|charge less|make more|next time)\b/i;
    for (let seed = 1; seed <= 30; seed++) {
      for (const pair of [
        [{ price: 1.0, cups: 32 }, { price: 2.4, cups: 32 }],
        [{ price: 1.5, cups: 16 }, { price: 1.5, cups: 48 }],
        [
          { price: 1.5, cups: 32, grade: 'value' as LemonGrade },
          { price: 1.5, cups: 32, grade: 'organic' as LemonGrade },
        ],
      ] as const) {
        const { outcome, before } = twoDays(seed, pair[0], pair[1]);
        const found = diagnose(outcome, before);
        if (!found) continue;
        expect(found.because, `seed ${seed} · ${found.cause}`).not.toMatch(advice);
        expect(found.correction, `seed ${seed} · ${found.cause}`).not.toMatch(advice);
        for (const answer of found.answers) expect(answer.label).not.toMatch(advice);
      }
    }
  });
});

describe('word of mouth, made visible at last', () => {
  it('says nothing on the ordinary lemon', () => {
    const { outcome, before } = play(createInitialState(5), 1.5, 32, 'regular');
    expect(wordOfMouth(outcome, before)).toBeNull();
  });

  it('names the cups the recipe moved, in both directions', () => {
    /*
     * The pilot: "I could not tell easily that choosing good lemons will make
     * less people come back." The mechanic has been in the simulation since
     * §15 and its effect had never appeared on a screen.
     */
    const posh = play(createInitialState(5), 1.5, 40, 'organic');
    expect(wordOfMouth(posh.outcome, posh.before)).toMatch(/brought about \d+ extra/);

    const cheap = play(createInitialState(5), 1.5, 40, 'value');
    expect(wordOfMouth(cheap.outcome, cheap.before)).toMatch(/cost you about \d+ customer/);
  });

  it('mentions yesterday only when yesterday was a different kind', () => {
    /*
     * `gradeDemandFactor` averages today's recipe with yesterday's, which is
     * the whole reason it is word of mouth rather than a price list. Saying so
     * on a day that used the same lemons twice would claim a subtlety that did
     * not happen.
     */
    const switched = twoDays(
      9,
      { price: 1.5, cups: 40, grade: 'value' },
      { price: 1.5, cups: 40, grade: 'organic' },
    );
    expect(wordOfMouth(switched.outcome, switched.before)).toMatch(/Yesterday/);

    const held = twoDays(
      9,
      { price: 1.5, cups: 40, grade: 'organic' },
      { price: 1.5, cups: 40, grade: 'organic' },
    );
    expect(wordOfMouth(held.outcome, held.before)).not.toMatch(/Yesterday/);
  });

  it('is shown far more often than it is ever the answer', () => {
    /*
     * The reason it is a sentence and not a quiz option. Measured: the recipe
     * moves demand by at most a quarter and usually an eighth, while the price
     * can move it by everything — so a child who only met the recipe as a
     * question would almost never meet it.
     */
    let said = 0;
    let wasTheAnswer = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let state = createInitialState(seed);
      for (let day = 1; day <= 6; day++) {
        const grade: LemonGrade = day % 2 === 0 ? 'organic' : 'value';
        const { outcome, before } = play(state, 1.0 + (day % 3) * 0.4, 24 + day * 3, grade);
        if (wordOfMouth(outcome, before)) said++;
        if (diagnose(outcome, before)?.cause === 'quality') wasTheAnswer++;
        state = outcome.nextState;
      }
    }
    expect(said, 'the recipe never showed its effect').toBeGreaterThan(50);
    expect(said).toBeGreaterThan(wasTheAnswer * 2);
  });
});

/*
 * The two kinds of day where the question is about nothing.
 *
 * Both found by opening paths I had not opened rather than by a test failing,
 * which is why they are pinned here now. Neither is exotic: one is the reward
 * for hiring a manager and the other is every Saturday in the market.
 */
describe('days that must not be compared', () => {
  it('would say something absurd about the Saturday stand, so nothing asks', () => {
    /*
     * The Saturday stand is a folding table out of an investment account, and
     * `beginWeekend` keeps the stand's history — so "yesterday" is the last day
     * of the shop the child *sold*. Probed: 84 cups yesterday against 24
     * today, and the question attributed sixty cups to the jug.
     *
     * The suppression lives at the call site because only the caller knows
     * which kind of day it is; this test's job is to show why, by proving the
     * comparison really is nonsense when it happens.
     */
    const game = demoGame(5);
    const weekend = beginWeekend(game);
    const last = weekend.stand.history[weekend.stand.history.length - 1];
    expect(last, 'the market save had no stand history to trip over').toBeTruthy();

    const outcome = runDay(
      weekend.stand,
      { ...orderForTargetCups(weekend.stand, 24), price: 1.5 },
      { ...DEFAULT_DAY_PARAMS, lastDay: null, cashFloor: null },
    );

    // The shop day it is being held against really is a different business.
    expect(last!.cupsMade ?? last!.cupsSold).toBeGreaterThan(outcome.cupsMakeable * 2);

    // So the raw comparison blames the jug for the sale of a company.
    const found = diagnose(outcome, weekend.stand.history);
    expect(found?.cause).toBe('batch');
    expect(found!.because).toMatch(/fewer to sell/);
  });

  it('is silent on a day the child did not price', () => {
    /*
     * A manager-run day. There is no `diagnose` flag for it — the screen is
     * told not to ask — so what this holds is the *reason*: the dials that
     * moved were not the child's, and `changesSince` would still happily
     * attribute them.
     */
    const state = createInitialState(11);
    const first = play(state, 1.2, 28);
    const managerPriced = play(first.outcome.nextState, 2.2, 44);
    const moved = changesSince(
      managerPriced.outcome,
      managerPriced.before[managerPriced.before.length - 1],
    );
    // Both of the child's levers appear to have moved, and neither did.
    expect(Math.abs(moved.price)).toBeGreaterThan(WORTH_ASKING_CUPS);
    expect(Math.abs(moved.batch)).toBeGreaterThan(WORTH_ASKING_CUPS);
  });
});
