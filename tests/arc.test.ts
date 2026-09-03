import { describe, expect, it } from 'vitest';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  TWO_STAND_DAYS_REQUIRED,
  act2Progress,
  buyUpgrade,
  createBusinessState,
  deriveDayParams,
  openStand,
  serviceCapacity,
  standCount,
  toggleStaff,
  trailingWeeklyProfit,
  updateHandsOff,
  updateTwoStandDays,
} from '../src/lib/business';
import {
  SHOP,
  SHOP_DAYS_REQUIRED,
  loanQuote,
  repayLoan,
  shopProgress,
  updateShopDays,
} from '../src/lib/retail';
import {
  ACT3_DAYS,
  act1Complete,
  act2Complete,
  act3Complete,
  act4Complete,
  beginAct2,
  beginAct3,
  beginAct4,
  beginAct5,
  createGame,
  type Game,
} from '../src/lib/progress';
import {
  floatPlan,
  listCompany,
  listingComplete,
  listingOffer,
  markListedWeek,
} from '../src/lib/listing';
import { acceptBuyout, recordDealChoice, type BuyoutOffer } from '../src/lib/ownership';
import { MARKET_WEEKS, advanceWeek, buy } from '../src/lib/market';
import { batchPlan, runDay, ECON } from '../src/lib/simulation';

/**
 * Can the game be finished by playing it?
 *
 * Nothing asked this before. Every act had its own tests, every transition
 * condition had its own tests, and the arc as a whole had none — so a stated
 * goal could become unreachable without a single test going red.
 *
 * One did. Act 2 tells a kid "three more profitable days run by your manager",
 * and the only thing in the codebase that sets `ranByManager` was a function
 * nothing called. The counter could never move, the goal could never be met and
 * the badge for it could never be earned. The act still ended, on a fourteen-day
 * fallback, which is exactly why nobody noticed: the game moved on and left the
 * kid looking for a control that did not exist.
 *
 * So this walks the whole thing the way a player does, and asserts that each
 * act ends *the way the game says it will* rather than merely ending.
 */

/**
 * A price that clears the day's costs.
 *
 * The first version of this test charged $1.60 every day and the streak never
 * got past one, because a cold day at that price loses $1.49 against a $20
 * manager's wage. That is the simulation being right, not the test finding a
 * bug — but it is worth keeping the detail, because it is also the actual Act 2
 * lesson: a wage turns a mediocre price into a loss.
 */
/** A buyout on the table, with only the fields the transition reads. */
function offerOf(multiple: number, price: number): BuyoutOffer {
  return {
    weeklyProfit: price / multiple,
    multiple,
    price,
    proceeds: price,
    investorShare: 0,
    growth: null,
    reason: 'steady',
    roundShare: 0,
    roundPremium: 0,
    premiumReason: null,
  };
}

function sensiblePrice(game: Game): number {
  if (game.stand.forecast === 'probably-cold') return 2.2;
  if (game.stand.forecast === 'probably-hot') return 1.9;
  return 2;
}

/**
 * And a batch that matches the sky.
 *
 * Also learned from a failing version of this test: at a fixed 34 cups the
 * cold days lost money on waste alone and the streak reset every other day. The
 * manager can only hold a streak if somebody sized the batch — which is the
 * right answer, and is the same skill `mastery.ts` scores.
 */
function sensibleBatch(game: Game): number {
  if (game.stand.forecast === 'probably-cold') return 14;
  if (game.stand.forecast === 'probably-hot') return 36;
  return 24;
}

/**
 * A batch sized to the business rather than to one table.
 *
 * The fixed numbers above are right for one stand and hopeless for three
 * pitches and a shop, where a 24-cup batch turns a 114-cup crowd into a
 * sold-out morning and a loss against $145 of rent and wages. Sizing off
 * capacity is what a player does once the business is bigger than their hands.
 */
function batchForCapacity(game: Game): number {
  const cap = serviceCapacity(game.business);
  const share =
    game.stand.forecast === 'probably-cold' ? 0.45 : game.stand.forecast === 'probably-hot' ? 1 : 0.72;
  return Math.max(8, Math.floor(cap * share));
}

/**
 * One day, with every counter the close screen advances.
 *
 * Deliberately mirrors `closeDay` in `src/app/page.tsx`: the hands-off streak,
 * the two-stand streak, the shop's run of good days and a day off the loan. If
 * this drifts from that, a stage goal can become unreachable in the app while
 * every test here still passes — which is the exact failure this file exists
 * to catch.
 */
