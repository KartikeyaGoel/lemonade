/** @vitest-environment jsdom */
/**
 * The goal strip, on the last day of the week.
 *
 * `tests/plural.test.ts` guards the class by scanning source, which is the
 * cheap way to stop it coming back but proves nothing about what a child
 * actually sees. This renders the one instance that was found by looking:
 * "1 days left", on the seventh morning, on the screen every Act 1 player
 * spends the most time on.
 *
 * Built by running six real days through the simulation rather than by handing
 * the component a fabricated history, so "the last day" is the state the game
 * produces and not the state this test imagines.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlanScreen } from '@/components/PlanScreen';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  orderForTargetCups,
  runDay,
  type GameState,
} from '@/lib/simulation';
import { createGame } from '@/lib/progress';

function afterDays(days: number): GameState {
  let state = createGame(4242).stand;
  for (let day = 0; day < days; day++) {
    const order = orderForTargetCups(state, 28);
    state = runDay(state, { ...order, price: 1.5 }, DEFAULT_DAY_PARAMS).nextState;
  }
  return state;
}

describe('the goal strip counts down in English', () => {
  afterEach(cleanup);

  it('says "1 day left" on the last day, not "1 days left"', () => {
    const state = afterDays(ECON.TOTAL_DAYS - 1);
    expect(state.history).toHaveLength(ECON.TOTAL_DAYS - 1);

    render(<PlanScreen state={state} onOpen={() => {}} />);

    expect(screen.getByText(/1 day left/)).toBeInTheDocument();
    expect(screen.queryByText(/1 days left/)).not.toBeInTheDocument();
  });

  it('still says "days" for every other day of the week', () => {
    for (let played = 0; played < ECON.TOTAL_DAYS - 1; played++) {
      const left = ECON.TOTAL_DAYS - played;
      render(<PlanScreen state={afterDays(played)} onOpen={() => {}} />);
      expect(screen.getByText(new RegExp(`${left} days left`))).toBeInTheDocument();
      cleanup();
    }
  });
});
