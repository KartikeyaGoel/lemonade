/**
 * Stage 1, against the specification in FRAMEWORK.md §1.
 *
 * §14 audited the build against that table and found six rows with no
 * mechanic behind them. This file is what those six rows became, asserted as
 * the properties the table actually states rather than as the numbers they
 * currently produce — a tuning pass should be free to move $25, and must not
 * be free to make the goal unreachable.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DAY_PARAMS,
  DEFAULT_GRADE,
  ECON,
  GRADE_ORDER,
  batchPlan,
  bulkDiscountFor,
  gradeDemandFactor,
  ingredientCostOf,
  lemonUnitCost,
  purchaseCost,
  round2,
  runDay,
  type GameState,
  type LemonGrade,
} from '../src/lib/simulation';
import { act1Complete, act1Progress, createGame } from '../src/lib/progress';

const params = { ...DEFAULT_DAY_PARAMS, lastDay: null };

/** Plays a week at one strategy and hands back every day. */
function week(price: number, grade: LemonGrade, cups = 40, seed = 7) {
  let state: GameState = createGame(seed).stand;
  const days = [];
  for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
    const plan = batchPlan(state, cups, grade);
    const outcome = runDay(state, { ...plan.order, price, grade }, params);
    days.push(outcome);
    state = outcome.nextState;
  }
  return { days, state };
}

describe('Lever 1 — the product costs money and changes demand', () => {
  it('charges more for a better lemon and less for a worse one', () => {
    const cheap = lemonUnitCost('value');
    const normal = lemonUnitCost('regular');
    const posh = lemonUnitCost('organic');
    expect(cheap).toBeLessThan(normal);
    expect(posh).toBeGreaterThan(normal);
  });

  it('leaves the normal lemon at exactly the old price', () => {
    /*
     * The safety property for every arithmetic identity written before grades
     * existed. `regular` is 1.0 on both axes, so a caller that does not choose
     * gets the economy a child met before this lever was built — to the cent.
     */
    expect(lemonUnitCost('regular')).toBe(ECON.LEMON_COST);
    expect(lemonUnitCost()).toBe(ECON.LEMON_COST);
    expect(gradeDemandFactor('regular')).toBe(1);
    expect(gradeDemandFactor()).toBe(1);
    expect(DEFAULT_GRADE).toBe('regular');
  });

  it('makes more people want a cup when the lemon is better', () => {
    expect(gradeDemandFactor('organic')).toBeGreaterThan(gradeDemandFactor('regular'));
    expect(gradeDemandFactor('value')).toBeLessThan(gradeDemandFactor('regular'));
  });

  it('is a real trade rather than a free win at every price', () => {
    /*
     * The row says "highest price or lowest cost isn't automatically best". So
     * neither end of the lever may dominate: there has to be a price where
     * posh wins and a price where it loses, or the decision is a formality.
     */
    const bestAt = (price: number) => {
      const scores = GRADE_ORDER.map((grade) => ({
        grade,
        profit: week(price, grade).days.reduce((sum, day) => sum + day.profit, 0),
      }));
      return scores.sort((a, b) => b.profit - a.profit)[0].grade;
    };

    const winners = new Set([bestAt(0.75), bestAt(1.5), bestAt(2), bestAt(2.5)]);
    expect(
      winners.size,
      `the same grade won at every price: ${[...winners].join(', ')}`,
    ).toBeGreaterThan(1);
  });

  it('lets a bad recipe lose money that a good one makes', () => {
    // Cheap lemons at a dear price: the combination the row warns about.
    const bad = week(2.5, 'value').days.reduce((sum, day) => sum + day.profit, 0);
    const good = week(2, 'organic').days.reduce((sum, day) => sum + day.profit, 0);
    expect(good).toBeGreaterThan(bad);
  });
});

describe('the quality effect carries into the next day', () => {
  it('remembers yesterday, so cheapening the recipe bites late', () => {
    /*
     * "Lower quality can reduce demand over time." Switching to the cheap
     * lemon today is judged half on today and half on yesterday, so the first
     * day after a switch is only partly punished and the second is fully.
     */
    const history = [{ grade: 'organic' as LemonGrade }] as never;
    const justSwitched = gradeDemandFactor('value', history);
    const settled = gradeDemandFactor('value', [{ grade: 'value' }] as never);
    expect(justSwitched).toBeGreaterThan(settled);
  });

  it('judges the first day on the first day’s own choice', () => {
    /*
     * Day one has nothing to remember. Blending against a default would mean
     * a child's opening day was scored partly on a decision they never made.
     */
    for (const grade of GRADE_ORDER) {
      expect(gradeDemandFactor(grade, [])).toBe(ECON.LEMON_GRADES[grade].demandFactor);
    }
  });
});

