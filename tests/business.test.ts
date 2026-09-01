import { describe, it, expect } from 'vitest';
import {
  ACT2_DAYS,
  BASE_SERVICE_CAPACITY,
  COOLER_CAPACITY,
  HANDS_OFF_DAYS_REQUIRED,
  HELPER_CAPACITY,
  LOCATIONS,
  RIVAL_APPEARS_ON_DAY,
  RIVAL_PRICE_FLOOR,
  STAFF,
  UPGRADES,
  act2Progress,
  advanceRival,
  applyWeeklyChoice,
  buyUpgrade,
  createBusinessState,
  dailyFixedCosts,
  deriveDayParams,
  growthRate,
  marketShareAgainstRival,
  moveTo,
  serviceCapacity,
  standAppeal,
  toggleStaff,
  trailingWeeklyProfit,
  updateHandsOff,
  type BusinessState,
} from '../src/lib/business';
import {
  createInitialState,
  orderForTargetCups,
  runDay,
  totalFixedCost,
  type DayRecord,
  type GameState,
} from '../src/lib/simulation';

function business(overrides: Partial<BusinessState> = {}): BusinessState {
  return { ...createBusinessState(), ...overrides };
}

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(1), ...overrides };
}

describe('the wall that starts Act 2: you are capped', () => {
  it('caps a bare stand at 30 cups however full the pantry is', () => {
    const state = stateWith({ cash: 500 });
    const params = deriveDayParams(business(), 1.6);
    expect(params.serviceCapacity).toBe(BASE_SERVICE_CAPACITY);

    const outcome = runDay(state, { ...orderForTargetCups(state, 90), price: 1.6 }, params);
    expect(outcome.cupsMakeable).toBe(BASE_SERVICE_CAPACITY);
    expect(outcome.cupsSold).toBeLessThanOrEqual(BASE_SERVICE_CAPACITY);
  });

  it('a cooler lifts the ceiling, permanently, for one payment', () => {
    const before = serviceCapacity(business());
    const bought = buyUpgrade(100, business(), 'cooler');
    expect(bought.ok).toBe(true);
    expect(bought.cash).toBe(100 - UPGRADES.cooler.cost);
    expect(serviceCapacity(bought.business)).toBe(before + COOLER_CAPACITY);
  });

  it('refuses an upgrade the kid cannot afford, without taking their money', () => {
    const result = buyUpgrade(5, business(), 'cooler');
    expect(result.ok).toBe(false);
    expect(result.cash).toBe(5);
    expect(result.business.upgrades.cooler).toBe(false);
  });

  it('will not sell the same upgrade twice', () => {
    const first = buyUpgrade(100, business(), 'cooler');
    const second = buyUpgrade(first.cash, first.business, 'cooler');
    expect(second.ok).toBe(false);
    expect(second.cash).toBe(first.cash);
  });
});

describe('capex versus opex, felt rather than explained', () => {
  it('a cooler costs once and never appears in daily costs again', () => {
    const withCooler = buyUpgrade(100, business(), 'cooler').business;
    const lines = dailyFixedCosts(withCooler);
    expect(lines.some((line) => line.label.toLowerCase().includes('cooler'))).toBe(false);
  });

  it('a helper costs nothing today and something every day after', () => {
    const hired = toggleStaff(business(), 'helper');
    const lines = dailyFixedCosts(hired);
    expect(lines.some((line) => line.amount === STAFF.helper.wage)).toBe(true);
    expect(totalFixedCost(lines)).toBe(LOCATIONS.sidewalk.fee + STAFF.helper.wage);
  });

  it('the helper raises capacity but must be earned back every single day', () => {
    const hired = toggleStaff(business(), 'helper');
    expect(serviceCapacity(hired)).toBe(BASE_SERVICE_CAPACITY + HELPER_CAPACITY);

    // A quiet day cannot use the extra capacity, so the wage is dead weight.
    const state = stateWith({ cash: 400, forecast: 'probably-cold', seed: 3 });
    const bare = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }, deriveDayParams(business(), 1.6));
    const staffed = runDay(state, { ...orderForTargetCups(state, 65), price: 1.6 }, deriveDayParams(hired, 1.6));
    expect(staffed.cupsSold).toBe(bare.cupsSold);
    expect(staffed.profit).toBeLessThan(bare.profit);
  });

  it('but pays for itself on a day busy enough to fill it', () => {
    const hired = toggleStaff(moveTo(business(), 'park'), 'helper');
    const state = stateWith({ cash: 600, forecast: 'probably-hot', seed: 9 });
    const bare = runDay(
      state,
      { ...orderForTargetCups(state, 90), price: 1.6 },
      deriveDayParams(moveTo(business(), 'park'), 1.6),
    );
    const staffed = runDay(state, { ...orderForTargetCups(state, 90), price: 1.6 }, deriveDayParams(hired, 1.6));
    expect(staffed.cupsSold).toBeGreaterThan(bare.cupsSold);
    expect(staffed.profit).toBeGreaterThan(bare.profit);
  });
});

