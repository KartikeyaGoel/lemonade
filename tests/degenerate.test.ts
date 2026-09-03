/**
 * Every money function, handed the input nobody expected.
 *
 * An audit of `src/lib` turned up about a dozen divisions with no guard on the
 * denominator — an average over `history.length`, a share count, a share
 * price, a mean revenue. Most of them are unreachable in normal play, which is
 * exactly why nothing had ever tried: the denominator is only zero on a
 * business with no days, a company with no revenue, or a portfolio somebody
 * hand-edited.
 *
 * "Unreachable" is a claim about today's callers, though, and these are
 * exported functions in a pure module. So rather than argue about reachability
 * this calls each one with its degenerate input and insists the answer is a
 * number a screen could print. `NaN` and `Infinity` render perfectly happily as
 * `$NaN` and `$Infinity`.
 */
import { describe, it, expect } from 'vitest';
import {
  buy,
  createPortfolio,
  currentPrice,
  holdingGain,
  positionFraction,
  sell,
  summarisePortfolio,
  totalValue,
} from '../src/lib/market';
import { SNAPSHOT } from '../src/lib/companies';
import { metricsFor } from '../src/lib/companies';
import {
  growthRate,
  regularShareOfSales,
  revenueSteadiness,
  trailingWeeklyProfit,
} from '../src/lib/business';
import { buyoutOffer, createOwnershipState, projectedProfit } from '../src/lib/ownership';
import { listingOffer, floatPlan, marketCap, sharePriceBridge, createListing } from '../src/lib/listing';
import { weekSummary, type DayRecord } from '../src/lib/simulation';
import { bins, findings, howClose, trueCurve, classWeek, type Entry } from '../src/lib/classroom';
import { record } from '../src/lib/playbook';

