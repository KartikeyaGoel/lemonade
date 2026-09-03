/**
 * The whole game: which act the kid is in, what they have demonstrated, and
 * whether they have earned the right to commit money in the market.
 *
 * The readiness gate is the spine of the product's honesty. We do not let a
 * kid put simulated money into real companies because they clicked through
 * four acts. We let them because they have made specific decisions that show
 * they understand what a price is.
 *
 * Pure module. No React, no I/O.
 */

import {
  ECON,
  createInitialState,
  type DayRecord,
  type GameState,
  type Insight,
} from './simulation';
import {
  ACT2_DAYS,
  act2Progress,
  createBusinessState,
  trailingWeeklyProfit,
  type BusinessState,
} from './business';
import { createOwnershipState, judgeDealChoice, type OwnershipState } from './ownership';
import { createListing, listingComplete, type Listing } from './listing';
import { shopProgress, type ShopProgress } from './retail';
import { createPortfolio, summarisePortfolio, type PortfolioState } from './market';
import { BADGES, earnedBadges, type BadgeContext } from './achievements';
import { GLOSSARY, wordProgress } from './glossary';
import type { Career } from './career';
import type { Thesis } from './thesis';
import type { ClubState } from './club';
import { createPlaybook, type Playbook } from './playbook';
import type { ChallengeSpec, RunResult } from './challenge';

/**
 * The five stages of the arc.
 *
 * Four for a very long time, and the fifth was not an addition so much as an
 * admission: the arc claimed to run from a small business to a public company
 * and stopped one step short, at a private sale. A kid sold their stand to one
 * buyer and then met their first share price on Apple, having never had one.
 *
 * So the stands split into "one" and "more than one", the shop went in between
 * — because a chain of pitches that all shut when it rains is the wall a door
 * answers — and the ownership stage now ends at a listing.
 */
export type Act = 1 | 2 | 3 | 4 | 5;

/**
 * Bumped from 3 for the five-stage arc.
 *
 * A save in the old Act 3 was in the ownership stage, which is now Act 4, and a
 * save in the old Act 4 was in the market, which is now Act 5. See
 * `migrateGame`: the shop stage is skipped for anybody already past it rather
 * than inserted behind them, because sending a child back to do a stage they
 * have already earned their way out of is the one thing a migration must never
 * do.
 */
export const SAVE_VERSION = 4;

/**
 * A same-sky challenge in progress: the seed both kids are playing, and the
 * friend's result once it has been pasted in.
 */
export interface ChallengeRun {
  spec: ChallengeSpec;
  friendResult: RunResult | null;
  /** Set once the comparison has been counted towards the career record. */
  settled: boolean;
}

export interface Game {
  version: number;
  act: Act;
  /**
   * The seed this run was created from.
   *
   * `stand.seed` is a live cursor and moves every day, so it cannot be used to
   * reproduce the run. A challenge is nothing but a shared seed, so the
   * original has to be kept.
   */
  seed: number;
  stand: GameState;
  business: BusinessState;
  ownership: OwnershipState;
  /** Shares, a share price, and every week since the company went public. */
  listing: Listing;
  portfolio: PortfolioState | null;
  /** Insight ids already given, so a word is never taught twice. */
  learned: string[];
  /**
   * Words earned but not yet handed over.
   *
   * Day one genuinely earns three of them — revenue, profit, capacity — and
   * playing it made the cost obvious: three panels of italic explanation under
   * the first profit and loss a kid has ever read. That is a vocabulary list,
   * and a vocabulary list is the thing this game exists not to be.
   *
   * So they queue. One a day, in the order they were earned, each still sitting
   * next to the numbers that produced it. Nothing is lost and nothing is
   * skipped; a kid on day three is simply still being told one new thing rather
   * than three.
   */
  pendingInsights: Insight[];
  /**
   * The day count the current stage started from.
   *
   * Stages used to be timed by subtracting `ECON.TOTAL_DAYS`, which worked
   * while there was exactly one stage before the open-ended ones. It stops
   * working the moment two stages in a row end on a *condition* rather than a
   * clock: two kids can reach the shop on day fourteen and on day twenty-two,
   * and a shop clock that assumes the fortnight tells the second one they are
   * on day minus two. So each stage records where it began.
   */
  stageStartDay: number;
  /** Total days of business traded across every act. */
  daysTraded: number;
  /** Which run through the whole arc this is. Kept for the career record. */
  season: number;
  /** Every reason written down before money moved in the market. */
  theses: Thesis[];
  /** A challenge against a friend, if this run is one. */
  challenge: ChallengeRun | null;
  /** A shared portfolio being passed between phones. */
  club: ClubState | null;
  /**
   * True while the kid is running the Saturday stand out of the market.
   *
   * See `beginWeekend` for why the stand is still standing after it was sold.
   */
  weekend: boolean;
  /**
   * The kid's rules, kept across the whole run.
   *
   * Lives on the game rather than the career because a playbook is a thing you
   * are working on, and a new season is a good moment to start it again — but
   * see `restart`, which carries it, because throwing away somebody's strategy
   * because they pressed replay would be unkind.
   */
  playbook: Playbook;
}

