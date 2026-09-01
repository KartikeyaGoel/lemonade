import { describe, it, expect } from 'vitest';
import {
  SNAPSHOT,
  formatMillions,
  metricsFor,
  standComparison,
  findCompany,
  closesFor,
  fundamentalsAsOf,
  FIRST_HONEST_WEEK,
} from '../src/lib/companies';
import {
  DIVERSIFIED_MIN_HOLDINGS,
  DRAWDOWN_THRESHOLD,
  HISTORY_WEEKS,
  MARKET_WEEKS,
  MAX_POSITION_FRACTION,
  advanceWeek,
  buy,
  createPortfolio,
  currentPrice,
  holdingGain,
  holdingValue,
  maxSpendOn,
  positionFraction,
  sell,
  summarisePortfolio,
  weekDate,
  windowStartFor,
  currentDate,
  totalValue,
  valueRanking,
  markResearched,
} from '../src/lib/market';
import { toCents } from '../src/lib/simulation';

describe('a company is shown with the same four numbers as a lemonade stand', () => {
  it('computes EPS, PE and margin as plain division', () => {
    for (const company of SNAPSHOT) {
      const m = metricsFor(company);
      if (company.sharesM > 0) {
        expect(m.eps).toBeCloseTo(company.netIncomeM / company.sharesM, 6);
      }
      expect(m.netMargin).toBeCloseTo(company.netIncomeM / company.revenueM, 6);
      if (m.pe !== null) {
        expect(m.pe).toBeCloseTo(company.price / m.eps!, 4);
        // Payback in years IS the multiple. Same number, restated.
        expect(m.paybackYears).toBeCloseTo(m.pe, 6);
        expect(m.earningsYield).toBeCloseTo(1 / m.pe, 6);
      }
    }
  });

  it('refuses to invent a PE for a company that loses money', () => {
    const roblox = findCompany('RBLX')!;
    const m = metricsFor(roblox);
    expect(roblox.netIncomeM).toBeLessThan(0);
    expect(m.profitable).toBe(false);
    expect(m.pe).toBeNull();
    expect(m.earningsYield).toBeNull();
    expect(standComparison(roblox)).toContain('no P/E');
  });

  it('keeps the revenue-versus-profit contrast that does the teaching', () => {
    const costco = findCompany('COST')!;
    const apple = findCompany('AAPL')!;
    // Costco sells far more and keeps far less. This pairing is the lesson.
    expect(costco.revenueM).toBeGreaterThan(apple.revenueM * 0.5);
    expect(metricsFor(costco).netMargin).toBeLessThan(metricsFor(apple).netMargin / 4);
  });

  it('reads big numbers the way a kid would say them', () => {
    expect(formatMillions(391_000)).toBe('$391B');
    expect(formatMillions(1_500_000)).toBe('$1.5T');
    expect(formatMillions(940)).toBe('$940M');
    expect(formatMillions(-940)).toBe('-$940M');
  });

  it('every company has a story a kid could actually argue with', () => {
    for (const company of SNAPSHOT) {
      expect(company.story.length).toBeGreaterThan(20);
      expect(company.whatTheySell.length).toBeGreaterThan(3);
    }
  });
});

