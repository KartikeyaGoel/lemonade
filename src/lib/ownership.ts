/**
 * Act 3 — Ownership.
 *
 * The emotional peak. The kid stops being someone who runs a business and
 * becomes someone who owns one, which means learning that a business has a
 * price, and that the price and the business are two different questions.
 *
 * Three beats, in order:
 *   1. An investor offers cash today for a slice of every future profit.
 *      Dilution, felt daily afterwards.
 *   2. A buyer offers a multiple of trailing weekly profit for the lot.
 *      This multiple is PE, arrived at by division the kid can do.
 *   3. Before deciding, the kid is shown other stands for sale at different
 *      multiples and must pick the best deal. The growing one costs the most.
 *      Spotting a good business is not the same as getting a good price.
 *
 * Pure module. No React, no I/O.
 */

import { round2, toCents, type DayRecord } from './simulation';
import { growthRate, regularShareOfSales, trailingWeeklyProfit } from './business';

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

export interface OwnershipState {
  /** Fraction of future profit owned by someone else. 0 or 0.2. */
  equitySoldPct: number;
  equityOfferSeen: boolean;
  equityCashReceived: number;
  /** Total the investor has actually collected, so dilution stays visible. */
  investorPaidToDate: number;

  comparisonAnswered: boolean;
  comparisonChoiceId: string | null;
  /** Evidence for the readiness gate: they declined a deal on price alone. */
  passedOnOverpriced: boolean;

  buyoutAccepted: boolean;
  buyoutMultiple: number;
  /** Gross price agreed for the whole business. */
  buyoutPrice: number;
  /** What the kid actually walked away with, after the investor's slice. */
  buyoutProceeds: number;
}

export function createOwnershipState(): OwnershipState {
  return {
    equitySoldPct: 0,
    equityOfferSeen: false,
    equityCashReceived: 0,
    investorPaidToDate: 0,
    comparisonAnswered: false,
    comparisonChoiceId: null,
    passedOnOverpriced: false,
    buyoutAccepted: false,
    buyoutMultiple: 0,
    buyoutPrice: 0,
    buyoutProceeds: 0,
  };
}

/* ------------------------------------------------------------------ *
 * Beat 1 — the equity offer
 * ------------------------------------------------------------------ */

export const EQUITY_SLICE = 0.2;
/** Weeks of the investor's slice that they are willing to pay up front. */
export const EQUITY_OFFER_WEEKS = 5;

export interface EquityOffer {
  slice: number;
  /** Cash on the table today. */
  cash: number;
  /** What the investor will collect each week if nothing changes. */
  weeklyCost: number;
  /** Weeks until the investor has their money back. */
  paybackWeeks: number;
}

/**
 * Priced deliberately in the investor's favour: five weeks of the slice they
 * are buying. A kid who intends to keep trading is selling cheap, and the
 * payback arithmetic is right there on the card so they can see it.
 *
 * We never tell them it is a bad deal. They can work it out, and either way
 * the cash is genuinely useful today.
 */
export function equityOffer(history: DayRecord[]): EquityOffer {
  const weekly = trailingWeeklyProfit(history);
  const weeklyCost = round2(weekly * EQUITY_SLICE);
  return {
    slice: EQUITY_SLICE,
    cash: round2(weeklyCost * EQUITY_OFFER_WEEKS),
    weeklyCost,
    paybackWeeks: EQUITY_OFFER_WEEKS,
  };
}

export function acceptEquity(
  ownership: OwnershipState,
  offer: EquityOffer,
): OwnershipState {
  return {
    ...ownership,
    equitySoldPct: offer.slice,
    equityOfferSeen: true,
    equityCashReceived: round2(ownership.equityCashReceived + offer.cash),
  };
}

export function declineEquity(ownership: OwnershipState): OwnershipState {
  return { ...ownership, equityOfferSeen: true };
}

/** Records what the investor took today, so the kid keeps seeing the cost. */
export function recordInvestorCut(ownership: OwnershipState, cut: number): OwnershipState {
  if (cut <= 0) return ownership;
  return { ...ownership, investorPaidToDate: round2(ownership.investorPaidToDate + cut) };
}

/* ------------------------------------------------------------------ *
 * Beat 2 — what is the whole thing worth
 * ------------------------------------------------------------------ */

export const BASE_MULTIPLE = 8;
export const GROWING_MULTIPLE = 11;
export const SHRINKING_MULTIPLE = 6;
/** Growth above this counts as "growing" for pricing purposes. */
export const GROWTH_THRESHOLD = 0.08;

