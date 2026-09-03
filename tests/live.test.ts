import { describe, expect, it } from 'vitest';
import {
  LATEST_WEEK,
  catchUp,
  createLivePortfolio,
  dateOfWeek,
  daysBetween,
  indexOfDate,
  lastWeekOnTheMarket,
  latestDate,
  rehydrate,
  runningFor,
  stepsBehind,
  weeksBehind,
} from '../src/lib/live';
import {
  HISTORY_WEEKS,
  MARKET_WEEKS,
  advanceWeek,
  buy,
  createPortfolio,
  currentDate,
  currentPrice,
  totalValue,
  type PortfolioState,
} from '../src/lib/market';
import { SNAPSHOT } from '../src/lib/companies';
import { toCents } from '../src/lib/simulation';

/**
 * Rewinds a live account by `rows` of price data, so it looks like the kid
 * opened it that far back and has not been since.
 *
 * Rows rather than weeks on purpose. The newest row in the file is the week in
 * progress, so four rows back is not four weeks back — which is exactly the
 * confusion the date-derived clock exists to prevent, and a helper that
 * pretended otherwise would hide it.
 */
function openedRowsAgo(cash: number, rows: number): PortfolioState {
  const fresh = createLivePortfolio(cash);
  const windowStart = LATEST_WEEK - rows;
  // The anchor date has to move with it, or `rehydrate` correctly snaps the
  // account straight back to where it really belongs.
  return { ...fresh, windowStart, anchorDate: dateOfWeek(windowStart) };
}

/** What the calendar says about a rewind of that many rows. */
function realWeeksBack(rows: number): number {
  return Math.floor(daysBetween(dateOfWeek(LATEST_WEEK - rows), latestDate()) / 7);
}

describe('the live account', () => {
  it('starts on the newest week there is', () => {
    const live = createLivePortfolio(500);
    expect(live.live).toBe(true);
    expect(live.windowStart).toBe(LATEST_WEEK);
    expect(live.week).toBe(0);
    expect(currentDate(live)).toBe(latestDate());
  });

  /*
   * Rounded to cents, like every other price in the product.
   *
   * This used to compare against the raw file value, which is how the
   * inconsistency hid: `createLivePortfolio` seeded week 0 unrounded while
   * every week after it went through `realClose`, which rounds. A first weekly
   * report then showed a fraction-of-a-percent move on a week where the data
   * says nothing happened. The claim being made here is about *which week* the
   * account is priced at, and that is unchanged.
   */
  it('prices it at the real latest close, not the replay window', () => {
    const live = createLivePortfolio(500);
    for (const company of SNAPSHOT.slice(0, 4)) {
      expect(currentPrice(live, company.ticker)).toBeGreaterThan(0);
      expect(currentPrice(live, company.ticker)).toBe(
        toCents(company.closes[company.closes.length - 1]),
      );
    }
  });

  /*
   * And the inconsistency itself, stated as the property rather than the
   * instance: whichever way a live price is arrived at, it is a price in cents.
   */
  it('quotes every price in whole cents, seeded or advanced', () => {
    let live = createLivePortfolio(500);
    const cents = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9;
    for (const company of SNAPSHOT) {
      expect(cents(currentPrice(live, company.ticker)), `${company.ticker} seed`).toBe(true);
    }
    for (let i = 0; i < 4; i += 1) {
      live = advanceWeek(live).portfolio;
      for (const company of SNAPSHOT) {
        expect(cents(currentPrice(live, company.ticker)), `${company.ticker} week ${i}`).toBe(true);
      }
    }
  });

  it('has nothing to report the moment it is opened', () => {
    const live = createLivePortfolio(500);
    expect(weeksBehind(live)).toBe(0);
    expect(catchUp(live).report).toBeNull();
  });

  it('never runs out of weeks the way Act 4 does', () => {
    let live = createLivePortfolio(500);
    for (let i = 0; i < MARKET_WEEKS + 6; i += 1) live = advanceWeek(live).portfolio;
    expect(live.status).toBe('open');

    // The replayed account, for contrast: same machinery, and it closes.
    let replay = createPortfolio(500, 7);
    for (let i = 0; i < MARKET_WEEKS; i += 1) replay = advanceWeek(replay).portfolio;
    expect(replay.status).toBe('closed');
  });

  it('never claims a week the data does not have', () => {
    expect(LATEST_WEEK).toBe(HISTORY_WEEKS - 1);
    expect(dateOfWeek(LATEST_WEEK + 50)).toBe(latestDate());
    expect(dateOfWeek(-3)).toBe(dateOfWeek(0));
  });
});

