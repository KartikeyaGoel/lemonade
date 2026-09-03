/**
 * The live market.
 *
 * The market replays twelve weeks of the past, chosen at random from five years of
 * real closes, and finishes in a sitting. That is the right shape for a story
 * and the wrong shape for the thing the product is actually for. A market a kid
 * has already finished gives them no reason to open the app on Tuesday, and the
 * original promise — *learn it on lemonade, then do it on the real thing* —
 * quietly became *learn it on lemonade, then do it on a recording*.
 *
 * So: the same market, anchored to now.
 *
 *  - `windowStart` sits at the newest week in the dataset rather than a random
 *    one, so `week` counts the weeks since the kid opened the account.
 *  - The account never closes. There is no finale and no reckoning.
 *  - The clock is the real calendar. A kid does not advance a week by pressing
 *    a button; a week arrives because a week has passed, and their holdings are
 *    marked to closes that did not exist last time they looked.
 *
 * **Weekly, on purpose.** The obvious complaint is that a week is a slow
 * heartbeat for a habit loop. Two answers. The daily reason to come back is the
 * stand — `skyOfTheDay` gives every child on Earth the same three-minute
 * weather — and it lives one screen away. And a market you are invited to check
 * hourly teaches the single most expensive habit there is. Once a week is not a
 * compromise forced by the data; it is the cadence we would pick anyway.
 *
 * **Where the prices come from.** `.github/workflows/refresh-market-data.yml`
 * fetches on a weekday cron and commits `market-data.json`. Nothing on a
 * child's device calls a data provider, and there is no key in the browser. A
 * phone app would put a server behind this; the experience it produces is the
 * same one, which is the point of a prototype.
 *
 * Pure module. No React, no I/O.
 */

import { SNAPSHOT, WEEK_DATES, closesFor } from './companies';
import {
  HISTORY_WEEKS,
  advanceWeek,
  createPortfolio,
  totalValue,
  type PortfolioState,
  type WeekReport,
} from './market';
import { toCents } from './simulation';
import { plural } from './copy';

/** The index of the newest week we have closes for. */
export const LATEST_WEEK = HISTORY_WEEKS - 1;

/** Every close series, read once. */
const SERIES: Record<string, number[]> = Object.fromEntries(
  SNAPSHOT.map((company) => [company.ticker, closesFor(company.ticker)]),
);

/** The date of that week, as published. */
export function latestDate(): string {
  return WEEK_DATES[LATEST_WEEK] ?? '';
}

/** The date a given week index fell on. */
export function dateOfWeek(index: number): string {
  const clamped = Math.min(LATEST_WEEK, Math.max(0, index));
  return WEEK_DATES[clamped] ?? '';
}

/**
 * A live account, opened now.
 *
 * `windowStart` is placed so that week 0 is the newest week on file. Every
 * later week is one the world has to actually produce.
 */
export function createLivePortfolio(startingCash: number, seed = LATEST_WEEK): PortfolioState {
  const base = createPortfolio(startingCash, seed);
  const windowStart = LATEST_WEEK;
  const priceHistory: Record<string, number[]> = {};
  for (const [ticker, series] of Object.entries(base.priceHistory)) {
    void series;
    priceHistory[ticker] = [closeAt(ticker, windowStart)];
  }
  return {
    ...base,
    live: true,
    windowStart,
    week: 0,
    priceHistory,
    status: 'open',
    anchorDate: dateOfWeek(windowStart),
  };
}

/**
 * Read straight from the dataset, so this does not depend on a portfolio.
 *
 * `toCents` for the same reason `realClose` does it: a share price is a price
 * somebody paid, and prices are quoted in cents. The raw file carries values
 * like `325.315`, and this used to hand them over unrounded — so a live
 * account's *first* week was seeded with a sub-cent price and every week after
 * it was rounded. The gap showed up as a first weekly report claiming a move of
 * a fraction of a percent on a week where the data says nothing happened, in
 * the one list whose whole job is to say what actually moved.
 */
function closeAt(ticker: string, weekIndex: number): number {
  const series = SERIES[ticker];
  if (!series || series.length === 0) return 0;
  const index = Math.min(series.length - 1, Math.max(0, weekIndex));
  return toCents(series[index]);
}

/**
 * The row for a date, or the closest one at or before it.
 *
 * Used to re-find an account's anchor after the file has rolled. Returns 0
 * rather than -1 when the date has fallen off the back of the window entirely,
 * because an account that old should be brought forward, not broken.
 */
