/**
 * Can every reward in the game actually be produced by playing it?
 *
 * PRODUCT.md §40 records the expensive version of this going wrong: Act 2 asked
 * a kid for "three more profitable days run by your manager", the counter
 * existed, the badge existed, and nothing in the game called the function that
 * moved it. The act still ended on a fallback, which is exactly why nobody
 * noticed for months.
 *
 * Restructuring the arc into five stages broke it again in the other direction:
 * the investor offer moved out of its own screen into the shop's three-way
 * funding choice, and `equityOfferSeen` — which the badge for keeping the whole
 * company reads — had nothing left to set it.
 *
 * So this asserts the property rather than the instance: every badge and every
 * mastery skill has *some* reachable state that produces it. It cannot prove a
 * player would find it, but it does refuse to let one become impossible.
 */
import { describe, it, expect } from 'vitest';
import { BADGES, earnedBadges, type BadgeContext } from '../src/lib/achievements';
import { createBusinessState, type BusinessState } from '../src/lib/business';
import { createOwnershipState } from '../src/lib/ownership';
import { createListing, listCompany, listingOffer, floatPlan, markListedWeek } from '../src/lib/listing';
import { buy, createPortfolio, markResearched, maxSpendOn } from '../src/lib/market';
import { GLOSSARY } from '../src/lib/glossary';
import { SHARES } from '../src/lib/listing';
import type { DayRecord } from '../src/lib/simulation';
import { beginAct5, createGame, seededWith, type Game } from '../src/lib/progress';
import { mastery, type SkillId } from '../src/lib/mastery';
import type { Thesis, ThesisScore } from '../src/lib/thesis';

/**
 * The most generous state the game can legally be in.
 *
 * Built to satisfy the day-shape detectors rather than to look plausible: a
 * cold day carried by the round, a day where everybody who wanted a cup got
 * one, a hot day that sold out, and a steady price through the worst day so
 * the no-panic detector fires. A fixture that misses those reports nine
 * perfectly reachable badges as broken, which is worse than no test.
 */
function everything(): BadgeContext {
  const day = (over: Partial<DayRecord> & { day: number }): DayRecord => ({
    weather: 'mild',
    price: 2,
    cupsSold: 40,
    cupsMade: 40,
    cupsWanted: 40,
    revenue: 80,
    profit: 30,
    cashAfter: 400,
    marketShare: 0.5,
    fixedCost: 40,
    subscriberCups: 6,
    spoiledLemons: 0,
    forecast: 'probably-mild',
    ...over,
  });

  const history: DayRecord[] = [
    // Everybody who wanted a cup got one.
    day({ day: 1, cupsSold: 40, cupsWanted: 40 }),
    // A hot day they could not reach the end of.
    day({ day: 2, weather: 'hot', cupsSold: 40, cupsMade: 40, cupsWanted: 90 }),
    // The round carrying a cold morning on its own.
    day({ day: 3, weather: 'cold', cupsSold: 10, cupsMade: 10, cupsWanted: 10, subscriberCups: 9 }),
    // Two cold days carried while a shop's rent was owed before opening.
    day({ day: 31, weather: 'cold', profit: 4, fixedCost: 127 }),
    day({ day: 32, weather: 'cold', profit: 9, fixedCost: 127 }),
    // The worst day, and the same price held straight through it.
    day({ day: 4, profit: -8 }),
    day({ day: 5 }),
    ...Array.from({ length: 23 }, (_, i) => day({ day: i + 6, profit: 30 + i })),
    // Charged more in the same weather and came out ahead. Not a rounding
    // detail: it is the whole of Act 1, so a fixture without it reports the
    // badge for it as unearnable.
    day({ day: 29, price: 1.8, cupsSold: 44, cupsMade: 44, cupsWanted: 44, profit: 22 }),
    day({ day: 30, price: 2.2, cupsSold: 32, cupsMade: 32, cupsWanted: 32, profit: 41 }),
  ];

  const business: BusinessState = {
    ...createBusinessState(),
    upgrades: { cooler: true, bigSign: true, freshSqueeze: true },
    staff: { helper: true, manager: true },
    location: 'park',
    rival: { active: true, price: 0.8, location: 'park', daysActive: 8 },
    savings: 400,
    handsOffDays: 5,
    daysAtPark: 6,
    regulars: 12,
    roundDrives: 3,
    stands: [{ id: 1, location: 'sidewalk', runBy: 'you' }],
    twoStandDays: 4,
    shop: { open: true, staff: 2, goodDays: 6 },
    loan: { principal: 400, total: 500, daily: 25, outstanding: 0 },
  };

  const ownership = {
    ...createOwnershipState(),
    equityOfferSeen: true,
    comparisonAnswered: true,
    comparisonChoiceId: 'sam',
    passedOnOverpriced: true,
  };

  const offer = listingOffer(history, ownership);
  const listed = markListedWeek(listCompany(offer, floatPlan(offer, 0.1, ownership)), 1).listing;

  /*
   * A portfolio that has done everything: six sets of accounts read, four
   * companies held, and one of them ridden through a fall rather than sold.
   * Built with the real functions so the shape cannot drift from the game's.
   */
  let portfolio = createPortfolio(4000, 7);
  for (const ticker of ['AAPL', 'KO', 'CMG', 'NKE', 'COST', 'MCD']) {
    portfolio = markResearched(portfolio, ticker);
  }
  for (const ticker of ['AAPL', 'KO', 'CMG', 'NKE']) {
    portfolio = buy(portfolio, ticker, maxSpendOn(portfolio, ticker)).portfolio;
  }
  portfolio = {
    ...portfolio,
    holdings: Object.fromEntries(
      Object.entries(portfolio.holdings).map(([ticker, holding]) => [
        ticker,
        { ...holding, heldThroughDrawdown: true, soldWhileDown: false },
      ]),
    ),
  };

  return {
    history,
    business,
    ownership,
    listing: listed,
    portfolio,
    // Every word, because several badges are about the collection itself.
    learned: GLOSSARY.map((word) => word.id),
    challengesPlayed: 6,
    clubWeeks: 6,
    clubProposalsPassed: 4,
    thesisCount: 6,
  };
}

