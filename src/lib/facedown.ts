/**
 * Two companies, side by side.
 *
 * Act 1 teaches a verb: put two attempts next to each other and read what the
 * difference is made of. That verb is the whole reason the bench works, and it
 * was abandoned at exactly the point it becomes valuable. A kid arriving in the
 * market gets eight rows and no way to hold two of them against each other, so
 * the choice comes down to which logo they like. Roblox, obviously.
 *
 * So the same verb, one act later. Pick two, and the differences are named.
 *
 * The hard rule here, and the reason this module is longer than it looks: **it
 * never says which one to buy.** Every row is a trade-off with two ends, and
 * the summary says out loud that you cannot have both. A lower P/E is not
 * better; it is cheaper, and cheap usually means somebody thinks it will
 * shrink. Faster growth is not better; it is faster, and fast usually costs
 * more. A kid who leaves Act 4 believing "low P/E good" has learned something
 * false, and would have been better off learning nothing.
 *
 * Pure module. No React, no I/O.
 */

import {
  MODELS,
  formatMillions,
  metricsFor,
  type Company,
} from './companies';

export type Edge = 'a' | 'b' | 'even';

export interface FaceoffRow {
  /** What is being compared, in the words Act 1 taught. */
  label: string;
  emoji: string;
  a: string;
  b: string;
  /** Which one is *more*, which is not the same as which one is better. */
  edge: Edge;
  /** What being more of this actually costs you. Never advice. */
  meaning: string;
}

export interface Faceoff {
  a: Company;
  b: Company;
  rows: FaceoffRow[];
  /** The one sentence worth reading. Always a trade-off, never a verdict. */
  tradeOff: string;
}

function edgeOf(x: number | null, y: number | null, tolerance = 0.02): Edge {
  if (x === null || y === null) return x === null && y === null ? 'even' : x === null ? 'b' : 'a';
  const bigger = Math.max(Math.abs(x), Math.abs(y));
  if (bigger === 0 || Math.abs(x - y) / bigger < tolerance) return 'even';
  return x > y ? 'a' : 'b';
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function faceoff(
  a: Company,
  b: Company,
  priceA: number,
  priceB: number,
  asOf?: string,
): Faceoff {
  const ma = metricsFor(a, priceA, asOf);
  const mb = metricsFor(b, priceB, asOf);

  const rows: FaceoffRow[] = [
    {
      label: 'How much it sells',
      emoji: '💵',
      a: formatMillions(ma.year.revenueM),
      b: formatMillions(mb.year.revenueM),
      edge: edgeOf(ma.year.revenueM, mb.year.revenueM),
      meaning: 'A bigger business is harder to knock over, and harder to double.',
    },
    {
      label: 'What it keeps',
      emoji: '💰',
      a: `${(ma.netMargin * 100).toFixed(0)}c per $1`,
      b: `${(mb.netMargin * 100).toFixed(0)}c per $1`,
      edge: edgeOf(ma.netMargin, mb.netMargin),
      meaning: 'The same margin you worked out on your own stand, one dollar at a time.',
    },
    {
      label: 'How fast it grows',
      emoji: '📈',
      a: growthLabel(ma),
      b: growthLabel(mb),
      edge: edgeOf(growthOf(ma), growthOf(mb)),
      meaning: 'Three years of it, not one, so a single odd year cannot flatter anybody.',
    },
    {
      label: 'What you pay for it',
      emoji: '🏷️',
      a: ma.pe === null ? 'no profit to price' : `${ma.pe.toFixed(0)} years of profit`,
      b: mb.pe === null ? 'no profit to price' : `${mb.pe.toFixed(0)} years of profit`,
      edge: edgeOf(ma.pe, mb.pe),
      meaning:
        'Higher is not worse and lower is not a bargain. It is what other people already expect.',
    },
    {
      label: 'How much it jumps about',
      emoji: '🎢',
      a: pct(a.volatility),
      b: pct(b.volatility),
      edge: edgeOf(a.volatility, b.volatility),
      meaning: 'How far the price swung in a normal year. Not a measure of the business.',
    },
    {
      label: 'How the money arrives',
      emoji: '🔁',
      a: MODELS[a.model].name,
      b: MODELS[b.model].name,
      edge: 'even',
      meaning: 'Two businesses can earn the same money in completely different ways.',
    },
  ];

  return { a, b, rows, tradeOff: tradeOffFor(a, b, ma, mb) };
}

function growthOf(m: ReturnType<typeof metricsFor>): number {
  // For a company still losing money, profit growth is meaningless — a widening
  // loss shrinking is not growth. Revenue is the only honest figure.
  return m.profitable ? m.year.growth : m.year.revenueGrowth;
}

function growthLabel(m: ReturnType<typeof metricsFor>): string {
  const value = growthOf(m);
  const what = m.profitable ? 'profit' : 'sales';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(0)}%/yr ${what}`;
}

/**
 * The sentence at the top, and the only place this module is allowed an
 * opinion — which is an opinion about the *shape* of the choice, never about
 * the answer.
 */
function tradeOffFor(
  a: Company,
  b: Company,
  ma: ReturnType<typeof metricsFor>,
  mb: ReturnType<typeof metricsFor>,
): string {
  const [fast, slow, mFast, mSlow] =
    growthOf(ma) >= growthOf(mb) ? [a, b, ma, mb] : [b, a, mb, ma];

  if (!mFast.profitable && mSlow.profitable) {
    return `${fast.name} is growing faster and does not make a profit yet. ${slow.name} makes one and grows slowly. You are choosing between a maybe and a certainty.`;
  }
  if (mFast.pe !== null && mSlow.pe !== null && mFast.pe > mSlow.pe * 1.25) {
    return `${fast.name} grows faster and costs more years of profit. ${slow.name} is cheaper and slower. Nobody is giving anything away — you are picking which risk you would rather take.`;
  }
  if (mFast.pe !== null && mSlow.pe !== null && mFast.pe < mSlow.pe * 0.8) {
    return `${fast.name} grows faster and costs fewer years of profit than ${slow.name}. That is unusual, so the interesting question is what other people are worried about.`;
  }
  if (Math.abs(ma.netMargin - mb.netMargin) > 0.08) {
    const [rich, thin] = ma.netMargin > mb.netMargin ? [a, b] : [b, a];
    return `${rich.name} keeps far more of every dollar than ${thin.name}. Ask what lets it charge that much, and whether anybody could copy it.`;
  }
  return `These two are closer than they look. The difference is how the money arrives — ${MODELS[a.model].name.toLowerCase()} against ${MODELS[b.model].name.toLowerCase()}.`;
}