describe('location is a fixed cost that only volume can justify', () => {
  it('the park is busier and dearer', () => {
    expect(LOCATIONS.park.demandMultiplier).toBeGreaterThan(LOCATIONS.sidewalk.demandMultiplier);
    expect(LOCATIONS.park.fee).toBeGreaterThan(LOCATIONS.sidewalk.fee);
  });

  it('loses money at the park on a quiet day and makes more on a busy one', () => {
    const park = moveTo(business(), 'park');
    const cold = stateWith({ cash: 400, forecast: 'probably-cold', seed: 21 });
    const hot = stateWith({ cash: 400, forecast: 'probably-hot', seed: 22 });

    const coldSidewalk = runDay(cold, { ...orderForTargetCups(cold, 30), price: 1.6 }, deriveDayParams(business(), 1.6));
    const coldPark = runDay(cold, { ...orderForTargetCups(cold, 30), price: 1.6 }, deriveDayParams(park, 1.6));
    expect(coldPark.standFee).toBeGreaterThan(coldSidewalk.standFee);

    const hotPark = runDay(hot, { ...orderForTargetCups(hot, 30), price: 1.6 }, deriveDayParams(park, 1.6));
    expect(hotPark.cupsWanted).toBeGreaterThan(coldSidewalk.cupsWanted);
  });
});

describe('the rival: why price is not the only lever', () => {
  it('does not exist for the first couple of days', () => {
    const rival = advanceRival(business(), RIVAL_APPEARS_ON_DAY - 1, 1.6);
    expect(rival.active).toBe(false);
    expect(marketShareAgainstRival(1.6, business())).toBe(1);
  });

  it('turns up and undercuts the kid', () => {
    const rival = advanceRival(business(), RIVAL_APPEARS_ON_DAY, 1.6);
    expect(rival.active).toBe(true);
    expect(rival.price).toBeLessThan(1.6);
  });

  it('takes a real share of the street once it is open', () => {
    const withRival = business({ rival: { active: true, price: 1.4, location: 'sidewalk', daysActive: 1 } });
    const share = marketShareAgainstRival(1.6, withRival);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });

  it('will not follow the kid below its own floor, so a price war is a trap', () => {
    let rival = business({ rival: { active: true, price: 1.4, location: 'sidewalk', daysActive: 1 } }).rival;
    // The kid keeps cutting; the rival stops at its floor.
    for (let i = 0; i < 30; i++) {
      rival = advanceRival(business({ rival }), 10, 0.1);
    }
    expect(rival.price).toBeCloseTo(RIVAL_PRICE_FLOOR, 2);
  });

  it('undercutting to win share destroys the kid\'s own margin', () => {
    const withRival = business({ rival: { active: true, price: 1.0, location: 'sidewalk', daysActive: 3 } });
    const state = stateWith({ cash: 400, seed: 8 });

    const cheap = runDay(state, { ...orderForTargetCups(state, 30), price: 0.6 }, deriveDayParams(withRival, 0.6));
    const held = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }, deriveDayParams(withRival, 1.6));

    expect(marketShareAgainstRival(0.6, withRival)).toBeGreaterThan(
      marketShareAgainstRival(1.6, withRival),
    );
    // More share, worse business.
    expect(cheap.profit).toBeLessThan(held.profit);
  });

  it('quality is the answer price cannot be: hold a higher price, keep customers', () => {
    const plain = business({ rival: { active: true, price: 1.2, location: 'sidewalk', daysActive: 3 } });
    const quality = buyUpgrade(100, plain, 'freshSqueeze').business;

    expect(standAppeal(1.6, true)).toBeGreaterThan(standAppeal(1.6, false));
    expect(marketShareAgainstRival(1.6, quality)).toBeGreaterThan(
      marketShareAgainstRival(1.6, plain),
    );

    // And the demand curve itself gets flatter: fewer people leave per dime.
    expect(deriveDayParams(quality, 1.6).demandSlope).toBeLessThan(
      deriveDayParams(plain, 1.6).demandSlope,
    );
  });

  it('moving to the park escapes the rival, until they follow you', () => {
    const atPark = moveTo(
      business({ rival: { active: true, price: 1.2, location: 'sidewalk', daysActive: 3 }, daysAtPark: 1 }),
      'park',
    );
    expect(marketShareAgainstRival(1.6, atPark)).toBe(1);

    const settled = { ...atPark, daysAtPark: 5 };
    const followed = advanceRival(settled, 8, 1.6);
    expect(followed.location).toBe('park');
  });

  it('a big sign brings more people past, whatever the rival does', () => {
    const plain = business();
    const signed = buyUpgrade(100, plain, 'bigSign').business;
    expect(deriveDayParams(signed, 1.6).demandIntercept).toBeGreaterThan(
      deriveDayParams(plain, 1.6).demandIntercept,
    );
  });
});