export interface BuyoutOffer {
  weeklyProfit: number;
  multiple: number;
  /** multiple x weeklyProfit. The whole point is that this is one sum. */
  price: number;
  /** The kid's share after any slice already sold. */
  proceeds: number;
  investorShare: number;
  growth: number | null;
  reason: string;
  /** Share of recent cups that went to the round. */
  roundShare: number;
  /** Extra weeks of profit the buyer will pay for predictable customers. */
  roundPremium: number;
  /** Why the round is worth paying extra for, or null if there is no round. */
  premiumReason: string | null;
}

/**
 * A buyer prices the stand the way every buyer prices every business: some
 * number of times what it earns. A growing stand earns a higher number, which
 * is the entire idea of a growth premium.
 */
export function buyoutOffer(history: DayRecord[], ownership: OwnershipState): BuyoutOffer {
  const weeklyProfit = trailingWeeklyProfit(history);
  const growth = growthRate(history);

  let multiple = BASE_MULTIPLE;
  let reason = 'Steady profits, so a normal price.';
  if (growth !== null && growth > GROWTH_THRESHOLD) {
    multiple = GROWING_MULTIPLE;
    reason = 'Profits are climbing, so buyers will pay more for each dollar of it.';
  } else if (growth !== null && growth < 0) {
    multiple = SHRINKING_MULTIPLE;
    reason = 'Profits are slipping, so buyers will pay less for each dollar of it.';
  }

  // A buyer is buying next month, not last week. Customers who turn up in the
  // cold because they are on a standing order are the part of the business the
  // weather cannot take away, so they are worth paying extra for. This is the
  // same reason a company with subscribers is priced above one without.
  const roundShare = regularShareOfSales(history);
  const roundPremium = roundShare >= 0.15 ? Math.min(3, Math.round(roundShare * 6)) : 0;
  const premiumReason =
    roundPremium > 0
      ? `${Math.round(roundShare * 100)}% of your cups go to regulars who come whatever the weather, so I will pay ${roundPremium} more ${roundPremium === 1 ? 'week' : 'weeks'} of profit for it.`
      : null;

  multiple += roundPremium;

  const price = round2(Math.max(0, weeklyProfit) * multiple);
  const investorShare = round2(price * ownership.equitySoldPct);
  return {
    weeklyProfit,
    multiple,
    price,
    proceeds: round2(price - investorShare),
    investorShare,
    growth,
    reason,
    roundShare,
    roundPremium,
    premiumReason,
  };
}

export function acceptBuyout(ownership: OwnershipState, offer: BuyoutOffer): OwnershipState {
  return {
    ...ownership,
    buyoutAccepted: true,
    buyoutMultiple: offer.multiple,
    buyoutPrice: offer.price,
    buyoutProceeds: offer.proceeds,
  };
}

/* ------------------------------------------------------------------ *
 * Beat 3 — comparison shopping, which is where PE lands
 * ------------------------------------------------------------------ */

export interface StandForSale {
  id: string;
  name: string;
  emoji: string;
  /** What it earns a week right now. */
  weeklyProfit: number;
  /** What the seller is asking, as a multiple of that. */
  askingMultiple: number;
  /** How its weekly profit is trending, per week. */
  weeklyGrowth: number;
  blurb: string;
}

/** How long we ask the kid to imagine owning it. Half a year. */
export const HOLD_WEEKS = 26;

/**
 * Three deals, chosen so that the obvious heuristics all fail:
 *
 *  - the cheapest multiple is a business that is shrinking
 *  - the dearest is perfectly steady, and still a bad buy at that price
 *  - the best is neither cheapest nor dearest
 *
 * A kid who reaches for "cheap is good" or "expensive means quality" gets it
 * wrong, which is exactly the habit we are trying to break before Act 4.
 */
export const STANDS_FOR_SALE: StandForSale[] = [
  {
    id: 'bella',
    name: "Bella's cart",
    emoji: '🛒',
    weeklyProfit: 100,
    askingMultiple: 6,
    weeklyGrowth: -0.02,
    blurb: 'Cheapest price on the board. Fewer customers every week.',
  },
  {
    id: 'sam',
    name: "Sam's corner stand",
    emoji: '🥤',
    weeklyProfit: 100,
    askingMultiple: 12,
    weeklyGrowth: 0.02,
    blurb: 'Costs twice as much as Bella. Busier every week.',
  },
  {
    id: 'kiosk',
    name: 'Downtown kiosk',
    emoji: '🏙️',
    weeklyProfit: 100,
    askingMultiple: 25,
    weeklyGrowth: 0,
    blurb: 'Famous spot. Same profit every week for a year.',
  },
];

export function askingPrice(stand: StandForSale): number {
  return round2(stand.weeklyProfit * stand.askingMultiple);
}

/**
 * Weeks of profit before you have your money back, ignoring growth. This is
 * the multiple, restated as something a twelve year old can feel.
 */
export function paybackWeeks(stand: StandForSale): number {
  return stand.askingMultiple;
}