export function indexOfDate(date: string): number {
  if (!date) return LATEST_WEEK;
  let best = 0;
  for (let i = 0; i < WEEK_DATES.length; i += 1) {
    if (WEEK_DATES[i] <= date) best = i;
    else break;
  }
  return best;
}

/**
 * Re-seat a saved account on the current price file.
 *
 * `windowStart + week` is an index, and indices move when the rolling window
 * drops a week off the back. The account's real position is the *date* it is
 * standing on, so that is what gets re-found. A no-op in the ordinary case
 * where nothing has rolled.
 */
export function rehydrate(portfolio: PortfolioState): PortfolioState {
  if (!portfolio.live) return portfolio;
  const anchor = portfolio.anchorDate;
  if (!anchor) return portfolio;
  const windowStart = indexOfDate(anchor);
  if (windowStart === portfolio.windowStart) return portfolio;
  /*
   * Only the anchor moves. `week` is an offset from it, and a roll shifts
   * every row by the same amount, so the offset is unchanged — which is the
   * whole reason this is fixable from one stored date.
   *
   * The first version of this re-derived `week` from
   * `dateOfWeek(windowStart + week)`, reading the date off the stale index it
   * was there to correct, and landed the account two weeks late. Caught by
   * simulating the roll rather than by reasoning about it.
   */
  return { ...portfolio, windowStart };
}

/** Whole days between two ISO dates. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * How many rows of price data this account has not caught up to.
 *
 * Rows, not weeks. The two are usually the same and must not be assumed to be:
 * the newest row in the file is the week *in progress*, so its date moves as
 * the week goes on — `2026-08-31` and `2026-09-01` are one day apart, not
 * seven. Counting index steps and calling them weeks would tell a kid who
 * checked in yesterday that a week had gone by, which is the one thing a
 * screen about real elapsed time must never get wrong.
 *
 * So the prices catch up by row, and everything a kid is *told* is derived
 * from the dates. See `daysAway`.
 */
export function stepsBehind(portfolio: PortfolioState): number {
  if (!portfolio.live) return 0;
  return Math.max(0, LATEST_WEEK - portfolio.windowStart - portfolio.week);
}

/** Real days since the account last saw a price. */
export function daysAway(portfolio: PortfolioState): number {
  if (!portfolio.live) return 0;
  return daysBetween(dateOfWeek(portfolio.windowStart + portfolio.week), latestDate());
}

/**
 * Whole weeks since the account last saw a price.
 *
 * A kid who opens the app twice in one week is told nothing has happened,
 * which is true and is a lesson in itself.
 */
export function weeksBehind(portfolio: PortfolioState): number {
  return Math.floor(daysAway(portfolio) / 7);
}

/** One move by one company over the catch-up, with the money attached. */
export interface CatchUpMove {
  ticker: string;
  from: number;
  to: number;
  changePct: number;
  /** What it did to this kid's money. Zero when they do not hold it. */
  dollars: number;
  held: boolean;
}

export interface CatchUp {
  /** Real days that passed while they were away. Zero means nothing did. */
  days: number;
  /** Those days as whole weeks, which is how the market is talked about. */
  weeks: number;
  from: string;
  to: string;
  valueBefore: number;
  valueAfter: number;
  changeDollars: number;
  changePct: number;
  /** Every company, biggest absolute move first. */
  moves: CatchUpMove[];
  /** Whether the market as a whole had a bad run of it. */
  wasScare: boolean;
}

/**
 * Bring an account up to today, and say what happened while they were away.
 *
 * Each intervening week is run through the ordinary `advanceWeek`, so drawdown
 * tracking, "held through it" and every other behavioural fact are recorded
 * exactly as they would have been had the kid been watching. Nothing about the
 * evidence is cheapened by having been away.
 */
