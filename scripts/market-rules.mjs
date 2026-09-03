/**
 * Rules about the market data that more than one caller needs to agree on.
 *
 * This module exists because the split rule was written twice — once in
 * `check-market-data.mjs` as a CI gate, once in `tests/market.test.ts` as an
 * assertion — and the two copies disagreed. The test knew that a flotation
 * moves a share count further than any split does and skipped a company's
 * first two transitions to allow for it. The CI gate did not, so it failed on
 * six real listings and went on failing, because a heuristic written to
 * prompt a human look had been wired up as a blocking check.
 *
 * One rule, one home. Same reason `MAX_EQUITY_SOLD` stopped being a constant
 * in the lib and a literal in the funding screen (PRODUCT.md §54).
 */

/** A share count moving by more than this in one year is worth explaining. */
export const SHARE_JUMP = 1.5;

/**
 * How far revenue may move before a share jump stops looking like a split.
 *
 * The load-bearing fact: **a split does not change revenue.** It re-slices the
 * same company into more pieces, so shares multiply by the split factor and
 * every income-statement line stays exactly where it was. Anything that moves
 * shares *and* revenue is the business changing, not the slicing.
 *
 * That is what separates the two cases the old gate could not tell apart. All
 * six of the flotations it flagged moved revenue by 1.26x or more — Uber's
 * 1.26x is the closest — and a genuine unadjusted split sits at 1.00x. The
 * threshold is set well inside that gap.
 */
export const REVENUE_STILL = 1.15;

/** Ratio between two figures, whichever direction it moved. */
function move(before, after) {
  if (!(before > 0) || !(after > 0)) return NaN;
  return Math.max(after / before, before / after);
}

/**
 * Share-count jumps that a split would explain and a growing business would not.
 *
 * Prices are adjusted for splits and 10-K share counts are not, so a missed
 * adjustment makes every P/E before it wrong by the split factor — Chipotle
 * briefly showed a price-to-earnings ratio of 1, which tells a child a company
 * earns back its whole share price in a year.
 *
 * Returns one entry per suspicious transition, with the figures that make it
 * suspicious, so both callers report the same thing.
 */
export function suspectSplits(company) {
  const years = company.annuals ?? [];
  const found = [];

  for (let i = 1; i < years.length; i++) {
    const before = years[i - 1];
    const after = years[i];
    const shares = move(before.sharesM, after.sharesM);
    if (!(shares > SHARE_JUMP)) continue;

    /*
     * Revenue held still while the share count multiplied. Nothing about the
     * business changed, only the number of pieces it is cut into — which is
     * a split, or a share count that missed one.
     */
    const revenue = move(before.revenueM, after.revenueM);
    if (Number.isFinite(revenue) && revenue >= REVENUE_STILL) continue;

    found.push({
      ticker: company.ticker,
      fromYear: before.fiscalYear,
      toYear: after.fiscalYear,
      fromShares: before.sharesM,
      toShares: after.sharesM,
      shares,
      revenue,
    });
  }

  return found;
}

/** The one sentence both the gate and the test print. */
export function describeSuspectSplit(s) {
  const revenue = Number.isFinite(s.revenue) ? `${s.revenue.toFixed(2)}x` : 'unknown';
  return (
    `${s.ticker}: shares went ${s.fromShares}M → ${s.toShares}M between ${s.fromYear} ` +
    `and ${s.toYear} (${s.shares.toFixed(1)}x) while revenue moved ${revenue} ` +
    `— an unadjusted split?`
  );
}