export function createGame(seed = Math.floor(Math.random() * 1_000_000)): Game {
  return {
    version: SAVE_VERSION,
    act: 1,
    seed,
    stand: createInitialState(seed),
    business: createBusinessState(),
    ownership: createOwnershipState(),
    listing: createListing(),
    portfolio: null,
    stageStartDay: 0,
    learned: [],
    pendingInsights: [],
    daysTraded: 0,
    season: 1,
    theses: [],
    challenge: null,
    club: null,
    weekend: false,
    playbook: createPlaybook(),
  };
}

/** A challenge run is an ordinary Act 1 week on somebody else's weather. */
export function createChallengeGame(spec: ChallengeSpec, friendResult: RunResult | null): Game {
  return {
    ...createGame(spec.seed),
    challenge: { spec, friendResult, settled: false },
  };
}

/* ------------------------------------------------------------------ *
 * Act boundaries
 * ------------------------------------------------------------------ */

/**
 * What an act is, said twice.
 *
 * A parent asked for stages named after the concepts they teach instead of
 * days. She is right that the learning was invisible and wrong about the fix:
 * "Act 2: Fixed and Variable Costs" is a chapter heading, and a kid who reads
 * a chapter heading knows they have been handed homework. Every gamified
 * curriculum that died, died on that line.
 *
 * So each act carries both names. The kid gets a `question` — the thing they
 * are actually about to find out, in their words, phrased as something worth
 * knowing. The grown-up gets `grownUpConcept`, which is the same act with the
 * economics named, and never appears on a screen a child looks at.
 *
 * They are the same stage. Only the register changes with the reader.
 */
export const ACT_TITLES: Record<
  Act,
  {
    name: string;
    promise: string;
    /** Kid-facing. The question this act answers. */
    question: string;
    /** Grown-up register only. What it teaches, named. */
    grownUpConcept: string;
    /** Grown-up register only. Why it is the right thing to teach here. */
    grownUpWhy: string;
  }
> = {
  1: {
    name: 'One stand',
    promise: 'Find the price that actually makes money.',
    question: 'What is a cup worth to them?',
    grownUpConcept: 'Price, cost and margin',
    grownUpWhy:
      'Unit economics before anything else. A child who can say what they keep from a dollar can read every business that follows.',
  },
  2: {
    name: 'More stands',
    promise: 'Spend money to make money. Then be in two places at once.',
    question: 'How do I sell more than my own two hands can?',
    grownUpConcept: 'Capacity, capital, hiring and competition',
    grownUpWhy:
      'The difference between buying a thing once and paying a wage every day, and then the reason firms hire at all: a second site needs somebody at the first one. Growth as arithmetic rather than magic.',
  },
  3: {
    name: 'The shop',
    promise: 'Get a door, so the rain stops deciding how your day goes.',
    question: 'What do I owe on a day nobody comes?',
    grownUpConcept: 'Fixed costs, operating leverage, debt against equity',
    grownUpWhy:
      'A big rent owed whatever happened is what makes a quiet week dangerous and a busy one enormous. It is also the first thing they cannot buy out of profit, which is where borrowing and selling a slice become two real answers.',
  },
  4: {
    name: 'Go public',
    promise: 'Cut the whole thing into a thousand pieces and sell some.',
    question: 'What is one piece of my company worth?',
    grownUpConcept: 'Valuation, ownership, shares and share price',
    grownUpWhy:
      'That a business has a value separate from its cash, that the value is a multiple of what it earns, and that dividing it by a share count is where a share price comes from. They watch their own price move before they see anybody else\'s.',
  },
  5: {
    name: 'Markets',
    promise: 'Other people\'s lemonade stands, at a much bigger scale.',
    question: 'Whose business do I want a piece of?',
    grownUpConcept: 'Public markets, and reading a filing',
    grownUpWhy:
      'Applying all of the above to real companies and real accounts — plus the two habits that decide outcomes: spreading money out, and sitting still when a price falls.',
  },
};

