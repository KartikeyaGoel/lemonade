import { describe, it, expect } from 'vitest';
import {
  LOAN,
  SHOP,
  SHOP_DAYS_REQUIRED,
  createShopState,
  fundingOptions,
  hireShopStaff,
  letShopStaffGo,
  loanCleared,
  loanFixedCosts,
  loanInterest,
  loanQuote,
  repayLoan,
  shopBreakEvenCups,
  shopCapacity,
  shopCrowd,
  shopDailyCost,
  shopFixedCosts,
  shopProgress,
  updateShopDays,
} from '../src/lib/retail';
import { createOwnershipState, declineEquity } from '../src/lib/ownership';
import { earnedBadges } from '../src/lib/achievements';
import { createListing } from '../src/lib/listing';
import {
  crowdMix,
  createBusinessState,
  dailyFixedCosts,
  deriveDayParams,
  serviceCapacity,
} from '../src/lib/business';
import {
  INDOOR_WEATHER_FLOOR,
  WEATHER_MULTIPLIER,
  cupsWantedWith,
  resolveDayParams,
  totalFixedCost,
  weatherFactor,
} from '../src/lib/simulation';

function openShop(staff = 0) {
  return { ...createShopState(), open: true, staff };
}

describe('a door is a different kind of risk from a pitch', () => {
  it('costs nothing at all until it is open', () => {
    const shut = createShopState();
    expect(shopCapacity(shut)).toBe(0);
    expect(shopCrowd(shut)).toBe(0);
    expect(shopFixedCosts(shut)).toEqual([]);
    expect(shopDailyCost(shut)).toBe(0);
  });

  it('owes its rent on a day nobody comes in', () => {
    expect(shopDailyCost(openShop())).toBe(SHOP.rent);
    // Which is many times the pitch fee it replaces, and that is the point.
    expect(SHOP.rent).toBeGreaterThan(20);
  });

  it('charges each assistant a wage, every day, and names them in the ledger', () => {
    const staffed = openShop(2);
    expect(shopDailyCost(staffed)).toBe(SHOP.rent + 2 * SHOP.staffWage);
    expect(shopFixedCosts(staffed).map((line) => line.label)).toEqual([
      'Shop rent',
      'Shop staff ×2',
    ]);
  });

  it('will not put a third person behind one counter', () => {
    let shop = openShop();
    for (let i = 0; i < 5; i += 1) shop = hireShopStaff(shop);
    expect(shop.staff).toBe(SHOP.maxStaff);
    expect(letShopStaffGo(shop).staff).toBe(SHOP.maxStaff - 1);
    expect(letShopStaffGo(createShopState()).staff).toBe(0);
  });

  it('cannot be staffed before it exists', () => {
    expect(hireShopStaff(createShopState()).staff).toBe(0);
  });
});

describe('break-even is the rent, said in cups', () => {
  it('converts what is owed into a number of cups at this price', () => {
    // $45 of rent, keeping $1.40 a cup, is 33 cups before today earns anything.
    expect(shopBreakEvenCups(openShop(), 1.6, 0.2)).toBe(Math.ceil(SHOP.rent / 1.4));
  });

  it('refuses to answer when the price is below cost', () => {
    expect(shopBreakEvenCups(openShop(), 0.15, 0.2)).toBeNull();
  });

  it('goes up when somebody is hired, because the wage is owed too', () => {
    const bare = shopBreakEvenCups(openShop(), 1.6, 0.2)!;
    const staffed = shopBreakEvenCups(openShop(1), 1.6, 0.2)!;
    expect(staffed).toBeGreaterThan(bare);
  });
});