describe('every badge has a state that earns it', () => {
  const all = everything();

  it('names which badges no state in the game can produce', () => {
    /*
     * Deliberately checked one badge at a time against a purpose-built state,
     * rather than expecting one state to earn all forty — several are mutually
     * exclusive (kept the whole thing against took the money). What this proves
     * is the weaker and still useful thing: for each badge, its `test` reads
     * fields that something in the game sets.
     */
    const unreachable: string[] = [];
    for (const badge of BADGES) {
      const earnedByAll = earnedBadges(all).includes(badge.id);
      const earnedBySold = earnedBadges({
        ...all,
        ownership: { ...all.ownership, equitySoldPct: 0.2, equityCashReceived: 120, buyoutAccepted: true, buyoutMultiple: 11, buyoutPrice: 4000, buyoutProceeds: 3200 },
        listing: createListing(),
      }).includes(badge.id);
      const earnedByFalling = earnedBadges({
        ...all,
        listing: {
          ...all.listing,
          weeks: [
            {
              week: 1,
              actual: 10,
              expected: 200,
              multipleBefore: 14,
              multipleAfter: 10,
              priceBefore: 3,
              priceAfter: 2,
              change: -0.33,
              reason: 'short',
            },
          ],
        },
      }).includes(badge.id);
      if (!earnedByAll && !earnedBySold && !earnedByFalling) unreachable.push(badge.id);
    }
    expect(unreachable).toEqual([]);
  });

  it('keeps the two mutually exclusive ownership badges exclusive', () => {
    // Both reachable, never together: that is the point of having both.
    const kept = earnedBadges(all);
    expect(kept).toContain('kept-the-whole-thing');
    expect(kept).not.toContain('took-the-money');
  });

  it('cuts the company into the number of pieces the listing says', () => {
    expect(all.listing.shares).toBe(SHARES);
    expect(all.listing.listed).toBe(true);
  });
});

/** The maximal state as a whole `Game`, for the layers that take one. */
function everythingGame(): Game {
  const ctx = everything();
  const base = createGame(11);
  return {
    ...base,
    act: 5,
    stand: { ...base.stand, history: ctx.history, cash: 500 },
    business: ctx.business,
    ownership: ctx.ownership,
    listing: ctx.listing,
    portfolio: ctx.portfolio,
    learned: ctx.learned,
    theses: [],
  };
}

