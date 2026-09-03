/**
 * Act 5 — Markets.
 *
 * Simulated money, real everything else. The kid buys slices of businesses they
 * already know how to read, because Acts 1 to 3 taught them the only four
 * numbers that matter.
 *
 * **The twelve weeks are a real stretch of market history.** The prices are
 * actual weekly closes, and which twelve weeks a kid gets is chosen from five
 * years of them by their own seed — so they are not told which period it is, and
 * every dip, recovery and flat patch genuinely happened. This replaced a
 * simulated random walk with a scripted week-5 crash, and it is a straight
 * upgrade: measured across all 250 windows in the data, 88% contain a fall of
 * 10% or more in at least one company a kid would plausibly hold, and the
 * median worst single-name drawdown is 21%. Real history teaches the lesson more
 * reliably than the script did, and it does it without anybody inventing a
 * number or cherry-picking a period.
 *
 * Two things here exist specifically to stop a future bloodbath:
 *
 *   1. A position cap. No single company may exceed a fraction of the
 *      portfolio. The kid meets the constraint before they meet the word
 *      "diversification".
 *   2. Prices genuinely fall. Acts 1 to 3 are monotonic, which is right for
 *      retention but trains the belief that things only go up. That belief is
 *      the most expensive thing a young investor can carry, so the market
 *      breaks it
 *      on purpose and rewards the kid who holds a sound business through it.
 *
 * No day trading, no leverage, no shorting, no options. Ever.
 *
 * Pure module. No React, no I/O.
 */

import {
  FIRST_HONEST_WEEK,
  SNAPSHOT,
  WEEK_DATES,
  closesFor,
  findCompany,
  metricsFor,
  type Company,
} from './companies';
import { round2, toCents } from './simulation';

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

/** No single holding may be worth more than this share of the portfolio. */
export const MAX_POSITION_FRACTION = 0.35;
/** Holdings needed before the cap is considered satisfied for the gate. */
export const DIVERSIFIED_MIN_HOLDINGS = 3;
/** How many weeks the market runs for. */
export const MARKET_WEEKS = 12;
/** A fall of this much counts as a drawdown worth crediting them for holding. */
export const DRAWDOWN_THRESHOLD = 0.1;
/**
 * A week where the market as a whole fell at least this much is called out.
 *
 * Derived from what actually happened that week rather than scripted to a fixed
 * week number, which is the whole difference between replaying history and
 * staging it.
 */
export const SCARE_MOVE = -0.04;

/** Weeks of real history available to replay. */
export const HISTORY_WEEKS = WEEK_DATES.length;

/**
 * Which twelve weeks this run gets.
 *
 * Uniform over every window where all eight companies have published accounts.
 * Deliberately *not* filtered to windows containing a crash: curating for drama
 * would teach a kid that markets always fall in three months, which is its own
 * kind of lie. Measured across the available windows, 88% contain a real fall
 * of 10% or more anyway.
 */
export function windowStartFor(seed: number): number {
  const first = FIRST_HONEST_WEEK;
  const windows = Math.max(1, HISTORY_WEEKS - MARKET_WEEKS - 1 - first);
  return first + (Math.abs(Math.floor(seed)) % windows);
}

/** The real calendar date of a given week of a run. */
export function weekDate(windowStart: number, week: number): string {
  const index = Math.min(WEEK_DATES.length - 1, Math.max(0, windowStart + week));
  return WEEK_DATES[index] ?? WEEK_DATES[WEEK_DATES.length - 1] ?? '';
}

