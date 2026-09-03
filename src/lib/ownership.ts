/**
 * Ownership: what a slice costs, and what the whole thing is worth.
 *
 * The emotional peak. The kid stops being someone who runs a business and
 * becomes someone who owns one, which means learning that a business has a
 * price, and that the price and the business are two different questions.
 *
 * Three beats, and they no longer all sit in one stage — which is the change
 * worth writing down, because it is the whole of PRODUCT.md §4's rule about
 * not teaching a concept before the wall that motivates it:
 *
 *   1. **An investor offers cash today for a slice of every future profit.**
 *      This used to arrive in the ownership act, where the kid did not need the
 *      money and the offer was therefore something to read rather than decide.
 *      It now lives in Stage 3, next to a shop they cannot afford, alongside a
 *      bank that wants the money back — see `src/lib/retail.ts`. Same offer,
 *      and now a real decision with two other real answers beside it.
 *   2. **Three stands for sale at three multiples**, ranked. The growing one
 *      costs the most. Spotting a good business is not the same as getting a
 *      good price, and this has to happen *before* the kid is handed a multiple
 *      for their own company or they have nothing to judge it against.
 *   3. **A buyer offers a multiple of trailing weekly profit for the lot.**
 *      This multiple is PE, arrived at by division the kid can do. It is now
 *      one of two ways out — see `src/lib/listing.ts` for the other.
 *
 * Pure module. No React, no I/O.
 */

import { round2, type DayRecord } from './simulation';
import { growthRate, regularShareOfSales, trailingWeeklyProfit } from './business';
import { plural } from './copy';

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

/** The slice the dial opens on. */
export const EQUITY_SLICE = 0.2;
/** Weeks of the investor's slice that they are willing to pay up front. */
export const EQUITY_OFFER_WEEKS = 5;

/**
 * The slices the investor will consider.
 *
 * This used to be the single constant above, and a fixed slice on a card is
 * something a kid reads rather than something a kid decides. PRODUCT.md §4 is
 * explicit that dials and their consequences belong on the same screen, and
 * this is the first decision in the game where the consequence arrives every
 * day for the rest of the run: sell a bigger slice, take more cash today, and
 * watch more of every close screen leave.
 */
export const EQUITY_SLICES = [0.1, 0.15, 0.2, 0.25, 0.3] as const;

/**
 * The most of the business the investor is ever allowed to end up holding.
 *
 * A ceiling rather than a rule the kid has to remember, because the whole
 * point of the beat is that a slice is *cheap today and expensive forever* —
 * and a child who can sell it all has been handed a way to lose the business
 * without ever being told that is what they were doing. Half keeps them the
 * owner, which is the fact the buyout in Beat 2 depends on.
 *
 * It lives here and not on the funding screen because it constrains
 * `acceptEquity`, and it used to live *only* on the screen. That split was a
 * real defect: the screen filtered the slices on offer additively — a kid who
 * had sold 30% was shown 10%, 15% and 20% — while `acceptEquity` *replaced*
 * the stored slice instead of adding to it. So a second sale paid the kid
 * again and left them owing **less**: sell 30% for $36, come back and sell
 * 20% for $24, and the investor's share drops from 30% to 20% having paid
 * $60 for it. Two files modelling one rule, and only one of them right.
 *
 * Reachable on the ordinary path, not a corner: on a modest week the largest
 * slice raises about $36 against a $600 fit-out, so returning to the shop plot
 * for a second go is the *normal* experience, and `page.tsx` says as much —
 * "come back, which is the honest answer and is a better lesson than a
 * disabled button".
 */
export const MAX_EQUITY_SOLD = 0.5;

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
export function equityOffer(history: DayRecord[], slice: number = EQUITY_SLICE): EquityOffer {
  const weekly = trailingWeeklyProfit(history);
  const chosen = nearestSlice(slice);
  const weeklyCost = round2(weekly * chosen);
  return {
    slice: chosen,
    cash: round2(weeklyCost * EQUITY_OFFER_WEEKS),
    weeklyCost,
    paybackWeeks: EQUITY_OFFER_WEEKS,
  };
}

/** Snaps a dragged dial to a slice the investor actually offers. */
export function nearestSlice(slice: number): number {
  return EQUITY_SLICES.reduce((best, option) =>
    Math.abs(option - slice) < Math.abs(best - slice) ? option : best,
  );
}

/**
 * Is there room under the ceiling for this slice?
 *
 * Exported so the caller can refuse *before* it puts the cash in the box.
 * `acceptEquity` alone is not enough: `page.tsx` adds `offer.cash` to the
 * stand and then calls this module, so a sale this module quietly declined
 * would leave the kid holding money for a slice nobody received.
 */
export function canSellSlice(ownership: OwnershipState, slice: number): boolean {
  return round2(ownership.equitySoldPct + slice) <= MAX_EQUITY_SOLD;
}

export function acceptEquity(
  ownership: OwnershipState,
  offer: EquityOffer,
): OwnershipState {
  /*
   * Added to what was already sold, not written over it. A kid can reach this
   * twice — the shop's fit-out is far more than one slice raises — and each
   * sale is a fresh slice of what is left, paid for on top of the last. The
   * cash has always accumulated; the slice used to not, which meant selling
   * more of the business made the investor's cut smaller. See
   * `MAX_EQUITY_SOLD`.
   *
   * A slice that will not fit is refused outright rather than trimmed to fit.
   * Clamping was the first attempt and it was the same defect wearing the
   * other face: the slice stopped at the ceiling while the cash carried on
   * up, so the kid was paid for something they never handed over. The two
   * ledgers move together or neither moves.
   */
  if (!canSellSlice(ownership, offer.slice)) {
    return { ...ownership, equityOfferSeen: true };
  }

  return {
    ...ownership,
    equitySoldPct: round2(ownership.equitySoldPct + offer.slice),
    equityOfferSeen: true,
    equityCashReceived: round2(ownership.equityCashReceived + offer.cash),
  };
}

/**
 * Records that the offer was on the table and another way was taken.
 *
 * Called when the shop is paid for out of cash or borrowed for, because both of
 * those *are* decisions about the investor — they are turning her down. There
 * is no longer a screen whose only job is to decline her, and there should not
 * be: her wall is the shop, and next to a bank.
 */
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
 * wrong, which is exactly the habit we are trying to break before the market.
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
    ? `${best.name} was not the cheapest. It cost ${plural(best.askingMultiple, 'time')} its weekly profit while Bella's cost ${STANDS_FOR_SALE[0].askingMultiple}. You paid more per dollar of profit because that profit was growing.`
    : chosen.id === worst.id
      ? `${chosen.name} earns the same ${chosen.weeklyProfit} a week as the others but costs ${plural(chosen.askingMultiple, 'time')} it. You would wait ${plural(chosen.askingMultiple, 'week')} just to get your money back.`
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
 * The bridge to the market
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
    ratioLine: `$${offer.price.toFixed(2)} ÷ $${weekly.toFixed(2)} = ${offer.multiple}. They paid ${plural(offer.multiple, 'time')} weekly profit.`,
    // Deliberately restated as a payback period rather than a percentage.
    // Your stand is priced on a WEEK of profit; a real company is priced on a
    // YEAR of it. A kid who carries "12.5% a week" into the market and meets a
    // company at 37x will do the sum in the wrong unit, so we name the unit
    // here instead of leaving them to notice.
    yieldLine: `So it would take ${plural(offer.multiple, 'week')} of profit to earn that price back. Real companies are priced the same way, counted in years instead of weeks.`,
  };
}
