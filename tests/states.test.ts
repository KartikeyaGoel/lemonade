/**
 * @vitest-environment jsdom
 */
/**
 * The states the pure modules only reach on a particular kind of run.
 *
 * Coverage on `src/lib` was 91% before this, and the missing 9% was not
 * scattered — it clustered. Every gap was a branch that only fires for a child
 * who did something specific: moved to the park, borrowed for the shop, held a
 * falling share, ran the Saturday stand, played a save written by a build from
 * before the acts existed.
 *
 * Which makes them exactly the branches worth having: each one is a *sentence
 * shown to a parent* or a *word handed to a child*, and both are claims about
 * what happened. A branch that never runs in a test is a sentence nobody has
 * ever read.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parentReport } from '../src/lib/parent';
import {
  beginWeekend,
  createGame,
  endWeekend,
  newSeason,
  seasonRecord,
  seededWith,
  type Game,
} from '../src/lib/progress';
import { beginSeason, createCareer, recordSeason, type Career } from '../src/lib/career';
import { createOwnershipState } from '../src/lib/ownership';
import { loanQuote, repayLoan } from '../src/lib/retail';
import { createListing, markListedWeek, type Listing } from '../src/lib/listing';
import { createBusinessState, deriveAct2Insights, moveTo } from '../src/lib/business';
import { createPortfolio, buy, advanceWeek } from '../src/lib/market';
import { SNAPSHOT } from '../src/lib/companies';
import { GLOSSARY } from '../src/lib/glossary';
import { BADGES } from '../src/lib/achievements';
import { loadGame, saveGame } from '../src/lib/storage';
import { createInitialState, runDay, type DayRecord } from '../src/lib/simulation';

function dayRecord(over: Partial<DayRecord> = {}): DayRecord {
  return {
    day: 1,
    weather: 'mild',
    forecast: 'probably-mild',
    price: 1.5,
    cupsMade: 40,
    cupsSold: 38,
    cupsWanted: 45,
    revenue: 57,
    profit: 30,
    fixedCost: 5,
    cashAfter: 300,
    spoiledLemons: 0,
    marketShare: 1,
    seedBefore: 1,
    subscriberCups: 0,
    ...over,
  };
}

const history = Array.from({ length: 24 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 24 + (i % 5) * 4 }),
);

/** A run that grew: four thin days at the start, four fat ones at the end. */
const compounding = [
  ...Array.from({ length: 4 }, (_, i) => dayRecord({ day: i + 1, profit: 6 })),
  ...Array.from({ length: 12 }, (_, i) => dayRecord({ day: i + 5, profit: 20 })),
  ...Array.from({ length: 4 }, (_, i) => dayRecord({ day: i + 17, profit: 40 })),
];

const fullCareer: Career = {
  ...createCareer('Ada'),
  badges: BADGES.map((b) => b.id),
  words: GLOSSARY.map((w) => w.id),
  companiesStudied: [SNAPSHOT[0].ticker, SNAPSHOT[1].ticker],
  seasons: 3,
  lifetimeDays: 60,
  lifetimeProfit: 900,
  bestWeekProfit: 180,
  bestBuyoutMultiple: 9,
  challengesPlayed: 2,
  challengesWon: 1,
  clubWeeks: 2,
  clubProposalsPassed: 1,
};

/** A loan paid down to nothing, one daily repayment at a time. */
function clearedLoan() {
  let loan = loanQuote();
  for (let day = 0; day < 40 && loan.outstanding > 0; day++) {
    loan = repayLoan(loan)!;
  }
  return loan;
}

function listedFor(actual: number): Listing {
  const base: Listing = {
    ...createListing(),
    listed: true,
    floated: 0.3,
    ipoPrice: 1.12,
    ipoMultiple: 9,
    price: 1.12,
    expected: 124.88,
    multiple: 9,
    founderShare: 0.7,
    raised: 336,
  };
  return markListedWeek(base, actual).listing;
}

/** Every sentence in a report, so a claim can be searched for. */
function sentences(report: ReturnType<typeof parentReport>): string {
  return [
    report.headline,
    report.ladderLine,
    report.conversationStarter,
    ...report.notYet,
    ...report.activity.flatMap((l) => [l.topic, l.evidence]),
    ...report.understanding.flatMap((l) => [l.topic, l.evidence]),
    ...report.ladder.flatMap((s) => [s.grownUpConcept, s.grownUpWhy]),
  ].join(' | ');
}

