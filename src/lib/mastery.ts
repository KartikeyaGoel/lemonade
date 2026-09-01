/**
 * What the kid can actually do, evidenced by what they actually did.
 *
 * This is the module that decides whether the product is edtech or a toy, so it
 * is worth being blunt about the problem it fixes.
 *
 * The parent report used to say things like "Knows the difference between
 * buying a thing once and paying wages every day" — and the condition for
 * saying it was `game.learned.includes('capex-vs-opex')`, which is true the
 * moment the game has *shown the kid a card with those words on it*. That is a
 * claim about what the software displayed, dressed up as a claim about what a
 * child understands. It is exactly the failure mode this project set out to
 * avoid, and it had crept into the one screen whose entire job is to be
 * trustworthy.
 *
 * The honest alternative is not a quiz. A quiz measures whether a kid can
 * recognise a definition ten minutes after reading it, which is close to
 * worthless and is also the thing we promised never to build. The alternative
 * is **behaviour**: a skill counts when the kid did something that only makes
 * sense if they understand it, with their own money at stake and nobody asking
 * them to.
 *
 * Three rules, and they are what make the output worth reading.
 *
 * 1. **Every sighting is an action, never an exposure.** Nothing here fires
 *    because a word was shown, a screen was opened, or a day elapsed.
 * 2. **Every sighting is citable.** It carries the day it happened and the
 *    kid's own figures, so a parent can go and check it against the ledger. A
 *    claim nobody can audit is a claim nobody should believe.
 * 3. **Once is a coincidence.** A skill needs separate occasions before it
 *    counts as held, because a kid who raised their price once and got lucky
 *    has not learned anything and should not be told they have.
 *
 * The output has three levels — unseen, emerging, held — and the honest one is
 * used most. `notYet` in the parent report is not a failure list; it is the
 * part that makes the rest of the report credible.
 *
 * Pure module. No React, no I/O.
 */

import type { DayRecord } from './simulation';
import { judgeDealChoice } from './ownership';
import { positionFraction, type PortfolioState } from './market';
import type { Game } from './progress';
import type { ThesisScore } from './thesis';

export type SkillId =
  | 'reads-the-queue'
  | 'stops-the-waste'
  | 'bets-on-the-forecast'
  | 'holds-under-attack'
  | 'buys-capacity-when-it-binds'
  | 'judges-on-a-run'
  | 'prices-a-business'
  | 'reason-held-up'
  | 'spreads-the-risk'
  | 'sat-on-cash';

export type Level = 'unseen' | 'emerging' | 'held';

/** One occasion, citable against the ledger. */
export interface Sighting {
  /** Where to look: "Day 4", "Week 6". */
  when: string;
  /** What they did, with their own numbers in it. */
  what: string;
}

export interface Skill {
  id: SkillId;
  /**
   * What a grown-up calls it. Used in the parent view only.
   *
   * Named `grownUp…` on purpose: `scripts/check-reading-level.mjs` holds every
   * other string in this file to a ten-year-old's reading level, and this one
   * is written for whoever is reading over their shoulder.
   */
  grownUpName: string;
  /** What it means, in the kid's words. Used everywhere else. */
  plain: string;
  /** Which act it becomes possible in, so nothing looks missing too early. */
  act: 1 | 2 | 3 | 4;
  /** Separate occasions before this counts as held. */
  needed: number;
  sightings: Sighting[];
  level: Level;
}

interface Detector {
  id: SkillId;
  grownUpName: string;
  plain: string;
  act: 1 | 2 | 3 | 4;
  needed: number;
  find: (game: Game, theses: ThesisScore[]) => Sighting[];
}

/* ------------------------------------------------------------------ *
 * Reading a day
 *
 * Small helpers so every detector agrees about what a day *was*. A day is
 * "short" when people who wanted a cup did not get one, which is only knowable
 * because `cupsMade` is recorded — without it, selling twenty-four cups looks
 * the same whether twenty-four was the demand or the supply.
 * ------------------------------------------------------------------ */

function turnedAway(day: DayRecord): number {
  if (day.cupsMade === undefined) return 0;
  return Math.max(0, day.cupsWanted - day.cupsSold);
}

