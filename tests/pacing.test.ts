/**
 * How long before a child sees the result of what they decided?
 *
 * The customer's research question: a Clash Royale match is a couple of
 * minutes, a Clash of Clans raid about the same, so a child gets a result and
 * the feeling that goes with it inside one short sitting. Whatever the exact
 * figure, the design principle underneath it is real and old — flow needs
 * immediate feedback, and formative feedback is one of the most robust findings
 * in learning research. The claim worth defending is not "two minutes" but
 * *the consequence arrives while the decision is still in mind.*
 *
 * lemonade's unit of feedback is the day, not the stage: plan, price, watch,
 * and a close screen with the P&L and up to one new word. So the day is what
 * has to stay short, and the watched portion is the only part the code
 * controls — the rest is a child reading, which no test can time.
 *
 * This file exists because that portion had quietly stopped being bounded.
 * `RunDayScreen` promised "roughly ten seconds regardless of how big the
 * crowd is" and delivered 32.7 seconds at the biggest crowd the simulation
 * produces, because the per-customer legibility floor stretched the day
 * instead of being absorbed. Nothing failed; the comment was just wrong.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DAY_PARAMS,
  batchPlan,
  runDay,
  ECON,
  type GameState,
} from '../src/lib/simulation';
import { createGame } from '../src/lib/progress';
import {
  buyUpgrade,
  createBusinessState,
  deriveDayParams,
  openStand,
  signUpRegulars,
  toggleStaff,
} from '../src/lib/business';

/*
 * The pacing arithmetic from `RunDayScreen`, restated.
 *
 * Duplicated deliberately and narrowly: the screen is a client component full
 * of sprites, sound and timers, and driving it in jsdom to time an animation
 * would test the fake clock rather than the pacing. What matters is that the
 * arithmetic bounds the day, so the arithmetic is what is asserted — with the
 * constants named the same way, so a change to one and not the other reads as
 * the drift it is.
 */
const WALK_MS = 1500;
const DAY_MS = 12000;
const MIN_TICK_MS = 110;

/** Milliseconds a child spends watching a day with this many customers. */
function watchedMs(crowd: number): number {
  const people = Math.max(1, crowd);
  const mostTicks = Math.floor(DAY_MS / MIN_TICK_MS);
  const step = Math.max(1, Math.ceil(people / mostTicks));
  const ticksNeeded = Math.ceil(people / step);
  const tick = Math.max(MIN_TICK_MS, Math.min(320, Math.round(DAY_MS / ticksNeeded)));
  return ticksNeeded * tick + WALK_MS;
}

/** Every crowd size the simulation can actually produce, across the arc. */
function everyCrowd(): number[] {
  const crowds: number[] = [];

  // Act 1, on a folding table, at every price a dial can reach.
  for (const price of [0.25, 0.5, 1, 1.5, 2, 2.5, 3]) {
    let state: GameState = createGame(7).stand;
    for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
      const outcome = runDay(
        state,
        { ...batchPlan(state, 200).order, price },
        { ...DEFAULT_DAY_PARAMS, lastDay: null },
      );
      crowds.push(outcome.customers.length);
      state = outcome.nextState;
    }
  }

  // Everything a child could own, at the cheap prices that draw the biggest
  // crowds. This is the case that was running at 32.7 seconds.
  let business = createBusinessState();
  for (const upgrade of ['cooler', 'bigSign', 'freshSqueeze'] as const) {
    const bought = buyUpgrade(9000, business, upgrade);
    if (bought.ok) business = bought.business;
  }
  business = toggleStaff(business, 'manager');
  business = toggleStaff(business, 'helper');
  const second = openStand(business, 'park', 9000);
  if (second.opened) business = second.business;

  let seeded: GameState = createGame(7).stand;
  for (let day = 0; day < 14; day++) {
    seeded = runDay(
      seeded,
      { ...batchPlan(seeded, 200).order, price: 1.5 },
      { ...DEFAULT_DAY_PARAMS, lastDay: null },
    ).nextState;
  }
  business = signUpRegulars(business, seeded.history).business;

  for (const price of [0.25, 0.5, 1, 1.5]) {
    let state: GameState = { ...seeded, status: 'playing' };
    for (let day = 0; day < 10; day++) {
      const outcome = runDay(
        state,
        { ...batchPlan(state, 400).order, price },
        { ...deriveDayParams(business, price), lastDay: null },
      );
      crowds.push(outcome.customers.length);
      state = outcome.nextState;
      if (state.status === 'finished') state = { ...state, status: 'playing' };
    }
  }

  return crowds;
}

describe('the watched day stays inside its budget', () => {
  it('never runs long, at any crowd the simulation can produce', () => {
    /*
     * Twenty seconds, against a twelve-second target and a 1.5s walk-on. The
     * ceiling is deliberately not tight: the point is to catch a day that has
     * stopped being bounded, not to freeze the pacing at its current value.
     */
    const crowds = everyCrowd();
    expect(crowds.length, 'no days were simulated').toBeGreaterThan(50)   ;

    const worst = Math.max(...crowds);
    expect(
      watchedMs(worst),
      `a crowd of ${worst} takes ${(watchedMs(worst) / 1000).toFixed(1)}s to watch`,
    ).toBeLessThan(20_000);
  });

  it('holds the promise its own comment makes, at the biggest crowd there is', () => {
    /*
     * The specific regression. 284 customers is a loaded late-game business
     * selling at 25c, and it used to take 32.7 seconds.
     */
    expect(watchedMs(284)).toBeLessThan(15_000);
    expect(watchedMs(150)).toBeLessThan(15_000);
  });

  it('does not rush a small crowd into a flicker', () => {
    /*
     * The other direction, and the reason the fix absorbs the floor rather
     * than deleting it. Ten customers should still be ten people walking up,
     * not one frame each.
     */
    const mostTicks = Math.floor(DAY_MS / MIN_TICK_MS);
    for (const crowd of [1, 5, 10, 30]) {
      const step = Math.max(1, Math.ceil(crowd / mostTicks));
      expect(step, `a crowd of ${crowd} should arrive one at a time`).toBe(1);
    }
  });

  it('gives every day a result, so the loop closes inside the day', () => {
    /*
     * The learning half of the timing question. A stage takes an hour; the
     * loop that has to close quickly is the day, and it only closes if every
     * day ends with a number the child can read.
     */
    let state: GameState = createGame(7).stand;
    for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
      const outcome = runDay(
        state,
        { ...batchPlan(state, 30).order, price: 1.5 },
        { ...DEFAULT_DAY_PARAMS, lastDay: null },
      );
      expect(Number.isFinite(outcome.profit), `day ${day + 1} had no result`).toBe(true);
      expect(outcome.nextState.history.length).toBe(day + 1);
      state = outcome.nextState;
    }
  });
});
