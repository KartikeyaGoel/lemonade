/**
 * The one decision inside a day.
 *
 * Four of five children in the pilot skipped the day, and one of them taught
 * the others how. The fix is a question at lunchtime, and everything about it
 * that could go wrong is arithmetic: a second price in a single day means the
 * close screen shows two figures that must reconcile (PRODUCT.md §4), and it
 * means `buildCustomers` has to stay byte-identical on the days nobody changes
 * anything or two children on one challenge code stop getting the same week.
 *
 * So this file asks three things:
 *
 *  1. A day with one price is exactly the day it always was.
 *  2. A day with two prices adds up.
 *  3. The direction is right — a cut can only gain customers, a rise can only
 *     lose them — which is the demand curve and the entire lesson.
 */
import { describe, expect, it } from 'vitest';
import {
  ECON,
  MORNING_SHARE,
  createInitialState,
  orderForTargetCups,
  round2,
  deriveInsights,
  runDay,
  type DayOutcome,
  type GameState,
} from '../src/lib/simulation';
import {
  MIDDAY_STEP_CENTS,
  middayCall,
  middayOptions,
  middayResult,
} from '../src/lib/midday';
import { money } from '../src/lib/copy';
import { closingLine } from '../src/lib/guide';

function day(
  seed: number,
  price: number,
  cups = 36,
  afternoonPrice?: number,
  state?: GameState,
): DayOutcome {
  const stand = state ?? createInitialState(seed);
  return runDay(stand, {
    ...orderForTargetCups(stand, cups),
    price,
    ...(afternoonPrice === undefined ? {} : { afternoonPrice }),
  });
}

describe('a day nobody changed', () => {
  it('is the same day it was before lunchtime existed', () => {
    /*
     * The invariant everything else rests on. `buildCustomers` short-circuits
     * on an unmoved price so the generator advances identically, and the seed
     * carried into tomorrow is what `tests/challenge.test.ts` pins.
     */
    for (const seed of [1, 7, 42, 2026, 99991]) {
      const plain = day(seed, 1.5);
      const explicit = day(seed, 1.5, 36, 1.5);
      expect(explicit.cupsSold, `seed ${seed}`).toBe(plain.cupsSold);
      expect(explicit.revenue, `seed ${seed}`).toBe(plain.revenue);
      expect(explicit.profit, `seed ${seed}`).toBe(plain.profit);
      expect(explicit.nextState.seed, `seed ${seed}: tomorrow`).toBe(plain.nextState.seed);
      expect(explicit.customers, `seed ${seed}: the crowd`).toEqual(plain.customers);
    }
  });

  it('reports one price and the whole day under it', () => {
    const outcome = day(11, 1.5);
    expect(outcome.afternoonPrice).toBe(outcome.price);
    expect(outcome.afternoonCups).toBe(0);
    expect(outcome.morningCups + outcome.subscriberCups).toBe(outcome.cupsSold);
    expect(outcome.afternoonRevenue).toBe(0);
    expect(outcome.morningRevenue).toBe(outcome.walkupRevenue);
    // Nothing in the record, so a save reads back as the one-price day it was.
    expect(outcome.nextState.history.at(-1)!.afternoonPrice).toBeUndefined();
    // And nothing to say about it on the close screen.
    expect(middayResult(outcome)).toBeNull();
  });
});

