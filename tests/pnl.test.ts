import { describe, it, expect } from 'vitest';
import {
  ECON,
  createInitialState,
  runDay,
  orderForTargetCups,
  maxAffordableCups,
  purchaseCost,
  ingredientCostOf,
  cupsMakeableFrom,
  totalLemons,
  clampPurchaseToCash,
  type GameState,
} from '../src/lib/simulation';

/** A state with a known pantry and cash, for arithmetic that must be exact. */
function stateWith(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(1), ...overrides };
}

describe('the P&L is arithmetic a kid can redo by hand', () => {
  it('revenue is exactly cups sold times price', () => {
    const state = stateWith({ cash: 200, forecast: 'probably-mild' });
    const outcome = runDay(state, { ...orderForTargetCups(state, 60), price: 1.6 });
    expect(outcome.revenue).toBeCloseTo(outcome.cupsSold * outcome.price, 2);
  });

  it('profit is revenue minus ingredients minus stand fee minus spoilage, and nothing else', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 50), price: 1.5 });
    const expected =
      outcome.revenue - outcome.ingredients.total - outcome.standFee - outcome.spoilageCost;
    expect(outcome.profit).toBeCloseTo(expected, 2);
  });

  it('gross profit is revenue minus ingredients', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 40), price: 1.75 });
    expect(outcome.grossProfit).toBeCloseTo(outcome.revenue - outcome.ingredients.total, 2);
  });

  it('gross margin per cup is price minus per-cup cost', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 40), price: 1.6 });
    expect(outcome.grossMarginPerCup).toBeCloseTo(outcome.price - outcome.ingredients.perCup, 2);
  });

  it('breaks the ingredient bill into lemons, sugar and cups that sum to the total', () => {
    const bill = ingredientCostOf(28);
    expect(bill.lemonsUsed).toBe(7); // 28 cups / 4 cups per lemon
    expect(bill.lemons).toBeCloseTo(3.5, 2);
    expect(bill.sugar).toBeCloseTo(1.12, 2);
    expect(bill.cups).toBeCloseTo(0.84, 2);
    expect(bill.total).toBeCloseTo(5.46, 2);
    expect(bill.lemons + bill.sugar + bill.cups).toBeCloseTo(bill.total, 2);
    expect(bill.perCup).toBeCloseTo(0.195, 3);
  });

  it('charges the stand fee even on a day with no sales at all', () => {
    const state = stateWith({ cash: 50 });
    const outcome = runDay(state, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 5 });
    expect(outcome.cupsSold).toBe(0);
    expect(outcome.revenue).toBe(0);
    expect(outcome.profit).toBe(-ECON.STAND_FEE);
  });

  it('reconciles cash: start minus shopping minus fee plus sales', () => {
    const state = stateWith({ cash: 200 });
    const order = orderForTargetCups(state, 40);
    const outcome = runDay(state, { ...order, price: 1.6 });
    const expected =
      state.cash - outcome.purchases.cost.total - outcome.standFee + outcome.revenue;
    expect(outcome.cashAfter).toBeCloseTo(expected, 2);
    expect(outcome.cashFloored).toBe(false);
  });

  it('never reports a cent it cannot show, at any price, on any day', () => {
    for (let cents = 0; cents <= 300; cents += 7) {
      const state = stateWith({ cash: 500, seed: cents });
      const outcome = runDay(state, { ...orderForTargetCups(state, 90), price: cents / 100 });
      expect(outcome.revenue).toBeCloseTo(outcome.cupsSold * outcome.price, 2);
      expect(outcome.profit).toBeCloseTo(
        outcome.revenue - outcome.ingredients.total - outcome.standFee - outcome.spoilageCost,
        2,
      );
      expect(outcome.ingredients.lemons + outcome.ingredients.sugar + outcome.ingredients.cups)
        .toBeCloseTo(outcome.ingredients.total, 2);
    }
  });
});

