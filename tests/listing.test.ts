import { describe, it, expect } from 'vitest';
import {
  MAX_FLOAT,
  MIN_FLOAT,
  PUBLIC_PREMIUM_WEEKS,
  SHARES,
  createListing,
  deriveListingInsights,
  floatChoices,
  floatPlan,
  founderStake,
  listCompany,
  listingComplete,
  listingOffer,
  marketCap,
  markListedWeek,
  sharePriceBridge,
} from '../src/lib/listing';
import { createOwnershipState, buyoutOffer } from '../src/lib/ownership';
import { GLOSSARY } from '../src/lib/glossary';
import type { DayRecord } from '../src/lib/simulation';

/** A week of steady days at a chosen daily profit. */
function history(dailyProfit: number, days = 14): DayRecord[] {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    weather: 'mild' as const,
    price: 1.6,
    cupsSold: 30,
    cupsWanted: 30,
    revenue: 48,
    profit: dailyProfit,
    cashAfter: 200,
  }));
}

const steady = history(10);
const own = createOwnershipState();

describe('what the whole thing is worth, twice', () => {
  it('is the same division the buyout was, one number bigger', () => {
    const offer = listingOffer(steady, own);
    expect(offer.value).toBeCloseTo(offer.weeklyProfit * offer.publicMultiple, 2);
    expect(offer.weeklyProfit).toBeCloseTo(70, 2);
  });

  it('always has the crowd paying more than the single buyer', () => {
    const offer = listingOffer(steady, own);
    const buyout = buyoutOffer(steady, own);
    expect(offer.publicMultiple).toBe(buyout.multiple + PUBLIC_PREMIUM_WEEKS);
    expect(offer.value).toBeGreaterThan(buyout.price);
  });

  it('gives a reason for the gap rather than a rule', () => {
    const offer = listingOffer(steady, own);
    expect(offer.reason).toMatch(/whole thing|bid against/i);
    expect(offer.reason).not.toMatch(/because we|the game/i);
  });

  it('divides by a thousand, which is the one division a kid can always do', () => {
    const offer = listingOffer(steady, own);
    expect(offer.shares).toBe(SHARES);
    expect(offer.pricePerShare).toBeCloseTo(offer.value / SHARES, 2);
  });

  it('carries the growth premium through from the buyout', () => {
    // A business whose recent week beats the one before it is worth more per
    // dollar of profit, and the listing inherits that rather than re-deriving.
    const growing = [...history(5, 7), ...history(14, 7)];
    const flat = history(9.5, 14);
    expect(listingOffer(growing, own).publicMultiple).toBeGreaterThan(
      listingOffer(flat, own).publicMultiple,
    );
  });

  it('puts a real business in the range real share prices live in', () => {
    for (const daily of [20, 40, 65]) {
      const price = listingOffer(history(daily), own).pricePerShare;
      expect(price).toBeGreaterThan(0.5);
      expect(price).toBeLessThan(60);
    }
  });
});

describe('a business that makes nothing is worth nothing, and says so', () => {
  /*
   * A multiple of nothing is nothing. Without this, a kid whose trailing week
   * lost money was shown a company worth $0 cut into a thousand pieces at
   * $0.00 each — arithmetically correct and completely absurd, on the biggest
   * screen in the arc.
   */
  it('refuses to price a losing week', () => {
    const losing = listingOffer(history(-4), own);
    expect(losing.worthAnything).toBe(false);
    expect(losing.value).toBe(0);
  });

  it('refuses to price a week that broke exactly even', () => {
    expect(listingOffer(history(0), own).worthAnything).toBe(false);
  });

  it('prices anything that made money, however little', () => {
    const tiny = listingOffer(history(1), own);
    expect(tiny.worthAnything).toBe(true);
    expect(tiny.pricePerShare).toBeGreaterThan(0);
  });

  it('scales all the way down without going strange', () => {
    // The fallback path exists so nobody gets stuck, and it delivers small
    // businesses to this screen. Small has to work, not just typical.
    for (const daily of [2, 5, 13]) {
      const offer = listingOffer(history(daily), own);
      const plan = floatPlan(offer, 0.3, own);
      expect(offer.pricePerShare).toBeGreaterThan(0);
      expect(plan.cashRaised).toBeGreaterThan(0);
      expect(plan.cashRaised).toBeCloseTo(plan.sharesSold * plan.pricePerShare, 2);
    }
  });
});

