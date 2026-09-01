import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  orderForTargetCups,
  rehearseDay,
  runDay,
  type DayParams,
  type DayRecord,
  type GameState,
} from '../src/lib/simulation';
import {
  MAX_TRIES,
  alreadyTried,
  asTry,
  bestTry,
  canRehearse,
  compareTries,
  crowdLabel,
  remember,
  type Try,
} from '../src/lib/bench';

/** Plays one real day from `state` and hands back both halves. */
function playDay(state: GameState, cups: number, price: number, params?: Partial<DayParams>) {
  const outcome = runDay(state, { ...orderForTargetCups(state, cups), price }, params);
  return { outcome, record: outcome.nextState.history[outcome.nextState.history.length - 1] };
}

function rich(seed = 7): GameState {
  return { ...createInitialState(seed), cash: 400 };
}

function tryOf(state: GameState, past: DayRecord, id: number, cups: number, price: number): Try {
  const outcome = rehearseDay(state, { ...orderForTargetCups(state, cups), price }, undefined, past);
  if (!outcome) throw new Error('expected the day to be rehearsable');
  return asTry(id, cups, outcome);
}

describe('a rehearsal is the same day, played again', () => {
  it('reproduces the day exactly when the plan is unchanged', () => {
    const state = rich();
    const { outcome, record } = playDay(state, 30, 1.6);

    const again = rehearseDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }, undefined, record);

    expect(again).not.toBeNull();
    expect(again!.weather).toBe(outcome.weather);
    expect(again!.cupsSold).toBe(outcome.cupsSold);
    expect(again!.revenue).toBeCloseTo(outcome.revenue, 2);
    expect(again!.profit).toBeCloseTo(outcome.profit, 2);
  });

  it('holds the weather still while the price moves', () => {
    const state = rich();
    const { record } = playDay(state, 30, 1.6);

    const weathers = new Set<string>();
    for (const price of [0.5, 1.0, 1.5, 2.0, 2.5]) {
      const outcome = rehearseDay(
        state,
        { ...orderForTargetCups(state, 30), price },
        undefined,
        record,
      );
      weathers.add(outcome!.weather);
    }

    // The entire point: one variable moves, the world does not.
    expect(weathers.size).toBe(1);
  });

  it('sells no more cups at a higher price to the same crowd', () => {
    const state = rich();
    const { record } = playDay(state, 60, 1.2);

    let previous = Infinity;
    for (const price of [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8]) {
      const outcome = rehearseDay(
        state,
        { ...orderForTargetCups(state, 60), price },
        undefined,
        record,
      )!;
      expect(outcome.cupsSold).toBeLessThanOrEqual(previous);
      previous = outcome.cupsSold;
    }
  });

  it('changes nothing about the day the kid then actually plays', () => {
    const state = rich();
    const { record } = playDay(state, 30, 1.6);

    const before = JSON.stringify(state);
    for (const price of [0.6, 1.1, 1.9, 2.7]) {
      rehearseDay(state, { ...orderForTargetCups(state, 44), price }, undefined, record);
    }
    expect(JSON.stringify(state)).toBe(before);

    // And the real day is still the real day.
    const real = playDay(state, 30, 1.6);
    expect(real.outcome.cupsSold).toBe(record.cupsSold);
    expect(real.outcome.profit).toBeCloseTo(record.profit, 2);
  });

  it('refuses to invent a crowd it cannot reproduce', () => {
    const state = rich();
    const { record } = playDay(state, 30, 1.6);
    const oldSave: DayRecord = { ...record, seedBefore: undefined, forecast: undefined };

    expect(canRehearse(oldSave)).toBe(false);
    expect(rehearseDay(state, { ...orderForTargetCups(state, 30), price: 2 }, undefined, oldSave)).toBeNull();
  });

  it('answers even when the recorded week is over', () => {
    let state = rich();
    for (let day = 0; day < 7; day++) {
      state = playDay(state, 28, 1.6).outcome.nextState;
    }
    expect(state.status).toBe('finished');

    const last = state.history[state.history.length - 1];
    expect(rehearseDay(state, { ...orderForTargetCups(state, 28), price: 2 }, undefined, last)).not.toBeNull();
  });
});

