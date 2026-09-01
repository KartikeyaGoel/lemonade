import { describe, it, expect } from 'vitest';
import {
  BASE_MULTIPLE,
  EQUITY_OFFER_WEEKS,
  EQUITY_SLICE,
  GROWING_MULTIPLE,
  HOLD_WEEKS,
  SHRINKING_MULTIPLE,
  STANDS_FOR_SALE,
  acceptBuyout,
  acceptEquity,
  askingPrice,
  bestDeal,
  buyoutOffer,
  createOwnershipState,
  dealValue,
  declineEquity,
  equityOffer,
  judgeDealChoice,
  paybackWeeks,
  peBridge,
  projectedProfit,
  rankDeals,
  recordDealChoice,
  recordInvestorCut,
  worstDeal,
} from '../src/lib/ownership';
import { createInitialState, orderForTargetCups, runDay, type DayRecord } from '../src/lib/simulation';

/** A steady business earning about $20 a day. */
function steadyHistory(profitPerDay = 20, days = 10): DayRecord[] {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    weather: 'mild' as const,
    price: 1.6,
    cupsSold: 30,
    cupsWanted: 30,
    revenue: 48,
    profit: profitPerDay,
    cashAfter: 100,
  }));
}

function growingHistory(days = 16): DayRecord[] {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    weather: 'mild' as const,
    price: 1.6,
    cupsSold: 30,
    cupsWanted: 30,
    revenue: 48,
    profit: 10 + i * 3,
    cashAfter: 100,
  }));
}

function shrinkingHistory(days = 16): DayRecord[] {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    weather: 'mild' as const,
    price: 1.6,
    cupsSold: 30,
    cupsWanted: 30,
    revenue: 48,
    profit: 60 - i * 3,
    cashAfter: 100,
  }));
}

describe('the equity offer teaches dilution by arithmetic', () => {
  it('prices the slice as a stated number of weeks of that slice', () => {
    const offer = equityOffer(steadyHistory(20));
    // $20/day => $140/week. 20% of that is $28. Five weeks of it is $140.
    expect(offer.slice).toBe(EQUITY_SLICE);
    expect(offer.weeklyCost).toBeCloseTo(28, 2);
    expect(offer.cash).toBeCloseTo(28 * EQUITY_OFFER_WEEKS, 2);
    expect(offer.paybackWeeks).toBe(EQUITY_OFFER_WEEKS);
  });

  it('shows a payback the kid can check: cash divided by weekly cost', () => {
    const offer = equityOffer(steadyHistory(20));
    expect(offer.cash / offer.weeklyCost).toBeCloseTo(offer.paybackWeeks, 6);
  });

  it('taking it hands over a fifth of every future profit', () => {
    const offer = equityOffer(steadyHistory(20));
    const after = acceptEquity(createOwnershipState(), offer);
    expect(after.equitySoldPct).toBe(0.2);
    expect(after.equityCashReceived).toBeCloseTo(offer.cash, 2);
  });

  it('declining costs nothing and is remembered', () => {
    const after = declineEquity(createOwnershipState());
    expect(after.equitySoldPct).toBe(0);
    expect(after.equityOfferSeen).toBe(true);
  });

  it('the investor really does take their cut, every profitable day', () => {
    const state = { ...createInitialState(1), cash: 300 };
    const plain = runDay(state, { ...orderForTargetCups(state, 28), price: 1.6 });
    const diluted = runDay(state, { ...orderForTargetCups(state, 28), price: 1.6 }, { equityShare: 0.2 });

    expect(diluted.investorCut).toBeGreaterThan(0);
    expect(diluted.investorCut).toBeCloseTo(plain.profitBeforeEquity * 0.2, 2);
    expect(diluted.profit).toBeLessThan(plain.profit);
    expect(diluted.profit).toBeCloseTo(plain.profit * 0.8, 1);
  });

  it('takes nothing on a day that lost money — you cannot dilute a loss', () => {
    const state = { ...createInitialState(1), cash: 300 };
    const bad = runDay(state, { ...orderForTargetCups(state, 28), price: 5 }, { equityShare: 0.2 });
    expect(bad.profit).toBeLessThan(0);
    expect(bad.investorCut).toBe(0);
  });

  it('keeps a running total of what dilution has actually cost', () => {
    let ownership = createOwnershipState();
    ownership = recordInvestorCut(ownership, 5);
    ownership = recordInvestorCut(ownership, 7.5);
    ownership = recordInvestorCut(ownership, 0);
    expect(ownership.investorPaidToDate).toBeCloseTo(12.5, 2);
  });
});