describe('every figure on screen reconciles with the others on paper', () => {
  // PRODUCT.md: the P&L must be arithmetic the kid can verify by hand. If two
  // displayed numbers do not subtract to a third displayed number, we have
  // quietly lied to them.
  it('price minus displayed per-cup cost equals displayed margin, at any price', () => {
    for (let cents = 25; cents <= 300; cents += 5) {
      const price = cents / 100;
      const state = stateWith({ cash: 500, seed: cents });
      const outcome = runDay(state, { ...orderForTargetCups(state, 40), price });
      if (outcome.cupsSold === 0) continue;
      const shownCost = Number(outcome.ingredients.perCup.toFixed(2));
      const shownMargin = Number(outcome.grossMarginPerCup.toFixed(2));
      expect(Number((price - shownCost).toFixed(2))).toBeCloseTo(shownMargin, 2);
    }
  });

  it('the itemised ingredient lines add up to the ingredient total exactly', () => {
    for (const cups of [1, 7, 13, 28, 40, 63]) {
      const bill = ingredientCostOf(cups);
      const shown = Number((bill.lemons + bill.sugar + bill.cups).toFixed(2));
      expect(shown).toBeCloseTo(Number(bill.total.toFixed(2)), 2);
    }
  });

  it('revenue, ingredients, fee and spoilage subtract to the printed profit', () => {
    const state = stateWith({ cash: 300, day: 3, lemonLots: [{ lemons: 6, purchasedOnDay: 1 }] });
    const outcome = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 });
    const byHand = Number(
      (
        outcome.revenue -
        outcome.ingredients.total -
        outcome.standFee -
        outcome.spoilageCost
      ).toFixed(2),
    );
    expect(byHand).toBeCloseTo(outcome.profit, 2);
  });
});

describe('sales are capped by what the kid could actually pour', () => {
  it('never sells more cups than it can make', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 5), price: 0.5 });
    expect(outcome.cupsSold).toBeLessThanOrEqual(outcome.cupsMakeable);
    // Asking for 5 cups buys 2 whole lemons, which pour 8. Supplies come in
    // lumps and the game must never pretend otherwise.
    expect(outcome.cupsSold).toBe(8);
    expect(outcome.turnedAwaySoldOut).toBeGreaterThan(0);
  });

  it('never sells more cups than customers wanted', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 90), price: 2.5 });
    expect(outcome.cupsSold).toBeLessThanOrEqual(outcome.cupsWanted);
  });

  it('cups makeable is limited by whichever ingredient runs out first', () => {
    expect(cupsMakeableFrom(10, 100, 100).cups).toBe(40); // lemons bind
    expect(cupsMakeableFrom(10, 12, 100).cups).toBe(12); // sugar binds
    expect(cupsMakeableFrom(10, 100, 7).cups).toBe(7); // cups bind
    expect(cupsMakeableFrom(10, 12, 100).limitedBy).toBe('sugar');
    expect(cupsMakeableFrom(10, 100, 7).limitedBy).toBe('cups');
    expect(cupsMakeableFrom(2, 100, 100).limitedBy).toBe('lemons');
  });

  it('every passer-by is accounted for as bought, too expensive, or sold out', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 12), price: 1.2 });
    expect(outcome.customers.length).toBe(outcome.passersby);
    expect(outcome.cupsSold + outcome.walkedAwayOnPrice + outcome.turnedAwaySoldOut).toBe(
      outcome.passersby,
    );
    expect(outcome.customers.filter((c) => c.outcome === 'bought').length).toBe(outcome.cupsSold);
  });

  it('customers who walk away really would not pay the price, and buyers would', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 90), price: 1.6 });
    for (const customer of outcome.customers) {
      if (customer.outcome === 'too-expensive') {
        expect(customer.reservationPrice).toBeLessThanOrEqual(outcome.price);
      } else {
        expect(customer.reservationPrice).toBeGreaterThanOrEqual(outcome.price);
      }
    }
  });
});