describe('every mastery skill has a state that can show it', () => {
  /*
   * The same property, one layer up, and it matters more here: these are the
   * lines a parent reads. A skill nothing can produce is a permanent "not yet"
   * in the report, which reads as a claim about the child rather than about the
   * software — the exact failure PRODUCT.md §41 records about `notYet`.
   *
   * Reachability only. Whether a real kid produces one is what the synthetic
   * players in `tests/mastery.test.ts` are for.
   */
  it('leaves no skill from the new stages unreachable', () => {
    const game = everythingGame();
    const thesis = (ticker: string): Thesis => ({
      ticker,
      quantId: 'cheap-for-growth',
      qualId: 'everyone-uses-it',
      week: 1,
      priceAtBuy: 100,
      dollars: 400,
      quantHeld: true,
      contradiction: false,
    });
    const score = (ticker: string, madeMoney: boolean, sound: boolean): ThesisScore => ({
      thesis: thesis(ticker),
      gainPct: madeMoney ? 0.2 : -0.2,
      madeMoney,
      sound,
      verdict: sound ? (madeMoney ? 'good-call' : 'right-idea-wrong-time') : madeMoney ? 'lucky' : 'now-you-know',
      headline: 'x',
      lesson: 'y',
    });
    // Two right for the reason written down, and one that only went up — which
    // is the pair the "called it luck" skill is about.
    const scores: ThesisScore[] = [
      score('AAPL', true, true),
      score('KO', true, true),
      score('CMG', false, false),
      score('NKE', true, false),
    ];

    /*
     * Scoped to the skills the new stages added, and deliberately so.
     *
     * The six Act 1 and Act 2 detectors read *adjacent* days — you saw the
     * queue and put the price up, the forecast changed and the batch changed —
     * and the only honest fixture for those is a player who actually behaves
     * that way. `tests/mastery.test.ts` has three of them, including one who
     * understands nothing and is required to score zero, which is the assertion
     * that makes the others mean anything. Rebuilding that here would either
     * duplicate it or, worse, weaken it into a fixture shaped to pass.
     *
     * What is checked here is the thing that had no coverage at all: that the
     * five detectors written for the stands, the shop and the listing read
     * fields something in the game actually sets.
     */
    const added: SkillId[] = [
      'delegates-to-grow',
      'reads-the-street',
      'covers-the-fixed-cost',
      'chooses-how-to-fund-it',
      'sizes-what-to-sell',
    ];
    const skills = mastery(game, scores);
    for (const id of added) {
      const skill = skills.find((s) => s.id === id);
      expect(skill, id).toBeDefined();
      expect(skill!.level, id).not.toBe('unseen');
      // And citable, which is the whole point of the layer.
      expect(skill!.sightings[0].what.length, id).toBeGreaterThan(20);
    }
  });

  it('files every new skill under the stage it belongs to', () => {
    const skills = mastery(everythingGame(), []);
    const actOf = (id: SkillId) => skills.find((s) => s.id === id)?.act;
    expect(actOf('delegates-to-grow')).toBe(2);
    expect(actOf('reads-the-street')).toBe(2);
    expect(actOf('covers-the-fixed-cost')).toBe(3);
    expect(actOf('chooses-how-to-fund-it')).toBe(3);
    expect(actOf('sizes-what-to-sell')).toBe(4);
  });
});

describe('the finale tells the run that actually happened', () => {
  /*
   * It took a `buyoutMultiple` and told everybody they had sold the business.
   * A founder who went public was shown "Sold the business: someone paid 0
   * times what it earned in a week" — a sale that did not happen, at a
   * multiple of nothing — and was told they "started with $0.00" while the
   * account they were looking at held the float.
   */
  it('seeds the account from whichever door the kid came through', () => {
    const sold: Game = {
      ...createGame(3),
      ownership: { ...createOwnershipState(), buyoutAccepted: true, buyoutProceeds: 900 },
    };
    expect(seededWith(sold)).toBe(900);

    const listed: Game = { ...createGame(3), listing: everythingGame().listing };
    expect(listed.listing.listed).toBe(true);
    expect(seededWith(listed)).toBe(listed.listing.raised);
    expect(seededWith(listed)).toBeGreaterThan(0);
  });

  it('never reports a founder who listed as having started with nothing', () => {
    const listed: Game = { ...createGame(3), listing: everythingGame().listing };
    // The specific defect: `buyoutProceeds` is zero on this path, and the
    // finale divided by it.
    expect(listed.ownership.buyoutProceeds).toBe(0);
    expect(seededWith(listed)).not.toBe(0);
  });

  it('carries that same figure into the market', () => {
    const listed: Game = {
      ...createGame(3),
      listing: everythingGame().listing,
      stand: { ...createGame(3).stand, cash: 0 },
    };
    expect(beginAct5(listed).portfolio!.cash).toBeCloseTo(seededWith(listed), 2);
  });
});