describe('the buyout offer is one division the kid can do', () => {
  it('is exactly multiple times trailing weekly profit', () => {
    const history = steadyHistory(20);
    const offer = buyoutOffer(history, createOwnershipState());
    expect(offer.price).toBeCloseTo(offer.weeklyProfit * offer.multiple, 2);
  });

  it('pays a growth premium for a business whose profits are climbing', () => {
    const growing = buyoutOffer(growingHistory(), createOwnershipState());
    const steady = buyoutOffer(steadyHistory(20), createOwnershipState());
    expect(growing.multiple).toBe(GROWING_MULTIPLE);
    expect(steady.multiple).toBe(BASE_MULTIPLE);
    expect(growing.multiple).toBeGreaterThan(steady.multiple);
    expect(growing.reason).toContain('climbing');
  });

  it('marks down a business whose profits are slipping', () => {
    const offer = buyoutOffer(shrinkingHistory(), createOwnershipState());
    expect(offer.multiple).toBe(SHRINKING_MULTIPLE);
    expect(offer.reason).toContain('slipping');
  });

  it('hands the investor their slice of the sale price', () => {
    const history = steadyHistory(20);
    const diluted = acceptEquity(createOwnershipState(), equityOffer(history));
    const offer = buyoutOffer(history, diluted);
    expect(offer.investorShare).toBeCloseTo(offer.price * 0.2, 2);
    expect(offer.proceeds).toBeCloseTo(offer.price * 0.8, 2);
    expect(offer.proceeds + offer.investorShare).toBeCloseTo(offer.price, 2);
  });

  it('gives the whole lot to a kid who never sold a slice', () => {
    const offer = buyoutOffer(steadyHistory(20), createOwnershipState());
    expect(offer.investorShare).toBe(0);
    expect(offer.proceeds).toBeCloseTo(offer.price, 2);
  });

  it('records the sale', () => {
    const history = steadyHistory(20);
    const offer = buyoutOffer(history, createOwnershipState());
    const sold = acceptBuyout(createOwnershipState(), offer);
    expect(sold.buyoutAccepted).toBe(true);
    expect(sold.buyoutProceeds).toBeCloseTo(offer.proceeds, 2);
    expect(sold.buyoutMultiple).toBe(offer.multiple);
  });

  it('never offers a negative price for a business that lost money', () => {
    const losing = steadyHistory(-10);
    expect(buyoutOffer(losing, createOwnershipState()).price).toBe(0);
  });
});