describe('the position cap is how diversification is felt', () => {
  it('will not let a first purchase exceed the cap', () => {
    const portfolio = createPortfolio(1000);
    const result = buy(portfolio, 'AAPL', 1000);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('35%');
    // And it says exactly how much they may put in.
    expect(result.reason).toContain(maxSpendOn(portfolio, 'AAPL').toFixed(2));
  });

  it('allows a purchase up to the cap', () => {
    const portfolio = createPortfolio(1000);
    const allowed = maxSpendOn(portfolio, 'AAPL');
    expect(allowed).toBeCloseTo(350, 2);
    const result = buy(portfolio, 'AAPL', allowed);
    expect(result.ok).toBe(true);
    expect(positionFraction(result.portfolio, 'AAPL')).toBeLessThanOrEqual(MAX_POSITION_FRACTION + 1e-6);
  });

  it('stops a kid topping up past the cap later', () => {
    let portfolio = createPortfolio(1000);
    portfolio = buy(portfolio, 'AAPL', 350).portfolio;
    const again = buy(portfolio, 'AAPL', 100);
    expect(again.ok).toBe(false);
  });

  it('forces at least three companies to get fully invested', () => {
    let portfolio = createPortfolio(1000);
    for (const ticker of ['AAPL', 'KO', 'CMG']) {
      const spend = maxSpendOn(portfolio, ticker);
      portfolio = buy(portfolio, ticker, spend).portfolio;
    }
    expect(Object.keys(portfolio.holdings).length).toBeGreaterThanOrEqual(DIVERSIFIED_MIN_HOLDINGS);
    expect(summarisePortfolio(portfolio, 1000).diversified).toBe(true);
    // Cash left over is small: the cap effectively required spreading out.
    expect(portfolio.cash).toBeLessThan(1000 * 0.35);
  });

  it('never spends cash the kid does not have', () => {
    const portfolio = createPortfolio(50);
    const result = buy(portfolio, 'AAPL', 999);
    expect(result.portfolio.cash).toBeGreaterThanOrEqual(0);
    if (result.ok) expect(result.portfolio.cash).toBeCloseTo(50 - maxSpendOn(portfolio, 'AAPL'), 2);
  });

  it('conserves money exactly on a buy and a sell round trip', () => {
    const portfolio = createPortfolio(1000);
    const bought = buy(portfolio, 'KO', 300);
    expect(bought.ok).toBe(true);
    expect(totalValue(bought.portfolio)).toBeCloseTo(1000, 2);

    const sold = sell(bought.portfolio, 'KO', 1);
    expect(sold.ok).toBe(true);
    expect(sold.portfolio.cash).toBeCloseTo(1000, 2);
    expect(sold.portfolio.holdings.KO).toBeUndefined();
  });

  it('sells only part of a holding when asked', () => {
    let portfolio = createPortfolio(1000);
    portfolio = buy(portfolio, 'KO', 300).portfolio;
    const shares = portfolio.holdings.KO.shares;
    const sold = sell(portfolio, 'KO', 0.5);
    expect(sold.portfolio.holdings.KO.shares).toBeCloseTo(shares / 2, 6);
    expect(sold.portfolio.holdings.KO.costBasis).toBeCloseTo(150, 2);
  });

  it('refuses to sell what the kid does not own', () => {
    expect(sell(createPortfolio(1000), 'AAPL').ok).toBe(false);
  });
});