describe('coming back after being away', () => {
  it('counts real elapsed weeks, not rows of data', () => {
    // Three rows back is not three weeks back while the newest row is a week
    // still in progress. The kid is told what the calendar says.
    expect(stepsBehind(openedRowsAgo(500, 3))).toBe(3);
    expect(weeksBehind(openedRowsAgo(500, 3))).toBe(realWeeksBack(3));
    expect(weeksBehind(openedRowsAgo(500, 3))).toBeLessThanOrEqual(3);
    expect(weeksBehind(openedRowsAgo(500, 0))).toBe(0);
  });

  it('never reports more weeks than have actually elapsed', () => {
    for (const rows of [1, 2, 3, 5, 8, 13]) {
      const away = openedRowsAgo(500, rows);
      const elapsed = daysBetween(dateOfWeek(LATEST_WEEK - rows), latestDate());
      expect(weeksBehind(away), `${rows} rows`).toBe(Math.floor(elapsed / 7));
      expect(weeksBehind(away), `${rows} rows`).toBeLessThanOrEqual(rows);
    }
  });

  it('says nothing happened when nothing happened', () => {
    const same = catchUp(openedRowsAgo(500, 0));
    expect(same.report).toBeNull();
    expect(same.portfolio.week).toBe(0);
  });

  it('brings the account all the way to today in one go', () => {
    const { portfolio, report } = catchUp(openedRowsAgo(500, 4));
    expect(report?.weeks).toBe(realWeeksBack(4));
    expect(report?.days).toBe(daysBetween(dateOfWeek(LATEST_WEEK - 4), latestDate()));
    expect(weeksBehind(portfolio)).toBe(0);
    expect(currentDate(portfolio)).toBe(latestDate());
  });

  it('moves money the kid actually holds, and only that money', () => {
    // 30% of the pot: inside MAX_POSITION_FRACTION, which the live account
    // enforces exactly as the replayed one does.
    const away = openedRowsAgo(1000, 5);
    const bought = buy(away, 'AAPL', 300);
    expect(bought.ok).toBe(true);

    const { portfolio, report } = catchUp(bought.portfolio);
    expect(report).not.toBeNull();
    expect(report!.changeDollars).toBeCloseTo(totalValue(portfolio) - report!.valueBefore, 2);

    const apple = report!.moves.find((move) => move.ticker === 'AAPL')!;
    expect(apple.held).toBe(true);
    const shares = portfolio.holdings.AAPL.shares;
    expect(apple.dollars).toBeCloseTo(shares * (apple.to - apple.from), 2);

    // Cash does not move on its own.
    expect(portfolio.cash).toBeCloseTo(bought.portfolio.cash, 2);
  });

  it('reports every company, held or not, biggest mover first', () => {
    const { report } = catchUp(openedRowsAgo(500, 3));
    expect(report!.moves).toHaveLength(SNAPSHOT.length);
    const sizes = report!.moves.map((move) => Math.abs(move.changePct));
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(report!.moves.every((move) => move.held === false)).toBe(true);
  });

  it('credits holding through a fall exactly as if they had watched it', () => {
    // The behavioural record is the product. Being away must not launder it,
    // and must not cost them credit they earned by doing nothing.
    const away = buy(openedRowsAgo(2000, 10), 'RBLX', 600).portfolio;

    let watched = away;
    for (let i = 0; i < 10; i += 1) watched = advanceWeek(watched).portfolio;
    const skipped = catchUp(away).portfolio;

    expect(skipped.holdings.RBLX.worstDrawdown).toBeCloseTo(
      watched.holdings.RBLX.worstDrawdown,
      6,
    );
    expect(skipped.holdings.RBLX.heldThroughDrawdown).toBe(
      watched.holdings.RBLX.heldThroughDrawdown,
    );
    expect(totalValue(skipped)).toBeCloseTo(totalValue(watched), 2);
  });

  it('reconciles: the change is the sum of what each holding did', () => {
    let away = openedRowsAgo(3000, 6);
    away = buy(away, 'AAPL', 500).portfolio;
    away = buy(away, 'COST', 500).portfolio;
    away = buy(away, 'NKE', 500).portfolio;

    const { report } = catchUp(away);
    const summed = report!.moves.reduce((total, move) => total + move.dollars, 0);
    expect(summed).toBeCloseTo(report!.changeDollars, 2);
  });
});