describe('indoors, the sky stops deciding', () => {
  it('changes nothing at all with no shop open', () => {
    expect(weatherFactor('cold')).toBe(WEATHER_MULTIPLIER.cold);
    expect(weatherFactor('hot', 0)).toBe(WEATHER_MULTIPLIER.hot);
  });

  it('puts a floor under a cold day for the part that is behind a door', () => {
    expect(weatherFactor('cold', 1)).toBeCloseTo(INDOOR_WEATHER_FLOOR, 4);
    // Half in, half out: halfway between the pavement and the floor.
    expect(weatherFactor('cold', 0.5)).toBeCloseTo(
      (WEATHER_MULTIPLIER.cold + INDOOR_WEATHER_FLOOR) / 2,
      4,
    );
  });

  it('never makes a hot day worse, because a shop is not a punishment', () => {
    expect(weatherFactor('hot', 1)).toBe(WEATHER_MULTIPLIER.hot);
    expect(weatherFactor('mild', 1)).toBe(WEATHER_MULTIPLIER.mild);
  });

  it('is the reason a cold day at the shop is survivable', () => {
    const outside = resolveDayParams({ demandMultiplier: 3, indoorShare: 0 });
    const inside = resolveDayParams({ demandMultiplier: 3, indoorShare: 1 });
    expect(cupsWantedWith(1.6, 'cold', inside)).toBeGreaterThan(
      cupsWantedWith(1.6, 'cold', outside),
    );
    // And identical when it is mild, so the shop is not a demand cheat.
    expect(cupsWantedWith(1.6, 'mild', inside)).toBeCloseTo(
      cupsWantedWith(1.6, 'mild', outside),
      4,
    );
  });

  it('blends by how much of the business is actually indoors', () => {
    const business = { ...createBusinessState(), shop: openShop() };
    const { crowd, indoorShare } = crowdMix(business);
    // One sidewalk pitch outside, the shop's crowd inside.
    expect(crowd).toBeCloseTo(1 + SHOP.demandMultiplier, 2);
    expect(indoorShare).toBeCloseTo(SHOP.demandMultiplier / (1 + SHOP.demandMultiplier), 4);
    expect(deriveDayParams(business, 1.6).indoorShare).toBeCloseTo(indoorShare, 4);
  });

  it('folds the shop into the one capacity and the one cost list', () => {
    const business = { ...createBusinessState(), shop: openShop(1) };
    expect(serviceCapacity(business)).toBe(
      serviceCapacity(createBusinessState()) + SHOP.capacity + SHOP.staffCapacity,
    );
    expect(totalFixedCost(dailyFixedCosts(business))).toBeCloseTo(
      totalFixedCost(dailyFixedCosts(createBusinessState())) + SHOP.rent + SHOP.staffWage,
      2,
    );
  });
});

describe('the run of good days that ends the stage', () => {
  it('does not count before the door opens', () => {
    expect(updateShopDays(createShopState(), 90).goodDays).toBe(0);
    expect(shopProgress(createShopState()).goal).toContain(String(SHOP.fitOut));
  });

  it('counts a profitable day and does not wipe on one bad one', () => {
    let shop = openShop();
    shop = updateShopDays(shop, 60);
    shop = updateShopDays(shop, 60);
    shop = updateShopDays(shop, -12);
    expect(shop.goodDays).toBe(1);
  });

  it('completes after the required run, and says what is left before then', () => {
    let shop = openShop();
    for (let i = 0; i < SHOP_DAYS_REQUIRED - 1; i += 1) shop = updateShopDays(shop, 60);
    expect(shopProgress(shop).complete).toBe(false);
    expect(shopProgress(shop).goal).toContain('1 more');

    shop = updateShopDays(shop, 60);
    expect(shopProgress(shop).complete).toBe(true);
  });
});