describe('reinvest or take it out', () => {
  it('moves money to savings, where it is safe and no longer working', () => {
    const result = applyWeeklyChoice(120, business(), { cashOut: 50 });
    expect(result.cash).toBe(70);
    expect(result.business.savings).toBe(50);
  });

  it('never lets a kid take out more than they have', () => {
    const result = applyWeeklyChoice(30, business(), { cashOut: 999 });
    expect(result.cash).toBe(0);
    expect(result.business.savings).toBe(30);
  });

  it('taking nothing out leaves everything compounding', () => {
    const result = applyWeeklyChoice(120, business(), { cashOut: 0 });
    expect(result.cash).toBe(120);
    expect(result.business.savings).toBe(0);
  });

  it('money left in can buy capacity that money taken out cannot', () => {
    const cashedOut = applyWeeklyChoice(40, business(), { cashOut: 40 });
    expect(buyUpgrade(cashedOut.cash, cashedOut.business, 'cooler').ok).toBe(false);

    const reinvested = applyWeeklyChoice(40, business(), { cashOut: 0 });
    expect(buyUpgrade(reinvested.cash, reinvested.business, 'cooler').ok).toBe(true);
  });
});

describe('a manager turns work into ownership', () => {
  it('is not complete until a manager is running it profitably', () => {
    expect(act2Progress(business(), 5).complete).toBe(false);
    const managed = toggleStaff(business(), 'manager');
    expect(act2Progress(managed, 5).complete).toBe(false);
    expect(act2Progress(managed, 5).nextStep).toContain('more profitable days');
  });

  it('completes after enough profitable hands-off days', () => {
    let managed = toggleStaff(business(), 'manager');
    for (let i = 0; i < HANDS_OFF_DAYS_REQUIRED; i++) {
      managed = updateHandsOff(managed, true, 20);
    }
    expect(act2Progress(managed, 10).complete).toBe(true);
  });

  it('does not count days the kid ran themselves', () => {
    const managed = updateHandsOff(toggleStaff(business(), 'manager'), false, 30);
    expect(managed.handsOffDays).toBe(0);
  });

  it('does not wipe the streak to zero on one bad-weather day', () => {
    let managed = toggleStaff(business(), 'manager');
    managed = updateHandsOff(managed, true, 20);
    managed = updateHandsOff(managed, true, 20);
    managed = updateHandsOff(managed, true, -3);
    expect(managed.handsOffDays).toBe(1);
  });

  it('tells the kid what is left to do, in their own terms', () => {
    expect(act2Progress(business(), 3).nextStep).toContain('manager');
  });
});

describe('trailing performance, which Act 3 will put a price on', () => {
  const history: DayRecord[] = Array.from({ length: 10 }, (_, i) => ({
    day: i + 1,
    weather: 'mild' as const,
    price: 1.6,
    cupsSold: 30,
    cupsWanted: 30,
    revenue: 48,
    profit: 20 + i, // steadily growing
    cashAfter: 100 + i * 20,
  }));

  it('averages a week rather than trusting one day', () => {
    const weekly = trailingWeeklyProfit(history, 7);
    const lastSeven = history.slice(-7);
    const expected = (lastSeven.reduce((s, d) => s + d.profit, 0) / 7) * 7;
    expect(weekly).toBeCloseTo(expected, 2);
  });

  it('spots that the business is growing', () => {
    const rate = growthRate(history, 5);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
  });

  it('will not claim a growth rate it cannot support', () => {
    expect(growthRate(history.slice(0, 3), 5)).toBeNull();
  });

  it('reads zero for a business with no history at all', () => {
    expect(trailingWeeklyProfit([], 7)).toBe(0);
  });
});