describe('inventory and spoilage', () => {
  it('carries unused sugar and cups to the next day', () => {
    const state = stateWith({ cash: 200 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 40), price: 2.5 });
    expect(outcome.cupsSold).toBeLessThan(40);
    expect(outcome.nextState.sugarServings).toBeGreaterThan(0);
    expect(outcome.nextState.cupsInStock).toBeGreaterThan(0);
  });

  it('throws out lemons on their third day, and charges for them', () => {
    const state = stateWith({
      cash: 200,
      day: 3,
      lemonLots: [{ lemons: 8, purchasedOnDay: 1 }],
      sugarServings: 0,
      cupsInStock: 0,
    });
    // No sugar or cups, so nothing can be poured and every lemon is stale.
    const outcome = runDay(state, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 1.6 });
    expect(outcome.cupsSold).toBe(0);
    expect(outcome.spoiledLemons).toBe(8);
    expect(outcome.spoilageCost).toBeCloseTo(4, 2);
    expect(outcome.nextState.lemonLots).toHaveLength(0);
  });

  it('keeps lemons that are still fresh', () => {
    const state = stateWith({ cash: 200, day: 1, lemonLots: [{ lemons: 8, purchasedOnDay: 1 }] });
    const outcome = runDay(state, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 3 });
    expect(outcome.spoiledLemons).toBe(0);
    expect(totalLemons(outcome.nextState.lemonLots)).toBe(8);
  });

  it('spends the oldest lemons first, so buying fresh does not waste old stock', () => {
    const state = stateWith({
      cash: 200,
      day: 2,
      lemonLots: [
        { lemons: 4, purchasedOnDay: 1 },
        { lemons: 4, purchasedOnDay: 2 },
      ],
      sugarServings: 100,
      cupsInStock: 100,
    });
    const outcome = runDay(state, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 2.6 });
    // 8 cups sold uses 2 lemons, both from the day-1 lot.
    expect(outcome.ingredients.lemonsUsed).toBe(2);
    const dayOneLot = outcome.nextState.lemonLots.find((l) => l.purchasedOnDay === 1);
    expect(dayOneLot?.lemons).toBe(2);
    expect(outcome.nextState.lemonLots.find((l) => l.purchasedOnDay === 2)?.lemons).toBe(4);
  });

  it('punishes over-buying: a huge order on a cold day destroys real money', () => {
    const state = stateWith({ cash: 200, day: 1, forecast: 'probably-cold', seed: 7 });
    const outcome = runDay(state, { ...orderForTargetCups(state, 90), price: 2.0 });
    expect(outcome.purchases.cost.total).toBeGreaterThan(10);
    expect(outcome.cupsSold).toBeLessThan(40);
  });
});

describe('one decision in, a real shopping list out', () => {
  it('buys exactly enough for the batch the kid asked for', () => {
    const state = stateWith({ cash: 200 });
    const order = orderForTargetCups(state, 28);
    expect(order.buyLemons).toBe(7);
    expect(order.buySugarPacks).toBe(3);
    expect(order.buyCupPacks).toBe(3);
    const pantry = { lemons: 7, sugar: 30, cups: 30 };
    expect(cupsMakeableFrom(pantry.lemons, pantry.sugar, pantry.cups).cups).toBe(28);
  });

  it('uses up the pantry before buying more', () => {
    const state = stateWith({
      cash: 200,
      lemonLots: [{ lemons: 7, purchasedOnDay: 1 }],
      sugarServings: 30,
      cupsInStock: 30,
    });
    const order = orderForTargetCups(state, 28);
    expect(order).toEqual({ buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0 });
    expect(purchaseCost(order).total).toBe(0);
  });

  it('a 28 cup batch from an empty pantry costs $5.60, affordable on day one', () => {
    const state = createInitialState(1);
    const cost = purchaseCost(orderForTargetCups(state, 28));
    expect(cost.total).toBeCloseTo(5.6, 2);
    expect(cost.total + ECON.STAND_FEE).toBeLessThan(ECON.STARTING_CASH);
  });

  it('the max affordable batch always leaves the stand fee covered', () => {
    const state = createInitialState(1);
    const max = maxAffordableCups(state);
    expect(max).toBeGreaterThanOrEqual(28); // the optimum must be reachable on day one
    const cost = purchaseCost(orderForTargetCups(state, max)).total;
    expect(cost).toBeLessThanOrEqual(state.cash - ECON.STAND_FEE);
  });
});

