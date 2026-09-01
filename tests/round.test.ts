import { describe, it, expect } from 'vitest';
import {
  ROUND,
  applyWeeklyChoice,
  createBusinessState,
  deriveDayParams,
  regularShareOfSales,
  revenueSteadiness,
  signUpRegulars,
  trailingDailyCups,
  type BusinessState,
} from '../src/lib/business';
import {
  createInitialState,
  ingredientCostOf,
  orderForTargetCups,
  round2,
  runDay,
  toCents,
  type DayRecord,
  type GameState,
} from '../src/lib/simulation';
import { buyoutOffer, createOwnershipState } from '../src/lib/ownership';

/** A cold day is where recurring revenue proves itself, so most tests use one. */
function coldState(seed = 4242): GameState {
  return { ...createInitialState(seed), forecast: 'probably-cold' };
}

describe('regulars are served first', () => {
  it('pours for the round before anybody in the queue', () => {
    const state = { ...coldState(), cash: 500 };
    const order = orderForTargetCups(state, 60);
    const outcome = runDay(state, { ...order, price: 3 }, {
      subscribers: 6,
      subscriberDiscount: ROUND.DISCOUNT,
      serviceCapacity: 30,
    });

    // At $3 nobody walks up, so every cup sold is a standing order.
    expect(outcome.cupsSold).toBe(6);
    expect(outcome.subscriberCups).toBe(6);
    expect(outcome.customers.filter((c) => c.kind === 'regular')).toHaveLength(6);
    expect(outcome.customers.filter((c) => c.kind === 'regular' && c.outcome === 'bought')).toHaveLength(6);
  });

  it('charges them the discount, and says so in the split', () => {
    const state = { ...coldState(), cash: 500 };
    const order = orderForTargetCups(state, 60);
    const outcome = runDay(state, { ...order, price: 2 }, {
      subscribers: 5,
      subscriberDiscount: 0.15,
      serviceCapacity: 30,
    });

    expect(outcome.subscriberPrice).toBe(1.7);
    expect(outcome.subscriberRevenue).toBe(round2(5 * 1.7));
    expect(outcome.revenue).toBe(round2(outcome.subscriberRevenue + outcome.walkupRevenue));
  });

  it('counts their cups as cups: the ingredients still get used', () => {
    const state = { ...coldState(), cash: 500 };
    const order = orderForTargetCups(state, 60);
    const outcome = runDay(state, { ...order, price: 3 }, {
      subscribers: 8,
      subscriberDiscount: ROUND.DISCOUNT,
      serviceCapacity: 30,
    });
    expect(outcome.ingredients.total).toBe(ingredientCostOf(8).total);
  });

  it('takes their cups out of the same capacity everyone else queues for', () => {
    const state = { ...createInitialState(4242), cash: 500, forecast: 'probably-hot' as const };
    const order = orderForTargetCups(state, 90);
    const outcome = runDay(state, { ...order, price: 1.2 }, {
      subscribers: 25,
      subscriberDiscount: ROUND.DISCOUNT,
      serviceCapacity: 30,
    });
    expect(outcome.cupsSold).toBe(30);
    expect(outcome.subscriberCups).toBe(25);
    expect(outcome.turnedAwaySoldOut).toBeGreaterThan(0);
  });

  it('never serves more regulars than there is lemonade for', () => {
    const state = { ...coldState(), cash: 500 };
    const order = orderForTargetCups(state, 4);
    const outcome = runDay(state, { ...order, price: 3 }, {
      subscribers: 20,
      subscriberDiscount: ROUND.DISCOUNT,
    });
    expect(outcome.subscriberCups).toBeLessThanOrEqual(outcome.cupsMakeable);
    expect(outcome.subscriberCups).toBe(4);
  });

  it('leaves a day with no round exactly as it was before the feature existed', () => {
    const state = createInitialState(777);
    const order = orderForTargetCups(state, 28);
    const plain = runDay(state, { ...order, price: 1.6 });
    const withZero = runDay(state, { ...order, price: 1.6 }, {
      subscribers: 0,
      subscriberDiscount: ROUND.DISCOUNT,
    });
    expect(withZero.profit).toBe(plain.profit);
    expect(withZero.revenue).toBe(plain.revenue);
    expect(withZero.cupsSold).toBe(plain.cupsSold);
    expect(plain.grossMarginPerCup).toBe(toCents(1.6 - toCents(plain.ingredients.perCup)));
  });

  it('reports a margin per cup that still reconciles once the prices blend', () => {
    const state = { ...coldState(), cash: 500 };
    const order = orderForTargetCups(state, 60);
    const outcome = runDay(state, { ...order, price: 2 }, {
      subscribers: 5,
      subscriberDiscount: 0.15,
      serviceCapacity: 30,
    });
    const realised = toCents(outcome.revenue / outcome.cupsSold);
    expect(outcome.grossMarginPerCup).toBe(toCents(realised - toCents(outcome.ingredients.perCup)));
  });

  it('writes the round into the day record so later acts can price it', () => {
    const state = { ...coldState(), cash: 500 };
    const order = orderForTargetCups(state, 60);
    const outcome = runDay(state, { ...order, price: 3 }, {
      subscribers: 6,
      subscriberDiscount: ROUND.DISCOUNT,
      serviceCapacity: 30,
    });
    expect(outcome.nextState.history.at(-1)!.subscriberCups).toBe(6);
  });
});