function soldOut(day: DayRecord): boolean {
  return day.cupsMade !== undefined && day.cupsSold >= day.cupsMade && turnedAway(day) > 0;
}

function leftOver(day: DayRecord): number {
  if (day.cupsMade === undefined) return 0;
  return Math.max(0, day.cupsMade - day.cupsSold);
}

function money(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
}

/** Consecutive pairs, so a detector can ask "and what did they do next". */
function pairs(history: DayRecord[]): Array<[DayRecord, DayRecord]> {
  return history.slice(0, -1).map((day, i) => [day, history[i + 1]] as [DayRecord, DayRecord]);
}

/** Warmth as a number, so "the forecast got hotter" is a subtraction. */
function heat(forecast: DayRecord['forecast']): number {
  if (forecast === 'probably-hot') return 1;
  if (forecast === 'probably-cold') return -1;
  return 0;
}

function plainSky(forecast: DayRecord['forecast']): string {
  if (forecast === 'probably-hot') return 'hot';
  if (forecast === 'probably-cold') return 'cold';
  return 'mild';
}

/* ------------------------------------------------------------------ *
 * The detectors
 * ------------------------------------------------------------------ */

const DETECTORS: Detector[] = [
  {
    id: 'reads-the-queue',
    grownUpName: 'Prices against demand',
    plain: 'When people were queuing, you asked for more.',
    act: 1,
    needed: 2,
    find: (game) =>
      pairs(game.stand.history)
        .filter(([today, tomorrow]) => soldOut(today) && tomorrow.price > today.price)
        .map(([today, tomorrow]) => ({
          when: `Day ${today.day}`,
          what: `Sold all ${today.cupsSold} cups with ${turnedAway(today)} people turned away, then put the price up to ${money(tomorrow.price)}.`,
        })),
  },
  {
    id: 'stops-the-waste',
    grownUpName: 'Cuts a batch that did not sell',
    plain: 'You stopped making lemonade nobody was buying.',
    act: 1,
    needed: 2,
    find: (game) =>
      pairs(game.stand.history)
        .filter(
          ([today, tomorrow]) =>
            leftOver(today) >= WASTE_WORTH_NOTICING &&
            tomorrow.cupsMade !== undefined &&
            tomorrow.cupsMade < (today.cupsMade ?? 0),
        )
        .map(([today, tomorrow]) => ({
          when: `Day ${today.day}`,
          what: `Poured away ${leftOver(today)} cups, then made ${tomorrow.cupsMade} instead of ${today.cupsMade} the next morning.`,
        })),
  },
  {
    id: 'bets-on-the-forecast',
    grownUpName: 'Commits money to a forecast',
    plain: 'When the sky changed, what you made changed with it.',
    act: 1,
    needed: 2,
    find: (game) =>
      /*
       * Adjacent days where the forecast moved, and the batch moved with it.
       *
       * The first version of this compared every hot day against the kid's
       * average cold day, and it was wrong in a way worth recording: batches
       * drift upwards as a kid gets richer, so a late cold day is routinely
       * bigger than an early hot one, and the comparison measured *when* a day
       * happened as much as what the kid decided. Comparing a day against the
       * day before it is immune to that, and it is also closer to what the
       * skill actually is — you saw the forecast change, and you changed.
       */
      pairs(game.stand.history)
        .filter(([today, tomorrow]) => {
          if (today.cupsMade === undefined || tomorrow.cupsMade === undefined) return false;
          const warmer = heat(tomorrow.forecast) - heat(today.forecast);
          if (warmer === 0) return false;
          const bigger = tomorrow.cupsMade - today.cupsMade;
          return Math.sign(warmer) === Math.sign(bigger) && Math.abs(bigger) >= BATCH_MOVE;
        })
        .map(([today, tomorrow]) => ({
          when: `Day ${tomorrow.day}`,
          what: `Forecast went from ${plainSky(today.forecast)} to ${plainSky(tomorrow.forecast)}, so the batch went from ${today.cupsMade} cups to ${tomorrow.cupsMade}.`,
        })),
  },
  {
    id: 'holds-under-attack',
    grownUpName: 'Answers a rival with something other than a discount',
    plain: 'Someone opened up across the road and you did not just go cheaper.',
    act: 2,
    needed: 2,
    find: (game) =>
      pairs(game.stand.history)
        .filter(
          ([today, tomorrow]) =>
            (today.marketShare ?? 1) < 1 &&
            tomorrow.price >= today.price &&
            tomorrow.profit > 0,
        )
        .map(([today, tomorrow]) => ({
          when: `Day ${today.day}`,
          what: `Lost ${Math.round((1 - (today.marketShare ?? 1)) * 100)}% of the street to the other stand, held at ${money(tomorrow.price)}, and still made ${money(tomorrow.profit)}.`,
        })),
  },
  {
    id: 'buys-capacity-when-it-binds',
    grownUpName: 'Spends on capacity only when capacity is the problem',
    plain: 'You bought a bigger stand because the queue was longer than the stand.',
    act: 2,
    needed: 1,
    find: (game) => {
      // Only claimable if they were genuinely turning people away in the days
      // before they spent. Owning a cooler proves nothing on its own.
      const owns = Object.values(game.business.upgrades).some(Boolean) || game.business.staff.helper;
      if (!owns) return [];
      const short = game.stand.history.filter((day) => soldOut(day));
      if (short.length < DAYS_SHORT_BEFORE_BUYING) return [];
      const worst = short.reduce((a, b) => (turnedAway(b) > turnedAway(a) ? b : a));
      return [
        {
          when: `Day ${worst.day}`,
          what: `Turned ${turnedAway(worst)} people away, on ${short.length} days of running short, and bought the room to serve them.`,
        },
      ];
    },
  },
  {
    id: 'judges-on-a-run',
    grownUpName: 'Judges the business on a run of days, not one day',
    plain: 'One bad day did not make you change everything.',
    act: 1,
    needed: 2,
    find: (game) =>
      pairs(game.stand.history)
        .filter(
          ([today, tomorrow]) =>
            today.profit < 0 &&
            Math.abs(tomorrow.price - today.price) <= PRICE_UNCHANGED &&
            tomorrow.profit > 0,
        )
        .map(([today, tomorrow]) => ({
          when: `Day ${today.day}`,
          what: `Lost ${money(Math.abs(today.profit))} and kept the price at ${money(today.price)} anyway. The next day made ${money(tomorrow.profit)}.`,
        })),
  },
  {
    id: 'prices-a-business',
    grownUpName: 'Compares a price against what a business earns',
    plain: 'You worked out which stand was worth more, not which was cheaper.',
    act: 3,
    needed: 1,
    find: (game) => {
      const choice = game.ownership.comparisonChoiceId;
      if (!choice) return [];
      const verdict = judgeDealChoice(choice);
      if (!verdict.correct) return [];
      return [
        {
          when: 'The stands for sale',
          what: `Passed over the cheapest and picked ${verdict.best.name} at ${verdict.best.askingMultiple}x weekly profit, because it was the one that was growing.`,
        },
      ];
    },
  },
  {
    id: 'reason-held-up',
    grownUpName: 'Buys for a reason, and the reason is what happened',
    plain: 'You said why before you bought, and you were right for that reason.',
    act: 4,
    needed: 2,
    find: (_game, theses) =>
      theses
        // `sound` is the honest field: the reason they wrote down is the reason
        // it went up. A verdict of 'lucky' is a win and is deliberately not one.
        .filter((score) => score.sound && score.madeMoney)
        .map((score) => ({
          when: score.thesis.ticker,
          what: `Bought on a reason that held: ${score.headline.toLowerCase()}`,
        })),
  },
  {
    id: 'spreads-the-risk',
    grownUpName: 'Spreads money across businesses',
    plain: 'You did not put everything into one company.',
    act: 4,
    needed: 1,
    find: (game) => {
      const portfolio = game.portfolio;
      if (!portfolio) return [];
      const held = Object.keys(portfolio.holdings);
      if (held.length < HOLDINGS_FOR_SPREAD) return [];
      const biggest = Math.max(...held.map((ticker) => positionFraction(portfolio, ticker)));
      if (biggest > BIGGEST_POSITION_ALLOWED) return [];
      return [
        {
          when: `Week ${portfolio.week}`,
          what: `Held ${held.length} companies with nothing bigger than ${Math.round(biggest * 100)}% of the money in any one of them.`,
        },
      ];
    },
  },
  {
    id: 'sat-on-cash',
    grownUpName: 'Does nothing when there is nothing worth doing',
    plain: 'You kept money back instead of spending it because you could.',
    act: 4,
    needed: 1,
    find: (game) => {
      const portfolio = game.portfolio;
      if (!portfolio || portfolio.week < WEEKS_BEFORE_PATIENCE_COUNTS) return [];
      const quiet = quietWeeks(portfolio);
      if (quiet < QUIET_WEEKS_NEEDED) return [];
      return [
        {
          when: `Week ${portfolio.week}`,
          what: `Went ${quiet} weeks without trading while holding ${money(portfolio.cash)} in cash.`,
        },
      ];
    },
  },
];