describe('progression is monotonic — a kid never ends below where they started', () => {
  it('floors cash at the $20 starting float', () => {
    const state = stateWith({ cash: ECON.STARTING_CASH });
    // Worst case: buy a big batch at a price nobody will pay.
    const outcome = runDay(state, { ...orderForTargetCups(state, 28), price: 5 });
    expect(outcome.cupsSold).toBe(0);
    expect(outcome.profit).toBeLessThan(0);
    expect(outcome.cashAfter).toBe(ECON.STARTING_CASH);
    expect(outcome.cashFloored).toBe(true);
  });

  it('cash never drops below the starting float across a whole ruinous week', () => {
    let state = createInitialState(99);
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      const outcome = runDay(state, { ...orderForTargetCups(state, 90), price: 4.5 });
      expect(outcome.cashAfter).toBeGreaterThanOrEqual(ECON.STARTING_CASH);
      state = outcome.nextState;
    }
  });

  it('still reports the true loss even when the floor catches the cash', () => {
    const state = stateWith({ cash: ECON.STARTING_CASH });
    const outcome = runDay(state, { ...orderForTargetCups(state, 28), price: 5 });
    // The P&L tells the truth; only the wallet is protected.
    expect(outcome.profit).toBeCloseTo(-ECON.STAND_FEE, 2);
    expect(outcome.cashFloored).toBe(true);
  });

  it('never lets a purchase overdraw the account', () => {
    const state = stateWith({ cash: 3 });
    const outcome = runDay(state, { buyLemons: 100, buySugarPacks: 100, buyCupPacks: 100, price: 1.6 });
    expect(outcome.purchases.cost.total).toBeLessThanOrEqual(3);
    expect(outcome.purchases.clamped).toBe(true);
  });

  it('clamps an unaffordable order down to something that fits', () => {
    const trimmed = clampPurchaseToCash({ buyLemons: 50, buySugarPacks: 50, buyCupPacks: 50 }, 5);
    expect(purchaseCost(trimmed).total).toBeLessThanOrEqual(5);
  });
});

describe('the week', () => {
  it('runs seven days and then finishes', () => {
    let state = createInitialState(42);
    const profits: number[] = [];
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      expect(state.status).toBe('playing');
      expect(state.day).toBe(day);
      const outcome = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 });
      profits.push(outcome.profit);
      state = outcome.nextState;
    }
    expect(state.status).toBe('finished');
    expect(state.history).toHaveLength(7);
    expect(profits).toHaveLength(7);
  });

  it('refuses to run an eighth day', () => {
    let state = createInitialState(42);
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      state = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }).nextState;
    }
    expect(() => runDay(state, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 1 })).toThrow();
  });

  it('records price and profit each day so the closing chart is the kid\'s real data', () => {
    let state = createInitialState(7);
    const prices = [0.5, 0.75, 1, 1.25, 1.6, 2, 2.5];
    for (const price of prices) {
      state = runDay(state, { ...orderForTargetCups(state, 45), price }).nextState;
    }
    expect(state.history.map((h) => h.price)).toEqual(prices);
    for (const record of state.history) {
      expect(Number.isFinite(record.profit)).toBe(true);
      expect(record.cupsSold).toBeLessThanOrEqual(record.cupsWanted);
    }
  });

  it('a kid who plays near the optimum all week comes out well ahead', () => {
    let state = createInitialState(2024);
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      state = runDay(state, { ...orderForTargetCups(state, 42), price: 1.6 }).nextState;
    }
    expect(state.cash).toBeGreaterThan(100);
  });

  it('is deterministic: same seed and same decisions give the same week', () => {
    const play = () => {
      let state = createInitialState(555);
      const log: number[] = [];
      for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
        const outcome = runDay(state, { ...orderForTargetCups(state, 40), price: 1.6 });
        log.push(outcome.profit, outcome.cupsSold);
        state = outcome.nextState;
      }
      return log;
    };
    expect(play()).toEqual(play());
  });

  it('does not mutate the state it is given', () => {
    const state = stateWith({ cash: 200 });
    const snapshot = JSON.stringify(state);
    runDay(state, { ...orderForTargetCups(state, 40), price: 1.6 });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('gives a genuinely uncertain forecast: the same hint resolves different ways', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const state = stateWith({ cash: 200, seed, forecast: 'probably-hot' });
      outcomes.add(runDay(state, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 1.6 }).weather);
    }
    expect(outcomes.size).toBeGreaterThan(1);
    expect(outcomes.has('hot')).toBe(true);
  });
});

