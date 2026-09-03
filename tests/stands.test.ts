import { describe, it, expect } from 'vitest';
import {
  BASE_SERVICE_CAPACITY,
  COOLER_CAPACITY,
  HELPER_CAPACITY,
  LOCATIONS,
  MANAGER_CAPACITY,
  MAX_STANDS,
  SAME_PITCH_SHARE,
  STAFF,
  STAND_SETUP_COST,
  buyUpgrade,
  closeStand,
  createBusinessState,
  crowdMix,
  dailyFixedCosts,
  deriveDayParams,
  openStand,
  serviceCapacity,
  splitCups,
  standCount,
  standLines,
  effectiveMarketShare,
  marketShareAgainstRival,
  standOpening,
  toggleStaff,
  updateTwoStandDays,
  youAreFree,
  type BusinessState,
} from '../src/lib/business';
import { totalFixedCost } from '../src/lib/simulation';

/** A business with a manager on the first stand, so hands are free. */
function managed(): BusinessState {
  return toggleStaff(createBusinessState(), 'manager');
}

describe('you cannot be in two places at once', () => {
  it('refuses a second stand until somebody is minding the first', () => {
    const bare = createBusinessState();
    expect(youAreFree(bare)).toBe(false);
    const blocked = standOpening(bare, 'park', 999);
    expect(blocked.blocked).toMatch(/mind/i);
    expect(openStand(bare, 'park', 999).opened).toBe(false);
  });

  it('frees the kid the moment a manager is on the payroll', () => {
    expect(youAreFree(managed())).toBe(true);
    expect(standOpening(managed(), 'park', 999).blocked).toBeNull();
  });

  it('puts the kid behind the second table and hires for the third', () => {
    let business = managed();
    expect(standOpening(business, 'park', 999).runBy).toBe('you');

    business = openStand(business, 'park', 999).business;
    expect(business.stands[0].runBy).toBe('you');
    // Their hands are now full, so the next one costs a wage.
    expect(youAreFree(business)).toBe(false);
    expect(standOpening(business, 'sidewalk', 999).runBy).toBe('minder');
  });

  it('charges a minder the same wage as the manager, and says so in the costs', () => {
    let business = managed();
    business = openStand(business, 'park', 999).business;
    business = openStand(business, 'sidewalk', 999).business;

    const labels = dailyFixedCosts(business).map((line) => line.label);
    expect(labels.filter((label) => label.includes('pitch'))).toHaveLength(3);
    expect(labels).toContain('Manager wages');
    expect(labels.some((label) => label.startsWith('Stand minder'))).toBe(true);
  });

  it('stops at three, because one more of the same decision is not a lesson', () => {
    let business = managed();
    for (let i = 0; i < 5; i += 1) {
      business = openStand(business, 'park', 9999).business;
    }
    expect(standCount(business)).toBe(MAX_STANDS);
    expect(standOpening(business, 'park', 9999).blocked).toMatch(/street will take/i);
  });

  it('takes the setup cost once, and refunds nothing when you close it', () => {
    const opened = openStand(managed(), 'park', 200);
    expect(opened.cash).toBe(200 - STAND_SETUP_COST);

    const shut = closeStand(opened.business, opened.business.stands[0].id);
    expect(shut.stands).toHaveLength(0);
    // The daily cost comes back. The table does not.
    expect(totalFixedCost(dailyFixedCosts(shut))).toBeLessThan(
      totalFixedCost(dailyFixedCosts(opened.business)),
    );
  });

  it('will not open one there is no money for', () => {
    const result = openStand(managed(), 'park', STAND_SETUP_COST - 1);
    expect(result.opened).toBe(false);
    expect(result.reason).toContain('table');
  });
});

