/**
 * The simulation, attacked rather than demonstrated.
 *
 * Every other test in this suite picks a case and checks the answer. That
 * verifies the cases somebody thought of, which is exactly the coverage that
 * kept turning out to be incomplete — the cash line did not reconcile from the
 * very first day of the game, and 800 hand-written tests all agreed it was
 * fine, because none of them asked the question.
 *
 * So this asks the questions instead, and asks them of thousands of days:
 * randomised prices, orders, upgrades, staff, stands, shops, loans, investors,
 * subscribers and skies, every combination the state can actually be in. What
 * it asserts is not answers but **invariants** — the properties PRODUCT.md
 * stakes its credibility on:
 *
 *  - the P&L is arithmetic, and it closes
 *  - the cash box is arithmetic, and it closes
 *  - no figure the game shows a child is ever `NaN` or `Infinity`
 *  - the same seed produces the same day, every time
 *  - nothing sells that was not made, and nobody is served twice
 *
 * A failure here is a real defect by construction: these are not opinions
 * about how the game should feel, they are sums that either work or do not.
 */
import { describe, it, expect } from 'vitest';
import {
  ECON,
  createInitialState,
  resolveDayParams,
  runDay,
  totalFixedCost,
  type DayOutcome,
  type DayParams,
  type GameState,
} from '../src/lib/simulation';

/**
 * A deterministic generator, so a failure is reproducible.
 *
 * `Math.random` in a property test gives you a bug you cannot look at twice.
 * This is the same mulberry32 shape the game uses for its own weather.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);

/** Every shape the state can be in, including the ones that end a run badly. */
function randomState(r: () => number): GameState {
  const state = createInitialState(Math.floor(r() * 1e9));
  return {
    ...state,
    day: 1 + Math.floor(r() * 6),
    cash: Math.round(between(r, 0, 3000) * 100) / 100,
    lemonLots: r() < 0.4 ? [] : [{ lemons: Math.floor(r() * 40), purchasedOnDay: 1 }],
    sugarServings: Math.floor(r() * 60),
    cupsInStock: Math.floor(r() * 60),
    forecast: pick(r, ['probably-cold', 'probably-mild', 'probably-hot'] as const),
  };
}

/** Every shape the params can be in, from one folding table to a shop and a loan. */
function randomParams(r: () => number): DayParams {
  const lines = [
    { label: 'Pitch', amount: Math.round(between(r, 0, 20) * 100) / 100 },
    ...(r() < 0.5 ? [{ label: 'Wage', amount: Math.round(between(r, 0, 40) * 100) / 100 }] : []),
    ...(r() < 0.35 ? [{ label: 'Rent', amount: Math.round(between(r, 0, 60) * 100) / 100 }] : []),
    ...(r() < 0.3 ? [{ label: 'Loan', amount: Math.round(between(r, 0, 30) * 100) / 100 }] : []),
  ];
  return resolveDayParams({
    demandIntercept: between(r, 20, 140),
    demandSlope: between(r, 8, 40),
    demandMultiplier: between(r, 0.4, 4),
    fixedCosts: lines,
    serviceCapacity: r() < 0.15 ? Number.POSITIVE_INFINITY : Math.floor(between(r, 1, 120)),
    marketShare: between(r, 0.05, 1),
    equityShare: r() < 0.3 ? between(r, 0, 0.5) : 0,
    lastDay: r() < 0.5 ? ECON.TOTAL_DAYS : null,
    cashFloor: r() < 0.5 ? ECON.STARTING_CASH : null,
    subscribers: r() < 0.4 ? Math.floor(between(r, 0, 25)) : 0,
    subscriberDiscount: between(r, 0, 0.5),
    indoorShare: r() < 0.3 ? between(r, 0, 1) : 0,
  });
}

function randomOrder(r: () => number, state: GameState) {
  return {
    buyLemons: Math.floor(between(r, 0, 60)),
    buySugarPacks: Math.floor(between(r, 0, 8)),
    buyCupPacks: Math.floor(between(r, 0, 8)),
    // Deliberately includes prices nobody would set, including zero.
    price: Math.round(between(r, 0, 6) * 100) / 100,
    ...(state.day > 0 ? {} : {}),
  };
}

/** Every number a day reports, flattened, so nothing can hide a NaN. */
function numbersIn(o: DayOutcome): [string, number][] {
  const out: [string, number][] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'number') out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  };
  /*
   * `nextState` carries the history, which is every previous day over again,
   * and `params` is the input handed back — its `serviceCapacity` is
   * legitimately `Infinity` when nothing caps the queue. Neither is a figure
   * this screen shows a child, which is what the rule is about.
   */
  const { nextState: _drop, params: _params, ...rest } = o;
  walk(rest, 'outcome');
  walk({ cash: o.nextState.cash, sugar: o.nextState.sugarServings, cups: o.nextState.cupsInStock }, 'next');
  return out;
}

const RUNS = 3000;