export function catchUp(saved: PortfolioState): {
  portfolio: PortfolioState;
  report: CatchUp | null;
} {
  // Always re-seat first. Every other number on this screen is read off the
  // index, and the index is the thing that cannot be trusted across a refresh.
  const portfolio = rehydrate(saved);
  const steps = stepsBehind(portfolio);
  const days = daysAway(portfolio);
  // No new prices *and* no elapsed time. Either alone is not enough: a row can
  // land mid-week, and a week can pass with the file not yet refreshed.
  if (steps === 0 && days === 0) return { portfolio, report: null };

  const from = dateOfWeek(portfolio.windowStart + portfolio.week);
  const valueBefore = totalValue(portfolio);
  const opening: Record<string, number> = {};
  for (const [ticker, series] of Object.entries(portfolio.priceHistory)) {
    opening[ticker] = series[series.length - 1];
  }

  let current = portfolio;
  const weekly: WeekReport[] = [];
  for (let i = 0; i < steps; i += 1) {
    const step = advanceWeek(current);
    current = step.portfolio;
    weekly.push(step.report);
  }

  const moves: CatchUpMove[] = Object.entries(opening).map(([ticker, was]) => {
    const series = current.priceHistory[ticker] ?? [was];
    const now = series[series.length - 1];
    const holding = current.holdings[ticker];
    return {
      ticker,
      from: was,
      to: now,
      changePct: was > 0 ? (now - was) / was : 0,
      dollars: holding ? holding.shares * (now - was) : 0,
      held: Boolean(holding),
    };
  });
  moves.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const valueAfter = totalValue(current);
  return {
    portfolio: current,
    report: {
      days,
      weeks: Math.floor(days / 7),
      from,
      to: dateOfWeek(current.windowStart + current.week),
      valueBefore,
      valueAfter,
      changeDollars: valueAfter - valueBefore,
      changePct: valueBefore > 0 ? (valueAfter - valueBefore) / valueBefore : 0,
      moves,
      wasScare: weekly.some((week) => week.wasScare),
    },
  };
}

/**
 * What the market did in the most recent finished week, held or not.
 *
 * This is the part that has to be true the first time an account is opened. A
 * kid — or a grown-up being shown this for the first time — should not have to
 * wait until next Monday to find out that the live market is live. Their own
 * money has not moved yet, and saying so plainly is better than manufacturing
 * a number; but the market moved, it moved for real, and that is worth looking
 * at from the first second.
 */
export function lastWeekOnTheMarket(): {
  from: string;
  to: string;
  moves: CatchUpMove[];
  averagePct: number;
} {
  const to = LATEST_WEEK;
  /*
   * A week back by the calendar, not one row back.
   *
   * The newest row is the week in progress. Comparing against the row before
   * it produced "what the market did last week: 2026-08-31 to 2026-09-01" —
   * a single day, labelled as a week, with moves a seventh of the size they
   * should be. Walk back until the date really is a week older.
   */
  let previous = to;
  while (previous > 0 && daysBetween(dateOfWeek(previous), dateOfWeek(to)) < 7) {
    previous -= 1;
  }
  const moves: CatchUpMove[] = SNAPSHOT.map((company) => {
    const was = closeAt(company.ticker, previous);
    const now = closeAt(company.ticker, to);
    return {
      ticker: company.ticker,
      from: was,
      to: now,
      changePct: was > 0 ? (now - was) / was : 0,
      dollars: 0,
      held: false,
    };
  });
  moves.sort((a, b) => b.changePct - a.changePct);
  const averagePct =
    moves.length > 0 ? moves.reduce((sum, move) => sum + move.changePct, 0) / moves.length : 0;
  return { from: dateOfWeek(previous), to: dateOfWeek(to), moves, averagePct };
}

/**
 * How long a live account has been running, in the kid's terms.
 *
 * Never a percentage of anything, because there is nothing to be a percentage
 * of. A live account is not a level with a top.
 */
export function runningFor(portfolio: PortfolioState): string {
  if (!portfolio.live) return '';
  /*
   * From the calendar, not from `week`.
   *
   * `week` counts rows of price data, and the newest row is the week in
   * progress — so an account five rows old is four weeks and a bit old. The
   * catch-up screen already says "4 weeks went by"; the market saying "5 weeks
   * in" on the very next tap is the kind of disagreement that makes a kid stop
   * believing either number.
   */
  const weeks = Math.floor(
    daysBetween(
      portfolio.anchorDate ?? dateOfWeek(portfolio.windowStart),
      dateOfWeek(portfolio.windowStart + portfolio.week),
    ) / 7,
  );
  if (weeks === 0) return 'Opened this week.';
  if (weeks === 1) return 'One week in.';
  if (weeks < 52) return `${plural(weeks, 'week')} in.`;
  const years = Math.floor(weeks / 52);
  return years === 1 ? 'A year in.' : `${years} years in.`;
}