describe('a second stand on your own pitch splits your own crowd', () => {
  it('adds a whole crowd at a pitch you were not trading', () => {
    const business = openStand(managed(), 'park', 999).business;
    const { crowd } = crowdMix(business);
    // Home sidewalk plus a park gate: additive, because they are two streets.
    expect(crowd).toBeCloseTo(
      LOCATIONS.sidewalk.demandMultiplier + LOCATIONS.park.demandMultiplier,
      2,
    );
  });

  it('adds only half a crowd at a pitch you already work', () => {
    const business = openStand(managed(), 'sidewalk', 999).business;
    const { crowd } = crowdMix(business);
    expect(crowd).toBeCloseTo(
      LOCATIONS.sidewalk.demandMultiplier * (1 + SAME_PITCH_SHARE),
      2,
    );
  });

  it('keeps halving, so doubling up never quietly becomes free', () => {
    let business = managed();
    business = openStand(business, 'sidewalk', 9999).business;
    business = openStand(business, 'sidewalk', 9999).business;
    const crowds = standLines(business).map((line) => line.crowd);
    expect(crowds).toEqual([1, SAME_PITCH_SHARE, SAME_PITCH_SHARE ** 2]);
  });

  it('reports what a stand would add before the money moves', () => {
    const fresh = standOpening(managed(), 'park', 999);
    expect(fresh.crowdAdded).toBeCloseTo(LOCATIONS.park.demandMultiplier, 2);

    const doubled = standOpening(managed(), 'sidewalk', 999);
    expect(doubled.crowdAdded).toBeCloseTo(LOCATIONS.sidewalk.demandMultiplier * SAME_PITCH_SHARE, 2);
  });
});

describe('capacity is the sum of every table', () => {
  it('is unchanged for one stand, so nothing about Act 1 or 2 moved', () => {
    expect(serviceCapacity(createBusinessState())).toBe(BASE_SERVICE_CAPACITY);

    let business = createBusinessState();
    business = buyUpgrade(999, business, 'cooler').business;
    business = toggleStaff(business, 'helper');
    business = toggleStaff(business, 'manager');
    expect(serviceCapacity(business)).toBe(
      BASE_SERVICE_CAPACITY + COOLER_CAPACITY + HELPER_CAPACITY + MANAGER_CAPACITY,
    );
  });

  it('adds a full pair of hands for the stand the kid works', () => {
    const business = openStand(managed(), 'park', 999).business;
    expect(serviceCapacity(business)).toBe(
      BASE_SERVICE_CAPACITY + MANAGER_CAPACITY + BASE_SERVICE_CAPACITY,
    );
  });

  it('adds only a minder for one the kid does not', () => {
    let business = openStand(managed(), 'park', 9999).business;
    const before = serviceCapacity(business);
    business = openStand(business, 'sidewalk', 9999).business;
    expect(serviceCapacity(business) - before).toBe(MANAGER_CAPACITY);
  });

  it('feeds the day through the one funnel, crowd and costs together', () => {
    const business = openStand(managed(), 'park', 999).business;
    const params = deriveDayParams(business, 1.6);
    expect(params.demandMultiplier).toBeCloseTo(crowdMix(business).crowd, 2);
    expect(params.serviceCapacity).toBe(serviceCapacity(business));
    expect(totalFixedCost(params.fixedCosts)).toBeCloseTo(
      LOCATIONS.sidewalk.fee + LOCATIONS.park.fee + STAFF.manager.wage,
      2,
    );
    // No shop, so nothing is behind a door and the sky still decides everything.
    expect(params.indoorShare).toBe(0);
  });
});

describe('splitting a day across the stands that served it', () => {
  it('gives the whole day to the only stand there is', () => {
    expect(splitCups(createBusinessState(), 27)).toEqual([27]);
  });

  it('adds up to exactly the day, however the crowd fell', () => {
    const business = openStand(managed(), 'park', 999).business;
    for (const cups of [0, 1, 7, 33, 48, 49, 50]) {
      const split = splitCups(business, cups);
      expect(split.reduce((sum, n) => sum + n, 0)).toBe(cups);
    }
  });

  it('gives the busier pitch more of it', () => {
    const business = openStand(managed(), 'park', 999).business;
    const [home, park] = splitCups(business, 40);
    // The park gate is 1.7x the sidewalk, so it should have poured more.
    expect(park).toBeGreaterThan(home);
  });

  it('never credits a stand with more cups than it could pour', () => {
    const business = openStand(managed(), 'park', 999).business;
    const lines = standLines(business);
    const split = splitCups(business, 500);
    split.forEach((cups, i) => expect(cups).toBeLessThanOrEqual(lines[i].capacity));
  });
});

