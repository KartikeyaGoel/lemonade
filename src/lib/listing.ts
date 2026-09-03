/**
 * Stage 4 — going public.
 *
 * This is where the product's own promise finally points at itself. The whole
 * game exists to say *every stock is somebody else's lemonade stand*, and until
 * now a child met their first share price on Apple, in the market, having never
 * once had one of their own. That is the wrong way round. A kid who has priced
 * their own company, cut it into shares, sold some of them and then watched the
 * price move on a bad week has already met everything the market is going to
 * ask of them, at a scale they can hold in their head.
 *
 * The decision that ends Stage 4 is not "sell or don't". It is:
 *
 *   Sell all of it to one buyer at 8x, or a slice of it to a thousand people
 *   at 11x and keep running it.
 *
 * That is the actual difference between selling up and going public, it is a
 * decision with two reasonable answers, and it keeps the arithmetic bridge in
 * PRODUCT.md §9 exactly where it was — the buyout multiple is still the sum the
 * kid does by hand, and the share price is now that same sum divided again.
 *
 * Pure module. No React, no I/O.
 */

import { round2, type DayRecord, type Insight } from './simulation';
import { growthRate, trailingWeeklyProfit } from './business';
import { buyoutOffer, type BuyoutOffer, type OwnershipState } from './ownership';

/* ------------------------------------------------------------------ *
 * Shares
 * ------------------------------------------------------------------ */

/**
 * How many pieces the company is cut into.
 *
 * A thousand, because the arithmetic has to be doable in a child's head and
 * dividing by a thousand is the one division that always is. It also puts the
 * share price of a real Stage 3 business in the three-to-eight-dollar range,
 * which is the range actual share prices live in — a company cut into ten
 * pieces would price each at six hundred dollars and teach nothing.
 */
export const SHARES = 1000;

/**
 * What a crowd pays over what one buyer pays, in weeks of profit.
 *
 * Not a fudge factor. One buyer is taking on the whole thing — the lease, the
 * staff, the early mornings — so they want it cheap enough to be worth the
 * trouble. A thousand people buying one share each are buying nothing but a
 * slice of the profit, and they are bidding against each other for it. That is
 * why companies go public rather than sell up, and it is stated to the kid as a
 * reason rather than a rule.
 */
export const PUBLIC_PREMIUM_WEEKS = 3;

/** The least and most of the company the bank will let a founder float. */
export const MIN_FLOAT = 0.1;
export const MAX_FLOAT = 0.5;
export const FLOAT_STEP = 0.05;

/* ------------------------------------------------------------------ *
 * The offer
 * ------------------------------------------------------------------ */

export interface ListingOffer {
  /** What the business has been earning a week. The kid's own number. */
  weeklyProfit: number;
  /** What one buyer would pay per week of profit. */
  buyoutMultiple: number;
  /** What the public will pay per week of profit. Always the higher one. */
  publicMultiple: number;
  /** publicMultiple x weeklyProfit. The whole company. */
  value: number;
  shares: number;
  /** value / shares. This is a share price, and it is theirs. */
  pricePerShare: number;
  /** What selling the lot to one buyer would put in their pocket instead. */
  buyout: BuyoutOffer;
  growth: number | null;
  /** Why the crowd pays more, in the kid's terms. */
  reason: string;
  /**
   * Whether there is anything here to sell at all.
   *
   * A multiple of nothing is nothing, so a kid whose trailing week lost money
   * would be shown a company worth $0 cut into a thousand pieces at $0.00 each
   * — three figures that are arithmetically correct and completely absurd, on
   * the biggest screen in the arc. Nobody buys a business that does not make
   * money, and saying so is a better lesson than a row of zeroes.
   *
   * It is escapable by doing the one thing the whole game has been teaching,
   * which is why it needs no clock: the week is a trailing average, so one
   * decent week clears it.
   */
  worthAnything: boolean;
}

export function listingOffer(history: DayRecord[], ownership: OwnershipState): ListingOffer {
  const buyout = buyoutOffer(history, ownership);
  const weeklyProfit = trailingWeeklyProfit(history);
  const publicMultiple = buyout.multiple + PUBLIC_PREMIUM_WEEKS;
  const value = round2(Math.max(0, weeklyProfit) * publicMultiple);
  return {
    weeklyProfit,
    buyoutMultiple: buyout.multiple,
    publicMultiple,
    value,
    shares: SHARES,
    pricePerShare: round2(value / SHARES),
    buyout,
    growth: growthRate(history),
    worthAnything: weeklyProfit > 0,
    reason:
      'One buyer takes the whole thing on, so they want it cheap. A thousand people buying one piece each only want the profit, and they bid against each other for it.',
  };
}