describe('prices really move, and really fall', () => {
  it('records a new price for every company each week', () => {
    const portfolio = createPortfolio(1000);
    const { portfolio: after } = advanceWeek(portfolio);
    for (const company of SNAPSHOT) {
      expect(after.priceHistory[company.ticker]).toHaveLength(2);
      expect(after.priceHistory[company.ticker][1]).toBeGreaterThan(0);
    }
    expect(after.week).toBe(1);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      let p = createPortfolio(1000, 777);
      for (let i = 0; i < 6; i++) p = advanceWeek(p).portfolio;
      return SNAPSHOT.map((c) => currentPrice(p, c.ticker));
    };
    expect(run()).toEqual(run());
  });

  it('replays real closes and never invents a price', () => {
    // The strongest guarantee available: every price the game ever shows has to
    // be a number that appears in the fetched history for that company.
    let portfolio = createPortfolio(1000, 5);
    for (let week = 1; week <= MARKET_WEEKS; week++) portfolio = advanceWeek(portfolio).portfolio;

    for (const company of SNAPSHOT) {
      const real = new Set(closesFor(company.ticker).map((close) => toCents(close)));
      for (const price of portfolio.priceHistory[company.ticker]) {
        expect(real.has(price), `${company.ticker} ${price}`).toBe(true);
      }
    }
  });

  it('lines the whole market up on the same weeks', () => {
    let portfolio = createPortfolio(1000, 5);
    for (let week = 1; week <= MARKET_WEEKS; week++) portfolio = advanceWeek(portfolio).portfolio;
    const lengths = SNAPSHOT.map((c) => portfolio.priceHistory[c.ticker].length);
    expect(new Set(lengths).size).toBe(1);
    expect(lengths[0]).toBe(MARKET_WEEKS + 1);
  });

  it('picks a different stretch of history for a different seed', () => {
    const starts = new Set([1, 2, 3, 50, 999, 12345].map((seed) => createPortfolio(1000, seed).windowStart));
    expect(starts.size).toBeGreaterThan(3);
    for (const start of starts) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(HISTORY_WEEKS - MARKET_WEEKS);
    }
  });

  it('does not curate history for drama: windows spread across what is offered', () => {
    const starts = Array.from({ length: 300 }, (_, i) => windowStartFor(i * 7 + 3));
    const span = HISTORY_WEEKS - MARKET_WEEKS - 1 - FIRST_HONEST_WEEK;
    // Near the bottom of the offered range and near the top of it, rather than
    // of the whole file — the earliest weeks are excluded for a reason.
    expect(Math.min(...starts) - FIRST_HONEST_WEEK).toBeLessThan(span * 0.15);
    expect(Math.max(...starts) - FIRST_HONEST_WEEK).toBeGreaterThan(span * 0.7);
  });

  it('calls a bad week bad based on what the market did, not on a week number', () => {
    // Scripted crashes always landed on week 5. Real ones land wherever they
    // landed, so this asserts the *rule* rather than a date.
    const scareWeeks: number[] = [];
    for (let seed = 0; seed < 40; seed++) {
      let portfolio = createPortfolio(1000, seed * 13 + 1);
      for (let week = 1; week <= MARKET_WEEKS; week++) {
        const stepped = advanceWeek(portfolio);
        portfolio = stepped.portfolio;
        if (stepped.report.wasScare) {
          scareWeeks.push(stepped.report.week);
          // When the market is called down, most of it must actually be down.
          const falling = stepped.report.moves.filter((m) => m.changePct < 0);
          expect(falling.length).toBeGreaterThan(SNAPSHOT.length / 2);
        }
      }
    }
    expect(scareWeeks.length).toBeGreaterThan(10);
    expect(new Set(scareWeeks).size).toBeGreaterThan(4);
  });

  it('the jumpy company really is the jumpier one, over the whole history', () => {
    // "Volatility" is not a tuning knob any more, so this checks the claim
    // against five years of actual closes.
    const spread = (ticker: string) => {
      const closes = closesFor(ticker);
      const returns = closes.slice(1).map((close, i) => close / closes[i] - 1);
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      return Math.sqrt(returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length);
    };
    expect(spread('RBLX')).toBeGreaterThan(spread('KO'));
  });

  it('closes the market after the last week', () => {
    let portfolio = createPortfolio(1000);
    for (let week = 1; week <= MARKET_WEEKS; week++) portfolio = advanceWeek(portfolio).portfolio;
    expect(portfolio.status).toBe('closed');
    expect(buy(portfolio, 'AAPL', 10).ok).toBe(false);
  });

  it('reports a truthful gain against what was actually paid', () => {
    let portfolio = createPortfolio(1000);
    portfolio = buy(portfolio, 'KO', 300).portfolio;
    const basis = portfolio.holdings.KO.costBasis;
    portfolio = advanceWeek(portfolio).portfolio;
    const gain = holdingGain(portfolio, 'KO');
    expect(gain.dollars).toBeCloseTo(holdingValue(portfolio, 'KO') - basis, 2);
    expect(gain.percent).toBeCloseTo(gain.dollars / basis, 6);
  });
});