describe('the two-stand streak', () => {
  it('does not count while there is only one stand', () => {
    expect(updateTwoStandDays(createBusinessState(), 40).twoStandDays).toBe(0);
  });

  it('counts a good day once there are two', () => {
    const business = openStand(managed(), 'park', 999).business;
    expect(updateTwoStandDays(business, 40).twoStandDays).toBe(1);
  });

  it('does not wipe the streak on one bad-weather day', () => {
    let business = openStand(managed(), 'park', 999).business;
    business = updateTwoStandDays(business, 40);
    business = updateTwoStandDays(business, 40);
    business = updateTwoStandDays(business, -6);
    expect(business.twoStandDays).toBe(1);
  });
});

describe('the rival only competes where he is standing', () => {
  /*
   * He was taking half the customers out of a shop on the high street and a
   * stand at the park gate, from a folding table outside the kid's house. The
   * pitch-level answer was being applied to the whole business, which was the
   * only sensible thing to do while the whole business was one table.
   */
  function withRival(business: BusinessState): BusinessState {
    return { ...business, rival: { active: true, price: 0.8, location: 'sidewalk', daysActive: 4 } };
  }

  it('still takes his share of the pitch he is on', () => {
    const one = withRival(createBusinessState());
    expect(effectiveMarketShare(one, 2.2)).toBeCloseTo(marketShareAgainstRival(2.2, one), 2);
    expect(effectiveMarketShare(one, 2.2)).toBeLessThan(1);
  });

  it('takes nothing from a pitch he cannot see', () => {
    const away = withRival(openStand(managed(), 'park', 999).business);
    const pitchOnly = marketShareAgainstRival(2.2, away);
    // The park keeps all of its own crowd, so the blended share sits above the
    // pitch-level one and below one.
    expect(effectiveMarketShare(away, 2.2)).toBeGreaterThan(pitchOnly);
    expect(effectiveMarketShare(away, 2.2)).toBeLessThan(1);
  });

  it('takes nothing at all from behind a door', () => {
    const shop = withRival({
      ...createBusinessState(),
      shop: { open: true, staff: 0, goodDays: 0 },
    });
    const pitchOnly = marketShareAgainstRival(2.2, shop);
    const blended = effectiveMarketShare(shop, 2.2);
    // The shop is three quarters of this crowd and he is outside a house.
    expect(blended).toBeGreaterThan(pitchOnly);
    expect(blended).toBeGreaterThan(0.8);
  });

  it('hurts less the bigger the rest of the business gets', () => {
    const small = withRival(createBusinessState());
    const medium = withRival(openStand(managed(), 'park', 999).business);
    const large = withRival({
      ...openStand(managed(), 'park', 999).business,
      shop: { open: true, staff: 0, goodDays: 0 },
    });
    expect(effectiveMarketShare(medium, 2.2)).toBeGreaterThan(effectiveMarketShare(small, 2.2));
    expect(effectiveMarketShare(large, 2.2)).toBeGreaterThan(effectiveMarketShare(medium, 2.2));
  });

  it('leaves every day with no rival exactly as it was', () => {
    expect(effectiveMarketShare(createBusinessState(), 1.6)).toBe(1);
    expect(deriveDayParams(createBusinessState(), 1.6).marketShare).toBe(1);
  });

  it('goes through the day params, so nothing computes it twice', () => {
    const away = withRival(openStand(managed(), 'park', 999).business);
    expect(deriveDayParams(away, 2.2).marketShare).toBeCloseTo(effectiveMarketShare(away, 2.2), 4);
  });
});