function noPoison(where: string, text: string) {
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null', '[object Object]']) {
    expect(text, `${where} says "${bad}"`).not.toContain(bad);
  }
}

describe('what a parent is told, run by run', () => {
  /*
   * Each of these is a different set of lines in the report, and the report is
   * the one screen whose entire job is to be trustworthy. A branch here that
   * has never run is a sentence about a child's afternoon that nobody has read.
   */
  const runs: [string, Game][] = [
    ['a fresh install', createGame(1)],
    [
      'a week at the stand',
      { ...createGame(2), stand: { ...createGame(2).stand, history: history.slice(0, 7) } },
    ],
    [
      'a child who moved to the park',
      {
        ...createGame(3),
        act: 2,
        stand: { ...createGame(3).stand, history },
        business: moveTo(createBusinessState(), 'park'),
      },
    ],
    [
      'a child who hired and opened a second pitch',
      {
        ...createGame(4),
        act: 2,
        stand: { ...createGame(4).stand, history },
        business: {
          ...createBusinessState(),
          staff: { helper: true, manager: true },
          handsOffDays: 6,
          stands: [{ id: 1, location: 'park', runBy: 'minder' }],
          twoStandDays: 4,
          upgrades: { cooler: true, bigSign: true, freshSqueeze: true },
          regulars: 12,
        },
      },
    ],
    [
      'a child who borrowed for the shop',
      {
        ...createGame(5),
        act: 3,
        stand: { ...createGame(5).stand, history },
        business: {
          ...createBusinessState(),
          shop: { open: true, staff: 2, goodDays: 5 },
          loan: loanQuote(),
        },
      },
    ],
    [
      'a child who cleared the loan',
      {
        ...createGame(6),
        act: 3,
        stand: { ...createGame(6).stand, history },
        business: {
          ...createBusinessState(),
          shop: { open: true, staff: 1, goodDays: 5 },
          // Paid off one day at a time, the way a child actually clears it.
          loan: clearedLoan(),
        },
      },
    ],
    [
      'a child who sold a slice to an investor',
      {
        ...createGame(7),
        act: 3,
        stand: { ...createGame(7).stand, history },
        ownership: {
          ...createOwnershipState(),
          equitySoldPct: 0.3,
          equityCashReceived: 186.5,
          investorPaidToDate: 74.2,
        },
      },
    ],
    [
      'a child who sold the whole business',
      {
        ...createGame(8),
        act: 5,
        stand: { ...createGame(8).stand, history },
        ownership: {
          ...createOwnershipState(),
          buyoutAccepted: true,
          buyoutMultiple: 8,
          buyoutPrice: 998,
          buyoutProceeds: 998,
          comparisonAnswered: true,
          comparisonChoiceId: 'sam',
          passedOnOverpriced: true,
        },
      },
    ],
    [
      'a child whose share price went up',
      { ...createGame(9), act: 5, stand: { ...createGame(9).stand, history }, listing: listedFor(200) },
    ],
    [
      'a child whose share price went down',
      { ...createGame(10), act: 5, stand: { ...createGame(10).stand, history }, listing: listedFor(40) },
    ],
    [
      'a child holding real companies',
      (() => {
        let p = createPortfolio(1000, 4242);
        p = buy(p, SNAPSHOT[0].ticker, 300).portfolio;
        p = buy(p, SNAPSHOT[1].ticker, 200).portfolio;
        for (let week = 0; week < 6; week++) p = advanceWeek(p).portfolio;
        return {
          ...createGame(11),
          act: 5,
          stand: { ...createGame(11).stand, history },
          portfolio: p,
          listing: listedFor(150),
        };
      })(),
    ],
    [
      'a child whose business compounded',
      { ...createGame(12), act: 2, stand: { ...createGame(12).stand, history: compounding } },
    ],
  ];

  for (const [label, game] of runs) {
    it(`reads sensibly for ${label}`, () => {
      for (const career of [null, createCareer(), fullCareer]) {
        const report = parentReport(game, career, []);
        const text = sentences(report);
        noPoison(`${label} (career ${career ? career.name || 'blank' : 'none'})`, text);
        expect(report.headline.length, label).toBeGreaterThan(5);
        expect(report.conversationStarter.length, label).toBeGreaterThan(10);
        expect(report.ladder.length, label).toBe(5);
        // Never a grade and never a percentage: §36's rule for this screen.
        expect(report.ladderLine, label).not.toMatch(/\b\d+%/);
      }
    });
  }

  it('gives a different dinner question depending on what happened', () => {
    const asked = new Set(runs.map(([, game]) => parentReport(game, fullCareer, []).conversationStarter));
    expect(asked.size, 'every run got the same question').toBeGreaterThan(3);
  });

  it('never claims a sale that did not happen', () => {
    for (const [label, game] of runs) {
      const text = sentences(parentReport(game, fullCareer, []));
      if (!game.ownership.buyoutAccepted) {
        expect(text, `${label} claimed a buyout`).not.toMatch(/Accepted \$/);
      }
      if (!game.listing.listed) {
        expect(text, `${label} claimed a float`).not.toMatch(/cut it into/i);
      }
    }
  });
});

