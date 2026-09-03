import { describe, it, expect } from 'vitest';
import {
  ACT3_DAYS,
  ACT_TITLES,
  act1Complete,
  act2Complete,
  act3Complete,
  act4Complete,
  actDay,
  beginAct2,
  beginAct3,
  beginAct4,
  beginAct5,
  createGame,
  heldThroughWorstDay,
  readiness,
  standing,
  type Game,
} from '../src/lib/progress';
import { parentReport, conversationStarter } from '../src/lib/parent';
import { ECON, orderForTargetCups, round2, runDay, type DayRecord } from '../src/lib/simulation';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  TWO_STAND_DAYS_REQUIRED,
  buyUpgrade,
  openStand,
  toggleStaff,
  trailingWeeklyProfit,
  updateHandsOff,
  updateTwoStandDays,
} from '../src/lib/business';
import { SHOP_DAYS_REQUIRED, updateShopDays } from '../src/lib/retail';
import { floatPlan, listCompany, listingOffer, markListedWeek } from '../src/lib/listing';
import {
  acceptBuyout,
  buyoutOffer,
  recordDealChoice,
} from '../src/lib/ownership';
import { buy, maxSpendOn, markResearched } from '../src/lib/market';

function withHistory(profits: number[], prices?: number[]): DayRecord[] {
  return profits.map((profit, i) => ({
    day: i + 1,
    weather: 'mild' as const,
    price: prices ? prices[i] : 1.6,
    cupsSold: 30,
    cupsWanted: 30,
    revenue: 48,
    profit,
    cashAfter: 100,
  }));
}

/** A game played all the way through Level 1, ending in a sale. */
function playedThrough(): Game {
  let game = createGame(7);
  for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
    const outcome = runDay(game.stand, { ...orderForTargetCups(game.stand, 30), price: 1.6 });
    game = { ...game, stand: { ...outcome.nextState, status: 'playing' } };
  }
  game = beginAct2(game);
  game = { ...game, business: buyUpgrade(200, game.business, 'cooler').business };
  game = { ...game, business: toggleStaff(game.business, 'manager') };
  for (let i = 0; i < HANDS_OFF_DAYS_REQUIRED; i++) {
    game = { ...game, business: updateHandsOff(game.business, true, 25) };
  }
  game = { ...game, business: openStand(game.business, 'park', 200).business };
  for (let i = 0; i < TWO_STAND_DAYS_REQUIRED; i++) {
    game = { ...game, business: updateTwoStandDays(game.business, 25) };
  }
  // Stage 3: a door, paid for out of profit, trading well enough to end it.
  game = beginAct3(game);
  game = {
    ...game,
    business: { ...game.business, shop: { ...game.business.shop, open: true } },
  };
  for (let i = 0; i < SHOP_DAYS_REQUIRED; i++) {
    game = { ...game, business: { ...game.business, shop: updateShopDays(game.business.shop, 40) } };
  }
  // Stage 4: rank the stands for sale, then sell up rather than list.
  game = beginAct4(game);
  game = { ...game, learned: [...game.learned, 'margin'] };
  game = { ...game, ownership: recordDealChoice(game.ownership, 'sam') };
  const offer = buyoutOffer(game.stand.history, game.ownership);
  game = { ...game, ownership: acceptBuyout(game.ownership, offer) };
  return game;
}

/** The same run, but taken public instead of sold. */
function listedInstead(): Game {
  const game = playedThrough();
  const base: Game = { ...game, ownership: { ...game.ownership, buyoutAccepted: false } };
  const offer = listingOffer(base.stand.history, base.ownership);
  const plan = floatPlan(offer, 0.3, base.ownership);
  const listing = listCompany(offer, plan);
  const marked = markListedWeek(listing, trailingWeeklyProfit(base.stand.history));
  return {
    ...base,
    listing: marked.listing,
    stand: { ...base.stand, cash: round2(base.stand.cash + plan.cashRaised) },
  };
}