describe('comparing two tries explains the gap and nothing else', () => {
  it('splits the gap into lines that add up to it exactly', () => {
    const state = rich();
    const { record } = playDay(state, 40, 1.4);

    const plans: Array<[number, number]> = [
      [40, 1.4],
      [40, 1.9],
      [40, 0.8],
      [20, 1.4],
      [70, 1.4],
      [20, 2.6],
      [70, 0.6],
    ];
    const tries = plans.map(([cups, price], i) => tryOf(state, record, i + 1, cups, price));

    for (const from of tries) {
      for (const to of tries) {
        const diff = compareTries(from, to);
        const summed = diff.lines.reduce((total, line) => total + line.amount, 0);
        expect(summed).toBeCloseTo(diff.gap, 2);
      }
    }
  });

  it('never invoices a kid for rent that did not change', () => {
    const state = rich();
    const { record } = playDay(state, 40, 1.4, { fixedCosts: [{ label: 'Pitch fee', amount: 5 }] });
    const params = { fixedCosts: [{ label: 'Pitch fee', amount: 5 }] };

    const a = asTry(1, 40, rehearseDay(state, { ...orderForTargetCups(state, 40), price: 1.4 }, params, record)!);
    const b = asTry(2, 40, rehearseDay(state, { ...orderForTargetCups(state, 40), price: 2.1 }, params, record)!);

    const diff = compareTries(a, b);
    expect(a.fixedCost).toBe(b.fixedCost);
    expect(diff.lines.map((line) => line.label)).not.toContain('Pitch fee');
    expect(diff.lines.reduce((t, l) => t + l.amount, 0)).toBeCloseTo(diff.gap, 2);
  });

  it('names the trade when charging more sold fewer and earned more', () => {
    const state = rich();
    const { record } = playDay(state, 60, 0.5);

    const cheap = tryOf(state, record, 1, 60, 0.5);
    const dear = tryOf(state, record, 2, 60, 1.5);

    expect(dear.cupsSold).toBeLessThan(cheap.cupsSold);
    expect(dear.profit).toBeGreaterThan(cheap.profit);
    expect(compareTries(cheap, dear).headline).toBe(
      'You charged more and sold fewer — and still came out ahead.',
    );
  });

  it('says so when the same money arrived a different way', () => {
    const state = rich();
    const { record } = playDay(state, 30, 1.6);
    const one = tryOf(state, record, 1, 30, 1.6);
    expect(compareTries(one, { ...one, id: 2 }).gap).toBe(0);
    expect(compareTries(one, { ...one, id: 2 }).headline).toContain('Exactly the same money');
  });
});

describe('the lab book stays short on purpose', () => {
  const stub = (id: number, price: number, profit: number): Try =>
    ({
      id,
      targetCups: 30,
      price,
      cupsMade: 30,
      cupsSold: 20,
      turnedAway: 0,
      walkedAwayOnPrice: 0,
      revenue: 40,
      ingredientCost: 6,
      fixedCost: 5,
      spoiledLemons: 0,
      spoilageCost: 0,
      investorCut: 0,
      profit,
      weather: 'mild',
    }) as Try;

  it('keeps the newest tries and drops the oldest', () => {
    let tries: Try[] = [];
    for (let id = 1; id <= MAX_TRIES + 3; id++) tries = remember(tries, stub(id, 1 + id / 10, id));

    expect(tries).toHaveLength(MAX_TRIES);
    expect(tries[0].id).toBe(MAX_TRIES + 3);
    expect(tries.map((t) => t.id)).not.toContain(1);
  });

  it('spots a plan that has already been tried, to the cent', () => {
    const tries = [stub(1, 1.6, 18), stub(2, 2.0, 22)];
    expect(alreadyTried(tries, 30, 1.6)?.id).toBe(1);
    expect(alreadyTried(tries, 30, 1.65)).toBeNull();
    expect(alreadyTried(tries, 31, 1.6)).toBeNull();
  });

  it('marks the best try by profit, not by price', () => {
    expect(bestTry([stub(1, 2.8, 4), stub(2, 1.4, 31), stub(3, 2.0, 12)])?.id).toBe(2);
    expect(bestTry([])).toBeNull();
  });

  it('labels the crowd by the day and the weather it actually had', () => {
    const state = rich();
    const { record } = playDay(state, 30, 1.6);
    expect(crowdLabel(record)).toContain(`Day ${record.day}`);
    expect(crowdLabel(record)).toContain(record.weather === 'hot' ? 'hot' : record.weather === 'cold' ? 'cold' : 'mild');
  });
});