describe('the mercy rule is a number, not magic', () => {
  /*
   * The floor is a retention rule and it stays: a kid who goes broke on day
   * three quits, and PRODUCT.md §4 caps the downside on purpose. But it creates
   * money, and while the whole business was one table and a $5 fee the gap was
   * pennies. With a rent, a second pitch, a wage and a loan repayment, a bad
   * day was inventing most of a hundred dollars behind a sentence that said
   * only "your original $20 is protected" — so the two figures on the cash line
   * did not reconcile with the profit above them, in the one screen a child is
   * told they can check by hand.
   */
  it('reports what it put in, so the cash line closes', () => {
    const state = { ...createInitialState(99), cash: 30 };
    const outcome = runDay(
      state,
      { ...orderForTargetCups(state, 4), price: 4.9 },
      { fixedCosts: [{ label: 'Rent', amount: 60 }], cashFloor: ECON.STARTING_CASH, lastDay: null },
    );
    expect(outcome.cashFloored).toBe(true);
    expect(outcome.cashTopUp).toBeGreaterThan(0);
    /*
     * The whole point: the figure the day really ended on, plus the top-up, is
     * exactly what is in the box. Deliberately not `cashBefore + profit` —
     * cash and profit are different stories in this ledger, because cash pays
     * for every lemon bought and profit counts only the ones sold.
     */
    expect(outcome.cashAfter - outcome.cashTopUp).toBeLessThan(ECON.STARTING_CASH);
    expect(outcome.cashAfter).toBe(ECON.STARTING_CASH);
  });

  it('puts nothing in on a day that did not need it', () => {
    const state = createInitialState(99);
    const outcome = runDay(state, { ...orderForTargetCups(state, 28), price: 1.6 });
    expect(outcome.cashFloored).toBe(false);
    expect(outcome.cashTopUp).toBe(0);
    expect(outcome.cashAfter - outcome.cashTopUp).toBe(outcome.cashAfter);
  });

  it('puts nothing in when there is no floor at all', () => {
    // The Saturday stand runs without one, because a floor on an investment
    // account would quietly print money into it.
    const state = { ...createInitialState(99), cash: 20 };
    const outcome = runDay(
      state,
      { ...orderForTargetCups(state, 4), price: 4.9 },
      { fixedCosts: [{ label: 'Rent', amount: 60 }], cashFloor: null, lastDay: null },
    );
    expect(outcome.cashTopUp).toBe(0);
    expect(outcome.cashAfter).toBeLessThan(0);
  });
});

/**
 * The close screen's cash box must close.
 *
 * §4's rule is that any two figures shown together reconcile with the third on
 * paper, and the cash line is where that is hardest: profit charges the lemons
 * a kid *used*, cash pays for the lemons they *bought*, and those differ on
 * every day the pantry is not empty at both ends. The screen names the gap now
 * — "ingredients you paid for earlier" — and this is the arithmetic that
 * sentence is claiming.
 *
 * Found by playing: a $10.02 loss took the cash box from $250.00 to $240.90,
 * and nothing on screen accounted for the ninety-two cents.
 */