/** The real close for a company at a given week of a run. */
export function realClose(ticker: string, windowStart: number, week: number): number {
  const closes = closesFor(ticker);
  if (closes.length === 0) return findCompany(ticker)?.price ?? 0;
  const index = Math.min(closes.length - 1, Math.max(0, windowStart + week));
  return toCents(closes[index]);
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

export interface Holding {
  ticker: string;
  shares: number;
  /** Total dollars paid in, for a truthful gain figure. */
  costBasis: number;
  /** Worst percentage fall below cost this holding has ever shown. */
  worstDrawdown: number;
  /** True if they bailed out while it was underwater. */
  soldWhileDown: boolean;
  /** True if they were down past the threshold and still held to recovery. */
  heldThroughDrawdown: boolean;
}

export interface Trade {
  week: number;
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
}

export interface PortfolioState {
  week: number;
  cash: number;
  holdings: Record<string, Holding>;
  /** Price per ticker per week, index 0 being the starting snapshot price. */
  priceHistory: Record<string, number[]>;
  trades: Trade[];
  /** Companies whose research card the kid has actually opened. */
  researched: string[];
  /**
   * The market week the Saturday stand was last run, or -1 for never.
   *
   * One a week. See `WEEKEND_FLOAT` in `progress.ts` for why the stand is still
   * here at all after it was sold.
   */
  standWeek: number;
  /** Everything the Saturday stand has put into the account, all told. */
  standEarnings: number;
  /**
   * Working capital currently sitting in the cash box rather than the account.
   *
   * Persisted rather than held in memory because a kid can close the tab
   * halfway through a Saturday, and the twenty dollars has to find its way
   * home when they come back.
   */
  standFloat: number;
  seed: number;
  /**
   * Index into the real weekly date axis for week 0 of this run.
   *
   * The kid is never shown it. They are trading a real twelve weeks without
   * being told which twelve.
   */
  windowStart: number;
  status: 'open' | 'closed';
  /**
   * A live account rather than a replayed one.
   *
   * Everything else about the machinery is identical — same holdings, same
   * drawdown tracking, same real closes — so live mode is not a second market
   * implementation. The only two differences are that `windowStart` is
   * anchored to the newest week in the dataset instead of a random one, and
   * that a live account never closes. See `src/lib/live.ts`.
   */
  live?: boolean;
  /**
   * The date this live account was opened, as published.
   *
   * Live accounts anchor to a *date*, never to `windowStart` alone. The price
   * file is a rolling five-year window: every refresh appends a week and
   * eventually drops the oldest one, at which point every index in the array
   * shifts by one and a saved `windowStart` quietly starts pointing at the
   * wrong week — forever, and worse each time. A date survives that. See
   * `rehydrate` in `src/lib/live.ts`.
   */
  anchorDate?: string;
}

export function createPortfolio(startingCash: number, seed = 4242): PortfolioState {
  const windowStart = windowStartFor(seed);
  const priceHistory: Record<string, number[]> = {};
  for (const company of SNAPSHOT) {
    priceHistory[company.ticker] = [realClose(company.ticker, windowStart, 0)];
  }
  return {
    windowStart,
    week: 0,
    cash: round2(startingCash),
    holdings: {},
    priceHistory,
    trades: [],
    researched: [],
    standWeek: -1,
    standEarnings: 0,
    standFloat: 0,
    seed,
    status: 'open',
  };
}

/* ------------------------------------------------------------------ *
 * Prices
 * ------------------------------------------------------------------ */

/**
 * The date the run is currently standing on.
 *
 * Everything shown about a company is read as of this date, so a kid replaying
 * an earlier week sees the accounts that were public then rather than ones
 * filed years later. Hindsight is not a teaching aid.
 */
export function currentDate(portfolio: PortfolioState): string {
  return weekDate(portfolio.windowStart, portfolio.week);
}

export function currentPrice(portfolio: PortfolioState, ticker: string): number {
  const series = portfolio.priceHistory[ticker];
  if (series && series.length > 0) return series[series.length - 1];
  /*
   * The fallback used to be today's price, which is the one price this must
   * never be. The market replays a week from the past and pairs it with the
   * accounts
   * that were public *then*; handing it the latest close instead would show a
   * 2026 share price over 2023 earnings and quote a price-to-earnings ratio
   * nobody ever paid. Read the real close for the week being replayed.
   */
  return realClose(ticker, portfolio.windowStart, portfolio.week);
}

/** Is there a Saturday left this week? */
export function canRunStand(portfolio: PortfolioState): boolean {
  return portfolio.status === 'open' && portfolio.standWeek !== portfolio.week;
}



/* ------------------------------------------------------------------ *
 * Valuation of what the kid holds
 * ------------------------------------------------------------------ */

export function holdingValue(portfolio: PortfolioState, ticker: string): number {
  const holding = portfolio.holdings[ticker];
  if (!holding) return 0;
  return round2(holding.shares * currentPrice(portfolio, ticker));
}

export function investedValue(portfolio: PortfolioState): number {
  return round2(
    Object.keys(portfolio.holdings).reduce((sum, ticker) => sum + holdingValue(portfolio, ticker), 0),
  );
}

export function totalValue(portfolio: PortfolioState): number {
  return round2(portfolio.cash + investedValue(portfolio));
}

export function holdingGain(portfolio: PortfolioState, ticker: string) {
  const holding = portfolio.holdings[ticker];
  if (!holding || holding.shares <= 0) return { dollars: 0, percent: 0 };
  const value = holdingValue(portfolio, ticker);
  const dollars = round2(value - holding.costBasis);
  return {
    dollars,
    percent: holding.costBasis > 0 ? dollars / holding.costBasis : 0,
  };
}

export function positionFraction(portfolio: PortfolioState, ticker: string): number {
  const total = totalValue(portfolio);
  if (total <= 0) return 0;
  return holdingValue(portfolio, ticker) / total;
}

/* ------------------------------------------------------------------ *
 * Buying, with the cap
 * ------------------------------------------------------------------ */

export interface TradeResult {
  ok: boolean
  reason?: string;
  portfolio: PortfolioState;
}

/**
 * The most the kid may put into one company right now, given the cap.
 *
 * Derived rather than guessed: after spending `x`, that holding must be no
 * more than `f` of the (unchanged) total, so x <= f * total - alreadyHeld.
 */
export function maxSpendOn(portfolio: PortfolioState, ticker: string): number {
  const total = totalValue(portfolio);
  const already = holdingValue(portfolio, ticker);
  const headroom = MAX_POSITION_FRACTION * total - already;
  return round2(Math.max(0, Math.min(portfolio.cash, headroom)));
}

export function buy(portfolio: PortfolioState, ticker: string, dollars: number): TradeResult {
  const company = findCompany(ticker);
  if (!company) return { ok: false, reason: 'No such company.', portfolio };
  if (portfolio.status === 'closed') return { ok: false, reason: 'The market is closed.', portfolio };

  const price = currentPrice(portfolio, ticker);
  /*
   * No price, no trade.
   *
   * `shares = spend / price` was unguarded, so a price of zero bought an
   * *infinite* number of shares — and the holding was then permanently
   * unprintable, worth `Infinity`, and poisoned every total on the screen. Real
   * closes are never zero, which is why nothing had ever tried it; a portfolio
   * restored from a save this program did not write, or a ticker whose week is
   * missing from the data, both are.
   *
   * Refusing is the only honest answer. There is no number of shares that
   * `$100` buys at a price of nothing, and inventing one would put a figure on
   * the screen that no arithmetic supports.
   */
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: 'There is no price for that company this week.', portfolio };
  }

  const spend = round2(Math.min(dollars, portfolio.cash));
  if (!Number.isFinite(spend) || spend <= 0) {
    return { ok: false, reason: 'You have no cash to spend.', portfolio };
  }

  const allowed = maxSpendOn(portfolio, ticker);
  if (spend > allowed + 0.01) {
    return {
      ok: false,
      reason: `Keep any one company under ${Math.round(MAX_POSITION_FRACTION * 100)}% of your money. You can put in up to $${allowed.toFixed(2)} here.`,
      portfolio,
    };
  }

  const shares = spend / price;
  const existing = portfolio.holdings[ticker];
  const holding: Holding = existing
    ? { ...existing, shares: existing.shares + shares, costBasis: round2(existing.costBasis + spend) }
    : {
        ticker,
        shares,
        costBasis: spend,
        worstDrawdown: 0,
        soldWhileDown: false,
        heldThroughDrawdown: false,
      };

  return {
    ok: true,
    portfolio: {
      ...portfolio,
      cash: round2(portfolio.cash - spend),
      holdings: { ...portfolio.holdings, [ticker]: holding },
      trades: [
        ...portfolio.trades,
        { week: portfolio.week, ticker, action: 'buy', shares, price, amount: spend },
      ],
    },
  };
}

