/** @vitest-environment jsdom */
/**
 * Does the first stage tell a child what it is asking for?
 *
 * FRAMEWORK.md §14 found that it did not. The goal strip read "6 days left ·
 * $33.40 of $20.00 start" — a clock and a comparison — and `act1Complete` was
 * seven days elapsed. Nothing was aimed at, so nothing could be hit or missed,
 * and a child could not tell whether the day they just played was any good.
 *
 * Asserted through the real screen rather than by calling `act1Progress`,
 * because a goal that exists in the model and never renders is PRODUCT.md
 * §40's defect class — and that class has now been a badge counter, a glossary
 * word and a tour step.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlanScreen } from '@/components/PlanScreen';
import { PriceScreen } from '@/components/PriceScreen';
import { ShopScreen } from '@/components/ShopScreen';
import { act1Progress, createGame } from '@/lib/progress';
import { money } from '@/components/ui';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  batchPlan,
  runDay,
  type GameState,
  type LemonGrade,
} from '@/lib/simulation';

const params = { ...DEFAULT_DAY_PARAMS, lastDay: null };

/** Plays real days at one strategy, so the history is the simulation's own. */
function after(days: number, price: number, grade: LemonGrade = 'regular'): GameState {
  let state: GameState = createGame(7).stand;
  for (let day = 0; day < days; day++) {
    const plan = batchPlan(state, 40, grade);
    state = runDay(state, { ...plan.order, price, grade }, params).nextState;
  }
  return state;
}

/**
 * Rendered the way `page.tsx` renders it.
 *
 * The stage line is computed by the app and handed down — `PlanScreen` is
 * presentational about it — so the goal has to be passed in for this to be a
 * test of the screen rather than of a default. `act1Progress` supplies it here
 * exactly as `page.tsx` does; that function's own answers are asserted in
 * `tests/stage1.test.ts`, and TypeScript is what guarantees the app passes it.
 */
function plan(state: GameState) {
  const progress = act1Progress(state);
  render(
    <PlanScreen
      state={state}
      /*
       * `day` is the day about to be played, which is what `page.tsx` passes.
       *
       * This helper first passed `history.length` — replicating the exact
       * off-by-one it was written to catch, so the test failed for the right
       * reason and then had to be corrected too. That is the hazard of a
       * fixture that re-derives what the app derives: the strongest version of
       * this test would render `<Page />`, and `tests/ui/journey.test.tsx` is
       * where that machinery lives.
       */
      stage={{ goal: progress.goal, day: state.history.length + 1, total: ECON.TOTAL_DAYS }}
      onOpen={() => {}}
      onInvest={() => {}}
    />,
  );
}

describe('the goal strip in the first stage', () => {
  afterEach(cleanup);

  it('asks for nothing while the child is still exploring', () => {
    const state = after(1, 1.5);
    expect(act1Progress(state).exploring).toBe(true);
    plan(state);
    expect(screen.getByText(/Try things out/i)).toBeInTheDocument();
    // And it does not name a figure a child has not been set yet.
    expect(screen.queryByText(new RegExp(`\\$${ECON.ACT1_PROFIT_TARGET}`))).not.toBeInTheDocument();
  });

  it('names the target once exploration is over', () => {
    // Two poor days: past exploring, nothing banked.
    const state = after(ECON.ACT1_EXPLORE_DAYS, 4.5, 'value');
    const progress = act1Progress(state);
    expect(progress.exploring).toBe(false);
    expect(progress.hits).toBe(0);

    plan(state);
    const strip = screen.getByText(new RegExp(`Make \\$${ECON.ACT1_PROFIT_TARGET} in one day`, 'i'));
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).toMatch(/twice/i);
  });

  it('counts down the second good day once the first is banked', () => {
    let state = after(ECON.ACT1_EXPLORE_DAYS, 4.5, 'value');
    // One good day, deliberately after exploration.
    const good = batchPlan(state, 40, 'organic');
    state = runDay(state, { ...good.order, price: 2, grade: 'organic' }, params).nextState;

    const progress = act1Progress(state);
    expect(progress.hits, 'the good day did not clear the target').toBe(1);
    expect(progress.complete).toBe(false);

    plan(state);
    expect(screen.getByText(new RegExp(`Make \\$${ECON.ACT1_PROFIT_TARGET} again`, 'i'))).toBeInTheDocument();
  });

  it('agrees with itself about which day it is', () => {
    /*
     * The header and the title are two renderings of one fact, and they
     * disagreed: "Day 1 / 7" above a screen headed "Day 2".
     *
     * `PlanScreen` reads `stage?.day ?? state.history.length + 1`. Act 1 had
     * no stage entry until the goal was added, so it took the fallback and was
     * correct by accident; the new entry passed the count of days *banked*
     * rather than the day about to be played. Found in a browser, on the
     * second screen of a fresh install.
     */
    for (const days of [1, 2, 3]) {
      cleanup();
      const state = after(days, 1.5);
      plan(state);
      const seen = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      const expected = `Day ${days + 1}`;
      // Once for the header, once for the title, and no other day number.
      const others = [1, 2, 3, 4, 5, 6, 7]
        .filter((n) => n !== days + 1)
        .filter((n) => new RegExp(`Day ${n}\\b`).test(seen));
      expect(seen).toContain(expected);
      expect(others, `also claims to be Day ${others.join(', Day ')}`).toEqual([]);
    }
  });

  it('never shows the old day-countdown strip in the first stage', () => {
    /*
     * The specific regression. `PlanScreen` still has that fallback for the
     * weekend stand, which has no stage and no goal — so it has to be the
     * branch that is *not* taken here.
     */
    for (const days of [1, 2, 3, 4]) {
      cleanup();
      plan(after(days, 1.5));
      expect(screen.queryByText(/days left ·/i), `day ${days + 1} still shows a countdown`)
        .not.toBeInTheDocument();
    }
  });
});