describe('the first visit, which has to be real anyway', () => {
  const market = lastWeekOnTheMarket();

  it('shows a real week with real dates', () => {
    expect(market.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(market.to).toBe(latestDate());
    expect(market.from < market.to).toBe(true);
  });

  it('covers every company and sorts best to worst', () => {
    expect(market.moves).toHaveLength(SNAPSHOT.length);
    const pcts = market.moves.map((move) => move.changePct);
    expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
  });

  it('never invents a gain for a kid who owns nothing', () => {
    expect(market.moves.every((move) => move.dollars === 0)).toBe(true);
    expect(market.moves.every((move) => move.held === false)).toBe(true);
  });

  it('reports a real average rather than a flattering one', () => {
    const mean =
      market.moves.reduce((sum, move) => sum + move.changePct, 0) / market.moves.length;
    expect(market.averagePct).toBeCloseTo(mean, 10);
  });
});

describe('how long it has been running', () => {
  /**
   * Ages the account by rewinding its anchor, which is how a real one ages:
   * the newest row stays the newest row and the anchor recedes from it.
   */
  const agedRows = (rows: number) => {
    const windowStart = LATEST_WEEK - rows;
    return {
      ...createLivePortfolio(100),
      windowStart,
      anchorDate: dateOfWeek(windowStart),
      week: rows,
    };
  };

  it('counts up rather than down, because there is no end', () => {
    const live = createLivePortfolio(100);
    expect(runningFor(live)).toContain('this week');
    expect(runningFor(agedRows(0))).toContain('this week');
  });

  it('measures age by the calendar, so it agrees with the catch-up screen', () => {
    // The two numbers a kid sees one tap apart. They came from different
    // clocks once — rows here, dates there — and disagreed by a week.
    for (const rows of [1, 3, 5, 9]) {
      const account = agedRows(rows);
      const weeks = Math.floor(
        daysBetween(account.anchorDate!, dateOfWeek(account.windowStart + account.week)) / 7,
      );
      const said = runningFor(account);
      if (weeks === 0) expect(said).toContain('this week');
      else if (weeks === 1) expect(said).toBe('One week in.');
      else expect(said).toBe(`${weeks} weeks in.`);
      expect(weeks).toBeLessThanOrEqual(rows);
    }
  });

  it('rolls up to years once there are years of it', () => {
    const live = createLivePortfolio(100);
    const yearsOld = (weeks: number) => {
      const windowStart = LATEST_WEEK - weeks;
      return { ...live, windowStart, anchorDate: dateOfWeek(windowStart), week: weeks };
    };
    expect(runningFor(yearsOld(60))).toBe('A year in.');
    expect(runningFor(yearsOld(140))).toBe('2 years in.');
  });

  it('says nothing at all about a replayed account', () => {
    expect(runningFor(createPortfolio(100, 3))).toBe('');
  });
});

describe('the week in progress, which is a real trap', () => {
  /**
   * The newest row in `market-data.json` is the week that has not finished. Its
   * date moves as the week goes on, so index arithmetic and the calendar
   * disagree by up to six days — and everything a kid is told about elapsed
   * time is a sentence that has to survive that.
   */
  it('never calls a partial week a week', () => {
    const gapToNewest = daysBetween(dateOfWeek(LATEST_WEEK - 1), latestDate());
    if (gapToNewest >= 7) return; // A full week; nothing to guard today.
    const oneRowBack = openedRowsAgo(500, 1);
    expect(stepsBehind(oneRowBack)).toBe(1);
    expect(weeksBehind(oneRowBack)).toBe(0);
  });

  it('still marks prices to the newest close even mid-week', () => {
    const oneRowBack = openedRowsAgo(500, 1);
    const { portfolio, report } = catchUp(oneRowBack);
    expect(currentDate(portfolio)).toBe(latestDate());
    expect(report).not.toBeNull();
    expect(report!.days).toBeGreaterThan(0);
  });

  it('measures "last week on the market" over a real week', () => {
    const market = lastWeekOnTheMarket();
    const span = daysBetween(market.from, market.to);
    // Either a genuine week or more — never the one-day gap that the newest
    // partial row would give if we simply stepped back one index.
    expect(span).toBeGreaterThanOrEqual(7);
  });
});

describe('the file rolls, and a saved account must not', () => {
  /**
   * `market-data.json` holds a rolling five-year window. Every refresh appends
   * a week, and sooner or later drops the oldest — at which point every index
   * in the array shifts down by one.
   *
   * An account whose position was stored as an index would then be standing on
   * a different week than the one it was saved on, silently, and would drift
   * further every time the window rolled. Nothing would throw and no test that
   * did not simulate the roll would notice. It is stored as a date instead.
   */
  it('finds its week again after the window shifts underneath it', () => {
    const anchorRow = LATEST_WEEK - 6;
    const account = {
      ...createLivePortfolio(1000),
      windowStart: anchorRow,
      anchorDate: dateOfWeek(anchorRow),
      week: 2,
    };
    const standingOn = dateOfWeek(account.windowStart + account.week);

    // The window rolls: two weeks fall off the front, so the row that held a
    // given date is now two lower. A saved account still carries the old
    // index, which now points two weeks too late.
    const rolled = { ...account, windowStart: account.windowStart + 2 };
    const fixed = rehydrate(rolled);

    expect(dateOfWeek(fixed.windowStart)).toBe(account.anchorDate);
    expect(dateOfWeek(fixed.windowStart + fixed.week)).toBe(standingOn);
  });

  it('leaves an account alone when nothing has rolled', () => {
    const account = createLivePortfolio(500);
    expect(rehydrate(account)).toBe(account);
  });

  it('ignores a replayed account entirely', () => {
    const replay = createPortfolio(500, 11);
    expect(rehydrate(replay)).toBe(replay);
  });

  it('brings forward an account older than the whole window', () => {
    const ancient = { ...createLivePortfolio(500), anchorDate: '1999-01-01', windowStart: 40 };
    const fixed = rehydrate(ancient);
    expect(fixed.windowStart).toBe(0);
    expect(fixed.week).toBeGreaterThanOrEqual(0);
  });

  it('resolves a date the file does not contain to the week before it', () => {
    const known = dateOfWeek(30);
    // A Wednesday inside week 30 is not a row, and must resolve to week 30.
    const midWeek = new Date(Date.parse(`${known}T00:00:00Z`) + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(indexOfDate(midWeek)).toBe(30);
    expect(indexOfDate(known)).toBe(30);
  });
});