describe('Bulk — buying more makes each one cheaper', () => {
  it('lowers the price per lemon at a bigger order', () => {
    const small = lemonUnitCost('regular', 4);
    const dozen = lemonUnitCost('regular', 12);
    const twoDozen = lemonUnitCost('regular', 24);
    expect(dozen).toBeLessThan(small);
    expect(twoDozen).toBeLessThan(dozen);
  });

  it('gives no discount below the first tier', () => {
    expect(bulkDiscountFor(0)).toBe(0);
    expect(bulkDiscountFor(11)).toBe(0);
    expect(bulkDiscountFor(12)).toBeGreaterThan(0);
  });

  it('costs more in total even though each one is cheaper', () => {
    /*
     * "...but requires more spending upfront." Both halves have to be true or
     * the lesson is just a discount.
     */
    const few = purchaseCost({ buyLemons: 8, buySugarPacks: 0, buyCupPacks: 0 });
    const many = purchaseCost({ buyLemons: 24, buySugarPacks: 0, buyCupPacks: 0 });
    expect(many.perLemon).toBeLessThan(few.perLemon);
    expect(many.total).toBeGreaterThan(few.total);
  });

  it('is punished by spoilage if the lemons are not used', () => {
    /*
     * The counterweight that stops "always buy two dozen" being correct. A
     * lemon lasts three days, and one bought for the discount and left in the
     * crate is a loss at the price actually paid for it.
     */
    let state: GameState = createGame(3).stand;
    let sawSpoilage = false;
    for (let day = 0; day < 5; day++) {
      // Buy far more than a cold day at a dear price could ever sell.
      const plan = batchPlan(state, 90, 'regular');
      const outcome = runDay(state, { ...plan.order, price: 3, grade: 'regular' }, params);
      if (outcome.spoiledLemons > 0) {
        sawSpoilage = true;
        expect(outcome.spoilageCost).toBeGreaterThan(0);
      }
      state = outcome.nextState;
    }
    expect(sawSpoilage, 'over-buying never cost anything').toBe(true);
  });
});

describe('the receipt still reconciles, at every grade', () => {
  it('costs the cups it sold at what those lemons actually cost', () => {
    /*
     * PRODUCT.md §4: any two figures shown together must reconcile with the
     * third on paper. Cost of goods sold used to be a count times a constant;
     * with grades and bulk it is what the pantry actually paid, oldest first.
     */
    for (const grade of GRADE_ORDER) {
      for (const day of week(1.5, grade).days) {
        expect(day.ingredients.total).toBe(
          round2(day.ingredients.lemons + day.ingredients.sugar + day.ingredients.cups),
        );
        if (day.cupsSold > 0) {
          expect(day.ingredients.perCup).toBeCloseTo(day.ingredients.total / day.cupsSold, 6);
        }
      }
    }
  });

  it('never pours a lemon it did not pay for', () => {
    for (const grade of GRADE_ORDER) {
      for (const day of week(1.5, grade).days) {
        expect(day.ingredients.lemons).toBeGreaterThanOrEqual(0);
        // Every lemon costed at or under the plain list price only when a
        // discount or a cheaper grade earned it — never by accident.
        if (day.ingredients.lemonsUsed > 0) {
          const each = day.ingredients.lemons / day.ingredients.lemonsUsed;
          expect(each).toBeGreaterThan(0);
          expect(each).toBeLessThanOrEqual(ECON.LEMON_COST * ECON.LEMON_GRADES.organic.costFactor);
        }
      }
    }
  });

  it('prices the shopping list at the grade being bought', () => {
    const state = createGame(5).stand;
    const posh = batchPlan(state, 40, 'organic');
    const cheap = batchPlan(state, 40, 'value');
    expect(posh.cost.total).toBeGreaterThan(cheap.cost.total);
    expect(posh.costPerCup).toBeGreaterThan(cheap.costPerCup);
    expect(posh.grade).toBe('organic');
  });
});