describe('a day with two prices', () => {
  it('adds up, at every price and in both directions', () => {
    /*
     * §4's rule, swept rather than sampled. Revenue on a two-price day is not
     * `cups × price` for any single price, so the two halves are the only
     * figures that can be shown — and they have to sum to the whole and to the
     * profit the cash box moved by.
     */
    let checked = 0;
    for (const seed of [1, 3, 9, 17, 42, 88, 2026]) {
      for (const price of [0.75, 1.2, 1.5, 2.1]) {
        for (const step of [-0.5, -0.25, 0.25, 0.5]) {
          const afternoon = round2(Math.max(0, price + step));
          const outcome = day(seed, price, 36, afternoon);
          const where = `seed ${seed} ${price}→${afternoon}`;

          expect(outcome.afternoonPrice, where).toBeCloseTo(afternoon, 2);
          expect(outcome.morningCups + outcome.afternoonCups + outcome.subscriberCups, where).toBe(
            outcome.cupsSold,
          );
          expect(outcome.morningRevenue, where).toBeCloseTo(outcome.morningCups * price, 2);
          expect(outcome.afternoonRevenue, where).toBeCloseTo(
            outcome.afternoonCups * afternoon,
            2,
          );
          expect(outcome.walkupRevenue, where).toBeCloseTo(
            outcome.morningRevenue + outcome.afternoonRevenue,
            2,
          );
          expect(outcome.revenue, where).toBeCloseTo(
            outcome.walkupRevenue + outcome.subscriberRevenue,
            2,
          );
          // The cash box agrees with the profit, which is the identity
          // `tests/pnl.test.ts` holds for one-price days.
          expect(outcome.cashAfter, where).toBeCloseTo(
            round2(
              outcome.cashBefore -
                outcome.purchases.cost.total +
                outcome.revenue -
                outcome.standFee -
                outcome.investorCut +
                outcome.cashTopUp,
            ),
            2,
          );
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('leaves the morning exactly as it was', () => {
    /*
     * The property that makes the screen work: the child watches the morning,
     * is asked, and the day is re-run. If the answer changed the morning, the
     * customers already on screen would have to be taken back.
     */
    for (const seed of [2, 13, 77, 404]) {
      const before = day(seed, 1.5);
      const raised = day(seed, 1.5, 36, 1.9);
      const cut = day(seed, 1.5, 36, 1.1);
      const upTo = Math.floor(
        before.customers.filter((c) => c.kind === 'passerby').length * MORNING_SHARE,
      );
      const morningOf = (o: DayOutcome) =>
        o.customers.filter((c) => c.kind === 'passerby').slice(0, upTo).map((c) => c.outcome);

      expect(morningOf(raised), `seed ${seed}: raised`).toEqual(morningOf(before));
      expect(morningOf(cut), `seed ${seed}: cut`).toEqual(morningOf(before));
      // And the weather and the footfall are the same day.
      expect(raised.weather).toBe(before.weather);
      expect(raised.passersby).toBe(before.passersby);
      expect(cut.passersby).toBe(before.passersby);
    }
  });

  it('moves demand the only direction demand can move', () => {
    /*
     * A cut can only ever gain afternoon customers and a rise can only ever
     * lose them, because each passer-by's reservation price is drawn once and
     * re-read at whatever the sign says. If this ever failed, the game would
     * be teaching that charging more sells more.
     *
     * Compared on walk-aways rather than on cups sold, because capacity can
     * mask the gain: a child who cuts the price when the jug is nearly empty
     * sells the same cups either way, which is itself the lesson in the
     * running-out case.
     */
    for (const seed of [5, 23, 61, 1234, 90210]) {
      const held = day(seed, 1.5, 60);
      const cut = day(seed, 1.5, 60, 1.0);
      const raised = day(seed, 1.5, 60, 2.0);
      expect(cut.walkedAwayOnPrice, `seed ${seed}: cut`).toBeLessThanOrEqual(
        held.walkedAwayOnPrice,
      );
      expect(raised.walkedAwayOnPrice, `seed ${seed}: raised`).toBeGreaterThanOrEqual(
        held.walkedAwayOnPrice,
      );
    }
  });

  it('says what the change did, with both figures', () => {
    const outcome = day(9, 1.5, 20, 2.0);
    const said = middayResult(outcome)!;
    expect(said).toContain('$1.50');
    expect(said).toContain('$2.00');
    expect(said).toContain('higher');
  });
});

describe('when the child is asked', () => {
  it('offers three answers, one of which changes nothing', () => {
    for (const price of [0.05, 0.25, 1, 1.45, 2.95]) {
      const options = middayOptions(price);
      expect(options.map((o) => o.id)).toEqual(['down', 'hold', 'up']);
      expect(options[1].price).toBe(price);
      /*
       * Counted in cents. `1.45 - 0.25` in floats is 1.2000000000000002, and a
       * price that renders as $1.20 while the simulation is charging something
       * else is the defect class PRODUCT.md §67 is about.
       */
      expect(Math.round(options[0].price * 100)).toBe(
        Math.max(0, Math.round(price * 100) - MIDDAY_STEP_CENTS),
      );
      expect(Math.round(options[2].price * 100)).toBe(Math.round(price * 100) + MIDDAY_STEP_CENTS);
      // Never a negative sign, however cheap the morning was.
      expect(options[0].price).toBeGreaterThanOrEqual(0);
    }
  });

  it('stays quiet on a day that is simply going fine', () => {
    /*
     * A beat with nothing at stake teaches a child that the beat does not
     * matter, so most ordinary days must not have one. Swept rather than
     * asserted: a sensible price with a batch sized to the crowd should be
     * left alone far more often than not.
     */
    let quiet = 0;
    let asked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const outcome = day(seed, 1.5, 34);
      if (middayCall(outcome)) asked++;
      else quiet++;
    }
    expect(quiet, 'never quiet').toBeGreaterThan(0);
    expect(asked, 'never asks').toBeGreaterThan(0);
  });

  it('asks when the batch will not reach the end of the day', () => {
    /*
     * The running-out case. A sensible price against a batch that is a little
     * too small, which a sweep of eight prices against six batch sizes puts at
     * 27 of 40 seeds — the most common shape of day at competent play, and the
     * one the old close screen could only ever report after the fact.
     */
    const found = Array.from({ length: 20 }, (_, i) => middayCall(day(i + 1, 1.5, 28))).filter(
      (call) => call?.lean === 'running-out',
    );
    expect(found.length, 'a small batch never ran short').toBeGreaterThan(5);
    for (const call of found) {
      expect(call!.cupsLeft).toBeGreaterThan(0);
      expect(call!.says.join(' ')).toMatch(/left/);
    }
  });

  it('stays quiet when the jug is already empty, because there is no decision', () => {
    /*
     * A very cheap price against a tiny batch clears the jug long before
     * lunch. The day *did* turn people away, so the sold-out half of the
     * condition is true — and there is still nothing to ask, because a child
     * holding an empty jug cannot price anything. Pinned because the first
     * version of this module used a quarter-of-the-batch threshold and got
     * this backwards.
     */
    const anyAsked = Array.from({ length: 20 }, (_, i) => {
      const outcome = day(i + 1, 0.5, 8);
      return { outcome, call: middayCall(outcome) };
    });
    const soldOut = anyAsked.filter(({ outcome }) => outcome.turnedAwaySoldOut > 0);
    expect(soldOut.length, 'nothing sold out at 50c on eight cups').toBeGreaterThan(10);
    for (const { call } of soldOut) {
      if (call) expect(call.cupsLeft, 'asked about an empty jug').toBeGreaterThan(0);
    }
  });

  it('asks when more people said no than yes', () => {
    /* The not-selling case: a dear price against a big batch. */
    const found = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map((seed) => middayCall(day(seed, 2.9, 60)))
      .filter((call) => call?.lean === 'not-selling');
    expect(found.length, 'a $2.90 cup never went unsold').toBeGreaterThan(0);
    for (const call of found) {
      expect(call!.walkedOn).toBeGreaterThan(0);
      expect(call!.says.join(' ')).toContain('kept walking');
    }
  });

  it('never tells the child what to do', () => {
    /*
     * `guide.ts`'s rule, held mechanically. Every sentence this module can
     * produce is swept for the imperatives that would turn an observation into
     * advice — which is the line between a game and a worksheet, and the one
     * thing that would make the parent report worthless.
     */
    const forbidden =
      /\b(should|try|make more|raise it|drop it|lower it|charge|you need to|why not)\b/i;
    for (let seed = 1; seed <= 40; seed++) {
      for (const [price, cups] of [
        [0.5, 12],
        [1.5, 34],
        [2.9, 60],
      ] as const) {
        const call = middayCall(day(seed, price, cups));
        if (!call) continue;
        for (const line of call.says) {
          expect(line, `seed ${seed} @ ${price}`).not.toMatch(forbidden);
        }
      }
    }
  });

  it('never asks about an afternoon that does not exist', () => {
    /*
     * A cold day with a dear price draws almost nobody, and asking a child to
     * price an afternoon with two people left in it is a decision that cannot
     * matter.
     */
    for (let seed = 1; seed <= 40; seed++) {
      const outcome = day(seed, 2.95, 4);
      const call = middayCall(outcome);
      if (!call) continue;
      const crowd = outcome.customers.filter((c) => c.kind === 'passerby').length;
      expect(crowd, `seed ${seed}`).toBeGreaterThanOrEqual(4);
    }
  });
});

/*
 * The defect class the second price created, guarded generally.
 *
 * The revenue word card read **"28 cups x $1.00 = $29.50"** on the first day of
 * a fresh run, because it was written when a day could only have one price and
 * it multiplied the whole day's cups by the morning sign. It was not found by a
 * test — it was read off a phone.
 *
 * So rather than fix two sentences and hope, this sweeps every sentence the
 * insight deriver can produce on a two-price day and checks the arithmetic in
 * it. Any copy of the shape `N cups x $P = $R` has to be true.
 */
describe('no sentence claims arithmetic that does not close', () => {
  /** Every `N thing x $P ... = $R` claim in a string, with the sum checked. */
  function badSums(text: string): string[] {
    const bad: string[] = [];
    /*
     * One or more `count x price` terms, then a total. Written to match the
     * two shapes the copy actually uses — one term, or two joined by "and" —
     * rather than trying to parse English.
     */
    /*
     * `\d+(?:\.\d+)?` rather than `[\d.]+`, and that is not pedantry — the
     * first version of this guard captured "$29.50." *with the full stop*,
     * `Number` gave it `NaN`, `Math.abs(NaN - x) > 0.011` is false, and the
     * test passed on the exact string it was written to catch. A guard that
     * cannot fail guards nothing, which is why the assertion below it exists.
     */
    const money = String.raw`\$(\d+(?:\.\d+)?)`;
    const claim = new RegExp(
      String.raw`(\d+)\s*cups?\s*x\s*${money}(?:\s*and\s*(\d+)\s*cups?\s*x\s*${money})?\s*=\s*${money}`,
      'gi',
    );
    for (const m of text.matchAll(claim)) {
      const [, n1, p1, n2, p2, total] = m;
      let sum = Number(n1) * Number(p1);
      if (n2 && p2) sum += Number(n2) * Number(p2);
      if (Math.abs(sum - Number(total)) > 0.011) {
        bad.push(`${m[0]} — the terms come to $${sum.toFixed(2)}`);
      }
    }
    return bad;
  }

  it('catches the sum that shipped', () => {
    /* The guard has to fail on the real defect, or it guards nothing. */
    expect(badSums('28 cups x $1.00 = $29.50. That is revenue')).toHaveLength(1);
    expect(badSums('22 cups x $1.00 and 6 cups x $1.25 = $29.50')).toHaveLength(0);
    expect(badSums('28 cups x $1.00 = $28.00')).toHaveLength(0);
  });

  it('holds for every word a two-price day can earn', () => {
    let seen = 0;
    for (const seed of [1, 4, 9, 17, 31, 42, 77, 2026]) {
      for (const price of [0.75, 1, 1.5, 2.2]) {
        for (const afternoon of [0.5, 1.25, 1.75, 2.75]) {
          const outcome = day(seed, price, 28, afternoon);
          for (const insight of deriveInsights(outcome, outcome.nextState.history)) {
            const where = `seed ${seed} ${price}→${afternoon} · ${insight.id}`;
            expect(badSums(insight.evidence), where).toEqual([]);
            expect(badSums(insight.carriesForward), where).toEqual([]);
            seen++;
          }
        }
      }
    }
    expect(seen, 'no words were produced, so nothing was checked').toBeGreaterThan(20);
  });

  it('never attributes the whole day to one of two prices', () => {
    /*
     * The elasticity card said "28 people looked at $2.50 and kept walking" on
     * a day whose sign changed to $2.25 halfway through. Some of them never
     * saw $2.50. A sentence that names exactly one price on a two-price day
     * must not also claim to cover everybody.
     */
    for (const seed of [3, 11, 23, 57]) {
      const outcome = day(seed, 2.5, 40, 2.25);
      for (const insight of deriveInsights(outcome, outcome.nextState.history)) {
        const names = (p: number) => insight.evidence.includes(`$${p.toFixed(2)}`);
        if (names(outcome.price) && !names(outcome.afternoonPrice)) {
          expect(
            insight.evidence,
            `${insight.id} pinned the day on one of two prices`,
          ).not.toMatch(/kept walking|paid it|all the money/i);
        }
      }
    }
  });
});

/**
 * Sending out for more cups — the half of the pilot's note the first pass
 * missed.
 *
 * > perhaps the external variables can help them revisit their choices of
 * > **#of cups**, price, location etc.
 *
 * Price was revisitable at lunchtime; the number of cups was not, and
 * `midday.ts` carried a note saying so. The question this file has to answer is
 * whether it is a *decision* or free money, because "sell more cups" sounds
 * like something a child should always say yes to.
 */
describe('buying more cups at lunchtime', () => {
  it('is offered only on a day that is running short', () => {
    /*
     * On a day nobody is buying, offering to make *more* would be the screen
     * suggesting something absurd — and a child who trusted it would be
     * punished for trusting the screen.
     */
    expect(middayOptions(1.5, 'running-out').some((o) => o.id === 'more')).toBe(true);
    expect(middayOptions(1.5, 'not-selling').some((o) => o.id === 'more')).toBe(false);
    expect(middayOptions(1.5).some((o) => o.id === 'more')).toBe(false);
  });

  it('keeps the three price answers where they were', () => {
    /* A child who has learned where "keep" sits must not find it moved. */
    const ids = middayOptions(1.5, 'running-out').map((o) => o.id);
    expect(ids).toEqual(['down', 'hold', 'up', 'more']);
  });

  it('adds cups the afternoon can actually sell, and charges for them', () => {
    const stand = createInitialState(3);
    const order = orderForTargetCups(stand, 16);
    const plain = runDay(stand, { ...order, price: 1.0 });
    const topped = runDay(stand, { ...order, price: 1.0, afternoonTopUp: 12 });

    expect(topped.afternoonTopUp).toBe(12);
    expect(topped.topUpCost).toBeCloseTo(12 * ECON.TOPUP_COST_PER_CUP, 2);
    // A day that was turning people away sells more of them.
    expect(plain.turnedAwaySoldOut).toBeGreaterThan(0);
    expect(topped.cupsSold).toBeGreaterThan(plain.cupsSold);
    // And the morning is untouched, as with a price change.
    expect(topped.morningCups).toBe(
      plain.customers.filter(
        (c, i) =>
          c.kind === 'passerby' &&
          c.outcome === 'bought' &&
          i < Math.floor(plain.customers.length * MORNING_SHARE),
      ).length,
    );
  });

  it('still adds up, at every price and in both directions', () => {
    /*
     * §4, swept. A top-up is a cost of goods that consumed nothing from the
     * pantry, so it sits above gross profit beside the ingredients and in the
     * cash line — two extra terms, and if either were missed the day would be
     * out by exactly the cost of the cups.
     */
    let checked = 0;
    for (const seed of [1, 5, 13, 29, 77]) {
      for (const price of [0.5, 1.0, 1.6, 2.4]) {
        for (const topUp of [0, 6, 12, 24]) {
          const stand = createInitialState(seed);
          const order = orderForTargetCups(stand, 20);
          const o = runDay(stand, { ...order, price, afternoonTopUp: topUp });
          const where = `seed ${seed} @ ${price} +${topUp}`;

          expect(o.grossProfit, where).toBeCloseTo(
            round2(o.revenue - o.ingredients.total - o.topUpCost),
            2,
          );
          expect(o.profit, where).toBeCloseTo(
            round2(
              o.revenue -
                o.ingredients.total -
                o.topUpCost -
                o.standFee -
                o.spoilageCost -
                o.investorCut,
            ),
            2,
          );
          expect(o.cashAfter, where).toBeCloseTo(
            round2(
              o.cashBefore -
                o.purchases.cost.total -
                o.topUpCost +
                o.revenue -
                o.standFee -
                o.investorCut +
                o.cashTopUp,
            ),
            2,
          );
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(60);
  });

  it('is never charged for more than the cash box holds', () => {
    /*
     * The same rule `clampPurchaseToCash` applies to the morning. A negative
     * cash balance is a bug a nine-year-old reads as the game breaking.
     */
    const stand = { ...createInitialState(4), cash: 1 };
    const o = runDay(stand, { ...orderForTargetCups(stand, 8), price: 1.0, afternoonTopUp: 40 });
    expect(o.topUpCost).toBeLessThanOrEqual(1);
    expect(o.afternoonTopUp).toBeLessThanOrEqual(Math.floor(1 / ECON.TOPUP_COST_PER_CUP));
  });

  it('is a decision rather than free money', () => {
    /*
     * The property that makes it worth building. "Sell more cups" sounds like
     * something to always say yes to, and if it were, it would be a tax on
     * attention rather than a choice.
     *
     * It is not, for two reasons the arithmetic guarantees: a ready-made cup
     * costs more than twice a planned one, and cups bought and not sold are
     * gone. So there must exist days where topping up *loses* money — and days
     * where it clearly wins, or nobody would ever take it.
     */
    let better = 0;
    let worse = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const price of [0.5, 0.75, 1.0, 1.5, 2.0]) {
        for (const cups of [12, 20, 32]) {
          const stand = createInitialState(seed);
          const order = orderForTargetCups(stand, cups);
          const plain = runDay(stand, { ...order, price });
          if (!middayCall(plain) || middayCall(plain)!.lean !== 'running-out') continue;
          const topped = runDay(stand, { ...order, price, afternoonTopUp: ECON.TOPUP_CUPS });
          if (topped.profit > plain.profit + 0.005) better++;
          else if (topped.profit < plain.profit - 0.005) worse++;
        }
      }
    }
    expect(better, 'topping up never once paid').toBeGreaterThan(10);
    expect(worse, 'topping up always paid, so it is not a decision').toBeGreaterThan(10);
  });

  it('says what it cost, against what the morning cost', () => {
    const stand = createInitialState(3);
    const o = runDay(stand, {
      ...orderForTargetCups(stand, 16),
      price: 1.0,
      afternoonTopUp: 12,
    });
    const said = middayResult(o)!;
    expect(said).toMatch(/12 more cups/);
    expect(said).toContain(money(o.topUpCost));
    // The comparison is the lesson: late is dearer than planned.
    expect(said).toContain(money(round2(ECON.TOPUP_COST_PER_CUP)));
  });
});

describe('a top-up day never claims to have sold more cups than it had', () => {
  it('counts the lunchtime cups in "how many you had"', () => {
    /*
     * Found on the first browser run after the top-up shipped: the ledger read
     * **"40 of 28 cups sold"**, and Pip said "you had 28" about a day with
     * forty. `cupsMakeable` is what the morning's shopping poured and has to
     * stay that — mid-day the jar fills against it and the sell-out warning is
     * about it — so every sentence meaning "how many you had" needs
     * `cupsAvailable` instead.
     */
    /*
     * Searched for rather than hard-coded: the defect only shows on a day whose
     * afternoon actually eats into the cups bought at lunchtime, and which
     * seeds do that depends on the weather roll. Picking one by hand is how a
     * test ends up passing because the fixture drifted rather than because the
     * code is right.
     */
    const oversold = (() => {
      for (let seed = 1; seed <= 80; seed++) {
        const stand = createInitialState(seed);
        const order = orderForTargetCups(stand, 28);
        const day = runDay(stand, { ...order, price: 0.75, afternoonTopUp: 12 });
        if (day.cupsSold > day.cupsMakeable) return day;
      }
      return null;
    })();
    expect(oversold, 'no seed in eighty sold past the morning batch').not.toBeNull();
    const o = oversold!;

    expect(o.cupsAvailable).toBe(o.cupsMakeable + o.afternoonTopUp);
    // The invariant that was broken: never more sold than there were to sell.
    expect(o.cupsSold).toBeLessThanOrEqual(o.cupsAvailable);
    expect(closingLine(o)).not.toContain(`you had ${o.cupsMakeable}.`);
    expect(closingLine(o)).toContain(`you had ${o.cupsAvailable}.`);
  });

  it('holds that invariant across the sweep, top-up or not', () => {
    for (const seed of [1, 9, 23, 55, 91]) {
      for (const topUp of [0, 12, 24]) {
        for (const price of [0.5, 1.0, 1.8]) {
          const stand = createInitialState(seed);
          const o = runDay(stand, {
            ...orderForTargetCups(stand, 20),
            price,
            afternoonTopUp: topUp,
          });
          expect(o.cupsSold, `seed ${seed} @${price} +${topUp}`).toBeLessThanOrEqual(
            o.cupsAvailable,
          );
        }
      }
    }
  });
});