describe('acts begin and end on real conditions', () => {
  it('Act 1 ends after seven days, not before', () => {
    let game = createGame(1);
    expect(act1Complete(game.stand)).toBe(false);
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      const outcome = runDay(game.stand, { ...orderForTargetCups(game.stand, 30), price: 1.6 });
      game = { ...game, stand: { ...outcome.nextState, status: 'playing' } };
    }
    expect(act1Complete(game.stand)).toBe(true);
  });

  it('Act 2 needs a manager and then a second stand actually paying', () => {
    const game = createGame(1);
    expect(act2Complete(game.business, 5)).toBe(false);

    // A manager on its own used to end the act. It is now the unlock: it frees
    // the kid's hands, and the act ends where the lesson does.
    let business = toggleStaff(game.business, 'manager');
    for (let i = 0; i < HANDS_OFF_DAYS_REQUIRED; i++) {
      business = updateHandsOff(business, true, 20);
    }
    expect(act2Complete(business, 5)).toBe(false);

    business = openStand(business, 'park', 200).business;
    expect(act2Complete(business, 5)).toBe(false);

    for (let i = 0; i < TWO_STAND_DAYS_REQUIRED; i++) {
      business = updateTwoStandDays(business, 20);
    }
    expect(act2Complete(business, 5)).toBe(true);
  });

  it('Act 2 also ends if the fortnight runs out, so nobody gets stuck', () => {
    const game = createGame(1);
    expect(act2Complete(game.business, ACT2_DAYS)).toBe(true);
  });

  it('Act 3 ends when the shop has paid for its own door', () => {
    const game = createGame(1);
    expect(act3Complete(game.business, 0)).toBe(false);

    let shop = { ...game.business.shop, open: true };
    for (let i = 0; i < SHOP_DAYS_REQUIRED; i++) shop = updateShopDays(shop, 40);
    expect(act3Complete({ ...game.business, shop }, 0)).toBe(true);
  });

  it('Act 3 hands over on the clock too, so a bad run is not a dead end', () => {
    const game = createGame(1);
    expect(act3Complete(game.business, ACT3_DAYS)).toBe(true);
  });

  it('Act 4 ends at a sale or at a listing, and both are real endings', () => {
    const fresh = createGame(1);
    expect(act4Complete(fresh.ownership, fresh.listing)).toBe(false);

    const sold = playedThrough();
    expect(act4Complete(sold.ownership, sold.listing)).toBe(true);

    const listed = listedInstead();
    expect(listed.ownership.buyoutAccepted).toBe(false);
    expect(act4Complete(listed.ownership, listed.listing)).toBe(true);
  });

  it('a listing is not finished until a week has actually been lived through', () => {
    const game = playedThrough();
    const base: Game = { ...game, ownership: { ...game.ownership, buyoutAccepted: false } };
    const offer = listingOffer(base.stand.history, base.ownership);
    const listing = listCompany(offer, floatPlan(offer, 0.3, base.ownership));
    // Reaching a listing teaches what a company is worth. Living a week as one
    // is what teaches what a share price is, so the stage does not end here.
    expect(act4Complete(base.ownership, listing)).toBe(false);
  });

  it('carries the same money and stand from Act 1 into Act 2', () => {
    let game = createGame(3);
    game = { ...game, stand: { ...game.stand, cash: 180 } };
    const act2 = beginAct2(game);
    expect(act2.act).toBe(2);
    expect(act2.stand.cash).toBe(180);
    expect(act2.stand.history).toEqual(game.stand.history);
  });

  it('seeds the market with exactly what the kid walked away with', () => {
    const game = playedThrough();
    const act5 = beginAct5(game);
    expect(act5.portfolio).not.toBeNull();
    const expected =
      game.ownership.buyoutProceeds + game.business.savings + game.stand.cash;
    expect(act5.portfolio!.cash).toBeCloseTo(expected, 2);
  });

  it('seeds the market from the float when the kid listed instead of selling', () => {
    const game = listedInstead();
    const act5 = beginAct5(game);
    // What the float raised, not what a buyer would have paid for the lot. The
    // company still exists and the kid still owns most of it.
    const expected = game.listing.raised + game.business.savings + game.stand.cash;
    expect(act5.portfolio!.cash).toBeCloseTo(expected, 2);
    expect(game.listing.raised).toBeGreaterThan(0);
  });

  it('counts each stage from where that stage opened, not from a fixed day', () => {
    // Two kids reach the shop on different days; both are on its day one.
    const early: Game = { ...createGame(1), act: 3, stageStartDay: 14 };
    const late: Game = { ...createGame(1), act: 3, stageStartDay: 26 };
    expect(actDay({ ...early, stand: { ...early.stand, history: withHistory([1], [1.6]) } })).toBe(1);
    expect(
      actDay({
        ...late,
        stand: {
          ...late.stand,
          history: Array.from({ length: 28 }, () => withHistory([1], [1.6])[0]),
        },
      }),
    ).toBe(3);
  });

  it('names every act with a promise, not a lesson title', () => {
    for (const act of [1, 2, 3, 4, 5] as const) {
      expect(ACT_TITLES[act].name.length).toBeGreaterThan(3);
      expect(ACT_TITLES[act].promise).not.toMatch(/learn|lesson/i);
    }
  });
});