describe('drawdown discipline is measured, not asserted', () => {
  it('credits holding through a real fall back to level', () => {
    // Walk weeks until a holding has been deeply down and recovered.
    let portfolio = createPortfolio(1000, 99);
    portfolio = buy(portfolio, 'RBLX', 350).portfolio;
    for (let week = 1; week <= MARKET_WEEKS; week++) {
      portfolio = advanceWeek(portfolio).portfolio;
    }
    const holding = portfolio.holdings.RBLX;
    expect(holding).toBeDefined();
    // Either it went deeply down at some point, or it never did; both are fine,
    // but the bookkeeping must be self-consistent.
    if (holding.heldThroughDrawdown) {
      expect(holding.worstDrawdown).toBeLessThanOrEqual(-DRAWDOWN_THRESHOLD);
      expect(holding.soldWhileDown).toBe(false);
    }
  });

  it('records a panic sale when the kid bails out underwater', () => {
    let portfolio = createPortfolio(1000, 3);
    portfolio = buy(portfolio, 'RBLX', 300).portfolio;
    // Force the position underwater by hand rather than leaning on the RNG,
    // so this test is about the bookkeeping and not about one lucky seed.
    //
    // Derived from the real starting price rather than hardcoded: the prices are
    // fetched now, and a literal pair went from "30% down" to "slightly up" the
    // first time the data refreshed.
    const start = findCompany('RBLX')!.price;
    portfolio = {
      ...portfolio,
      priceHistory: { ...portfolio.priceHistory, RBLX: [start, start * 0.7] },
    };
    expect(holdingGain(portfolio, 'RBLX').percent).toBeLessThan(0);

    const sold = sell(portfolio, 'RBLX', 0.5);
    expect(sold.portfolio.holdings.RBLX.soldWhileDown).toBe(true);
    expect(summarisePortfolio(sold.portfolio, 1000).panicSold).toBe(true);
  });

  it('real history reliably puts a diversified kid underwater', () => {
    // The discipline lesson is only load-bearing if it actually happens. Under
    // the scripted engine it happened every time by construction. Under real
    // history it happens because markets do that, so this asserts a measured
    // floor rather than certainty — and deliberately does not curate the
    // windows to make it certain, because "markets always fall in three months"
    // would be its own kind of lie.
    let sawDrawdown = 0;
    const seeds = 60;
    for (let seed = 0; seed < seeds; seed++) {
      let portfolio = createPortfolio(1000, seed);
      for (const ticker of ['AAPL', 'KO', 'CMG']) {
        portfolio = buy(portfolio, ticker, 300).portfolio;
      }
      let deep = false;
      for (let week = 1; week <= MARKET_WEEKS; week++) {
        portfolio = advanceWeek(portfolio).portfolio;
        const worst = Math.min(
          ...['AAPL', 'KO', 'CMG'].map((t) => holdingGain(portfolio, t).percent),
        );
        if (worst <= -DRAWDOWN_THRESHOLD) deep = true;
      }
      if (deep) sawDrawdown++;
    }
    // Measured at 88% of all 250 windows across a plausible basket. The floor is
    // set below that so a data refresh does not turn a true statement into a
    // failing test, and well above chance so a regression would still show.
    expect(sawDrawdown / seeds).toBeGreaterThan(0.6);
  });

  it('does not accuse a kid who sold at a profit of panicking', () => {
    let portfolio = createPortfolio(1000);
    portfolio = buy(portfolio, 'KO', 300).portfolio;
    // Force a gain by hand so the test does not depend on the RNG.
    portfolio = {
      ...portfolio,
      priceHistory: { ...portfolio.priceHistory, KO: [65, 90] },
    };
    expect(holdingGain(portfolio, 'KO').percent).toBeGreaterThan(0);
    const sold = sell(portfolio, 'KO', 1);
    expect(summarisePortfolio(sold.portfolio, 1000).panicSold).toBe(false);
  });

  it('never flags a drawdown the kid never actually experienced', () => {
    const portfolio = createPortfolio(1000);
    expect(summarisePortfolio(portfolio, 1000).heldThroughDrawdown).toBe(false);
    expect(summarisePortfolio(portfolio, 1000).panicSold).toBe(false);
  });
});