function playDay(game: Game, price: number, cups: number, byManager = false): Game {
  const params = deriveDayParams(game.business, price);
  const plan = batchPlan(game.stand, cups);
  const outcome = runDay(game.stand, { ...plan.order, price }, { ...params, lastDay: null });
  return {
    ...game,
    stand: outcome.nextState,
    business: {
      ...updateHandsOff(game.business, byManager, outcome.profit),
      twoStandDays: updateTwoStandDays(game.business, outcome.profit).twoStandDays,
      shop: updateShopDays(game.business.shop, outcome.profit),
      loan: repayLoan(game.business.loan),
    },
  };
}

/** Act 1, played sensibly, which is where every later stage starts from. */
function throughActOne(seed = 2026): Game {
  let game = createGame(seed);
  for (let i = 0; i < ECON.TOTAL_DAYS; i += 1) {
    const plan = batchPlan(game.stand, 28);
    game = { ...game, stand: runDay(game.stand, { ...plan.order, price: 1.6 }).nextState };
  }
  return { ...game, stand: { ...game.stand, status: 'playing' } };
}

/**
 * The stands stage, played the way the goal strip asks.
 *
 * Buy the cooler, hire a manager once there is a wage in hand, wait for the
 * hands-off days, then open at the park. Returns the game and how many days it
 * took, because "before the fallback fires" is the assertion that matters.
 */
function throughStands(start: Game): { game: Game; days: number } {
  let game = beginAct2(start);
  let days = 0;
  while (days < ACT2_DAYS && !act2Progress(game.business, days).complete) {
    if (!game.business.upgrades.cooler && game.stand.cash > 80) {
      const bought = buyUpgrade(game.stand.cash, game.business, 'cooler');
      if (bought.ok) {
        game = { ...game, stand: { ...game.stand, cash: bought.cash }, business: bought.business };
      }
    }
    if (!game.business.staff.manager && game.stand.cash > 120) {
      game = { ...game, business: toggleStaff(game.business, 'manager') };
    }
    if (
      game.business.staff.manager &&
      game.business.handsOffDays >= HANDS_OFF_DAYS_REQUIRED &&
      standCount(game.business) < 2
    ) {
      const opened = openStand(game.business, 'park', game.stand.cash);
      if (opened.opened) {
        game = { ...game, stand: { ...game.stand, cash: opened.cash }, business: opened.business };
      }
    }
    game = playDay(game, sensiblePrice(game), batchForCapacity(game), game.business.staff.manager);
    days += 1;
  }
  return { game, days };
}

/** The shop stage, paid for with a loan and traded until it pays for itself. */
function throughShop(start: Game): { game: Game; days: number } {
  let game = beginAct3(start);
  const loan = loanQuote();
  game = {
    ...game,
    business: { ...game.business, loan },
    stand: { ...game.stand, cash: game.stand.cash + loan.principal },
  };
  let days = 0;
  while (days < ACT3_DAYS && !shopProgress(game.business.shop).complete) {
    if (!game.business.shop.open && game.stand.cash >= SHOP.fitOut) {
      game = {
        ...game,
        stand: { ...game.stand, cash: game.stand.cash - SHOP.fitOut },
        business: { ...game.business, shop: { ...game.business.shop, open: true } },
      };
    }
    game = playDay(game, sensiblePrice(game), batchForCapacity(game), true);
    days += 1;
  }
  return { game, days };
}

