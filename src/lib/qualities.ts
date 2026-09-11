/**
 * What is good about a company, and what could go wrong — derived, not written.
 *
 * ## The gap this fills
 *
 * The pilot's grown-up looked at the compare screen and wrote, twice:
 *
 * > I think including Strengths and Risks for both companies will be helpful.
 *
 * > Comparing stocks — why would i buy something. Numbers look good for both
 * > stocks but there are qualitative risks and benefits of each stock right,
 * > the app should articulate these?
 *
 * They are right, and the reason the screen has none is worth stating: there
 * was nowhere honest to get them from. A hand-written "strengths and risks"
 * list for twenty-four companies is twenty-four pairs of opinions the game
 * would be asserting, and `scout.ts` is explicit that "nothing here is an
 * opinion the game holds" — every answer computes from the same SEC
 * fundamentals and the same replayed price the rest of the market uses.
 *
 * So these are derived. Each one is a threshold crossed by a real filed figure,
 * and each carries the figure that produced it so a child (or a sceptical
 * parent) can check it. Nothing here is about a company's products, its
 * management or its future; those would be opinions.
 *
 * ## The two sides stay apart
 *
 * `scout.ts` makes the argument and it is the most valuable thing in the
 * product, so it is honoured here too:
 *
 *   **Is this a good business?** Does it make money. Is it growing. Does it
 *   keep much of what it takes in.
 *
 *   **Is this an attractive stock?** What am I paying. What is already expected
 *   in the price. How much does it jump about.
 *
 * A great business at a silly price is a bad investment, and a child cannot
 * learn that while the two questions are mixed. So every quality is tagged with
 * which side it belongs to, and a high price-to-profit is a `stock` risk rather
 * than a mark against the business.
 *
 * ## And it fixes the repetition
 *
 * A separate pilot note: *"The comparisons part is way too repetitive like
 * reading comparisons over and over again people just end up scrolling over
 * it."* That was literally true. `FaceoffRow.meaning` is a constant per row —
 * the same six sentences for every pair of companies a child ever holds up
 * against each other, so the fifth comparison was word-for-word the first.
 *
 * These vary with the company, because they are computed from it.
 *
 * Pure module. No React, no I/O.
 */

import { formatMillions, metricsFor, type Company } from './companies';
import { plural } from './copy';

/** Which of `scout.ts`'s two questions a quality answers. */
export type Side = 'business' | 'stock';

export interface Quality {
  id: string;
  kind: 'strength' | 'risk';
  side: Side;
  /** The claim, in words a nine-year-old has. Six words or so. */
  says: string;
  /** The filed figure it came from. This is what makes it checkable. */
  because: string;
}

/* ------------------------------------------------------------------ *
 * Thresholds
 *
 * Every one of these is a number, named, so that a child who asks "why is
 * that a strength" has an answer, and so that changing our mind about one is
 * a one-line edit rather than a hunt.
 * ------------------------------------------------------------------ */

/** Keeping more than this much of each dollar is unusual. */
export const FAT_MARGIN = 0.2;
/** Keeping less than this leaves no room for a bad year. */
export const THIN_MARGIN = 0.06;
/** Three-year compound profit growth that counts as fast. */
export const FAST_GROWTH = 0.15;
/** Years of profit the price is asking for, above which a lot is expected. */
export const DEAR_MULTIPLE = 30;
/** Weekly swing that counts as a jumpy share price. */
export const JUMPY = 0.05;
/** Weekly swing that counts as a steady one. */
export const STEADY = 0.025;
/** Revenue, in millions, above which a business is simply enormous. */
export const ENORMOUS_M = 100_000;
/** How many of the two sides' items ever reach a screen. */
export const MOST_SHOWN = 2;

/**
 * Has profit gone up every year, for as far back as the filings go?
 *
 * Counted as a run ending at the most recent year, because "grew in four of
 * the last eight" is not a thing a child can act on and "up every year for
 * six years" is.
 */
function risingYears(company: Company): number {
  const years = company.annuals;
  let run = 0;
  for (let i = years.length - 1; i > 0; i--) {
    if (years[i].netIncomeM > years[i - 1].netIncomeM) run++;
    else break;
  }
  return run;
}

/** Did profit fall in the most recently filed year? */
function profitFell(company: Company): boolean {
  const years = company.annuals;
  if (years.length < 2) return false;
  return years[years.length - 1].netIncomeM < years[years.length - 2].netIncomeM;
}

/**
 * Is it selling more without keeping more?
 *
 * The most useful shape in the whole set, and the one a child would otherwise
 * read as good news: revenue climbing while profit does not is a business
 * whose costs are climbing faster than its sales.
 */
function sellingMoreKeepingLess(company: Company): boolean {
  const m = company.annuals;
  if (m.length < 2) return false;
  const now = m[m.length - 1];
  const before = m[m.length - 2];
  if (now.revenueM <= before.revenueM) return false;
  const marginNow = now.revenueM > 0 ? now.netIncomeM / now.revenueM : 0;
  const marginBefore = before.revenueM > 0 ? before.netIncomeM / before.revenueM : 0;
  return marginNow < marginBefore;
}

/**
 * Everything true about this company, at this price, in priority order.
 *
 * Order is the design decision. The list is cut to `MOST_SHOWN` of each kind
 * per side by `strengthsAndRisks`, so what comes first is what a child reads —
 * and the ordering puts the *largest* facts first within each kind, because a
 * business keeping 25c of every dollar matters more to a nine-year-old than its
 * share price being slightly steady.
 */