describe('the dial, and what moving it costs', () => {
  const offer = listingOffer(steady, own);

  it('raises more cash the more of the company goes', () => {
    const small = floatPlan(offer, 0.1, own);
    const big = floatPlan(offer, 0.5, own);
    expect(big.cashRaised).toBeGreaterThan(small.cashRaised);
    expect(big.youKeep).toBeLessThan(small.youKeep);
  });

  it('names the cost a first-time founder forgets', () => {
    const plan = floatPlan(offer, 0.3, own);
    // Not the cash. The profit that now belongs to somebody else, every week.
    expect(plan.weeklyProfitGivenUp).toBeCloseTo(offer.weeklyProfit * 0.3, 2);
  });

  it('adds up: shares sold at the price is the cash raised', () => {
    for (const fraction of floatChoices()) {
      const plan = floatPlan(offer, fraction, own);
      expect(plan.cashRaised).toBeCloseTo(plan.sharesSold * plan.pricePerShare, 2);
      expect(plan.sharesSold).toBe(Math.round(SHARES * plan.fraction));
      expect(plan.youKeep + plan.othersKeep).toBeCloseTo(1, 4);
    }
  });

  it('clamps to what the bank will allow', () => {
    expect(floatPlan(offer, 0, own).fraction).toBeCloseTo(MIN_FLOAT, 4);
    expect(floatPlan(offer, 0.95, own).fraction).toBeCloseTo(MAX_FLOAT, 4);
    expect(floatChoices()[0]).toBeCloseTo(MIN_FLOAT, 4);
  });

  it('will not let a founder sell what they already sold', () => {
    // Auntie Ro has 30% and cannot be sold twice.
    const diluted = { ...own, equitySoldPct: 0.3 };
    const plan = floatPlan(offer, 0.5, diluted);
    expect(plan.youKeep).toBeGreaterThanOrEqual(0);
    expect(plan.othersKeep).toBeLessThanOrEqual(1);
    expect(plan.othersKeep).toBeCloseTo(0.3 + plan.fraction, 4);
  });

  it('prices the piece they keep at the same price they sold at', () => {
    const plan = floatPlan(offer, 0.2, own);
    expect(plan.yourStakeValue).toBeCloseTo(offer.value * plan.youKeep, 2);
  });
});