/**
 * How far a price may move and still count as "kept the same".
 *
 * A cent either way is a kid nudging the dial past the number they meant, not a
 * change of mind.
 */
const PRICE_UNCHANGED = 0.02;
/** Cups poured away before it is worth calling waste rather than rounding. */
const WASTE_WORTH_NOTICING = 4;
/** Cups the batch has to move by before it counts as a decision. */
const BATCH_MOVE = 4;
/** Days of turning people away before buying capacity is a judgement. */
const DAYS_SHORT_BEFORE_BUYING = 2;
const HOLDINGS_FOR_SPREAD = 3;
const BIGGEST_POSITION_ALLOWED = 0.5;
const WEEKS_BEFORE_PATIENCE_COUNTS = 4;
const QUIET_WEEKS_NEEDED = 3;

/** The longest run of consecutive weeks with no trade at all. */
function quietWeeks(portfolio: PortfolioState): number {
  const traded = new Set(portfolio.trades.map((trade) => trade.week));
  let best = 0;
  let run = 0;
  for (let week = 1; week <= portfolio.week; week += 1) {
    run = traded.has(week) ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

export function mastery(game: Game, theses: ThesisScore[] = []): Skill[] {
  return DETECTORS.map((detector) => {
    const sightings = detector.find(game, theses);
    return {
      id: detector.id,
      grownUpName: detector.grownUpName,
      plain: detector.plain,
      act: detector.act,
      needed: detector.needed,
      sightings,
      level:
        sightings.length === 0
          ? 'unseen'
          : sightings.length >= detector.needed
            ? 'held'
            : 'emerging',
    };
  });
}

/**
 * Skills that could plausibly have shown up by now.
 *
 * A kid on day three has not failed to demonstrate diversification. Filtering
 * by act is what stops the report reading as a list of things they cannot do.
 */
export function reachable(skills: Skill[], act: number): Skill[] {
  return skills.filter((skill) => skill.act <= act);
}

export interface MasteryTally {
  held: number;
  emerging: number;
  /** Out of the ones that were reachable, not out of everything. */
  outOf: number;
}

export function tally(skills: Skill[], act: number): MasteryTally {
  const list = reachable(skills, act);
  return {
    held: list.filter((skill) => skill.level === 'held').length,
    emerging: list.filter((skill) => skill.level === 'emerging').length,
    outOf: list.length,
  };
}

/**
 * The one line at the top.
 *
 * Never a percentage and never a grade. It names the most recent thing the kid
 * demonstrated, because a specific true sentence is worth more to a parent than
 * any score — and because a score invites comparison with other children, which
 * is the thing this product has spent its whole design avoiding.
 */
export function masteryLine(skills: Skill[], act: number): string {
  const list = reachable(skills, act);
  const held = list.filter((skill) => skill.level === 'held');
  if (held.length === 0) {
    const emerging = list.find((skill) => skill.level === 'emerging');
    return emerging
      ? `Starting to show it: ${emerging.grownUpName.toLowerCase()}. Do it once more and it counts.`
      : 'Nothing shown yet. This fills up from what they do, never from what they are told.';
  }
  const last = held[held.length - 1];
  return `${held.length} of ${list.length} shown more than once. Most recently: ${last.grownUpName.toLowerCase()}.`;
}