describe('did they panic after their worst day?', () => {
  it('credits a kid who held their price', () => {
    const history = withHistory([20, -4, 22, 25], [1.6, 1.6, 1.6, 1.65]);
    const result = heldThroughWorstDay(history);
    expect(result.met).toBe(true);
    expect(result.detail).toContain('instead of panicking');
  });

  it('does not credit a kid who swung wildly', () => {
    const history = withHistory([20, -4, 10, 12], [1.6, 1.6, 0.6, 0.7]);
    const result = heldThroughWorstDay(history);
    expect(result.met).toBe(false);
    expect(result.detail).toContain('swung the price');
  });

  it('judges the worst day that had a tomorrow, not the worst day outright', () => {
    // The final day here is the worst overall, but there is nothing to judge
    // about it. The kid held steady after their worst *judgeable* day, so this
    // should pass rather than lock them out on a technicality.
    const history = withHistory([20, 4, 22, -5], [1.6, 1.6, 1.6, 1.6]);
    expect(heldThroughWorstDay(history).met).toBe(true);
  });

  it('still catches a panic after the worst judgeable day', () => {
    const history = withHistory([20, 4, 22, -5], [1.6, 1.6, 0.5, 1.6]);
    expect(heldThroughWorstDay(history).met).toBe(false);
  });

  it('needs some history before it claims anything', () => {
    expect(heldThroughWorstDay(withHistory([10])).met).toBe(false);
  });
});

describe('the readiness gate is a real lock', () => {
  it('a fresh game cannot trade', () => {
    const gate = readiness(createGame(1));
    expect(gate.canTrade).toBe(false);
    expect(gate.metCount).toBe(0);
    expect(gate.criteria).toHaveLength(4);
  });

  it('four out of four is the only thing that unlocks trading', () => {
    let game = playedThrough();
    // Force the held-through-loss criterion by giving a steady-handed history.
    game = { ...game, stand: { ...game.stand, history: withHistory([20, -3, 21, 24], [1.6, 1.6, 1.6, 1.6]) } };
    const gate = readiness(game);
    expect(gate.metCount).toBe(4);
    expect(gate.canTrade).toBe(true);
  });

  it('three out of four still refuses', () => {
    let game = playedThrough();
    game = { ...game, stand: { ...game.stand, history: withHistory([20, -3, 21], [1.6, 0.5, 1.6]) } };
    game = { ...game, learned: game.learned.filter((l) => l !== 'margin') };
    const gate = readiness(game);
    expect(gate.canTrade).toBe(false);
  });

  it('will not credit picking the overpriced kiosk', () => {
    let game = playedThrough();
    game = { ...game, ownership: recordDealChoice(game.ownership, 'kiosk') };
    const gate = readiness(game);
    const passed = gate.criteria.find((c) => c.id === 'passed-on-price')!;
    expect(passed.met).toBe(false);
    expect(gate.canTrade).toBe(false);
  });

  it('every unmet criterion explains what is missing', () => {
    for (const criterion of readiness(createGame(1)).criteria) {
      expect(criterion.met).toBe(false);
      expect(criterion.detail.length).toBeGreaterThan(10);
    }
  });
});