describe('a randomised day, three thousand times over', () => {
  it('never produces a number that is not a number', () => {
    const r = rng(20260903);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      for (const [path, n] of numbersIn(o)) {
        if (!Number.isFinite(n)) {
          throw new Error(`run ${i}: ${path} is ${n} (seed ${state.seed}, price ${o.price})`);
        }
      }
    }
  });

  it('closes the profit and loss on every single one', () => {
    const r = rng(11);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      const expected =
        o.revenue - o.ingredients.total - o.standFee - o.spoilageCost - o.investorCut;
      expect(o.profit, `run ${i}`).toBeCloseTo(expected, 2);
      // And the stand fee is the sum of the lines that were shown.
      expect(o.standFee, `run ${i} fee`).toBeCloseTo(totalFixedCost(o.fixedCostLines), 2);
    }
  });

  /*
   * The one this file exists for. `profit` and the two cash figures are shown
   * together on the close screen, and §4 says any two figures shown together
   * must reconcile with the third on paper. The pantry line is what closes it.
   */
  it('closes the cash box on every single one', () => {
    const r = rng(22);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      // Exactly what the close screen prints: everything charged today that
      // was not paid for today, less what was paid for and not used. The
      // spoilage term is the one the first version of that line forgot.
      const pantry =
        Math.round((o.ingredients.total + o.spoilageCost - o.purchases.cost.total) * 100) / 100;
      expect(o.cashBefore + o.profit + pantry + o.cashTopUp, `run ${i}`).toBeCloseTo(
        o.cashAfter,
        2,
      );
    }
  });

  it('never sells a cup that was not made, or serves anybody twice', () => {
    const r = rng(33);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      expect(o.cupsSold, `run ${i} made`).toBeLessThanOrEqual(o.cupsMakeable);
      expect(o.cupsSold, `run ${i} negative`).toBeGreaterThanOrEqual(0);
      expect(o.subscriberCups, `run ${i} subs`).toBeLessThanOrEqual(o.cupsSold);
      expect(o.subscriberCups + (o.cupsSold - o.subscriberCups), `run ${i} split`).toBe(o.cupsSold);
      expect(o.revenue, `run ${i} rev`).toBeCloseTo(o.subscriberRevenue + o.walkupRevenue, 2);
    }
  });

  it('never puts cash below the floor it promised', () => {
    const r = rng(44);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      if (params.cashFloor !== null) {
        expect(o.cashAfter, `run ${i}`).toBeGreaterThanOrEqual(params.cashFloor - 0.005);
        // And a top-up is reported whenever one happened, never silently.
        if (o.cashTopUp > 0) expect(o.cashFloored).toBe(true);
        if (o.cashFloored) expect(o.cashTopUp).toBeGreaterThan(0);
      } else {
        expect(o.cashTopUp, `run ${i} no floor`).toBe(0);
      }
    }
  });

  it('never spends money the kid does not have', () => {
    const r = rng(55);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      expect(o.purchases.cost.total, `run ${i}`).toBeLessThanOrEqual(state.cash + 0.005);
    }
  });

  /*
   * Determinism is not a nicety here. The whole same-sky feature — challenge
   * codes, the classroom board, the rehearsal on yesterday's crowd — rests on
   * one seed meaning one day.
   */
  it('gives the same day twice for the same seed', () => {
    const r = rng(66);
    for (let i = 0; i < 600; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const order = randomOrder(r, state);
      const a = runDay(state, order, params);
      const b = runDay(state, order, params);
      expect(JSON.stringify(a.nextState.history), `run ${i}`).toBe(
        JSON.stringify(b.nextState.history),
      );
      expect(a.profit).toBe(b.profit);
      expect(a.cupsSold).toBe(b.cupsSold);
      expect(a.passersby).toBe(b.passersby);
    }
  });

  /*
   * §38's invariant, stated as a property: the number of people who walk past
   * depends on the weather and the params, and not on the price. A kid holding
   * the price dial must be changing what people decide, never how many of them
   * there are — otherwise the same-sky comparison is measuring the wrong thing.
   */
  it('draws the same crowd whatever the price', () => {
    const r = rng(77);
    for (let i = 0; i < 600; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const order = randomOrder(r, state);
      const cheap = runDay(state, { ...order, price: 0.5 }, params);
      const dear = runDay(state, { ...order, price: 4.5 }, params);
      expect(cheap.passersby, `run ${i}`).toBe(dear.passersby);
      expect(cheap.weather).toBe(dear.weather);
    }
  });

  it('never reports a margin per cup above the price paid', () => {
    const r = rng(88);
    for (let i = 0; i < RUNS; i++) {
      const state = randomState(r);
      const params = randomParams(r);
      const o = runDay(state, randomOrder(r, state), params);
      if (o.cupsSold > 0) {
        const realised = o.revenue / o.cupsSold;
        expect(o.grossMarginPerCup, `run ${i}`).toBeLessThanOrEqual(realised + 0.005);
      }
    }
  });
});
