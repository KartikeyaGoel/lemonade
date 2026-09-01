/**
 * The bench.
 *
 * Watching a kid play the Roblox factory game made one thing obvious: the part
 * they loved was not the machines, it was the row of saved attempts down the
 * side. Initial Test $3,828. Test 1 $3,287. Test 2 $3,828. They were not
 * playing a game, they were running experiments and keeping a lab book, and the
 * interface made that the most natural thing in the world to do.
 *
 * Our game had no such thing. It had two sliders and a commitment. A kid could
 * charge more and earn less and never find out whether the price did it or the
 * weather did, because both moved at once. That is not a difficulty problem, it
 * is a *measurement* problem, and no amount of good copy fixes it.
 *
 * So: a try is a rehearsal of today's plan against yesterday's crowd
 * (`rehearseDay`), kept in a short list the kid can compare against. The
 * comparison is the whole point — not "which was bigger" but which decision
 * moved the money, decomposed so the lines add up to the gap exactly.
 *
 * Why the list is short: six. Enough to hold a hypothesis, a control and a few
 * variations. Not enough to grind a slider until the number peaks, which would
 * turn a question into a search and teach nothing. When it fills, the oldest
 * try falls off the end — a kid should never be told they are out of thinking.
 *
 * Pure module. No React, no I/O.
 */

import {
  round2,
  type DayOutcome,
  type DayRecord,
  type Weather,
} from './simulation';

/** How many tries are kept. See the note above on why this is small. */
export const MAX_TRIES = 6;

export interface Try {
  /** Monotonic, so "Try 4" keeps its name even after Try 1 has fallen off. */
  id: number;
  targetCups: number;
  price: number;
  cupsMade: number;
  cupsSold: number;
  /** People who wanted one after the jug ran dry. Money left on the pavement. */
  turnedAway: number;
  walkedAwayOnPrice: number;
  revenue: number;
  ingredientCost: number;
  fixedCost: number;
  spoiledLemons: number;
  spoilageCost: number;
  investorCut: number;
  profit: number;
  weather: Weather;
}

export function asTry(id: number, targetCups: number, outcome: DayOutcome): Try {
  return {
    id,
    targetCups,
    price: outcome.price,
    cupsMade: outcome.cupsMakeable,
    cupsSold: outcome.cupsSold,
    turnedAway: outcome.turnedAwaySoldOut,
    walkedAwayOnPrice: outcome.walkedAwayOnPrice,
    revenue: outcome.revenue,
    ingredientCost: outcome.ingredients.total,
    fixedCost: outcome.standFee,
    spoiledLemons: outcome.spoiledLemons,
    spoilageCost: outcome.spoilageCost,
    investorCut: outcome.investorCut,
    profit: outcome.profit,
    weather: outcome.weather,
  };
}

/** Newest first, oldest dropped. */
export function remember(tries: Try[], next: Try): Try[] {
  return [next, ...tries].slice(0, MAX_TRIES);
}

/**
 * Has this exact plan already been tried?
 *
 * Re-running an identical plan produces an identical result — the crowd is
 * fixed — so adding it again would fill the list with copies of one row and
 * quietly push the interesting ones off the end.
 */
export function alreadyTried(tries: Try[], targetCups: number, price: number): Try | null {
  return (
    tries.find((t) => t.targetCups === targetCups && Math.abs(t.price - price) < 0.005) ?? null
  );
}

export function bestTry(tries: Try[]): Try | null {
  if (tries.length === 0) return null;
  return tries.reduce((best, t) => (t.profit > best.profit ? t : best));
}

export interface TryDiffLine {
  label: string;
  /** Signed dollars. Every line in a diff sums to `gap`, exactly. */
  amount: number;
  /** Why this line exists, in the kid's own terms. */
  detail: string;
}

export interface TryDiff {
  from: Try;
  to: Try;
  /** `to.profit − from.profit`. */
  gap: number;
  /** The one sentence worth reading. */
  headline: string;
  lines: TryDiffLine[];
}

/**
 * Why the second try made more money than the first.
 *
 * The decomposition is the standard price/volume split, and it is arranged so
 * the arithmetic closes: the price line is the price change valued at the *old*
 * number of cups, and the cups line is everything else in the revenue change.
 * That way a discount blending into the average — which happens as soon as
 * there are regulars on punch cards — lands in the cups line rather than
 * silently breaking the total.
 *
 * Fixed costs never appear. Rent and the pitch fee are the same in both tries
 * by construction, so a line for them would always read $0.00 and teach a kid
 * that rent does not matter.
 */
