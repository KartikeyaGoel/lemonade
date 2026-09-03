/**
 * Types for the shared market rules.
 *
 * The rule itself has to be `.mjs` so `check-market-data.mjs` can run it under
 * plain node with no build step, and it has to be importable from
 * `tests/market.test.ts` so the gate and the test cannot drift apart again.
 * This is what lets the second of those be type-checked.
 */

/** A share count moving by more than this in one year is worth explaining. */
export const SHARE_JUMP: number;

/** How far revenue may move before a share jump stops looking like a split. */
export const REVENUE_STILL: number;

export interface SuspectSplit {
  ticker: string;
  fromYear: string;
  toYear: string;
  fromShares: number;
  toShares: number;
  /** How far the share count moved, whichever direction. */
  shares: number;
  /** How far revenue moved. `NaN` when a year reports none. */
  revenue: number;
}

/** One entry per share jump that a split would explain and growth would not. */
export function suspectSplits(company: {
  ticker: string;
  annuals?: { fiscalYear: string; sharesM: number; revenueM: number }[];
}): SuspectSplit[];

/** The one sentence both the gate and the test print. */
export function describeSuspectSplit(suspect: SuspectSplit): string;
