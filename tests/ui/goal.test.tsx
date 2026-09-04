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
import { act1Progress, createGame } from '@/lib/progress';
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
      stage={{ goal: progress.goal, day: state.history.length, total: ECON.TOTAL_DAYS }}
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