/* ------------------------------------------------------------------ *
 * The dial
 *
 * PRODUCT.md §4: the kid must be able to fiddle. A fixed slice on a card is
 * something to read; a slice they choose, with the three consequences updating
 * as they drag it, is a decision. The three numbers are cash today, the piece
 * they keep, and the profit they will be handing over every week from now on —
 * and the third one is the one a first-time founder forgets.
 * ------------------------------------------------------------------ */

export interface FloatPlan {
  /** Fraction of the company sold to the public. */
  fraction: number;
  sharesSold: number;
  pricePerShare: number;
  /** What lands in the bank today. */
  cashRaised: number;
  /** The share of the company the kid still owns, after any earlier investor. */
  youKeep: number;
  /** Everyone else's share: the public, plus whoever bought in earlier. */
  othersKeep: number;
  /** Profit a week that now belongs to somebody else. Every week. Forever. */
  weeklyProfitGivenUp: number;
  /** What the piece they keep is worth at the listing price. */
  yourStakeValue: number;
}

export function floatPlan(
  offer: ListingOffer,
  fraction: number,
  ownership: OwnershipState,
): FloatPlan {
  const alreadySold = ownership.equitySoldPct;
  // A founder cannot sell what they no longer own.
  const cap = Math.min(MAX_FLOAT, Math.max(0, 1 - alreadySold - MIN_FLOAT));
  const f = Math.min(Math.max(fraction, MIN_FLOAT), Math.max(MIN_FLOAT, cap));
  const sharesSold = Math.round(SHARES * f);
  const cashRaised = round2(sharesSold * offer.pricePerShare);
  const youKeep = round2(1 - alreadySold - f);
  return {
    fraction: f,
    sharesSold,
    pricePerShare: offer.pricePerShare,
    cashRaised,
    youKeep,
    othersKeep: round2(alreadySold + f),
    weeklyProfitGivenUp: round2(offer.weeklyProfit * (alreadySold + f)),
    yourStakeValue: round2(offer.value * youKeep),
  };
}

/** Every slice the dial can stop on. */
export function floatChoices(): number[] {
  const out: number[] = [];
  for (let f = MIN_FLOAT; f <= MAX_FLOAT + 1e-9; f += FLOAT_STEP) out.push(round2(f));
  return out;
}

/* ------------------------------------------------------------------ *
 * Being listed
 * ------------------------------------------------------------------ */

export interface PriceMove {
  week: number;
  /** What the company actually earned that week. */
  actual: number;
  /** What the market was expecting it to earn. */
  expected: number;
  multipleBefore: number;
  multipleAfter: number;
  priceBefore: number;
  priceAfter: number;
  /** priceAfter / priceBefore - 1. */
  change: number;
  /**
   * Why it moved, in one sentence, built from the two numbers above it.
   *
   * Never "the market was nervous". A price move a kid cannot attribute is a
   * price move that teaches them prices are weather, which is the single most
   * expensive thing this product could accidentally install.
   */
  reason: string;
}

export interface Listing {
  listed: boolean;
  shares: number;
  /** Fraction of the company held by the public. */
  floated: number;
  /** The price the shares first sold at. Never changes. */
  ipoPrice: number;
  /**
   * Weeks of profit the float was priced at. Never changes.
   *
   * Kept separately from `multiple`, which re-rates every week. The parent
   * report printed *"valued the company at $5130 — 12.7 times weekly profit"*
   * using the live one, and $5130 is not 12.7 weeks of anything the business
   * earned — the float was struck at 14. Two figures that do not reconcile,
   * in the report whose whole job is to be checkable.
   */
  ipoMultiple: number;
  /** The price today. */
  price: number;
  /** What the market currently expects a week. */
  expected: number;
  /** Weeks of profit the market is currently paying. */
  multiple: number;
  /** The kid's own share, after the float and any earlier investor. */
  founderShare: number;
  /** Cash the float put in the bank. */
  raised: number;
  weeks: PriceMove[];
}

