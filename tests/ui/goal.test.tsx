/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanScreen } from '@/components/PlanScreen';
import { ACT2_DAYS, act2Progress, createBusinessState, deriveDayParams } from '@/lib/business';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  createInitialState,
  orderForTargetCups,
  runDay,
  type GameState,
} from '@/lib/simulation';

/**
 * The goal has to be on the screen the kid is actually standing on.
 *
 * This file exists because of the most expensive piece of evidence we have. A
 * real middle schooler played to day eighteen and quit bored. Day eighteen is
 * Act 2, day eleven of fourteen — three days from the sale, which is the
 * moment the whole arc is built towards. He never saw it.
 *
 * The cause was not pacing and it was not a shortage of things to do. The goal
 * strip on the stand was wrapped in `dayLabel === undefined`, which is true in
 * Act 1 and false in every act after it, so the objective disappeared on day
 * eight and never came back. The header dropped its `/ 14` at the same moment.
 * From day eight he was playing an unbounded day loop with no stated aim and
 * no finish line — and Act 2's aim did exist, as a finished string, on the one
 * screen he had no reason to open.
 *
 * That is a render-level fact, so it gets a render-level test. The assertions
 * are deliberately about the *presence of an objective*, not about its
 * wording, so rewriting the copy does not break them but deleting the strip
 * does.
 */

/** Plays `days` days so the stand arrives in the act under test. */
function standAfter(days: number): GameState {
  let stand = createInitialState(4242);
  for (let i = 0; i < days; i += 1) {
    const params =
      i < ECON.TOTAL_DAYS - 1
        ? DEFAULT_DAY_PARAMS
        : { ...DEFAULT_DAY_PARAMS, lastDay: null, cashFloor: null };
    stand = runDay(stand, { ...orderForTargetCups(stand, 28), price: 1.75 }, params).nextState;
  }
  return stand;
}

describe('the goal is visible in every act', () => {
  it('shows Act 1 its own derived goal', () => {
    render(<PlanScreen state={standAfter(2)} onOpen={vi.fn()} />);
    expect(screen.getByText(/Goal/i)).toBeInTheDocument();
    expect(screen.getByText(/days left/i)).toBeInTheDocument();
  });

  it('shows Act 2 a goal on the stand, not only in the shop', () => {
    const stand = standAfter(17);
    const business = createBusinessState();
    const act2Day = stand.history.length - ECON.TOTAL_DAYS + 1;
    const progress = act2Progress(business, act2Day);

    render(
      <PlanScreen
        state={stand}
        params={deriveDayParams(business, 1.75)}
        business={business}
        dayLabel={`Day ${stand.history.length + 1}`}
        stage={{ goal: progress.nextStep, day: act2Day, total: ACT2_DAYS }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText(/Goal/i)).toBeInTheDocument();
    // The act's real next step, which used to live only on the shop screen.
    expect(screen.getByText(progress.nextStep)).toBeInTheDocument();
  });

  it('never tells a kid on day 18 that they have negative days left', () => {
    // The old strip computed `ECON.TOTAL_DAYS - history.length`. By Act 2 that
    // is negative, so the bug had two halves: hidden, and wrong if shown.
    const stand = standAfter(17);
    const business = createBusinessState();
    const act2Day = stand.history.length - ECON.TOTAL_DAYS + 1;

    render(
      <PlanScreen
        state={stand}
        params={deriveDayParams(business, 1.75)}
        business={business}
        dayLabel={`Day ${stand.history.length + 1}`}
        stage={{ goal: act2Progress(business, act2Day).nextStep, day: act2Day, total: ACT2_DAYS }}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText(/-\d+ days left/)).toBeNull();
    expect(screen.queryByText(/days left/i)).toBeNull();
  });

  it('counts the act’s own clock, so the finish line is in sight', () => {
    // "Day 18" says nothing about how much is left. "11 / 14" says three days.
    const stand = standAfter(17);
    const business = createBusinessState();
    const act2Day = stand.history.length - ECON.TOTAL_DAYS + 1;

    render(
      <PlanScreen
        state={stand}
        params={deriveDayParams(business, 1.75)}
        business={business}
        dayLabel={`Day ${stand.history.length + 1}`}
        stage={{ goal: act2Progress(business, act2Day).nextStep, day: act2Day, total: ACT2_DAYS }}
        onOpen={vi.fn()}
      />,
    );

    expect(act2Day).toBe(11);
    expect(screen.getByText(`Day ${act2Day}`)).toBeInTheDocument();
    expect(screen.getByText(`/ ${ACT2_DAYS}`)).toBeInTheDocument();
  });

  it('states the goal in words a kid can act on, with no jargon', () => {
    // The grown-up register belongs on the grown-up screen. Whatever the goal
    // says, it must not say it in the language of the parent report.
    const business = createBusinessState();
    for (const day of [1, 7, 11, ACT2_DAYS]) {
      const goal = act2Progress(business, day).nextStep;
      expect(goal, `day ${day}`).not.toMatch(
        /margin|capital|valuation|equity|earnings|unit economics|fixed cost|opex/i,
      );
      expect(goal.length, `day ${day}`).toBeLessThan(70);
    }
  });
});