describe('the words a run earns', () => {
  /*
   * `deriveInsights` is where vocabulary comes from, and §36 is explicit that a
   * word is earned by *doing* the thing. Every branch in it is therefore a
   * claim about a specific afternoon — "your cooler cost you once and shows up
   * nowhere today" — and several had never been generated.
   */
  it('hands over capex-and-opex once there is a machine and a wage', () => {
    const outcome = runDay(
      { ...createInitialState(1), cash: 400 },
      { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 },
      {
        fixedCosts: [
          { label: 'Pitch', amount: 5 },
          { label: 'Helper wages', amount: 12 },
        ],
      },
    );
    const business = {
      ...createBusinessState(),
      upgrades: { cooler: true, bigSign: false, freshSqueeze: false },
      staff: { helper: true, manager: false },
    };
    const found = deriveAct2Insights(outcome, business, history);
    const ids = found.map((i) => i.id);
    expect(ids).toContain('capex-vs-opex');
    for (const insight of found) {
      noPoison(`insight ${insight.id}`, `${insight.term} ${insight.evidence} ${insight.carriesForward}`);
    }
  });

  it('hands over compounding to a business that actually grew', () => {
    const outcome = runDay(
      { ...createInitialState(2), cash: 600 },
      { buyLemons: 30, buySugarPacks: 4, buyCupPacks: 4, price: 1.5 },
    );
    /*
     * `ownsCapex` is part of the condition and should be: "profit bought
     * capacity that made more profit" is not a true sentence about a business
     * that never bought anything.
     */
    const business = {
      ...createBusinessState(),
      upgrades: { cooler: true, bigSign: false, freshSqueeze: false },
    };
    const found = deriveAct2Insights(outcome, business, compounding);
    expect(found.map((i) => i.id)).toContain('compounding');
  });

  /*
   * Filtering the already-known is the caller's job, not this function's — it
   * reports what today earned and `page.tsx` drops the repeats. Worth pinning
   * because it is the seam where a word gets handed over twice, and §26's
   * one-word-a-day rule lives on the other side of it.
   */
  it('reports what today earned, and leaves the de-duplication to its caller', () => {
    const outcome = runDay(
      { ...createInitialState(3), cash: 400 },
      { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 },
      { fixedCosts: [{ label: 'Helper wages', amount: 12 }] },
    );
    const business = {
      ...createBusinessState(),
      upgrades: { cooler: true, bigSign: true, freshSqueeze: true },
      staff: { helper: true, manager: true },
    };
    const found = deriveAct2Insights(outcome, business, compounding);
    // Every insight is a real glossary word rather than an id nobody defined.
    const known = new Set(GLOSSARY.map((w) => w.id));
    for (const insight of found) {
      expect(known.has(insight.id), `${insight.id} is not in the glossary`).toBe(true);
    }
    // And no id twice in one day's worth.
    expect(new Set(found.map((i) => i.id)).size).toBe(found.length);
  });
});