export function sell(portfolio: PortfolioState, ticker: string, fraction = 1): TradeResult {
  const holding = portfolio.holdings[ticker];
  if (!holding || holding.shares <= 0) return { ok: false, reason: 'You do not own any.', portfolio };

  // `fraction` reaches here from a slider and from a decoded club proposal, so
  // `NaN` is possible and would silently sell nothing while reporting a sale.
  const share = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const shares = holding.shares * share;
  const price = currentPrice(portfolio, ticker);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, reason: 'There is no price for that company this week.', portfolio };
  }
  const proceeds = round2(shares * price);

  const gain = holdingGain(portfolio, ticker);
  const remaining = holding.shares - shares;

  const updated: Holding = {
    ...holding,
    shares: remaining,
    costBasis: round2(holding.costBasis * (1 - share)),
    // Bailing out underwater is exactly the habit the market exists to surface.
    soldWhileDown: holding.soldWhileDown || gain.percent < -0.02,
  };

  const holdings = { ...portfolio.holdings };
  if (remaining <= 1e-9) delete holdings[ticker];
  else holdings[ticker] = updated;

  return {
    ok: true,
    portfolio: {
      ...portfolio,
      cash: round2(portfolio.cash + proceeds),
      holdings,
      trades: [
        ...portfolio.trades,
        { week: portfolio.week, ticker, action: 'sell', shares, price, amount: proceeds },
      ],
    },
  };
}