describe('the challenge, and the two rounds that unlock the next stage', () => {
  it('asks for nothing at all in the exploratory rounds', () => {
    /*
     * "1-2 exploratory rounds without a target." A goal on day one is a demand
     * made of a child who does not yet know what a cup costs.
     */
    let state: GameState = createGame(7).stand;
    for (let day = 0; day < ECON.ACT1_EXPLORE_DAYS; day++) {
      expect(act1Progress(state).exploring, `day ${day + 1} already had a target`).toBe(true);
      expect(act1Progress(state).complete).toBe(false);
      const plan = batchPlan(state, 40);
      state = runDay(state, { ...plan.order, price: 2 }, params).nextState;
    }
    expect(act1Progress(state).exploring).toBe(false);
  });

  it('names the number, so a child can repeat the goal back', () => {
    let state: GameState = createGame(7).stand;
    for (let day = 0; day < ECON.ACT1_EXPLORE_DAYS; day++) {
      const plan = batchPlan(state, 40);
      state = runDay(state, { ...plan.order, price: 0.1 }, params).nextState;
    }
    expect(act1Progress(state).goal).toContain(`$${ECON.ACT1_PROFIT_TARGET}`);
  });

  it('does not count a good day that happened before the goal existed', () => {
    /*
     * The bug this test was written for. `hits` counted the whole history, so
     * a child whose two exploratory days both cleared the target completed the
     * stage before ever being shown it — the challenge won before it was set.
     */
    let state: GameState = createGame(7).stand;
    for (let day = 0; day < ECON.ACT1_EXPLORE_DAYS; day++) {
      const plan = batchPlan(state, 40, 'organic');
      state = runDay(state, { ...plan.order, price: 2, grade: 'organic' }, params).nextState;
    }
    const cleared = state.history.filter((day) => day.profit >= ECON.ACT1_PROFIT_TARGET).length;
    expect(cleared, 'fixture did not clear the target during exploration').toBeGreaterThan(0);
    expect(act1Progress(state).hits).toBe(0);
    expect(act1Complete(state)).toBe(false);
  });

  it('takes two separate days, not one big one', () => {
    let state: GameState = createGame(7).stand;
    let sawOneHit = false;
    for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
      const before = act1Progress(state);
      if (before.hits === 1) {
        sawOneHit = true;
        expect(before.complete, 'one good day finished the stage').toBe(false);
      }
      if (act1Complete(state)) break;
      const plan = batchPlan(state, 40, 'organic');
      state = runDay(state, { ...plan.order, price: 2, grade: 'organic' }, params).nextState;
    }
    expect(sawOneHit, 'never passed through a single hit').toBe(true);
    expect(act1Progress(state).hits).toBeGreaterThanOrEqual(ECON.ACT1_TARGET_HITS);
  });

  it('is reachable by ordinary play, on every seed', () => {
    /*
     * A target nobody can hit is worse than no target. Asserted across seeds
     * because the weather is drawn from one, and a goal that depends on a hot
     * week is a goal that depends on luck.
     */
    const missed: number[] = [];
    for (const seed of [1, 7, 42, 99, 2026, 31337]) {
      let state: GameState = createGame(seed).stand;
      for (let day = 0; day < ECON.TOTAL_DAYS && !act1Complete(state); day++) {
        const plan = batchPlan(state, 40, 'organic');
        state = runDay(state, { ...plan.order, price: 2, grade: 'organic' }, params).nextState;
      }
      if (!act1Progress(state).complete) missed.push(seed);
    }
    expect(missed, `good play never hit the goal twice on seeds: ${missed.join(', ')}`).toEqual([]);
  });

  it('still lets a child who never hits it move on', () => {
    /*
     * "No harsh failure." The seven-day clock stays as the fallback, exactly as
     * it does for the two stages after this one — an arc with a single exit is
     * an arc somebody gets stuck in.
     */
    let state: GameState = createGame(7).stand;
    for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
      const plan = batchPlan(state, 8, 'value');
      state = runDay(state, { ...plan.order, price: 4.5, grade: 'value' }, params).nextState;
    }
    expect(act1Progress(state).complete, 'this play should not have met the goal').toBe(false);
    expect(act1Complete(state), 'the clock did not release a stuck child').toBe(true);
  });
});

describe('the same-sky guarantee survives the new lever', () => {
  it('draws the same weather whatever the recipe', () => {
    /*
     * `buildCustomers` insists the number of random draws depends "only on the
     * weather and the day's parameters — never on the price or the batch",
     * because two children on one challenge code must get the same week.
     * Grade is a decision, so it had to land on the same side of that line.
     */
    const weathers = GRADE_ORDER.map((grade) =>
      week(1.5, grade).days.map((day) => day.weather).join(','),
    );
    expect(new Set(weathers).size, `recipe changed the weather: ${weathers.join(' | ')}`).toBe(1);
  });

  it('leaves the seed carried into tomorrow untouched by the recipe', () => {
    const seeds = GRADE_ORDER.map((grade) => week(1.5, grade).state.seed);
    expect(new Set(seeds).size, 'recipe changed tomorrow’s seed').toBe(1);
  });

  it('still sends the same number of people past the stand', () => {
    const crowds = GRADE_ORDER.map((grade) =>
      week(1.5, grade).days.map((day) => day.passersby).join(','),
    );
    expect(new Set(crowds).size, 'recipe changed the footfall').toBe(1);
  });
});

describe('nothing about the old economy moved', () => {
  it('reproduces the pre-grade week exactly, when nothing is chosen', () => {
    /*
     * The regression guard for the whole change. A run that passes no grade
     * must be identical to one that passes `regular`, day for day and cent for
     * cent — that is what let ~30 arithmetic identities keep passing untouched.
     */
    let plain: GameState = createGame(11).stand;
    let explicit: GameState = createGame(11).stand;
    for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
      const a = runDay(plain, { ...batchPlan(plain, 30).order, price: 1.5 }, params);
      const b = runDay(
        explicit,
        { ...batchPlan(explicit, 30, 'regular').order, price: 1.5, grade: 'regular' },
        params,
      );
      expect(b.profit).toBe(a.profit);
      expect(b.revenue).toBe(a.revenue);
      expect(b.ingredients.total).toBe(a.ingredients.total);
      plain = a.nextState;
      explicit = b.nextState;
    }
  });

  it('costs a flat lemon exactly what it always did, below the first tier', () => {
    expect(ingredientCostOf(8).total).toBe(round2(2 * ECON.LEMON_COST + 8 * 0.04 + 8 * 0.03));
  });
});