describe('the portfolio summary is evidence', () => {
  it('starts flat and honest', () => {
    const summary = summarisePortfolio(createPortfolio(500), 500);
    expect(summary.currentValue).toBe(500);
    expect(summary.gainDollars).toBe(0);
    expect(summary.gainPercent).toBe(0);
    expect(summary.holdingsCount).toBe(0);
    expect(summary.diversified).toBe(false);
  });

  it('tracks research actually opened', () => {
    let portfolio = createPortfolio(500);
    portfolio = markResearched(portfolio, 'AAPL');
    portfolio = markResearched(portfolio, 'AAPL');
    portfolio = markResearched(portfolio, 'KO');
    expect(portfolio.researched).toEqual(['AAPL', 'KO']);
    expect(summarisePortfolio(portfolio, 500).researchedCount).toBe(2);
  });

  it('never lets the largest position exceed the cap through legal play', () => {
    let portfolio = createPortfolio(1200);
    for (const ticker of ['AAPL', 'KO', 'CMG', 'NFLX']) {
      const spend = maxSpendOn(portfolio, ticker);
      if (spend > 0) portfolio = buy(portfolio, ticker, spend).portfolio;
    }
    expect(summarisePortfolio(portfolio, 1200).largestPositionFraction).toBeLessThanOrEqual(
      MAX_POSITION_FRACTION + 1e-6,
    );
  });

  it('ranks companies by the same sum the kid used on the stands for sale', () => {
    const ranking = valueRanking();
    expect(ranking).toHaveLength(SNAPSHOT.length);
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1].score).toBeGreaterThanOrEqual(ranking[i].score);
    }
    // A loss-making company cannot rank on earnings yield.
    expect(ranking.find((r) => r.company.ticker === 'RBLX')!.pe).toBeNull();
  });
});

describe('no hindsight: the accounts are the ones that were public that week', () => {
  it('shows an earlier fiscal year when replaying an earlier week', () => {
    const early = fundamentalsAsOf(findCompany('AAPL')!, '2022-06-01');
    const late = fundamentalsAsOf(findCompany('AAPL')!, '2026-06-01');
    expect(early.fiscalYear < late.fiscalYear).toBe(true);
    expect(early.filedOn <= '2022-06-01').toBe(true);
  });

  it('never offers a week before every company has filed anything', () => {
    // Roblox listed part-way through the history, so the earliest weeks in the
    // file have no accounts for it at all. Those weeks are excluded rather than
    // shown with a filing from the future.
    expect(FIRST_HONEST_WEEK).toBeGreaterThan(0);
    for (let seed = 0; seed < 200; seed++) {
      expect(windowStartFor(seed)).toBeGreaterThanOrEqual(FIRST_HONEST_WEEK);
    }
  });

  it('never shows a filing from the future on any offered week', () => {
    for (const company of SNAPSHOT) {
      for (const week of [FIRST_HONEST_WEEK, FIRST_HONEST_WEEK + 40, HISTORY_WEEKS - 1]) {
        const date = weekDate(0, week);
        expect(fundamentalsAsOf(company, date).filedOn <= date, `${company.ticker} ${date}`).toBe(
          true,
        );
      }
    }
  });

  it('prices a P/E off the same week as the price', () => {
    // The bug this guards against: a real 2022 price divided by 2025 earnings
    // is a multiple nobody ever quoted, and it flatters or damns a company for
    // information the kid could not have had.
    const portfolio = createPortfolio(1000, 4242);
    const asOf = currentDate(portfolio);
    const apple = findCompany('AAPL')!;
    const price = currentPrice(portfolio, 'AAPL');
    const m = metricsFor(apple, price, asOf);

    expect(m.year.filedOn <= asOf).toBe(true);
    expect(m.pe).toBeCloseTo(price / (m.year.netIncomeM / m.year.sharesM), 4);
  });

  it('falls back to the newest accounts when no date is given', () => {
    const apple = findCompany('AAPL')!;
    expect(fundamentalsAsOf(apple).fiscalYearEnd).toBe(apple.fiscalYearEnd);
    expect(metricsFor(apple).year.netIncomeM).toBe(apple.netIncomeM);
  });

  it('keeps every company reasonable at every week of every window', () => {
    // A sweep, because a single bad annual row would only show up on one date.
    for (let seed = 0; seed < 12; seed++) {
      const portfolio = createPortfolio(1000, seed * 97 + 5);
      for (let week = 0; week <= MARKET_WEEKS; week++) {
        const asOf = weekDate(portfolio.windowStart, week);
        for (const company of SNAPSHOT) {
          const year = fundamentalsAsOf(company, asOf);
          expect(year.sharesM, `${company.ticker} ${asOf}`).toBeGreaterThan(0);
          expect(Number.isFinite(year.revenueM)).toBe(true);
          expect(year.filedOn <= asOf).toBe(true);
        }
      }
    }
  });
});