export function qualitiesOf(company: Company, price = company.price, asOf?: string): Quality[] {
  const m = metricsFor(company, price, asOf);
  const found: Quality[] = [];
  const cents = Math.round(m.netMargin * 100);
  const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

  /* ---- Is this a good business? ---- */

  if (m.netMargin >= FAT_MARGIN) {
    found.push({
      id: 'fat-margin',
      kind: 'strength',
      side: 'business',
      says: 'Keeps a lot of every dollar',
      because: `${cents}c of every $1 it takes in. Most businesses keep under 10c.`,
    });
  }

  const rising = risingYears(company);
  if (rising >= 3) {
    found.push({
      id: 'rising',
      kind: 'strength',
      side: 'business',
      says: 'Profit up every year lately',
      because: `Bigger profit than the year before, ${plural(rising, 'year')} running, in its own filings.`,
    });
  }

  if (m.profitable && m.year.growth >= FAST_GROWTH) {
    found.push({
      id: 'fast-and-profitable',
      kind: 'strength',
      side: 'business',
      says: 'Growing fast and already earning',
      because: `Profit up about ${pct(m.year.growth)} a year over three years, and it makes a profit today.`,
    });
  }

  if (m.year.revenueM >= ENORMOUS_M) {
    found.push({
      id: 'enormous',
      kind: 'strength',
      side: 'business',
      says: 'Big enough to be hard to knock over',
      because: `${formatMillions(m.year.revenueM)} of sales in a year.`,
    });
  }

  if (!m.profitable) {
    found.push({
      id: 'no-profit',
      kind: 'risk',
      side: 'business',
      says: 'Does not make a profit yet',
      because: `It lost ${formatMillions(Math.abs(m.year.netIncomeM))} in its last filed year.`,
    });
  } else if (m.netMargin <= THIN_MARGIN) {
    found.push({
      id: 'thin-margin',
      kind: 'risk',
      side: 'business',
      says: 'Keeps very little of each dollar',
      because: `${cents}c of every $1. A small wobble in costs wipes that out.`,
    });
  }

  if (sellingMoreKeepingLess(company)) {
    found.push({
      id: 'margin-slipping',
      kind: 'risk',
      side: 'business',
      says: 'Selling more without keeping more',
      because: 'Sales went up last year and the share it kept went down.',
    });
  } else if (profitFell(company)) {
    found.push({
      id: 'profit-fell',
      kind: 'risk',
      side: 'business',
      says: 'Profit went down last year',
      because: `${m.year.fiscalYear} earned less than the year before it.`,
    });
  }

  /* ---- Is this an attractive stock? ---- */

  if (m.pe !== null && m.pe >= DEAR_MULTIPLE) {
    found.push({
      id: 'dear',
      kind: 'risk',
      side: 'stock',
      says: 'The price already expects a lot',
      because: `${plural(Math.round(m.pe), 'year')} of profit at today's price. It has to keep growing to be worth that.`,
    });
  }

  if (company.volatility >= JUMPY) {
    found.push({
      id: 'jumpy',
      kind: 'risk',
      side: 'stock',
      says: 'The price jumps about',
      because: `About ${pct(company.volatility)} a week in a normal year. That is the price moving, not the business.`,
    });
  }

  if (m.pe !== null && m.pe < DEAR_MULTIPLE * 0.6) {
    found.push({
      id: 'cheaper',
      kind: 'strength',
      side: 'stock',
      says: 'Costs fewer years of profit',
      because: `${plural(Math.round(m.pe), 'year')} of profit. Cheaper than most — which usually means somebody is worried.`,
    });
  }

  if (company.volatility <= STEADY) {
    found.push({
      id: 'steady',
      kind: 'strength',
      side: 'stock',
      says: 'The price moves less than most',
      because: `About ${pct(company.volatility)} a week in a normal year.`,
    });
  }

  return found;
}

/**
 * The two strengths and two risks worth showing, split by side.
 *
 * Bounded at two of each for §13's reason: what has to be limited is how much
 * a child is asked to hold at once, and eight bullet points is a page of
 * reading on a screen the pilot already scrolls past.
 *
 * **Every company gets at least one of each.** That is not cosmetic. A card
 * showing three strengths and no risks reads as a recommendation, and a
 * recommendation is the one thing this product must never make — so when
 * nothing crossed a risk threshold the fallback names the risk every share has,
 * which is that the price is somebody's opinion and opinions change.
 */
export function strengthsAndRisks(
  company: Company,
  price = company.price,
  asOf?: string,
): { strengths: Quality[]; risks: Quality[] } {
  const all = qualitiesOf(company, price, asOf);
  const strengths = all.filter((q) => q.kind === 'strength').slice(0, MOST_SHOWN);
  const risks = all.filter((q) => q.kind === 'risk').slice(0, MOST_SHOWN);

  if (risks.length === 0) {
    const m = metricsFor(company, price, asOf);
    risks.push({
      id: 'always',
      kind: 'risk',
      side: 'stock',
      says: 'You are paying today’s opinion',
      because:
        m.pe === null
          ? 'Nothing in its own numbers looks fragile. The price is still what other people think it is worth today.'
          : `Nothing in its own numbers looks fragile, and it still costs ${plural(Math.round(m.pe), 'year')} of profit because of what people expect.`,
    });
  }

  if (strengths.length === 0) {
    strengths.push({
      id: 'known',
      kind: 'strength',
      side: 'business',
      says: 'You can see what it sells',
      because: `${company.whatTheySell}. A business you can describe is one you can judge.`,
    });
  }

  return { strengths, risks };
}