export function compareTries(from: Try, to: Try): TryDiff {
  const gap = round2(to.profit - from.profit);

  const priceEffect = round2((to.price - from.price) * from.cupsSold);
  const revenueChange = round2(to.revenue - from.revenue);
  const cupsEffect = round2(revenueChange - priceEffect);
  const ingredientsEffect = round2(-(to.ingredientCost - from.ingredientCost));
  const wasteEffect = round2(-(to.spoilageCost - from.spoilageCost));
  const investorEffect = round2(-(to.investorCut - from.investorCut));

  const lines: TryDiffLine[] = [];

  if (priceEffect !== 0) {
    const up = to.price > from.price;
    lines.push({
      label: up ? 'Charging more' : 'Charging less',
      amount: priceEffect,
      detail: `${up ? '+' : '−'}${cents(Math.abs(to.price - from.price))} a cup on the ${from.cupsSold} you were selling`,
    });
  }
  if (cupsEffect !== 0) {
    const soldMore = to.cupsSold > from.cupsSold;
    const change = Math.abs(to.cupsSold - from.cupsSold);
    lines.push({
      label: soldMore ? 'Selling more cups' : 'Selling fewer cups',
      amount: cupsEffect,
      detail:
        change === 0
          ? 'the mix of who bought changed'
          : `${change} ${change === 1 ? 'cup' : 'cups'} ${soldMore ? 'more' : 'fewer'}, at ${cents(to.price)}`,
    });
  }
  if (ingredientsEffect !== 0) {
    lines.push({
      label: ingredientsEffect < 0 ? 'More lemons and sugar' : 'Fewer lemons and sugar',
      amount: ingredientsEffect,
      detail: 'what the cups you sold cost to pour',
    });
  }
  if (wasteEffect !== 0) {
    lines.push({
      label: wasteEffect < 0 ? 'More thrown away' : 'Less thrown away',
      amount: wasteEffect,
      detail: `${to.spoiledLemons} lemons went off instead of ${from.spoiledLemons}`,
    });
  }
  if (investorEffect !== 0) {
    lines.push({
      label: "Your investor's slice",
      amount: investorEffect,
      detail: 'they take their share of whatever the day makes',
    });
  }

  return { from, to, gap, headline: headlineFor(from, to, gap, priceEffect, cupsEffect), lines };
}

/**
 * The sentence at the top.
 *
 * It names the trade, because the trade is the lesson. A kid who reads "you
 * charged more, sold fewer, and came out ahead" has just been handed the entire
 * idea of a demand curve without the phrase being used, and they were the one
 * who did it.
 */
function headlineFor(
  from: Try,
  to: Try,
  gap: number,
  priceEffect: number,
  cupsEffect: number,
): string {
  const dearer = to.price > from.price;
  const cheaper = to.price < from.price;
  const soldFewer = to.cupsSold < from.cupsSold;
  const soldMore = to.cupsSold > from.cupsSold;

  if (gap === 0) return 'Exactly the same money, a different way of getting it.';

  if (dearer && soldFewer) {
    return gap > 0
      ? 'You charged more and sold fewer — and still came out ahead.'
      : 'You charged more, and lost more cups than the extra money was worth.';
  }
  if (cheaper && soldMore) {
    return gap > 0
      ? 'You charged less and sold more — and the extra cups more than paid for it.'
      : 'You charged less and sold more, and still ended up with less.';
  }
  if (to.turnedAway > 0 && to.turnedAway > from.turnedAway) {
    return `You ran out. ${to.turnedAway} people wanted one and you had nothing to sell them.`;
  }
  if (to.spoiledLemons > from.spoiledLemons) {
    return 'You made more than the street wanted, and paid for the difference in lemons.';
  }
  if (Math.abs(priceEffect) > Math.abs(cupsEffect)) {
    return gap > 0 ? 'The price did that.' : 'The price cost you that.';
  }
  return gap > 0 ? 'The extra cups did that.' : 'The missing cups did that.';
}

function cents(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** The day being replayed, described the way the kid will read it. */
export function crowdLabel(past: DayRecord): string {
  const weather =
    past.weather === 'hot' ? 'a hot day' : past.weather === 'cold' ? 'a cold day' : 'a mild day';
  return `Day ${past.day}'s crowd — ${weather}`;
}

/** Whether a rehearsal is possible at all. Old saves kept no seed. */
export function canRehearse(past: DayRecord | undefined): past is DayRecord {
  return Boolean(past && past.seedBefore !== undefined && past.forecast !== undefined);
}