export function markResearched(portfolio: PortfolioState, ticker: string): PortfolioState {
  if (portfolio.researched.includes(ticker)) return portfolio;
  return { ...portfolio, researched: [...portfolio.researched, ticker] };
}

/* ------------------------------------------------------------------ *
 * Time passing
 * ------------------------------------------------------------------ */

export interface WeekReport {
  week: number;
  moves: Array<{ ticker: string; from: number; to: number; changePct: number }>;
  portfolioBefore: number;
  portfolioAfter: number;
  changePct: number;
  /** How the whole market moved, averaged across all eight companies. */
  marketChangePct: number;
  /** True when the market as a whole fell hard, not on a scheduled week. */
  wasScare: boolean;
  /** Holdings that just crossed into a real drawdown. */
  nowUnderwater: string[];
}

/**
 * Advances one week and updates the drawdown bookkeeping.
 *
 * `heldThroughDrawdown` is only set once a holding has been down past the
 * threshold and has climbed back above water while still being held. That is
 * a genuine behavioural fact about the kid, which is why the parent view is
 * allowed to report it.
 */
export function advanceWeek(portfolio: PortfolioState): { portfolio: PortfolioState; report: WeekReport } {
  const before = totalValue(portfolio);
  const week = portfolio.week + 1;

  const priceHistory: Record<string, number[]> = {};
  const moves: WeekReport['moves'] = [];

  for (const company of SNAPSHOT) {
    const series = portfolio.priceHistory[company.ticker] ?? [
      realClose(company.ticker, portfolio.windowStart, 0),
    ];
    const from = series[series.length - 1];
    // The real close for this week of the real window. Nothing is generated.
    const to = realClose(company.ticker, portfolio.windowStart, week);
    priceHistory[company.ticker] = [...series, to];
    moves.push({ ticker: company.ticker, from, to, changePct: from > 0 ? (to - from) / from : 0 });
  }

  // Whether this was a bad week for the market is read off what the market did,
  // rather than being true on a fixed week number.
  const marketChangePct =
    moves.length > 0 ? moves.reduce((sum, move) => sum + move.changePct, 0) / moves.length : 0;

  const nextPortfolio: PortfolioState = { ...portfolio, week, priceHistory };

  const holdings: Record<string, Holding> = {};
  const nowUnderwater: string[] = [];
  for (const [ticker, holding] of Object.entries(portfolio.holdings)) {
    const gain = holdingGain(nextPortfolio, ticker);
    const worstDrawdown = Math.min(holding.worstDrawdown, gain.percent);
    const wasDeepDown = worstDrawdown <= -DRAWDOWN_THRESHOLD;

    if (gain.percent <= -DRAWDOWN_THRESHOLD && holding.worstDrawdown > -DRAWDOWN_THRESHOLD) {
      nowUnderwater.push(ticker);
    }

    holdings[ticker] = {
      ...holding,
      worstDrawdown,
      heldThroughDrawdown:
        holding.heldThroughDrawdown || (wasDeepDown && gain.percent >= 0 && !holding.soldWhileDown),
    };
  }

  // A live account has no last week. The twelve-week cap is what turns the arc
  // into a story with an ending, and the whole point of the live market is that
  // it is a practice rather than a story.
  const finished = !portfolio.live && week >= MARKET_WEEKS;
  const settled: PortfolioState = {
    ...nextPortfolio,
    holdings,
    status: finished ? 'closed' : 'open',
  };

  const after = totalValue(settled);
  return {
    portfolio: settled,
    report: {
      week,
      moves,
      portfolioBefore: before,
      portfolioAfter: after,
      changePct: before > 0 ? (after - before) / before : 0,
      marketChangePct,
      wasScare: marketChangePct <= SCARE_MOVE,
      nowUnderwater,
    },
  };
}

