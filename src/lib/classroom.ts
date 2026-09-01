/**
 * A class of thirty children discovering a demand curve from their own data.
 *
 * The honest problem with everything else in this repo is reach. The
 * simulation is sound, the accounts are real, the evidence layer can tell a kid
 * who understands from a kid who is busy — and all of it runs on one phone, for
 * one child, who has to find it first. Impact is quality multiplied by reach,
 * and the second number has been zero. One teacher is thirty children.
 *
 * There is no backend and there is not going to be one, so this cannot be a
 * class roster with logins. What it can be is the thing a good lesson actually
 * needs, which is smaller:
 *
 *  1. The teacher writes **one code** on the board.
 *  2. Every child plays the *same week* — same forecasts, same weather, same
 *     twenty dollars. That is guaranteed by the simulation and pinned by a test
 *     (`tests/challenge.test.ts`), because the number of random draws in a day
 *     depends on the weather and never on a decision.
 *  3. Each child ends up with **two numbers**: what they charged, and what they
 *     made. Two numbers is what a class of thirty can actually report in the
 *     five minutes a lesson has for it.
 *  4. Those sixty numbers go on one chart.
 *
 * And the chart is a demand curve. Not one drawn by a teacher on a whiteboard,
 * and not one revealed by the software — one the class measured, by each doing
 * a different experiment on the same world. Nobody has to be told that charging
 * more sells fewer and that there is a hump in the middle; thirty dots say it,
 * and the kid who charged $3.50 can see exactly where they are on it.
 *
 * That is the whole feature. Everything below is in service of it.
 *
 * The truth is computable here, which is worth stating because it usually is
 * not: because the weather is decision-independent, the game can replay the
 * *same week* at every price and say what a perfectly-judged batch would have
 * earned. So after the class has looked at their own dots, the real curve can
 * be laid over the top. The order matters — the measurement first, the answer
 * second — which is why they are separate calls.
 *
 * Pure module. No React, no I/O.
 */

import {
  batchPlan,
  createInitialState,
  cupsWantedWith,
  resolveDayParams,
  round2,
  runDay,
  type GameState,
} from './simulation';
import { CHALLENGE_DAYS, tidyName, type ChallengeSpec } from './challenge';

/** One child's week, as the two numbers they can read off their own screen. */
export interface Entry {
  who: string;
  /** Cents, because a class reports "one seventy-five" and floats drift. */
  priceCents: number;
  profit: number;
}

export function entry(who: string, priceCents: number, profit: number): Entry {
  return {
    who: tidyName(who),
    priceCents: Math.max(0, Math.round(priceCents)),
    profit: round2(profit),
  };
}

/* ------------------------------------------------------------------ *
 * What the class found
 * ------------------------------------------------------------------ */

/** One price the class tried, and how it went for everyone who tried it. */
export interface Bin {
  priceCents: number;
  /** How many children charged about this much. */
  tried: number;
  /** What they made on average. The class's own measurement. */
  averageProfit: number;
  best: number;
  worst: number;
}

/**
 * Prices rounded to the nearest ten cents.
 *
 * Without binning, thirty children produce thirty x-values and the chart is a
 * cloud rather than a curve. Ten cents is coarse enough to group and fine
 * enough that the hump survives.
 */
export const BIN_CENTS = 10;

export function bins(entries: Entry[]): Bin[] {
  const groups = new Map<number, number[]>();
  for (const item of entries) {
    const key = Math.round(item.priceCents / BIN_CENTS) * BIN_CENTS;
    groups.set(key, [...(groups.get(key) ?? []), item.profit]);
  }
  return [...groups]
    .map(([priceCents, profits]) => ({
      priceCents,
      tried: profits.length,
      averageProfit: round2(profits.reduce((a, b) => a + b, 0) / profits.length),
      best: Math.max(...profits),
      worst: Math.min(...profits),
    }))
    .sort((a, b) => a.priceCents - b.priceCents);
}

export interface Findings {
  children: number;
  /** How many genuinely different prices the class tried between them. */
  pricesTried: number;
  /** The binned price that earned the most on average. */
  classBestCents: number | null;
  cheapest: number | null;
  dearest: number | null;
  /** Children who lost money, which is a fact and not a shaming. */
  lostMoney: number;
  /**
   * What the class can say out loud, in order.
   *
   * Deliberately never names a child. The board is a shared measurement, not a
   * scoreboard — see `src/lib/table.ts` for the same argument at length.
   */
  lines: string[];
}

/** How many children before the shape of the curve means anything. */
export const ENOUGH_FOR_A_CURVE = 6;