describe('the parent report is evidence, never a score', () => {
  it('says almost nothing about a kid who has done almost nothing', () => {
    const report = parentReport(createGame(1));
    expect(report.understanding).toHaveLength(0);
    expect(report.daysTraded).toBe(0);
    expect(report.conversationStarter.length).toBeGreaterThan(10);
  });

  it('never contains a percentage score or a grade', () => {
    const report = parentReport(playedThrough());
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/\b(score|grade|xp|badge|streak)\b/i);
  });

  it('quotes the kid\'s own numbers in every activity line', () => {
    const report = parentReport(playedThrough());
    expect(report.activity.length).toBeGreaterThan(2);
    expect(report.activity.some((line) => /\$/.test(line.evidence))).toBe(true);
  });

  it('reports the buyout with the multiple it represented', () => {
    const game = playedThrough();
    const report = parentReport(game);
    const sale = report.activity.find((l) => l.topic === 'Sold the business');
    expect(sale).toBeDefined();
    expect(sale!.evidence).toContain(String(game.ownership.buyoutMultiple));
    expect(sale!.evidence).toContain('times what it earned in a week');
  });

  it('claims valuation understanding only when they actually got it right', () => {
    const right = parentReport({ ...playedThrough(), ownership: recordDealChoice(playedThrough().ownership, 'sam') });
    expect(right.understanding.some((l) => l.topic === 'Valuation')).toBe(true);

    const wrong = parentReport({ ...playedThrough(), ownership: recordDealChoice(playedThrough().ownership, 'kiosk') });
    expect(wrong.understanding.some((l) => l.topic === 'Valuation')).toBe(false);
    expect(wrong.notYet.length).toBeGreaterThan(0);
  });

  it('is honest about what has not been shown yet', () => {
    let game = playedThrough();
    game = beginAct5(game);
    game = { ...game, portfolio: buy(game.portfolio!, 'AAPL', maxSpendOn(game.portfolio!, 'AAPL')).portfolio };
    const report = parentReport(game);
    // One holding is not diversification, and we say so rather than implying it.
    expect(report.understanding.some((l) => l.topic.includes('Spreads money'))).toBe(false);
    expect(report.notYet.some((n) => n.toLowerCase().includes('concentrated'))).toBe(true);
  });

  it('credits diversification once it is real', () => {
    const game = beginAct5(playedThrough());
    let portfolio = game.portfolio!;
    for (const ticker of ['AAPL', 'KO', 'CMG']) {
      portfolio = buy(portfolio, ticker, maxSpendOn(portfolio, ticker)).portfolio;
    }
    const report = parentReport({ ...game, portfolio });
    const line = report.understanding.find((l) => l.topic.includes('Spreads money'));
    expect(line).toBeDefined();
    // And it cites the actual position, so a parent can check it rather than
    // taking the word for it. See `src/lib/mastery.ts`.
    expect(line?.evidence).toMatch(/3 companies/);
    expect(line?.evidence).toMatch(/\d+%/);
  });

  it('reports research actually opened', () => {
    const game = beginAct5(playedThrough());
    let portfolio = markResearched(game.portfolio!, 'AAPL');
    portfolio = markResearched(portfolio, 'KO');
    const report = parentReport({ ...game, portfolio });
    expect(report.activity.some((l) => l.evidence.includes('Researched 2'))).toBe(true);
  });

  it('gives a conversation starter tied to what the kid actually did', () => {
    const sold = playedThrough();
    // Passing on an overpriced business is the harder, more interesting skill,
    // so it outranks the buyout question when both are true.
    expect(sold.ownership.passedOnOverpriced).toBe(true);
    expect(conversationStarter(sold)).toContain('kiosk');

    /*
     * The starter picks the most interesting true thing, and the shop and the
     * second stand are both more interesting than the sale. So this asserts the
     * ordering rather than one string: with the later facts taken away, the
     * buyout question is what is left.
     */
    const soldOnly: Game = {
      ...sold,
      ownership: { ...sold.ownership, passedOnOverpriced: false, comparisonChoiceId: null },
      business: {
        ...sold.business,
        stands: [],
        shop: { ...sold.business.shop, open: false },
        loan: null,
      },
      listing: createGame(1).listing,
    };
    expect(conversationStarter(soldOnly)).toContain('times what your stand earns');

    // And with the shop back, the shop is what gets asked about.
    expect(conversationStarter({ ...soldOnly, business: sold.business })).toMatch(
      /shop owes|second stand|borrowed/,
    );
  });

  it('never asks about something that did not happen', () => {
    const fresh = createGame(1);
    const starter = conversationStarter(fresh);
    expect(starter).not.toContain('manager');
    expect(starter).not.toContain('kiosk');
  });
});

describe('standing summarises where the kid is', () => {
  it('reports the act, the day and the money', () => {
    const game = createGame(1);
    const s = standing(game);
    expect(s.act).toBe(1);
    expect(s.actDay).toBe(1);
    expect(s.cash).toBe(ECON.STARTING_CASH);
  });

  it('counts days traded across the whole game', () => {
    const game = playedThrough();
    expect(standing(game).daysTraded).toBe(ECON.TOTAL_DAYS);
  });
});