/* ------------------------------------------------------------------ *
 * How they did, and what it proves
 * ------------------------------------------------------------------ */

export interface PortfolioSummary {
  startingValue: number;
  currentValue: number;
  gainDollars: number;
  gainPercent: number;
  holdingsCount: number;
  diversified: boolean;
  /** Concentration of the largest single position. */
  largestPositionFraction: number;
  heldThroughDrawdown: boolean;
  panicSold: boolean;
  tradeCount: number;
  researchedCount: number;
}

export function summarisePortfolio(portfolio: PortfolioState, startingValue: number): PortfolioSummary {
  const current = totalValue(portfolio);
  const tickers = Object.keys(portfolio.holdings);
  const fractions = tickers.map((t) => positionFraction(portfolio, t));

  return {
    startingValue: round2(startingValue),
    currentValue: current,
    gainDollars: round2(current - startingValue),
    gainPercent: startingValue > 0 ? (current - startingValue) / startingValue : 0,
    holdingsCount: tickers.length,
    diversified: tickers.length >= DIVERSIFIED_MIN_HOLDINGS,
    largestPositionFraction: fractions.length ? Math.max(...fractions) : 0,
    heldThroughDrawdown: Object.values(portfolio.holdings).some((h) => h.heldThroughDrawdown),
    panicSold: Object.values(portfolio.holdings).some((h) => h.soldWhileDown),
    tradeCount: portfolio.trades.length,
    researchedCount: portfolio.researched.length,
  };
}

/**
 * Ranks the companies by the same arithmetic the kid used on the stands for
 * sale on the deal board: cheap per dollar of profit, and growing.
 *
 * This is used only to check the kid's reasoning after the fact. It is never
 * shown as a recommendation, because the whole point is that they decide.
 */
export function valueRanking(): Array<{ company: Company; pe: number | null; score: number }> {
  return SNAPSHOT.map((company) => {
    const m = metricsFor(company);
    // Earnings yield plus growth: the crude version of what a real investor does.
    const score = m.earningsYield !== null ? m.earningsYield + company.growth : company.growth - 0.1;
    return { company, pe: m.pe, score };
  }).sort((a, b) => b.score - a.score);
}