describe('profit, the pantry and the cash box', () => {
  /**
   * Exactly what the screen prints, from the three halves the outcome reports.
   *
   * The spoilage term is not decoration: without it this closes on every day
   * except one where fruit went in the bin, which is the version that shipped
   * first and the version `tests/fuzz.test.ts` caught.
   */
  const shiftOf = (o: {
    ingredients: { total: number };
    spoilageCost: number;
    purchases: { cost: { total: number } };
  }) =>
    Math.round((o.ingredients.total + o.spoilageCost - o.purchases.cost.total) * 100) / 100;

  it('closes on a day that stocks up from nothing', () => {
    const state = stateWith({ cash: 200 });
    const o = runDay(state, { ...orderForTargetCups(state, 45), price: 1.5 });
    // Bought more than was drunk, so cash falls further than profit.
    expect(shiftOf(o)).toBeLessThanOrEqual(0);
    expect(o.cashBefore + o.profit + shiftOf(o) + o.cashTopUp).toBeCloseTo(o.cashAfter, 2);
  });

  it('closes on a day that lives off yesterday’s pantry', () => {
    const stocked = stateWith({ cash: 200 });
    const first = runDay(stocked, { ...orderForTargetCups(stocked, 60), price: 1.5 });
    // Buy nothing today: every cup comes out of what is already in the pantry.
    const o = runDay(first.nextState, {
      buyLemons: 0,
      buySugarPacks: 0,
      buyCupPacks: 0,
      price: 1.5,
    });
    expect(o.purchases.cost.total).toBe(0);
    expect(shiftOf(o)).toBeGreaterThan(0);
    expect(o.cashBefore + o.profit + shiftOf(o) + o.cashTopUp).toBeCloseTo(o.cashAfter, 2);
  });

  /*
   * The property, not the instance. A week of a business that buys
   * erratically — including days it buys nothing at all, which is the case
   * that produced the original gap — and the cash box closes on every one.
   */
  it('closes on every day of a week of erratic shopping', () => {
    let state = stateWith({ cash: 400 });
    for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
      const target = [0, 60, 20, 0, 45, 90, 10][day];
      const order =
        target === 0
          ? { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0 }
          : orderForTargetCups(state, target);
      const o = runDay(state, { ...order, price: 1.4 + (day % 3) * 0.2 });
      expect(o.cashBefore + o.profit + shiftOf(o) + o.cashTopUp).toBeCloseTo(o.cashAfter, 2);
      state = o.nextState;
    }
  });
});

/**
 * And the day the fruit goes in the bin.
 *
 * Called out separately from the property test because this is the exact case
 * the first version of the pantry line got wrong, and a named test is what
 * stops somebody simplifying the arithmetic back.
 */
describe('the cash box on a day with spoiled lemons', () => {
  it('closes, with the thrown-away fruit accounted for', () => {
    const state = {
      ...createInitialState(5),
      day: 6,
      cash: 500,
      lemonLots: [{ lemons: 26, purchasedOnDay: 1 }],
      sugarServings: 40,
      cupsInStock: 40,
    };
    const o = runDay(state, { buyLemons: 6, buySugarPacks: 0, buyCupPacks: 0, price: 1.5 });
    expect(o.spoiledLemons).toBeGreaterThan(0);

    const withSpoilage =
      Math.round((o.ingredients.total + o.spoilageCost - o.purchases.cost.total) * 100) / 100;
    expect(o.cashBefore + o.profit + withSpoilage + o.cashTopUp).toBeCloseTo(o.cashAfter, 2);

    // And the version without it does not close, which is why the term is there.
    const withoutSpoilage =
      Math.round((o.ingredients.total - o.purchases.cost.total) * 100) / 100;
    expect(o.cashBefore + o.profit + withoutSpoilage + o.cashTopUp).not.toBeCloseTo(o.cashAfter, 2);
  });
});