describe('the Saturday stand, which outlives the business', () => {
  /*
   * A child who sold up still makes lemonade at weekends, and whatever it
   * makes goes into the market account. It is the only place money moves
   * *between* the two halves of the game, so both directions matter.
   */
  it('takes a float out of the account and puts the takings back', () => {
    let p = createPortfolio(500, 4242);
    p = { ...p, standWeek: -1 };
    const game: Game = { ...createGame(1), act: 5, portfolio: p };

    const opened = beginWeekend(game);
    expect(opened.weekend).toBe(true);
    expect(opened.portfolio!.cash).toBeLessThan(500);
    expect(opened.stand.cash).toBeGreaterThan(0);
    expect(opened.portfolio!.standFloat).toBe(opened.stand.cash);

    // Play the Saturday, then bank it.
    let state = opened.stand;
    for (let i = 0; i < 3; i++) {
      const outcome = runDay(state, {
        buyLemons: 6,
        buySugarPacks: 1,
        buyCupPacks: 1,
        price: 1.5,
      });
      state = outcome.nextState;
      if (state.status === 'finished') break;
    }
    const closed = endWeekend({ ...opened, stand: state });
    expect(closed.weekend).toBe(false);
    expect(closed.portfolio!.standFloat).toBe(0);
    // Nothing vanished: the float came home along with whatever it earned.
    expect(closed.portfolio!.cash).toBeGreaterThan(0);
    expect(Number.isFinite(closed.portfolio!.cash)).toBe(true);
  });

  it('does nothing when there is no account to take a float from', () => {
    const game: Game = { ...createGame(1), portfolio: null };
    expect(beginWeekend(game)).toEqual(game);
  });
});

describe('a new season, and what it keeps', () => {
  it('carries the career and throws away the run', () => {
    const played: Game = {
      ...createGame(1),
      act: 5,
      stand: { ...createGame(1).stand, history, cash: 800 },
      learned: GLOSSARY.slice(0, 6).map((w) => w.id),
      listing: listedFor(150),
    };
    const record = seasonRecord(played);
    expect(Number.isFinite(record.totalProfit)).toBe(true);
    expect(Number.isFinite(record.weekProfit)).toBe(true);
    // A child who listed instead of selling still gets a multiple recorded,
    // rather than a zero that says the run was worth nothing.
    expect(record.buyoutMultiple).toBeGreaterThan(0);

    const carried = beginSeason(recordSeason(fullCareer, record));
    expect(carried.badges).toEqual(fullCareer.badges);
    expect(carried.seasons).toBeGreaterThan(fullCareer.seasons);
    expect(carried.lifetimeDays).toBeGreaterThanOrEqual(fullCareer.lifetimeDays);

    const fresh = newSeason(played);
    expect(fresh.act).toBe(1);
    expect(fresh.stand.history).toEqual([]);
    expect(fresh.listing.listed).toBe(false);
    expect(fresh.season).toBeGreaterThan(played.season);
  });

  it('reports what the market was seeded with, from either ending', () => {
    const sold: Game = {
      ...createGame(1),
      ownership: { ...createOwnershipState(), buyoutAccepted: true, buyoutProceeds: 749.28 },
    };
    const listed: Game = { ...createGame(1), listing: listedFor(150) };
    expect(seededWith(sold)).toBe(749.28);
    expect(seededWith(listed)).toBe(listed.listing.raised);
    // And a run that did neither is zero rather than undefined.
    expect(seededWith(createGame(1))).toBe(0);
  });
});

describe('a save from a build that predates the acts', () => {
  beforeEach(() => window.localStorage.clear());

  /*
   * The legacy slot. A child who played the very first build has a save under
   * a different key with no acts, no business and no career in it. §"a save
   * from an earlier build must never be thrown away, because that punishes
   * exactly the kids who played earliest" — so this is that promise, tested.
   */
  it('is read, upgraded and playable', () => {
    const state = createInitialState(99);
    window.localStorage.setItem(
      'lemonade.act1.v1',
      JSON.stringify({ state: { ...state, history: history.slice(0, 3) }, learned: ['margin'] }),
    );
    const game = loadGame();
    expect(game, 'the earliest save was thrown away').toBeTruthy();
    expect(game!.stand.history.length).toBe(3);
    expect(game!.learned).toContain('margin');
    expect(game!.act).toBe(1);
    // And it is a whole game: every field the app dereferences is there.
    expect(typeof game!.business).toBe('object');
    expect(typeof game!.listing).toBe('object');
    expect(Array.isArray(game!.theses)).toBe(true);
  });

  it('refuses a legacy save that is not one', () => {
    for (const junk of ['{}', '{"state":{}}', '{"state":{"day":"one"}}', 'nonsense']) {
      window.localStorage.clear();
      window.localStorage.setItem('lemonade.act1.v1', junk);
      expect(() => loadGame()).not.toThrow();
    }
  });

  it('prefers the current save when both exist', () => {
    const current = { ...createGame(7), stand: { ...createGame(7).stand, history } };
    saveGame(current);
    window.localStorage.setItem(
      'lemonade.act1.v1',
      JSON.stringify({ state: createInitialState(1), learned: [] }),
    );
    expect(loadGame()!.stand.history.length).toBe(history.length);
  });
});