/**
 * Act 1 ends after the seventh day — unless this run is a short challenge.
 *
 * A duel is one day. It is the same act, the same stand and the same
 * arithmetic; it just stops sooner, because a thing you send a friend at
 * lunchtime has to be finishable at lunchtime.
 */
export function act1Complete(stand: GameState, lastDay: number = ECON.TOTAL_DAYS): boolean {
  return stand.history.length >= lastDay;
}

/**
 * Act 2 ends when the kid is running two stands at a profit, or time is up.
 *
 * It used to end at "a manager has run it profitably", which proved the manager
 * worked and stopped there. The manager is the *unlock*, not the finish: what a
 * manager buys is the kid's own hands back, and the thing to do with a spare
 * pair of hands is stand behind a second table. So the act now ends where the
 * lesson does, with two pitches and one price.
 */
export function act2Complete(business: BusinessState, act2DaysPlayed: number): boolean {
  return act2Progress(business, act2DaysPlayed).complete || act2DaysPlayed >= ACT2_DAYS;
}

/** Stage 3 ends when the shop has paid for its own door for a working week. */
export function act3Complete(business: BusinessState, act3DaysPlayed = 0): boolean {
  return shopProgress(business.shop).complete || act3DaysPlayed >= ACT3_DAYS;
}

/**
 * Act 4 ends at the listing, or at the sale.
 *
 * Both are real endings and the kid picks. Selling the lot to one buyer is a
 * respectable outcome and it is what the game used to do; the listing is the
 * one the arc now points at, because a founder who still owns most of a public
 * company has a share price to watch and a reason to care what a share price
 * *is*.
 */
export function act4Complete(ownership: OwnershipState, listing: Listing): boolean {
  return ownership.buyoutAccepted || listingComplete(listing);
}

/**
 * Days the shop stage runs before it hands over regardless.
 *
 * Six, and this one is free. Measured in `tests/wordbudget.test.ts` over ten
 * seeds and two levels of play: the objective — fit the shop out, then five
 * good days — completes on **day five in every single run**, careless play
 * included, because the shop's capacity makes a good day easy once the door is
 * open. Words delivered are byte-identical at caps twelve, eight, six and
 * five.
 *
 * So the twelve it started at, and the eight it passed through, were six spare
 * days and two spare days that no child ever spent well. Six is the worst
 * observed run plus one day of margin.
 *
 * Contrast `ACT2_DAYS`, where the same measurement says the opposite and the
 * cap is deliberately *not* cut to the floor.
 */
export const ACT3_DAYS = 6;

/** The one line the goal strip shows in the shop stage. */
export function act3Progress(business: BusinessState): ShopProgress {
  return shopProgress(business.shop);
}

/* ------------------------------------------------------------------ *
 * The readiness gate
 * ------------------------------------------------------------------ */

export interface Criterion {
  id: 'margin' | 'held-through-loss' | 'ranked-by-multiple' | 'passed-on-price';
  label: string;
  /** What the kid did, or what they still need to do. */
  detail: string;
  met: boolean;
}

export interface Readiness {
  criteria: Criterion[];
  metCount: number;
  /** Research is always open. This gates committing money. */
  canTrade: boolean;
}

/**
 * Did the kid hold their nerve after their worst day?
 *
 * A kid who swings the price wildly after one bad day has not yet learned that
 * a single day is noise, which is the habit that most reliably ruins people in
 * markets. We look at their actual worst day and what they did next.
 */