describe('the whole arc, played', () => {
  it('finishes Act 1 on the seventh day', () => {
    let game = createGame(2026);
    for (let i = 0; i < ECON.TOTAL_DAYS; i += 1) {
      const plan = batchPlan(game.stand, 28);
      game = { ...game, stand: runDay(game.stand, { ...plan.order, price: 1.6 }).nextState };
    }
    expect(act1Complete(game.stand)).toBe(true);
  });

  it('lets a manager actually earn the hands-off days the goal asks for', () => {
    // The bug. `updateHandsOff` refuses to count a day unless it was run by the
    // manager, and until the close screen grew a button there was no way for a
    // player to produce one.
    let game = beginAct2(createGame(2026));
    game = {
      ...game,
      business: { ...game.business, staff: { helper: false, manager: true } },
      stand: { ...game.stand, cash: 300 },
    };

    expect(act2Progress(game.business, 0).complete).toBe(false);

    let days = 0;
    while (days < ACT2_DAYS && game.business.handsOffDays < HANDS_OFF_DAYS_REQUIRED) {
      game = playDay(game, sensiblePrice(game), sensibleBatch(game), true);
      days += 1;
    }

    expect(game.business.handsOffDays).toBeGreaterThanOrEqual(HANDS_OFF_DAYS_REQUIRED);

    /*
     * And reachable *well before* the fallback, which is the part that matters.
     *
     * `act2Complete` also lets the act end after the fortnight regardless. If
     * the stated goal took longer than that to satisfy, it would be unreachable
     * in every way that a player would notice — the act would simply end one
     * day and the goal strip would still be asking.
     *
     * It takes about a week, because a cold day with a manager on twenty
     * dollars is a loss almost whatever you charge, and the streak only ticks
     * down by one rather than resetting. That is the act's lesson working
     * rather than the act being broken.
     *
     * Proving the manager is no longer the *end* of the act — the second stand
     * is, and the test below walks that — but it is still the gate on opening
     * one, so it has to land with days to spare.
     *
     * Stated as the margin it actually needs rather than as `ACT2_DAYS / 2`.
     * The halfway proxy read as caution and behaved as a constraint: the gate
     * lands on day seven, so `/2` silently pinned the cap at sixteen or more,
     * and shortening the stage failed this assertion instead of failing the
     * player. What the gate genuinely owes the rest of the act is enough room
     * to open a second stand and run it profitably twice.
     */
    expect(days + 1 + TWO_STAND_DAYS_REQUIRED).toBeLessThanOrEqual(ACT2_DAYS);
    expect(act2Progress(game.business, days).nextStep).toMatch(/second stand/i);
  });

  it('does not count a day the kid ran themselves', () => {
    // The other half: if any day counted, "it runs without you" would be a
    // sticker rather than a demonstration.
    let game = beginAct2(createGame(2026));
    game = {
      ...game,
      business: { ...game.business, staff: { helper: false, manager: true } },
      stand: { ...game.stand, cash: 300 },
    };
    for (let i = 0; i < 5; i += 1) {
      game = playDay(game, sensiblePrice(game), sensibleBatch(game), false);
    }
    expect(game.business.handsOffDays).toBe(0);
  });

  it('still ends Act 2 for a kid who never hires anybody', () => {
    // The fallback is correct and should stay: an act with only one exit is an
    // act somebody gets stuck in.
    expect(act2Complete(createBusinessState(), ACT2_DAYS)).toBe(true);
  });

  it('reaches the second stand before the fortnight runs out', () => {
    /*
     * The stands stage now ends on two pitches trading at a profit, not on a
     * manager existing. That is a longer chain — hire, prove, open, prove again
     * — and a chain that took longer than the fallback would leave the goal
     * strip asking for something the act had already moved past. It takes about
     * ten days.
     */
    const { game, days } = throughStands(throughActOne());
    expect(standCount(game.business)).toBe(2);
    expect(game.business.twoStandDays).toBeGreaterThanOrEqual(TWO_STAND_DAYS_REQUIRED);
    expect(act2Complete(game.business, days)).toBe(true);
    expect(days).toBeLessThan(ACT2_DAYS);
  });

  it('opens a stand only once somebody is minding the first one', () => {
    // The whole staffing lesson in one assertion: the kid is one person.
    const bare = createBusinessState();
    expect(openStand(bare, 'park', 999).opened).toBe(false);
    expect(openStand(bare, 'park', 999).reason).toMatch(/mind/i);

    const managed = toggleStaff(bare, 'manager');
    expect(openStand(managed, 'park', 999).opened).toBe(true);
  });

  it('makes the shop reachable, and pays for its own door before the clock', () => {
    const stands = throughStands(throughActOne());
    const { game, days } = throughShop(stands.game);

    expect(game.business.shop.open).toBe(true);
    expect(game.business.shop.goodDays).toBeGreaterThanOrEqual(SHOP_DAYS_REQUIRED);
    expect(act3Complete(game.business, days)).toBe(true);
    expect(days).toBeLessThan(ACT3_DAYS);

    // And it is a genuinely bigger business than the stands were, or the rent
    // was not worth owing.
    expect(trailingWeeklyProfit(game.stand.history)).toBeGreaterThan(
      trailingWeeklyProfit(stands.game.stand.history),
    );
  });

  it('pays the loan down out of trading, without being asked', () => {
    const { game } = throughShop(throughStands(throughActOne()).game);
    expect(game.business.loan).not.toBeNull();
    // Owed every day, good day or bad, which is the entire difference between
    // borrowing and selling a slice.
    expect(game.business.loan!.outstanding).toBeLessThan(game.business.loan!.total);
  });

  it('prices the company off the kid\'s own week, and cuts it into shares', () => {
    const { game } = throughShop(throughStands(throughActOne()).game);
    const ready = beginAct4(game);
    const offer = listingOffer(ready.stand.history, ready.ownership);

    // The bridge in PRODUCT.md §9, still one division the kid can do — and
    // then one more.
    expect(offer.value).toBeCloseTo(offer.weeklyProfit * offer.publicMultiple, 2);
    expect(offer.pricePerShare).toBeCloseTo(offer.value / offer.shares, 2);

    // The crowd always pays more than the single buyer, because they are
    // buying less: the profit, and not the early mornings.
    expect(offer.publicMultiple).toBeGreaterThan(offer.buyoutMultiple);
    expect(offer.value).toBeGreaterThan(offer.buyout.price);

    // And a share price a child can hold in their head rather than a number
    // nobody has ever seen on a share.
    expect(offer.pricePerShare).toBeGreaterThan(0.5);
    expect(offer.pricePerShare).toBeLessThan(60);
  });

  it('ends the listing stage only after a week has been lived through', () => {
    const { game } = throughShop(throughStands(throughActOne()).game);
    let ready = beginAct4(game);
    ready = { ...ready, ownership: recordDealChoice(ready.ownership, 'sam') };

    const offer = listingOffer(ready.stand.history, ready.ownership);
    const plan = floatPlan(offer, 0.3, ready.ownership);
    let listing = listCompany(offer, plan);

    // Listed, and not finished: reaching a listing teaches what a company is
    // worth, and living one is what teaches what a share price is.
    expect(listing.listed).toBe(true);
    expect(listingComplete(listing)).toBe(false);
    expect(act4Complete(ready.ownership, listing)).toBe(false);

    listing = markListedWeek(listing, trailingWeeklyProfit(ready.stand.history)).listing;
    expect(listingComplete(listing)).toBe(true);
    expect(act4Complete(ready.ownership, listing)).toBe(true);
  });

  it('still ends the listing stage for a kid who sells up instead', () => {
    // The buyout did not go away and should not: selling is a real outcome and
    // it is the one the game used to have.
    const fresh = createGame(1);
    const sold = acceptBuyout(fresh.ownership, offerOf(10, 800));
    expect(act4Complete(sold, fresh.listing)).toBe(true);
  });

  it('carries the money from the sale into the market, and nothing else', () => {
    let game = beginAct4(beginAct3(beginAct2(createGame(2026))));
    game = {
      ...game,
      stand: { ...game.stand, cash: 40 },
      business: { ...game.business, savings: 60 },
      ownership: acceptBuyout(game.ownership, offerOf(10, 800)),
    };
    const market = beginAct5(game);
    expect(market.portfolio?.cash).toBeCloseTo(900, 2);
    expect(Object.keys(market.portfolio?.holdings ?? {})).toHaveLength(0);
  });

  it('carries the float into the market when the kid stayed a founder', () => {
    const { game } = throughShop(throughStands(throughActOne()).game);
    let ready = beginAct4(game);
    const offer = listingOffer(ready.stand.history, ready.ownership);
    const plan = floatPlan(offer, 0.3, ready.ownership);
    const listing = markListedWeek(
      listCompany(offer, plan),
      trailingWeeklyProfit(ready.stand.history),
    ).listing;
    ready = { ...ready, listing, stand: { ...ready.stand, cash: 0 }, business: { ...ready.business, savings: 0 } };

    const market = beginAct5(ready);
    // What the float raised — not what a buyer would have paid for the lot,
    // because the company is still standing and the kid still owns most of it.
    expect(market.portfolio?.cash).toBeCloseTo(listing.raised, 2);
    expect(market.act).toBe(5);
    expect(listing.founderShare).toBeCloseTo(0.7, 2);
  });

  it('runs the market out to the end and closes itself', () => {
    let game = beginAct5({
      ...beginAct4(beginAct3(beginAct2(createGame(2026)))),
      ownership: acceptBuyout(createGame(1).ownership, offerOf(10, 800)),
    });
    let portfolio = game.portfolio!;
    const bought = buy(portfolio, 'AAPL', 200);
    expect(bought.ok).toBe(true);
    portfolio = bought.portfolio;

    for (let week = portfolio.week; week < MARKET_WEEKS; week += 1) {
      portfolio = advanceWeek(portfolio).portfolio;
    }
    expect(portfolio.week).toBe(MARKET_WEEKS);
    expect(portfolio.status).toBe('closed');
    game = { ...game, portfolio };
    // And the finale has something real to show.
    expect(Object.keys(portfolio.holdings)).toContain('AAPL');
  });
});