/** Every number in a value, so nothing can hide behind a nested object. */
function finiteEverywhere(label: string, value: unknown, path = ''): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${label}${path} is ${value}`).toBe(true);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => finiteEverywhere(label, v, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) finiteEverywhere(label, v, `${path}.${k}`);
  }
}

const EMPTY: DayRecord[] = [];

describe('a business with no history at all', () => {
  it('averages, growth and steadiness are all still numbers', () => {
    finiteEverywhere('trailingWeeklyProfit', trailingWeeklyProfit(EMPTY));
    finiteEverywhere('growthRate', growthRate(EMPTY));
    finiteEverywhere('revenueSteadiness', revenueSteadiness(EMPTY));
    finiteEverywhere('regularShareOfSales', regularShareOfSales(EMPTY, 0));
  });

  it('the week summary is a number even with nothing in the week', () => {
    finiteEverywhere('weekSummary', weekSummary(EMPTY));
  });

  it('a buyout offer for a business with no days is still printable', () => {
    finiteEverywhere('buyoutOffer', buyoutOffer(EMPTY, createOwnershipState()));
  });

  it('a listing offer for a business with no days is still printable', () => {
    const offer = listingOffer(EMPTY, createOwnershipState());
    finiteEverywhere('listingOffer', offer);
    // And every float of it, including the extremes of the dial.
    for (const fraction of [0, 0.1, 0.3, 0.5, 1]) {
      finiteEverywhere(`floatPlan(${fraction})`, floatPlan(offer, fraction, createOwnershipState()));
    }
  });

  it('a listing with no shares does not divide by zero', () => {
    const zeroShares = { ...createListing(), listed: true, shares: 0, price: 1, expected: 100, multiple: 9 };
    finiteEverywhere('marketCap', marketCap(zeroShares));
    finiteEverywhere('sharePriceBridge', sharePriceBridge(zeroShares));
  });

  /*
   * A business whose revenue was zero every day. `steadiness` divides the
   * standard deviation by the mean, and the mean is zero.
   */
  it('a business that took no money is still steady or not', () => {
    const noRevenue: DayRecord[] = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      weather: 'mild',
      forecast: 'probably-mild',
      price: 1.5,
      cupsMade: 0,
      cupsSold: 0,
      cupsWanted: 0,
      revenue: 0,
      profit: -5,
      fixedCost: 5,
      cashAfter: 20,
      spoiledLemons: 0,
      marketShare: 1,
      seedBefore: 1,
      subscriberCups: 0,
    }));
    finiteEverywhere('revenueSteadiness(no revenue)', revenueSteadiness(noRevenue));
    finiteEverywhere('growthRate(no revenue)', growthRate(noRevenue));
    finiteEverywhere('weekSummary(no revenue)', weekSummary(noRevenue));
  });

  it('a stand for sale that is not growing at all', () => {
    for (const weeklyGrowth of [0, -1, 1e-12, -1e-12]) {
      finiteEverywhere(
        `projectedProfit(g=${weeklyGrowth})`,
        projectedProfit({ weeklyProfit: 100, weeklyGrowth, askingMultiple: 8 } as never),
      );
    }
  });
});

describe('a portfolio at its edges', () => {
  it('is printable when empty', () => {
    const p = createPortfolio(0, 4242);
    finiteEverywhere('totalValue', totalValue(p));
    finiteEverywhere('summarisePortfolio(0 seed)', summarisePortfolio(p, 0));
    finiteEverywhere('positionFraction', positionFraction(p, SNAPSHOT[0].ticker));
  });

  it('reports a gain when nothing was paid for a holding', () => {
    const p = createPortfolio(500, 4242);
    const withFree = {
      ...p,
      holdings: {
        [SNAPSHOT[0].ticker]: {
          ticker: SNAPSHOT[0].ticker,
          shares: 1,
          costBasis: 0,
          worstDrawdown: 0,
          soldWhileDown: false,
          heldThroughDrawdown: false,
        },
      },
    };
    finiteEverywhere('holdingGain(costBasis 0)', holdingGain(withFree, SNAPSHOT[0].ticker));
    finiteEverywhere('positionFraction(costBasis 0)', positionFraction(withFree, SNAPSHOT[0].ticker));
    finiteEverywhere('summarise(costBasis 0)', summarisePortfolio(withFree, 0));
  });

  /*
   * The one that would be a real money bug rather than a cosmetic one.
   * `buy` computes `shares = spend / price` with no guard, so a price of zero
   * buys an infinite number of shares — and the holding is then permanently
   * unprintable and worth `Infinity`. Real prices are never zero; a portfolio
   * that has been hand-edited, or a company whose week is missing from the
   * data, both are.
   */
  it('refuses to buy at a price of zero rather than buying infinity', () => {
    const p = createPortfolio(500, 4242);
    const ticker = SNAPSHOT[0].ticker;
    const zeroPriced = { ...p, priceHistory: { ...p.priceHistory, [ticker]: [0] } };
    expect(currentPrice(zeroPriced, ticker)).toBe(0);

    const result = buy(zeroPriced, ticker, 100);
    if (result.ok) {
      finiteEverywhere('buy at zero', result.portfolio.holdings[ticker]);
      expect(
        Number.isFinite(result.portfolio.holdings[ticker].shares),
        'bought an infinite number of shares',
      ).toBe(true);
    }
    // Either it refused, or it bought a finite number. Never Infinity.
    expect(result.ok === false || Number.isFinite(result.portfolio.holdings[ticker]?.shares)).toBe(
      true,
    );
  });

  it('sells a fraction of nothing without complaint', () => {
    const p = createPortfolio(500, 4242);
    for (const fraction of [0, 0.5, 1, 2, -1, NaN]) {
      const r = sell(p, SNAPSHOT[0].ticker, fraction);
      finiteEverywhere(`sell(${fraction})`, r.portfolio.cash);
    }
  });
});

describe('a company whose figures are degenerate', () => {
  it('every company in the snapshot has printable metrics', () => {
    for (const company of SNAPSHOT) {
      finiteEverywhere(`metricsFor(${company.ticker})`, metricsFor(company, 100));
    }
  });

  it('a company with no revenue and no shares is still printable', () => {
    const broken = { ...SNAPSHOT[0], revenueM: 0, netIncomeM: 0, sharesM: 0 };
    finiteEverywhere('metricsFor(all zeroes)', metricsFor(broken as never, 100));
    finiteEverywhere('metricsFor(price 0)', metricsFor(broken as never, 0));
  });
});

describe('a classroom board and a playbook with nothing in them', () => {
  /*
   * A teacher who opens the board before anybody has typed a result. Every
   * figure on that screen is an average over the entries.
   */
  it('summarises an empty board', () => {
    const none: Entry[] = [];
    finiteEverywhere('bins([])', bins(none));
    finiteEverywhere('findings([])', findings(none));
    const curve = trueCurve(classWeek(4242));
    finiteEverywhere('trueCurve', curve);
    expect(() => howClose(none, curve)).not.toThrow();
    expect(() => howClose(none, [])).not.toThrow();
  });

  it('records a playbook with no rules', () => {
    finiteEverywhere('record(no rules)', record({ name: '', ruleIds: [] }));
  });

  it('records a playbook whose rules exclude everything', () => {
    // Rules that no company can satisfy: the backtest buys nothing, so every
    // per-name division has a zero denominator.
    finiteEverywhere(
      'record(impossible rules)',
      record({ name: 'Impossible', ruleIds: ['nothing-dear', 'keeps-a-lot', 'getting-better', 'profit-only'] }),
    );
  });
});