export function createListing(): Listing {
  return {
    listed: false,
    shares: SHARES,
    floated: 0,
    ipoPrice: 0,
    ipoMultiple: 0,
    price: 0,
    expected: 0,
    multiple: 0,
    founderShare: 1,
    raised: 0,
    weeks: [],
  };
}

export function listCompany(offer: ListingOffer, plan: FloatPlan): Listing {
  return {
    listed: true,
    shares: SHARES,
    floated: plan.fraction,
    ipoPrice: offer.pricePerShare,
    ipoMultiple: offer.publicMultiple,
    price: offer.pricePerShare,
    expected: offer.weeklyProfit,
    multiple: offer.publicMultiple,
    founderShare: plan.youKeep,
    raised: plan.cashRaised,
    weeks: plan.sharesSold > 0 ? [] : [],
  };
}

/** What the whole company is worth at today's price. price x shares. */
export function marketCap(listing: Listing): number {
  return round2(listing.price * listing.shares);
}

/** What the kid's own piece is worth at today's price. */
export function founderStake(listing: Listing): number {
  return round2(marketCap(listing) * listing.founderShare);
}

/**
 * How hard the multiple moves on a surprise.
 *
 * Small, and smaller than it first looks like it should be, because two things
 * move on the same news and they multiply. A good week raises what the market
 * expects *and* how many weeks of it the market will pay for, so at the first
 * value tried here a company that earned double for one week saw its share
 * price go up 124% — which teaches a child that a share price is a scoreboard
 * with a multiplier on it, and that is worse than teaching them nothing.
 *
 * At this value the price always moves *less* than the profit did, which is the
 * single most useful true thing about share prices and is held by a test.
 */
const RERATE_SENSITIVITY = 0.25;

/** The market never pays fewer than this many weeks, or more. */
const MIN_MULTIPLE = 4;
const MAX_MULTIPLE = 20;

/**
 * How much of a surprise the market believes will last.
 *
 * The rest it treats as one odd week. This is why the price does not simply
 * track profit: the market is guessing at *next* week, and it only half changes
 * its mind on one week's evidence.
 */
const EXPECTATION_MEMORY = 0.6;

/**
 * Marks one week of being public.
 *
 * Two things move, and they move for two different reasons: what the market
 * expects the company to earn, and how many weeks of it the market will pay
 * for. Both are on screen, and the sentence names whichever one did the work.
 */
export function markListedWeek(listing: Listing, actualWeekly: number): {
  listing: Listing;
  move: PriceMove;
} {
  const expected = listing.expected;
  const actual = round2(actualWeekly);
  const surprise = expected > 0 ? actual / expected - 1 : 0;

  const multipleAfter = round2(
    Math.min(MAX_MULTIPLE, Math.max(MIN_MULTIPLE, listing.multiple * (1 + RERATE_SENSITIVITY * surprise))),
  );
  const expectedAfter = round2(expected * EXPECTATION_MEMORY + actual * (1 - EXPECTATION_MEMORY));
  const priceBefore = listing.price;
  const priceAfter = round2((expectedAfter * multipleAfter) / listing.shares);

  const move: PriceMove = {
    week: listing.weeks.length + 1,
    actual,
    expected,
    multipleBefore: listing.multiple,
    multipleAfter,
    priceBefore,
    priceAfter,
    change: priceBefore > 0 ? round2(priceAfter / priceBefore - 1) : 0,
    reason: moveReason(actual, expected, priceBefore, priceAfter),
  };

  return {
    listing: {
      ...listing,
      price: priceAfter,
      expected: expectedAfter,
      multiple: multipleAfter,
      weeks: [...listing.weeks, move],
    },
    move,
  };
}

function moveReason(actual: number, expected: number, before: number, after: number): string {
  const gap = round2(actual - expected);
  const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;
  if (Math.abs(gap) < 0.01) {
    return `You made ${money(actual)}, which is what they were expecting. The price barely moved.`;
  }
  if (gap > 0) {
    return `You made ${money(actual)} where they expected ${money(expected)}. That is ${money(gap)} more, so they will pay more for a piece.`;
  }
  if (after < before) {
    return `You made ${money(actual)} where they expected ${money(expected)}. That is ${money(gap)} short, so a piece is worth less than it was.`;
  }
  return `You made ${money(actual)} where they expected ${money(expected)}.`;
}