describe('signing people up', () => {
  const history = (cups: number, days = 7): DayRecord[] =>
    Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      weather: 'mild' as const,
      price: 1.6,
      cupsSold: cups,
      cupsWanted: cups,
      revenue: round2(cups * 1.6),
      profit: 20,
      cashAfter: 100,
    }));

  it('signs up a share of the people who already buy', () => {
    const drive = signUpRegulars(createBusinessState(), history(40));
    expect(trailingDailyCups(history(40))).toBe(40);
    expect(drive.added).toBe(Math.round(40 * ROUND.SIGNUP_RATE));
    expect(drive.regulars).toBe(drive.added);
  });

  it('cannot build a round on a street that does not buy anything', () => {
    const drive = signUpRegulars(createBusinessState(), history(0));
    expect(drive.added).toBe(0);
    expect(drive.blurb).toContain('Not enough people buy');
  });

  it('is easier when the lemonade is good', () => {
    const plain = signUpRegulars(createBusinessState(), history(40));
    const quality = signUpRegulars(
      { ...createBusinessState(), upgrades: { cooler: false, bigSign: false, freshSqueeze: true } },
      history(40),
    );
    expect(quality.added).toBeGreaterThan(plain.added);
  });

  it('runs out of street eventually', () => {
    let business: BusinessState = createBusinessState();
    for (let i = 0; i < 20; i++) business = signUpRegulars(business, history(90)).business;
    expect(business.regulars).toBe(ROUND.MAX_REGULARS);
    expect(signUpRegulars(business, history(90)).blurb).toContain('already has one');
  });

  it('is reached through the weekly choice, and counts the drive', () => {
    const result = applyWeeklyChoice(200, createBusinessState(), { cashOut: 50, signUpRegulars: true }, history(40));
    expect(result.cash).toBe(150);
    expect(result.business.savings).toBe(50);
    expect(result.business.regulars).toBeGreaterThan(0);
    expect(result.business.roundDrives).toBe(1);
    expect(result.drive).not.toBeNull();
  });

  it('leaves the round alone when the kid does not ask', () => {
    const result = applyWeeklyChoice(200, createBusinessState(), { cashOut: 0 }, history(40));
    expect(result.business.regulars).toBe(0);
    expect(result.drive).toBeNull();
  });

  it('feeds straight into the day parameters', () => {
    const business = signUpRegulars(createBusinessState(), history(40)).business;
    const params = deriveDayParams(business, 1.6);
    expect(params.subscribers).toBe(business.regulars);
    expect(params.subscriberDiscount).toBe(ROUND.DISCOUNT);
  });
});

describe('what the round is worth when the stand is sold', () => {
  function weekOf(regularCups: number, totalCups: number): DayRecord[] {
    return Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      weather: 'mild' as const,
      price: 1.6,
      cupsSold: totalCups,
      cupsWanted: totalCups,
      revenue: round2(totalCups * 1.6),
      profit: 40,
      cashAfter: 500,
      subscriberCups: regularCups,
    }));
  }

  it('measures the round as a share of cups actually poured', () => {
    expect(regularShareOfSales(weekOf(10, 40))).toBeCloseTo(0.25, 5);
    expect(regularShareOfSales(weekOf(0, 40))).toBe(0);
    expect(regularShareOfSales([])).toBe(0);
  });

  it('pays a higher multiple for the same profit', () => {
    const without = buyoutOffer(weekOf(0, 40), createOwnershipState());
    const with_ = buyoutOffer(weekOf(14, 40), createOwnershipState());

    expect(with_.weeklyProfit).toBe(without.weeklyProfit);
    expect(with_.multiple).toBeGreaterThan(without.multiple);
    expect(with_.price).toBeGreaterThan(without.price);
    expect(with_.premiumReason).toContain('whatever the weather');
  });

  it('does not pay a premium for a round barely anybody is on', () => {
    const offer = buyoutOffer(weekOf(2, 40), createOwnershipState());
    expect(offer.roundPremium).toBe(0);
    expect(offer.premiumReason).toBeNull();
  });

  it('caps the premium, so the round is a bonus and not a cheat code', () => {
    const offer = buyoutOffer(weekOf(40, 40), createOwnershipState());
    expect(offer.roundPremium).toBe(3);
  });

  it('scores a steady week above a lumpy one', () => {
    const steady = weekOf(0, 40);
    const lumpy = steady.map((day, i) => ({
      ...day,
      revenue: i % 2 === 0 ? 10 : 118,
    }));
    expect(revenueSteadiness(steady)).toBe(1);
    expect(revenueSteadiness(lumpy)!).toBeLessThan(0.5);
    expect(revenueSteadiness(steady.slice(0, 2))).toBeNull();
  });
});