describe('being public', () => {
  const offer = listingOffer(steady, own);
  const listed = listCompany(offer, floatPlan(offer, 0.3, own));

  it('starts at the price it floated at, owning what was kept', () => {
    expect(listed.listed).toBe(true);
    expect(listed.price).toBe(listed.ipoPrice);
    expect(listed.founderShare).toBeCloseTo(0.7, 4);
    expect(marketCap(listed)).toBeCloseTo(offer.value, 2);
    expect(founderStake(listed)).toBeCloseTo(offer.value * 0.7, 2);
  });

  it('keeps the float multiple separate from the one that re-rates', () => {
    /*
     * The parent report quotes the float's valuation against a multiple, and
     * for a while it used the live one — so it printed "$5130, 12.7 times
     * weekly profit" about a float struck at 14. Two figures that do not
     * divide into each other, in the report whose whole job is to be checked.
     */
    expect(listed.ipoMultiple).toBe(offer.publicMultiple);
    const after = markListedWeek(listed, listed.expected * 0.6).listing;
    expect(after.multiple).toBeLessThan(after.ipoMultiple);
    expect(after.ipoMultiple).toBe(listed.ipoMultiple);
    expect(after.ipoPrice).toBe(listed.ipoPrice);
    // And the float valuation still divides by the float multiple.
    expect(after.ipoPrice * after.shares).toBeCloseTo(offer.weeklyProfit * after.ipoMultiple, 1);
  });

  it('is not finished until a week has been lived through', () => {
    expect(listingComplete(createListing())).toBe(false);
    expect(listingComplete(listed)).toBe(false);
    expect(listingComplete(markListedWeek(listed, 70).listing)).toBe(true);
  });

  it('goes up on a week that beat what the market expected', () => {
    const { listing, move } = markListedWeek(listed, 90);
    expect(move.actual).toBe(90);
    expect(move.expected).toBeCloseTo(70, 2);
    expect(listing.price).toBeGreaterThan(listed.price);
    expect(move.change).toBeGreaterThan(0);
  });

  it('goes down on a week that missed, and says the business is the business', () => {
    const { listing, move } = markListedWeek(listed, 45);
    expect(listing.price).toBeLessThan(listed.price);
    expect(move.change).toBeLessThan(0);
    expect(move.reason).toMatch(/short/i);
  });

  it('barely moves on a week that landed where they thought', () => {
    const { move } = markListedWeek(listed, listed.expected);
    expect(Math.abs(move.change)).toBeLessThan(0.005);
    expect(move.reason).toMatch(/what they were expecting/i);
  });

  it('always attributes the move to two numbers it also prints', () => {
    /*
     * The one rule this module has. A price move a kid cannot account for
     * teaches that prices are weather, which is the single most expensive
     * belief this product could install by accident.
     */
    for (const actual of [20, 45, 70, 90, 150]) {
      const { move } = markListedWeek(listed, actual);
      expect(move.reason).toContain(actual.toFixed(2));
      expect(move.expected).toBeCloseTo(listed.expected, 2);
      expect(move.priceBefore).toBe(listed.price);
    }
  });

  it('always moves the price less than the profit moved', () => {
    /*
     * The most useful true thing about a share price, and the reason
     * `RERATE_SENSITIVITY` is as small as it is: two things move on one week's
     * news — what the market expects, and how many weeks of it they will pay —
     * and they multiply. Twice the profit is not twice the company.
     */
    for (const factor of [0.4, 0.6, 0.8, 1.25, 1.5, 2, 3]) {
      const { move } = markListedWeek(listed, listed.expected * factor);
      const surprise = Math.abs(factor - 1);
      expect(Math.abs(move.change)).toBeLessThan(surprise);
      expect(Math.sign(move.change)).toBe(Math.sign(factor - 1));
    }
  });

  it('keeps the multiple inside the range anybody ever pays', () => {
    let listing = listed;
    for (let week = 0; week < 12; week += 1) listing = markListedWeek(listing, 1).listing;
    expect(listing.multiple).toBeGreaterThanOrEqual(4);

    let boom = listed;
    for (let week = 0; week < 12; week += 1) boom = markListedWeek(boom, boom.expected * 3).listing;
    expect(boom.multiple).toBeLessThanOrEqual(20);
  });

  it('records every week, so a stake can be read against the float', () => {
    let listing = listed;
    for (const actual of [80, 60, 75]) listing = markListedWeek(listing, actual).listing;
    expect(listing.weeks.map((week) => week.week)).toEqual([1, 2, 3]);
    expect(listing.weeks[2].priceBefore).toBeCloseTo(listing.weeks[1].priceAfter, 2);
  });

  it('reconciles the price back to the whole company', () => {
    const bridge = sharePriceBridge(listed);
    expect(bridge.cap).toContain(String(SHARES));
    expect(bridge.pe).toBeGreaterThan(0);
    // A weekly multiple restated yearly: 14 weeks of profit is well under a
    // year of it, so the yearly P/E has to be smaller than the weekly one.
    expect(bridge.pe).toBeLessThan(listed.multiple);
  });
});

describe('the words the listing earns', () => {
  it('hands over nothing at all before there is a listing', () => {
    expect(deriveListingInsights(createListing(), null)).toEqual([]);
  });

  it('only ever uses ids the glossary actually has', () => {
    const offer = listingOffer(steady, own);
    const listing = listCompany(offer, floatPlan(offer, 0.3, own));
    const ids = new Set(GLOSSARY.map((word) => word.id));
    for (const insight of deriveListingInsights(listing, null)) {
      expect(ids.has(insight.id)).toBe(true);
      expect(insight.evidence.length).toBeGreaterThan(20);
      expect(insight.carriesForward.length).toBeGreaterThan(20);
    }
  });

  it('quotes the kid\'s own figures rather than an example', () => {
    const offer = listingOffer(steady, own);
    const listing = listCompany(offer, floatPlan(offer, 0.3, own));
    const found = deriveListingInsights(listing, null);
    const shares = found.find((insight) => insight.id === 'shares')!;
    expect(shares.evidence).toContain('300');
    const price = found.find((insight) => insight.id === 'share-price')!;
    expect(price.evidence).toContain(listing.ipoPrice.toFixed(2));
  });

  it('puts the reason for the first move next to the price it moved to', () => {
    const offer = listingOffer(steady, own);
    const listing = listCompany(offer, floatPlan(offer, 0.3, own));
    const marked = markListedWeek(listing, 95);
    const found = deriveListingInsights(marked.listing, marked.move);
    const price = found.find((insight) => insight.id === 'share-price')!;
    expect(price.evidence).toContain(marked.move.priceAfter.toFixed(2));
    expect(price.evidence).toContain('95.00');
  });
});