describe('comparison shopping: the growing one costs the most, and is still best', () => {
  it('asking price is the multiple times weekly profit, for every stand', () => {
    for (const stand of STANDS_FOR_SALE) {
      expect(askingPrice(stand)).toBeCloseTo(stand.weeklyProfit * stand.askingMultiple, 2);
      expect(paybackWeeks(stand)).toBe(stand.askingMultiple);
    }
  });

  it('all three earn the same today, so only price and growth differ', () => {
    const profits = new Set(STANDS_FOR_SALE.map((s) => s.weeklyProfit));
    expect(profits.size).toBe(1);
  });

  it('the best deal is the growing one, and it is not the cheapest', () => {
    const best = bestDeal();
    expect(best.id).toBe('sam');
    const cheapest = [...STANDS_FOR_SALE].sort((a, b) => a.askingMultiple - b.askingMultiple)[0];
    expect(best.id).not.toBe(cheapest.id);
    expect(best.askingMultiple).toBeGreaterThan(cheapest.askingMultiple);
  });

  it('the worst deal is the expensive steady one, which is the pass-on-price test', () => {
    expect(worstDeal().id).toBe('kiosk');
  });

  it('"cheap is good" gets the wrong answer', () => {
    const cheapest = [...STANDS_FOR_SALE].sort((a, b) => a.askingMultiple - b.askingMultiple)[0];
    expect(judgeDealChoice(cheapest.id).correct).toBe(false);
  });

  it('"expensive means quality" gets the wrong answer too', () => {
    const dearest = [...STANDS_FOR_SALE].sort((a, b) => b.askingMultiple - a.askingMultiple)[0];
    expect(judgeDealChoice(dearest.id).correct).toBe(false);
  });

  it('projects profit with growth compounding, not a flat line', () => {
    const growing = STANDS_FOR_SALE.find((s) => s.id === 'sam')!;
    const flat = STANDS_FOR_SALE.find((s) => s.id === 'kiosk')!;
    expect(projectedProfit(growing)).toBeGreaterThan(growing.weeklyProfit * HOLD_WEEKS);
    expect(projectedProfit(flat)).toBeCloseTo(flat.weeklyProfit * HOLD_WEEKS, 2);
  });

  it('a shrinking business collects less than its headline suggests', () => {
    const shrinking = STANDS_FOR_SALE.find((s) => s.id === 'bella')!;
    expect(projectedProfit(shrinking)).toBeLessThan(shrinking.weeklyProfit * HOLD_WEEKS);
  });

  it('value is profit collected minus price paid, and ranks the board', () => {
    const ranked = rankDeals();
    for (let i = 1; i < ranked.length; i++) {
      expect(dealValue(ranked[i - 1])).toBeGreaterThanOrEqual(dealValue(ranked[i]));
    }
    expect(ranked[0].id).toBe('sam');
  });

  it('the reveal is arithmetic on every option, not just the one they picked', () => {
    const verdict = judgeDealChoice('bella');
    expect(verdict.rows).toHaveLength(STANDS_FOR_SALE.length);
    for (const row of verdict.rows) {
      expect(row.price).toBeCloseTo(row.stand.weeklyProfit * row.stand.askingMultiple, 2);
      expect(row.value).toBeCloseTo(row.projected - row.price, 2);
    }
    expect(verdict.rows.filter((r) => r.isBest)).toHaveLength(1);
  });

  it('explains a wrong answer using that answer\'s own numbers', () => {
    expect(judgeDealChoice('kiosk').lesson).toContain('25');
    expect(judgeDealChoice('bella').lesson.toLowerCase()).toContain('cheap');
  });

  it('credits passing on the overpriced one, even if the pick was not perfect', () => {
    expect(recordDealChoice(createOwnershipState(), 'bella').passedOnOverpriced).toBe(true);
    expect(recordDealChoice(createOwnershipState(), 'sam').passedOnOverpriced).toBe(true);
    expect(recordDealChoice(createOwnershipState(), 'kiosk').passedOnOverpriced).toBe(false);
  });
});

describe('the PE bridge is generated from the kid\'s own sale', () => {
  it('states the division both ways, with real numbers', () => {
    const offer = buyoutOffer(steadyHistory(20), createOwnershipState());
    const bridge = peBridge(offer);
    expect(bridge.ratioLine).toContain(String(offer.multiple));
    expect(bridge.ratioLine).toContain('÷');
    expect(bridge.standLine).toContain(offer.price.toFixed(2));
    // Restated as a payback period, and the unit is named explicitly so a kid
    // does not carry a weekly multiple into a market quoted in years.
    expect(bridge.yieldLine).toContain(`${offer.multiple} weeks`);
    expect(bridge.yieldLine).toContain('years instead of weeks');
  });

  it('never divides by zero on a stand that earned nothing', () => {
    const bridge = peBridge(buyoutOffer(steadyHistory(0), createOwnershipState()));
    expect(bridge.yieldLine.length).toBeGreaterThan(10);
    expect(bridge.ratioLine).toContain('÷');
  });
});