export function findings(entries: Entry[]): Findings {
  const grouped = bins(entries);
  const prices = entries.map((item) => item.priceCents);
  const peak = grouped.reduce<Bin | null>(
    (best, bin) => (best === null || bin.averageProfit > best.averageProfit ? bin : best),
    null,
  );
  const lostMoney = entries.filter((item) => item.profit < 0).length;

  const lines: string[] = [];
  if (entries.length === 0) {
    lines.push('Nothing on the board yet. Add the first result.');
  } else if (entries.length < ENOUGH_FOR_A_CURVE) {
    lines.push(
      `${entries.length} in so far. It takes about ${ENOUGH_FOR_A_CURVE} before the shape means anything.`,
    );
  } else {
    lines.push(
      `${entries.length} children, ${grouped.length} different prices, one identical week.`,
    );
    if (peak) {
      lines.push(
        `Best on average: ${dollars(peak.priceCents)} a cup, ${dollars(
          Math.round(peak.averageProfit * 100),
        )} for the week.`,
      );
    }
    const spread = Math.max(...prices) - Math.min(...prices);
    if (spread >= 100) {
      lines.push(
        `The cheapest and dearest in the room were ${dollars(spread)} apart. Ask both of them why.`,
      );
    }
    if (lostMoney > 0) {
      lines.push(
        `${lostMoney} lost money. Every one of them was on the same weather as everybody else.`,
      );
    }
  }

  return {
    children: entries.length,
    pricesTried: grouped.length,
    classBestCents: peak?.priceCents ?? null,
    cheapest: prices.length > 0 ? Math.min(...prices) : null,
    dearest: prices.length > 0 ? Math.max(...prices) : null,
    lostMoney,
    lines,
  };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/* ------------------------------------------------------------------ *
 * The answer, for afterwards
 * ------------------------------------------------------------------ */

export interface CurvePoint {
  priceCents: number;
  profit: number;
  cupsSold: number;
}

/** Prices the reveal is computed at: 50c to $4.00, every 10c. */
const FROM_CENTS = 50;
const TO_CENTS = 400;

/**
 * The same week, played at every price, always making close to enough.
 *
 * Only meaningful because the weather does not depend on the decision. The
 * batching policy is stated rather than optimal: buy what the forecast implies
 * at this price, which is what a careful child would do and is reproducible.
 * A perfect-hindsight curve would sit above anything a class could reach and
 * would make their own measurement look like a failure.
 */
export function trueCurve(spec: ChallengeSpec): CurvePoint[] {
  const points: CurvePoint[] = [];
  const params = resolveDayParams({ lastDay: spec.days });

  for (let priceCents = FROM_CENTS; priceCents <= TO_CENTS; priceCents += BIN_CENTS) {
    const price = priceCents / 100;
    // Plenty of cash, so the curve measures the price and not the float. A
    // child starting on twenty dollars is capital-constrained for a day or two
    // and the reveal is not about that.
    let state: GameState = { ...createInitialState(spec.seed), cash: 500 };
    let profit = 0;
    let cupsSold = 0;

    for (let day = 0; day < spec.days; day += 1) {
      if (state.status !== 'playing') break;
      // What the forecast implies, before knowing what the day turns out to be.
      const expected = cupsWantedWith(price, forecastAsWeather(state.forecast), params);
      const plan = batchPlan(state, Math.ceil(expected));
      const outcome = runDay(state, { ...plan.order, price }, { lastDay: spec.days });
      profit = round2(profit + outcome.profit);
      cupsSold += outcome.cupsSold;
      state = outcome.nextState;
    }

    points.push({ priceCents, profit, cupsSold });
  }
  return points;
}

/** The weather a forecast is promising, which is what you plan against. */
function forecastAsWeather(forecast: GameState['forecast']) {
  if (forecast === 'probably-hot') return 'hot' as const;
  if (forecast === 'probably-cold') return 'cold' as const;
  return 'mild' as const;
}

/** The best price on the real curve, for the sentence after the reveal. */
export function bestOnCurve(curve: CurvePoint[]): CurvePoint | null {
  return curve.reduce<CurvePoint | null>(
    (best, point) => (best === null || point.profit > best.profit ? point : best),
    null,
  );
}

/**
 * How close the class got, in the only terms that matter.
 *
 * Not "you were 12% off". A class that landed within twenty cents of the peak
 * found it, and should be told so; a class that did not gets a question rather
 * than a mark.
 */
export function howClose(entries: Entry[], curve: CurvePoint[]): string {
  const peak = bestOnCurve(curve);
  const classPeak = findings(entries).classBestCents;
  if (peak === null || classPeak === null) return '';

  const gap = Math.abs(peak.priceCents - classPeak);
  if (gap <= BIN_CENTS) {
    return `The class found it. The best price this week really was ${dollars(peak.priceCents)}.`;
  }
  if (gap <= 30) {
    return `Within ${dollars(gap)} of it. The best price this week was ${dollars(peak.priceCents)}.`;
  }
  return classPeak < peak.priceCents
    ? `The best price this week was ${dollars(peak.priceCents)} — dearer than anyone in the room went. What stopped you?`
    : `The best price this week was ${dollars(peak.priceCents)} — cheaper than the class settled on. Who was turning people away?`;
}

/** A class code is a week. Same object the challenge screen already uses. */
export function classWeek(seed: number, days = CHALLENGE_DAYS): ChallengeSpec {
  return { version: 1, seed: seed >>> 0, days, rule: 'classic' };
}