export function heldThroughWorstDay(history: DayRecord[]): { met: boolean; detail: string } {
  if (history.length < 3) {
    return { met: false, detail: 'Trade a few more days first.' };
  }
  // Only consider days that were actually followed by another day. Judging
  // the single worst day outright meant a kid whose worst day happened to be
  // their last was locked out for a reason that had nothing to do with them.
  const judgeable = history.filter((day) =>
    history.some((other) => other.day === day.day + 1),
  );
  if (judgeable.length === 0) {
    return { met: false, detail: 'Trade another day and this will be checked.' };
  }
  const worst = judgeable.reduce((a, day) => (day.profit < a.profit ? day : a), judgeable[0]);
  const next = history.find((day) => day.day === worst.day + 1)!;
  const swing = Math.abs(next.price - worst.price);
  if (swing <= 0.3) {
    return {
      met: true,
      detail: `After your worst day (${money(worst.profit)}) you kept your price near ${money(worst.price)} instead of panicking.`,
    };
  }
  return {
    met: false,
    detail: `After your worst day you swung the price by ${money(swing)}. One day is mostly weather.`,
  };
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function readiness(game: Game): Readiness {
  const held = heldThroughWorstDay(game.stand.history);

  const knowsMargin = game.learned.includes('margin');
  const choice = game.ownership.comparisonChoiceId;
  const verdict = choice ? judgeDealChoice(choice) : null;

  const criteria: Criterion[] = [
    {
      id: 'margin',
      label: 'Knows what they keep per cup',
      detail: knowsMargin
        ? 'Worked out margin from their own price and costs.'
        : 'Not yet — keep running the stand.',
      met: knowsMargin,
    },
    {
      id: 'held-through-loss',
      label: 'Did not panic after a bad day',
      detail: held.detail,
      met: held.met,
    },
    {
      id: 'ranked-by-multiple',
      label: 'Picked the better deal of two businesses',
      detail: verdict
        ? verdict.correct
          ? `Chose ${verdict.best.name} over the cheaper option, and was right.`
          : `Chose ${verdict.chosen.name}. Worth another look at the numbers.`
        : 'Not yet — the stands for sale come when you sell up.',
      met: Boolean(verdict?.correct),
    },
    {
      id: 'passed-on-price',
      label: 'Turned down a good business at a bad price',
      detail: game.ownership.passedOnOverpriced
        ? 'Passed on the famous kiosk because 25 times profit was too much to pay.'
        : 'Not yet. This is the hard one.',
      met: game.ownership.passedOnOverpriced,
    },
  ];

  const metCount = criteria.filter((c) => c.met).length;
  return { criteria, metCount, canTrade: metCount === criteria.length };
}

/* ------------------------------------------------------------------ *
 * Moving between acts
 * ------------------------------------------------------------------ */

/**
 * Act 2 keeps the same stand and the same money — it is the same business,
 * just with the ceiling lifted. Only the day counter restarts so the act has
 * its own arc.
 */
export function beginAct2(game: Game): Game {
  return {
    ...game,
    act: 2,
    stageStartDay: game.stand.history.length,
    stand: { ...game.stand, status: 'playing' },
  };
}

/** Stage 3 keeps the stands. The shop goes up beside them. */
export function beginAct3(game: Game): Game {
  return {
    ...game,
    act: 3,
    stageStartDay: game.stand.history.length,
    stand: { ...game.stand, status: 'playing' },
  };
}

export function beginAct4(game: Game): Game {
  return {
    ...game,
    act: 4,
    stageStartDay: game.stand.history.length,
    stand: { ...game.stand, status: 'playing' },
  };
}

/**
 * The market is seeded with exactly what the kid walked out with.
 *
 * Two doors lead here now and they hand over different money. A sale hands over
 * the proceeds and the business is gone. A listing hands over what the float
 * raised — and the kid still owns most of a company, so the stake stays on the
 * books and in the report rather than being quietly converted into pocket money
 * the market can spend.
 */
export function beginAct5(game: Game): Game {
  const proceeds = seededWith(game) + game.business.savings + game.stand.cash;
  return {
    ...game,
    act: 5,
    portfolio: createPortfolio(round2(proceeds), game.stand.seed),
  };
}

/**
 * What the investing account was actually seeded with.
 *
 * Two doors lead into the market and they hand over different money: a sale
 * hands over the proceeds, a listing hands over what the float raised. Six
 * places worked this out for themselves from `buyoutProceeds`, which is zero
 * for a founder who went public — so the finale told them they "started with
 * $0.00" and printed a flat return on an account that had grown, the parent
 * report computed its gain against nothing, and the career record banked the
 * wrong number.
 *
 * One place now. `beginAct5` seeds the account from this, so anything asking
 * "what did they start with" is asking the same function that decided it.
 */
export function seededWith(game: Game): number {
  return game.listing.listed ? game.listing.raised : game.ownership.buyoutProceeds;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * The Saturday stand
 * ------------------------------------------------------------------ */

/**
 * What comes out of the investing account to buy lemons, and goes back in on
 * Sunday along with whatever the day made.
 */
export const WEEKEND_FLOAT = 20;

/**
 * Why the stand is still standing after it was sold.
 *
 * The four acts were a sequence, and a sequence has an end. That is the right
 * shape for a story and the wrong shape for a habit: a kid who finishes reads
 * it as finished, closes it, and does not come back — which for a product whose
 * whole purpose is a practice is the only failure that really counts.
 *
 * Clash of Clans has a strict sequence too — every building is gated behind a
 * Town Hall level — but it never *presents* as one. It presents as a village
 * with a row of tabs, and the sequence is invisible scaffolding underneath. The
 * loops sit beside each other and money flows between them: the mines fill up
 * while you raid, and the raiding pays for the mines.
 *
 * This is that, and it is also the truest thing in the game. The kid sold their
 * stand and put the money in the market — and they still make lemonade on
 * Saturdays, because they can, and the profit goes into the account. So there
 * are two loops, adjacent rather than sequential: a two-minute one that makes
 * money out of unit economics, and a twelve-week one that turns money into
 * ownership. Each week the kid sees exactly what a Saturday buys them, which is
 * the single clearest statement this product can make about why any of it
 * matters.
 *
 * Twenty dollars comes out of the account as working capital, because a
 * business needs money before it makes money, and Act 1 taught that on day one.
 */
export function beginWeekend(game: Game): Game {
  if (!game.portfolio) return game;
  const float = Math.min(WEEKEND_FLOAT, game.portfolio.cash);
  return {
    ...game,
    weekend: true,
    portfolio: { ...game.portfolio, cash: round2(game.portfolio.cash - float), standFloat: float },
    stand: { ...game.stand, cash: float, status: 'playing' },
  };
}

/** Sunday. Everything in the cash box goes back into the account. */
export function endWeekend(game: Game): Game {
  if (!game.portfolio) return { ...game, weekend: false };
  const swept = round2(game.stand.cash);
  return {
    ...game,
    weekend: false,
    portfolio: {
      ...game.portfolio,
      cash: round2(game.portfolio.cash + swept),
      standWeek: game.portfolio.week,
      // What the day actually made, which is what came back minus what went
      // out. A loss is a real answer and is allowed to be negative.
      standEarnings: round2(game.portfolio.standEarnings + swept - game.portfolio.standFloat),
      standFloat: 0,
    },
    stand: { ...game.stand, cash: 0 },
  };
}

/**
 * Days played in the current stage.
 *
 * Act 1 still derives from the total, because Act 1 *is* the total and its
 * length is arithmetic on the starting cash. Everything after it counts from
 * where the stage opened — see `Game.stageStartDay` for why that cannot be a
 * subtraction from `ECON.TOTAL_DAYS` any more.
 */
export function actDay(game: Game): number {
  if (game.act === 1) return game.stand.history.length + 1;
  return Math.max(1, game.stand.history.length - game.stageStartDay + 1);
}

/* ------------------------------------------------------------------ *
 * Where the kid is, in one object the UI can render
 * ------------------------------------------------------------------ */

export interface GameStanding {
  act: Act;
  actDay: number;
  cash: number;
  savings: number;
  netWorth: number;
  weeklyProfit: number;
  daysTraded: number;
}

export function standing(game: Game): GameStanding {
  const portfolioValue = game.portfolio
    ? summarisePortfolio(game.portfolio, 0).currentValue
    : 0;
  return {
    act: game.act,
    actDay: actDay(game),
    cash: game.stand.cash,
    savings: game.business.savings,
    netWorth: round2(
      (game.act === 5 ? portfolioValue : game.stand.cash) + game.business.savings,
    ),
    weeklyProfit: trailingWeeklyProfit(game.stand.history),
    daysTraded: game.stand.history.length,
  };
}

/* ------------------------------------------------------------------ *
 * The meta-game: what they hold, and what to do next
 * ------------------------------------------------------------------ */

/**
 * Everything the trophy case needs, gathered from real state.
 *
 * The career counters come in from the permanent record because they span
 * seasons — a challenge played last week still counts.
 */
export function badgeContext(game: Game, career: Career): BadgeContext {
  return {
    history: game.stand.history,
    business: game.business,
    ownership: game.ownership,
    portfolio: game.portfolio,
    learned: [...new Set([...game.learned, ...career.words])],
    challengesPlayed: career.challengesPlayed,
    clubWeeks: career.clubWeeks,
    clubProposalsPassed: career.clubProposalsPassed,
    thesisCount: game.theses.length,
    listing: game.listing,
  };
}

/** Badges the current state supports, merged with everything ever earned. */
export function badgesHeld(game: Game, career: Career): string[] {
  return [...new Set([...career.badges, ...earnedBadges(badgeContext(game, career))])];
}

export interface NextThing {
  emoji: string;
  title: string;
  how: string;
}

/**
 * The three things to try next.
 *
 * This exists for one reason: a kid who finishes a session with nothing
 * outstanding does not come back. Every suggestion is a locked badge that is
 * actually reachable from where they are standing — never a badge from an act
 * they have not opened, because a goal you cannot attempt is just a tease.
 */
export function whatsNext(game: Game, career: Career): NextThing[] {
  const held = new Set(badgesHeld(game, career));
  const open = BADGES.filter((badge) => !held.has(badge.id));

  const soloReachable = open
    .filter((badge) => badge.act !== 'social' && badge.act <= game.act)
    // Nearest act first, so the next thing is always the closest thing. Getting
    // this the wrong way round put "join a club" in front of a kid who had not
    // yet opened the stand for a single day.
    .sort((a, b) => Number(a.act) - Number(b.act));

  const social = open.filter((badge) => badge.act === 'social');

  const asThing = (badge: (typeof BADGES)[number]): NextThing => ({
    emoji: badge.emoji,
    title: badge.name,
    how: badge.how,
  });

  // Two from where they are standing, and one thing to do with somebody else —
  // the social slot is held open on purpose, because "play it with a friend" is
  // the suggestion most likely to bring them back.
  const next: NextThing[] = [
    ...soloReachable.slice(0, 2).map(asThing),
    ...social.slice(0, 1).map(asThing),
  ];

  if (next.length < 3) {
    next.push(...soloReachable.slice(2, 2 + (3 - next.length)).map(asThing));
  }

  if (next.length < 3) {
    const words = wordProgress([...game.learned, ...career.words]);
    if (words.earned < words.total) {
      next.push({
        emoji: '\u{1F4DA}',
        title: 'Collect the rest of the words',
        how: `${words.total - words.earned} of ${GLOSSARY.length} still to earn.`,
      });
    }
  }

  return next.slice(0, 3);
}

/* ------------------------------------------------------------------ *
 * Seasons
 * ------------------------------------------------------------------ */

/** What this run contributed to the permanent record. */
export function seasonRecord(game: Game) {
  const totalProfit = game.stand.history.reduce((sum, day) => sum + day.profit, 0);
  const gain = game.portfolio
    ? summarisePortfolio(game.portfolio, seededWith(game)).gainPercent
    : 0;
  return {
    weekProfit: trailingWeeklyProfit(game.stand.history),
    // A listing is priced on the same sum as a sale, so the career record keeps
    // whichever of the two this run actually reached rather than reporting zero
    // for a kid who went public instead of selling up.
    buyoutMultiple: game.listing.listed
      ? game.listing.multiple
      : game.ownership.buyoutMultiple,
    portfolioGainPct: gain,
    daysTraded: game.stand.history.length,
    totalProfit: Math.round(totalProfit * 100) / 100,
  };
}

/**
 * A new season is a genuinely new stand — new seed, new weather, no money.
 *
 * Nothing is carried across except the club, which belongs to a group of people
 * rather than to this run, and the season counter. Badges and words live in the
 * career record, which this does not touch.
 */
export function newSeason(game: Game, seed = Math.floor(Math.random() * 1_000_000)): Game {
  return {
    ...createGame(seed),
    season: game.season + 1,
    club: game.club,
    // Carried, like the club: a season is a fresh run at the arc, not a reason
    // to delete the rules the kid worked out last time.
    playbook: game.playbook,
  };
}