describe('Act 2 hangs together over a full run', () => {
  it('a kid who reinvests ends far ahead of one who does not', () => {
    const play = (reinvest: boolean) => {
      let state = stateWith({ cash: 120 });
      let biz = business();
      for (let day = 1; day <= ACT2_DAYS; day++) {
        if (reinvest) {
          for (const id of ['cooler', 'bigSign'] as const) {
            const attempt = buyUpgrade(state.cash, biz, id);
            if (attempt.ok) {
              state = { ...state, cash: attempt.cash };
              biz = attempt.business;
            }
          }
        }
        const params = deriveDayParams(biz, 1.6);
        const target = Math.min(params.serviceCapacity, 80);
        const outcome = runDay(state, { ...orderForTargetCups(state, target), price: 1.6 }, params);
        state = { ...outcome.nextState, status: 'playing' };
        biz = { ...biz, rival: advanceRival(biz, day, 1.6) };
      }
      return state.cash;
    };

    expect(play(true)).toBeGreaterThan(play(false));
  });

  it('never lets the kid end a day below the starting float', () => {
    let state = stateWith({ cash: 60 });
    // A ruinous setup: park rent, two wages, and a price nobody pays.
    const biz = toggleStaff(toggleStaff(moveTo(business(), 'park'), 'helper'), 'manager');
    for (let day = 1; day <= 10; day++) {
      const params = deriveDayParams(biz, 4);
      const outcome = runDay(state, { ...orderForTargetCups(state, 20), price: 4 }, params);
      expect(outcome.cashAfter).toBeGreaterThanOrEqual(ECON_STARTING_CASH);
      state = { ...outcome.nextState, status: 'playing' };
    }
  });
});

const ECON_STARTING_CASH = 20;

describe('growth measurement has to survive the weather', () => {
  // Weather swings daily demand by up to 50%. If the growth window is short
  // enough for that noise to dominate, every business reads as "shrinking" and
  // the growth premium in Act 3 becomes unreachable. This locks the fix.
  const noisy = (trendPerDay: number, days = 20): DayRecord[] => {
    const weathers = [0.6, 1.0, 1.5, 1.0, 0.6, 1.5, 1.0];
    return Array.from({ length: days }, (_, i) => {
      const base = 30 + trendPerDay * i;
      return {
        day: i + 1,
        weather: 'mild' as const,
        price: 1.6,
        cupsSold: 30,
        cupsWanted: 30,
        revenue: 48,
        profit: base * weathers[i % weathers.length],
        cashAfter: 100,
      };
    });
  };

  it('reads a genuinely growing business as growing, despite the weather', () => {
    const rate = growthRate(noisy(2));
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
  });

  it('reads a genuinely shrinking business as shrinking', () => {
    const rate = growthRate(noisy(-1));
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
  });

  it('does not flip sign just because you cut the window differently', () => {
    // The bug this replaces: the same run read -0.28 at one window and +0.14
    // at another, which made the Act 3 multiple essentially arbitrary.
    const history = noisy(2, 24);
    const wide = growthRate(history, 7)!;
    const wider = growthRate(history, 8)!;
    expect(Math.sign(wide)).toBe(Math.sign(wider));
  });

  it('a flat business is not mistaken for a growing one', () => {
    const rate = growthRate(noisy(0, 20));
    expect(Math.abs(rate ?? 0)).toBeLessThan(0.08);
  });
});

describe('the stand keeps trading past Act 1', () => {
  // Previously runDay used Act 1's seven-day constant to decide the run was
  // over, so from day 8 onwards every single day marked the game finished and
  // the close screen offered to show a week that was not ending.
  it('Act 1 still ends itself on the seventh day', () => {
    let state = stateWith({ cash: 400 });
    for (let day = 1; day < 7; day++) {
      const outcome = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 });
      expect(outcome.nextState.status).toBe('playing');
      state = outcome.nextState;
    }
    expect(runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }).nextState.status).toBe(
      'finished',
    );
  });

  it('Act 2 keeps going indefinitely', () => {
    let state = stateWith({ cash: 900, day: 8 });
    const params = deriveDayParams(business(), 1.6);
    expect(params.lastDay).toBeNull();
    for (let day = 0; day < 12; day++) {
      const outcome = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }, params);
      expect(outcome.nextState.status).toBe('playing');
      state = outcome.nextState;
    }
  });
});