/** Total profit collected over the hold, with growth compounding weekly. */
export function projectedProfit(stand: StandForSale, weeks = HOLD_WEEKS): number {
  const g = stand.weeklyGrowth;
  if (Math.abs(g) < 1e-9) return round2(stand.weeklyProfit * weeks);
  // Geometric series: p * (1 - (1+g)^n) / (1 - (1+g))
  const total = (stand.weeklyProfit * (Math.pow(1 + g, weeks) - 1)) / g;
  return round2(total);
}

/** Profit collected, minus what you paid. The number that decides it. */
export function dealValue(stand: StandForSale, weeks = HOLD_WEEKS): number {
  return round2(projectedProfit(stand, weeks) - askingPrice(stand));
}

export function rankDeals(stands = STANDS_FOR_SALE, weeks = HOLD_WEEKS): StandForSale[] {
  return [...stands].sort((a, b) => dealValue(b, weeks) - dealValue(a, weeks));
}

export function bestDeal(stands = STANDS_FOR_SALE, weeks = HOLD_WEEKS): StandForSale {
  return rankDeals(stands, weeks)[0];
}

export function worstDeal(stands = STANDS_FOR_SALE, weeks = HOLD_WEEKS): StandForSale {
  const ranked = rankDeals(stands, weeks);
  return ranked[ranked.length - 1];
}

export interface DealVerdict {
  chosen: StandForSale;
  best: StandForSale;
  correct: boolean;
  /** The arithmetic, so the reveal is a calculation and not an opinion. */
  rows: Array<{
    stand: StandForSale;
    price: number;
    payback: number;
    projected: number;
    value: number;
    isBest: boolean;
  }>;
  /** True when the kid avoided the overpriced steady business. */
  avoidedOverpriced: boolean;
  lesson: string;
}

export function judgeDealChoice(choiceId: string, weeks = HOLD_WEEKS): DealVerdict {
  const chosen = STANDS_FOR_SALE.find((s) => s.id === choiceId) ?? STANDS_FOR_SALE[0];
  const best = bestDeal(STANDS_FOR_SALE, weeks);
  const worst = worstDeal(STANDS_FOR_SALE, weeks);

  const rows = STANDS_FOR_SALE.map((stand) => ({
    stand,
    price: askingPrice(stand),
    payback: paybackWeeks(stand),
    projected: projectedProfit(stand, weeks),
    value: dealValue(stand, weeks),
    isBest: stand.id === best.id,
  }));

  const correct = chosen.id === best.id;
  const lesson = correct
    ? `${best.name} was not the cheapest. It cost ${best.askingMultiple} times its weekly profit while Bella's cost ${STANDS_FOR_SALE[0].askingMultiple}. You paid more per dollar of profit because that profit was growing.`
    : chosen.id === worst.id
      ? `${chosen.name} earns the same ${chosen.weeklyProfit} a week as the others but costs ${chosen.askingMultiple} times it. You would wait ${chosen.askingMultiple} weeks just to get your money back.`
      : `${chosen.name} was the cheapest on the board, but its profit shrinks every week. Cheap is not the same as good value.`;

  return {
    chosen,
    best,
    correct,
    rows,
    avoidedOverpriced: chosen.id !== worst.id,
    lesson,
  };
}

export function recordDealChoice(ownership: OwnershipState, choiceId: string): OwnershipState {
  const verdict = judgeDealChoice(choiceId);
  return {
    ...ownership,
    comparisonAnswered: true,
    comparisonChoiceId: choiceId,
    passedOnOverpriced: verdict.avoidedOverpriced,
  };
}

/* ------------------------------------------------------------------ *
 * The bridge to Act 4
 * ------------------------------------------------------------------ */

/**
 * The same division, written out both ways. This is the single most important
 * paragraph in the product, so it is generated from the kid's real numbers
 * rather than written as copy.
 */
export function peBridge(offer: BuyoutOffer): {
  standLine: string;
  ratioLine: string;
  yieldLine: string;
} {
  const weekly = Math.max(0.01, offer.weeklyProfit);
  return {
    standLine: `Your stand makes $${weekly.toFixed(2)} a week. They offered $${offer.price.toFixed(2)}.`,
    ratioLine: `$${offer.price.toFixed(2)} ÷ $${weekly.toFixed(2)} = ${offer.multiple}. They paid ${offer.multiple} times weekly profit.`,
    // Deliberately restated as a payback period rather than a percentage.
    // Your stand is priced on a WEEK of profit; a real company is priced on a
    // YEAR of it. A kid who carries "12.5% a week" into Act 4 and meets a
    // company at 37x will do the sum in the wrong unit, so we name the unit
    // here instead of leaving them to notice.
    yieldLine: `So it would take ${offer.multiple} weeks of profit to earn that price back. Real companies are priced the same way, counted in years instead of weeks.`,
  };
}