describe('borrowing, which is owed whatever happened', () => {
  it('hands back more than it lent, and the extra has a name', () => {
    const loan = loanQuote();
    expect(loan.total).toBeCloseTo(LOAN.amount * (1 + LOAN.interestRate), 2);
    expect(loanInterest(loan)).toBeCloseTo(LOAN.amount * LOAN.interestRate, 2);
    expect(loan.daily).toBeCloseTo(loan.total / LOAN.days, 2);
  });

  it('puts a repayment line in the day\'s costs while anything is owed', () => {
    const loan = loanQuote();
    expect(loanFixedCosts(loan)[0].label).toBe('Loan repayment');
    expect(loanFixedCosts(null)).toEqual([]);
  });

  it('clears in the number of days it said, and then costs nothing', () => {
    let loan: ReturnType<typeof loanQuote> | null = loanQuote();
    for (let day = 0; day < LOAN.days; day += 1) loan = repayLoan(loan);
    expect(loan!.outstanding).toBe(0);
    expect(loanCleared(loan)).toBe(true);
    expect(loanFixedCosts(loan)).toEqual([]);
  });

  it('keeps a cleared loan on the books, because it is the only evidence there is', () => {
    /*
     * It used to be thrown away, which left the parent report reading
     * `learned.includes('interest')` — a claim about what the software
     * displayed, dressed as a claim about what the child did. PRODUCT.md §36.
     */
    let loan: ReturnType<typeof loanQuote> | null = loanQuote();
    for (let day = 0; day < LOAN.days + 5; day += 1) loan = repayLoan(loan);
    expect(loan).not.toBeNull();
    expect(loan!.principal).toBe(LOAN.amount);
    expect(loanCleared(null)).toBe(false);
  });

  it('never takes more than is left on the last payment', () => {
    let loan: ReturnType<typeof loanQuote> | null = loanQuote();
    for (let day = 0; day < LOAN.days - 1; day += 1) loan = repayLoan(loan);
    const last = loanFixedCosts(loan)[0].amount;
    expect(last).toBeLessThanOrEqual(loan!.daily + 0.01);
    expect(last).toBeGreaterThan(0);
  });
});

describe('three ways to buy the same door', () => {
  it('offers waiting as a real option, not a scolding', () => {
    const options = fundingOptions(SHOP.fitOut, 0);
    const wait = options.find((option) => option.id === 'cash')!;
    expect(wait.enough).toBe(true);
    expect(wait.cost).toMatch(/wait/i);
  });

  it('says what each one costs without saying which is right', () => {
    const options = fundingOptions(100, 250);
    expect(options.map((option) => option.id)).toEqual(['cash', 'loan', 'investor']);
    for (const option of options) {
      expect(option.cost.length).toBeGreaterThan(10);
      // No verdicts. A kid weighing three real trade-offs is the lesson.
      expect(option.cost).not.toMatch(/\b(best|worst|should|better|bad idea)\b/i);
    }
  });

  it('knows which ones would actually cover the fit-out', () => {
    const short = fundingOptions(100, 50);
    expect(short.every((option) => option.enough)).toBe(false);

    const enough = fundingOptions(SHOP.fitOut - LOAN.amount, 0);
    expect(enough.find((option) => option.id === 'loan')!.enough).toBe(true);
    expect(enough.find((option) => option.id === 'cash')!.enough).toBe(false);
  });
});

describe('choosing a route is also a decision about the investor', () => {
  /*
   * The badge for keeping the whole company reads `equityOfferSeen`, and when
   * the offer moved out of its own screen and into the three-way choice there
   * was nothing left to set it — so the badge became unearnable. A badge
   * nothing can produce is the defect PRODUCT.md §40 records about the manager,
   * arrived at from the opposite direction.
   */
  it('records the decline when another route is taken', () => {
    const fresh = createOwnershipState();
    expect(fresh.equityOfferSeen).toBe(false);
    const declined = declineEquity(fresh);
    expect(declined.equityOfferSeen).toBe(true);
    expect(declined.equitySoldPct).toBe(0);
  });

  it('makes the keep-it-all badge reachable again', () => {
    const held = earnedBadges({
      history: [],
      business: createBusinessState(),
      ownership: { ...createOwnershipState(), equityOfferSeen: true },
      portfolio: null,
      listing: createListing(),
      learned: [],
      challengesPlayed: 0,
      clubWeeks: 0,
      clubProposalsPassed: 0,
      thesisCount: 0,
    });
    expect(held).toContain('kept-the-whole-thing');
  });

  it('does not award it to a kid who sold a slice', () => {
    const held = earnedBadges({
      history: [],
      business: createBusinessState(),
      ownership: { ...createOwnershipState(), equityOfferSeen: true, equitySoldPct: 0.2 },
      portfolio: null,
      listing: createListing(),
      learned: [],
      challengesPlayed: 0,
      clubWeeks: 0,
      clubProposalsPassed: 0,
      thesisCount: 0,
    });
    expect(held).not.toContain('kept-the-whole-thing');
  });
});
