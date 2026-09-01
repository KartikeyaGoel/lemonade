import { describe, expect, it } from 'vitest';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  act2Progress,
  createBusinessState,
  deriveDayParams,
  updateHandsOff,
} from '../src/lib/business';
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

function playDay(game: Game, price: number, cups: number, byManager = false): Game {
  const params = deriveDayParams(game.business, game.stand.history.length);
  const plan = batchPlan(game.stand, cups);
  const outcome = runDay(game.stand, { ...plan.order, price }, { ...params, lastDay: null });
  return {
    ...game,
    stand: outcome.nextState,
    business: updateHandsOff(game.business, byManager, outcome.profit),
  };
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
    while (days < ACT2_DAYS && !act2Progress(game.business, days).complete) {
      game = playDay(game, sensiblePrice(game), sensibleBatch(game), true);
      days += 1;
    }

    expect(game.business.handsOffDays).toBeGreaterThanOrEqual(HANDS_OFF_DAYS_REQUIRED);
    expect(act2Progress(game.business, days).complete).toBe(true);

    /*
     * And reachable *before* the fallback, which is the part that matters.
     *
     * `act2Complete` also lets the act end after fourteen days regardless. If
     * the stated goal took longer than that to satisfy, it would be unreachable
     * in every way that a player would notice — the act would simply end one
     * day and the goal strip would still be asking.
     *
     * It takes about a week, because a cold day with a manager on twenty
     * dollars is a loss almost whatever you charge, and the streak only ticks
     * down by one rather than resetting. That is the act's lesson working
     * rather than the act being broken.
     */
    expect(days).toBeLessThan(ACT2_DAYS);
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

  it('ends Act 3 only when the business is actually sold', () => {
    let game = beginAct3(beginAct2(createGame(2026)));
    expect(act3Complete(game.ownership)).toBe(false);
    game = { ...game, ownership: recordDealChoice(game.ownership, 'sam') };
    expect(act3Complete(game.ownership)).toBe(false);
    game = { ...game, ownership: acceptBuyout(game.ownership, offerOf(10, 800)) };
    expect(act3Complete(game.ownership)).toBe(true);
  });

  it('carries the money from the sale into the market, and nothing else', () => {
    let game = beginAct3(beginAct2(createGame(2026)));
    game = {
      ...game,
      stand: { ...game.stand, cash: 40 },
      business: { ...game.business, savings: 60 },
      ownership: acceptBuyout(game.ownership, offerOf(10, 800)),
    };
    const act4 = beginAct4(game);
    expect(act4.portfolio?.cash).toBeCloseTo(900, 2);
    expect(Object.keys(act4.portfolio?.holdings ?? {})).toHaveLength(0);
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