/**
 * Stage 4 is over once the company is listed and one week has been marked.
 *
 * The second half is doing real work. Reaching a listing teaches what a company
 * is worth. Living a week as a public company is what teaches what a share
 * price *is* — and a kid who has never watched their own price move has no
 * business being handed eight real ones.
 */
export function listingComplete(listing: Listing): boolean {
  return listing.listed && listing.weeks.length >= 1;
}

/* ------------------------------------------------------------------ *
 * The bridge, restated for shares
 *
 * PRODUCT.md §9 built the bridge out of the buyout: 270 / 34 = 8. That sum is
 * still the one the kid does, and this is the same sum divided one more time.
 * Generated from their own figures rather than written as copy, for the same
 * reason it was before — a worked example with somebody else's numbers in it is
 * a worked example nobody checks.
 * ------------------------------------------------------------------ */

export function sharePriceBridge(listing: Listing): {
  cap: string;
  perShare: string;
  yearly: string;
  pe: number;
} {
  const cap = marketCap(listing);
  const weekly = listing.expected;
  const yearlyPerShare = round2((weekly * 52) / listing.shares);
  const pe = yearlyPerShare > 0 ? round2(listing.price / yearlyPerShare) : 0;
  return {
    cap: `$${listing.price.toFixed(2)} a piece x ${listing.shares} pieces = $${cap.toFixed(0)} for the whole company.`,
    perShare: `$${cap.toFixed(0)} for a company earning $${weekly.toFixed(2)} a week is ${listing.multiple.toFixed(1)} weeks of profit.`,
    yearly: `Each piece earns $${yearlyPerShare.toFixed(2)} a year, and costs $${listing.price.toFixed(2)}.`,
    pe,
  };
}

/* ------------------------------------------------------------------ *
 * Stage 4 vocabulary
 *
 * Four words, and every one of them arrives after the kid has already done the
 * thing. "Shares" lands the moment the company is cut up, not when the banker
 * walks in. "Share price" lands with the division that produced it. "Market
 * value" lands with the multiplication back the other way, so the two of them
 * reconcile on paper in front of the child who did the sum.
 *
 * `going-public` is deliberately last, because it is the only one that names
 * something the kid *chose* rather than something they observed.
 * ------------------------------------------------------------------ */

export function deriveListingInsights(listing: Listing, move: PriceMove | null): Insight[] {
  if (!listing.listed) return [];
  const found: Insight[] = [];
  const money = (n: number) => `$${n.toFixed(2)}`;

  found.push({
    id: 'shares',
    term: 'Shares',
    evidence: `Your company got cut into ${listing.shares} equal pieces, and you sold ${Math.round(listing.floated * listing.shares)} of them.`,
    carriesForward:
      'Ownership you can divide. It is the only reason a thousand strangers can each own a bit of the same company.',
  });

  found.push({
    id: 'share-price',
    term: 'Share price',
    evidence: `The whole company was worth ${money(round2(listing.ipoPrice * listing.shares))}, so one piece of ${listing.shares} cost ${money(listing.ipoPrice)}.`,
    carriesForward:
      'A share price is that same division on a much bigger company. It is a guess about what is coming, not a score for what already happened.',
  });

  found.push({
    id: 'market-cap',
    term: 'Market value',
    evidence: `${money(listing.price)} a piece times ${listing.shares} pieces is ${money(marketCap(listing))} for the lot.`,
    carriesForward:
      'When somebody says how big a company is, this is usually the number they mean \u2014 and it moves every single day the price does.',
  });

  found.push({
    id: 'going-public',
    term: 'Going public',
    evidence: `You kept ${Math.round(listing.founderShare * 100)}% and let other people buy the rest, instead of selling the whole thing to one buyer.`,
    carriesForward:
      'An IPO. The founder takes some money off the table, keeps running it, and gains a price they now have to live with.',
  });

  if (move && Math.abs(move.change) >= 0.01) {
    // Nothing new is named here on purpose. The word was already handed over
    // above; what the first move adds is the reason, and the reason belongs
    // next to the two numbers that caused it rather than in a glossary.
    found[1] = {
      ...found[1],
      evidence: `${money(move.priceBefore)} became ${money(move.priceAfter)}. ${move.reason}`,
    };
  }

  return found;
}