describe('the number a price has to beat', () => {
  afterEach(cleanup);

  /**
   * The price screen must quote the cost of *today's* lemonade.
   *
   * It used to work this out itself with `ingredientCostOf(cupsMakeable)`,
   * which prices lemons flat. So a child who had just chosen posh lemons was
   * shown "a cup costs you $0.20 to make — charge more than that" when a cup
   * cost 29c, and 25c looked like a profit and was a loss on every cup.
   *
   * Found by playing it in a browser, not by any test, which is why this one
   * exists. The floor is now passed in by the caller, which is the only place
   * that knows both the grade and the order size — and the order size is what
   * decides the bulk discount.
   */
  it('quotes the cost of the recipe actually chosen', () => {
    /*
     * A fresh stand, because the sentence is behind `firstEver` — it is
     * day one's advice and day one only. Which is also exactly where the bug
     * lived: from day two the price is set on the plan screen, whose sheets
     * read `projectDay`, and that was given the grade.
     */
    const state = createGame(7).stand;
    const cups = 28;

    for (const grade of ['value', 'regular', 'organic'] as LemonGrade[]) {
      cleanup();
      const plan = batchPlan(state, cups, grade);
      render(
        <PriceScreen
          state={state}
          cupsMakeable={plan.cupsMakeable}
          perCupCost={plan.costPerCup}
          learned={[]}
          onConfirm={() => {}}
          onBack={() => {}}
        />,
      );
      /*
       * Compared against `money()`, the app's own rounding, not `toFixed`.
       * The two disagree on a half-cent and the screen is the thing under
       * test — asserting my own arithmetic would be asserting the wrong side.
       */
      /*
       * Read off the rendered text rather than with `getByText`.
       *
       * The sentence is `A cup costs you {money(perCup)} to make`, so React
       * splits it across text nodes and a regex spanning the interpolation
       * matches nothing — "the text is broken up by multiple elements". What
       * a child sees is the concatenation, so that is what is asserted.
       */
      const shown = money(plan.costPerCup);
      const seen = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      expect(seen, `${grade}: the screen did not quote ${shown}`).toContain(
        `A cup costs you ${shown} to make`,
      );
    }
  });

  it('moves with the recipe, so the floor is never the wrong one', () => {
    /*
     * The property, rather than the three instances: a dearer lemon must
     * produce a higher floor. That is what the bug got wrong — the floor was
     * frozen at the normal price whatever a child bought.
     *
     * Measured from a *fresh* stand deliberately. After a day of trading there
     * are leftover lemons in the pantry, so a plan buys fewer and the cost of
     * a cup is partly yesterday's price — true to life, and no use for
     * comparing grades against each other.
     */
    const fresh = createGame(7).stand;
    const cheap = batchPlan(fresh, 28, 'value').costPerCup;
    const normal = batchPlan(fresh, 28, 'regular').costPerCup;
    const posh = batchPlan(fresh, 28, 'organic').costPerCup;

    expect(cheap).toBeLessThan(normal);
    expect(posh).toBeGreaterThan(normal);
    expect(cheap).toBeGreaterThan(0);
  });
});

describe('the recipe is a standing decision', () => {
  afterEach(cleanup);

  it('is still the one they chose after a reload', () => {
    /*
     * Found on the second screen of a real session. A resumed Act 1 save goes
     * `morning → shop → price`, and the shop screen defaulted the recipe to
     * normal — so a reload switched a child off the posh lemons they had
     * bought, without asking and without saying.
     *
     * Worse than a reset, because `gradeDemandFactor` reads *yesterday's*
     * grade for word of mouth: demand would move for a decision they did not
     * make. ShopScreen's own comment claimed it "is only ever reached on a
     * run's first day", which resume disproves.
     */
    let state = createGame(7).stand;
    const plan = batchPlan(state, 28, 'organic');
    state = runDay(
      state,
      { ...plan.order, price: 1.5, grade: 'organic' },
      { ...DEFAULT_DAY_PARAMS, lastDay: null },
    ).nextState;

    render(<ShopScreen state={state} onConfirm={() => {}} onBack={() => {}} />);

    const posh = screen.getAllByRole('radio').find((el) =>
      /Posh/i.test(el.getAttribute('aria-label') ?? ''),
    );
    expect(posh, 'the posh option is gone').toBeDefined();
    expect(
      posh?.getAttribute('aria-checked'),
      'a reload put the child back on normal lemons',
    ).toBe('true');
  });

  it('starts a brand new stand on the normal lemon', () => {
    /* Nothing to carry forward on day one, so the plain choice is the default. */
    render(<ShopScreen state={createGame(7).stand} onConfirm={() => {}} onBack={() => {}} />);
    const normal = screen.getAllByRole('radio').find((el) =>
      /Normal/i.test(el.getAttribute('aria-label') ?? ''),
    );
    expect(normal?.getAttribute('aria-checked')).toBe('true');
  });
});
