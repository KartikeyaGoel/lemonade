import { describe, expect, it } from 'vitest';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  TWO_STAND_DAYS_REQUIRED,
  act2Progress,
  createBusinessState,
  openStand,
  standCount,
  toggleStaff,
  trailingWeeklyProfit,
} from '../src/lib/business';
import {
  SHOP_DAYS_REQUIRED,
} from '../src/lib/retail';
import {
  act1Complete,
  act2Complete,
  act3Complete,
  beginAct2,
  beginAct3,
  beginAct4,
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
/*
 * The playthrough itself lives in `src/lib/demo.ts`.
 *
 * It started here, as a test double that deliberately mirrored `closeDay` in
 * `page.tsx`. Then the demo shortcut needed exactly the same thing — a save
 * played forward to a given stage — and a policy with two homes is the defect
 * class PRODUCT.md §62 names. So the app owns it and this file drives it,
 * which is the better arrangement anyway: the assertions below are now checking
 * the code that actually builds a demo save rather than a copy of it.
 */
import {
  playDay,
  sensiblePrice,
  throughActOne,
  throughStands,
} from '../src/lib/demo';

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
      business: {
        ...game.business,
        staff: { helper: false, manager: true },
        /*
         * The kit, which this fixture used to leave empty.
         *
         * It could, while `playDay` never advanced the rival — with the street
         * uncontested the streak filled in about a week on the cooler alone.
         * With the competitor restored it takes the full sixteen days and this
         * assertion fails, which is the trap this fixture would otherwise be
         * quietly asserting is fine: a child standing across the road from
         * somebody cheaper, paying a manager twenty dollars a day, on a
         * business that loses money about two days in three.
         *
         * So the fixture is now a child who has bought the fifty-five dollars
         * of kit that answers the rival, because what this test is about is
         * whether the gate lands with days to spare for somebody playing the
         * stage as designed. The trap itself is measured in
         * `tests/rival.test.ts`, where it belongs.
         */
        upgrades: { ...game.business.upgrades, freshSqueeze: true, bigSign: true, cooler: true },
      },
      stand: { ...game.stand, cash: 300 },
    };

    expect(act2Progress(game.business, 0).complete).toBe(false);

    let days = 0;
    while (days < ACT2_DAYS && game.business.handsOffDays < HANDS_OFF_DAYS_REQUIRED) {
      days += 1;
      game = playDay(game, sensiblePrice(game), sensibleBatch(game), true, days);
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
    /*
     * One stage now. The shop is the fourth rung of the business stage rather
     * than a stage of its own — see the note on `Act` — so `throughStands`
     * walks the whole thing: the kit, the manager, the second stand, and then
     * the door on a loan.
     */
    const { game, days } = throughStands(throughActOne());

    expect(game.business.shop.open, 'the door never went up').toBe(true);
    expect(game.business.shop.goodDays).toBeGreaterThanOrEqual(SHOP_DAYS_REQUIRED);
    expect(act2Complete(game.business, days)).toBe(true);
    expect(days, `took ${days} days of ${ACT2_DAYS}`).toBeLessThan(ACT2_DAYS);

    // And it is a genuinely bigger business than one table was, or the rent
    // was not worth owing.
    const beforeTheDoor = game.stand.history.slice(0, ECON.TOTAL_DAYS);
    expect(trailingWeeklyProfit(game.stand.history)).toBeGreaterThan(
      trailingWeeklyProfit(beforeTheDoor),
    );
  });

  it('pays the loan down out of trading, without being asked', () => {
    const { game } = throughStands(throughActOne());
    expect(game.business.loan).not.toBeNull();
    // Owed every day, good day or bad, which is the entire difference between
    // borrowing and selling a slice.
    expect(game.business.loan!.outstanding).toBeLessThan(game.business.loan!.total);
  });

  it('prices the company off the kid\'s own week, and cuts it into shares', () => {
    const { game } = throughStands(throughActOne());
    const ready = beginAct3(game);
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
    const { game } = throughStands(throughActOne());
    let ready = beginAct3(game);
    ready = { ...ready, ownership: recordDealChoice(ready.ownership, 'sam') };

    const offer = listingOffer(ready.stand.history, ready.ownership);
    const plan = floatPlan(offer, 0.3, ready.ownership);
    let listing = listCompany(offer, plan);

    // Listed, and not finished: reaching a listing teaches what a company is
    // worth, and living one is what teaches what a share price is.
    expect(listing.listed).toBe(true);
    expect(listingComplete(listing)).toBe(false);
    expect(act3Complete(ready.ownership, listing)).toBe(false);

    listing = markListedWeek(listing, trailingWeeklyProfit(ready.stand.history)).listing;
    expect(listingComplete(listing)).toBe(true);
    expect(act3Complete(ready.ownership, listing)).toBe(true);
  });

  it('still ends the listing stage for a kid who sells up instead', () => {
    // The buyout did not go away and should not: selling is a real outcome and
    // it is the one the game used to have.
    const fresh = createGame(1);
    const sold = acceptBuyout(fresh.ownership, offerOf(10, 800));
    expect(act3Complete(sold, fresh.listing)).toBe(true);
  });

  it('carries the money from the sale into the market, and nothing else', () => {
    let game = beginAct3(beginAct3(beginAct2(createGame(2026))));
    game = {
      ...game,
      stand: { ...game.stand, cash: 40 },
      business: { ...game.business, savings: 60 },
      ownership: acceptBuyout(game.ownership, offerOf(10, 800)),
    };
    const market = beginAct4(game);
    expect(market.portfolio?.cash).toBeCloseTo(900, 2);
    expect(Object.keys(market.portfolio?.holdings ?? {})).toHaveLength(0);
  });

  it('carries the float into the market when the kid stayed a founder', () => {
    const { game } = throughStands(throughActOne());
    let ready = beginAct3(game);
    const offer = listingOffer(ready.stand.history, ready.ownership);
    const plan = floatPlan(offer, 0.3, ready.ownership);
    const listing = markListedWeek(
      listCompany(offer, plan),
      trailingWeeklyProfit(ready.stand.history),
    ).listing;
    ready = { ...ready, listing, stand: { ...ready.stand, cash: 0 }, business: { ...ready.business, savings: 0 } };

    const market = beginAct4(ready);
    // What the float raised — not what a buyer would have paid for the lot,
    // because the company is still standing and the kid still owns most of it.
    expect(market.portfolio?.cash).toBeCloseTo(listing.raised, 2);
    expect(market.act).toBe(4);
    expect(listing.founderShare).toBeCloseTo(0.7, 2);
  });

  it('runs the market out to the end and closes itself', () => {
    let game = beginAct4({
      ...beginAct3(beginAct2(createGame(2026))),
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
