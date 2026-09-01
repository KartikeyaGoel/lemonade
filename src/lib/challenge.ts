/**
 * Same-Sky Challenge.
 *
 * The weather in this game is seeded, which means a seed *is* a fortnight. Two
 * kids who put in the same code get the identical week — the same forecasts,
 * the same days turning out hot when they were promised cool, the same rival
 * opening on the same morning at the same price.
 *
 * That matters for a reason beyond fairness. If the world is identical then the
 * whole difference in the result is decisions, and the difference can be
 * decomposed and shown. "You beat me by $41, and $28 of it was because you
 * charged twenty cents more and $9 of it was lemons I threw away" is a sentence
 * a kid learns something from. "You won" is not.
 *
 * So the comparison screen never leads with the winner. It leads with the
 * arithmetic of *why*, and every line of it reconciles to the gap.
 *
 * Pure module. No React, no I/O.
 */

import { ECON, ingredientCostOf, round2, type DayRecord } from './simulation';
import { ByteReader, ByteWriter, decodeShort, encodeShort } from './sharecode';

export const CHALLENGE_PREFIX = 'SKY';
export const RESULT_PREFIX = 'RUN';

/** A challenge is a week, so it fits in a lunch break and stays comparable. */
export const CHALLENGE_DAYS = 7;

export type ChallengeRule = 'classic';

const RULES: ChallengeRule[] = ['classic'];

export interface ChallengeSpec {
  version: number;
  seed: number;
  days: number;
  rule: ChallengeRule;
}

export function createChallenge(seed: number, days = CHALLENGE_DAYS): ChallengeSpec {
  return {
    version: 1,
    seed: seed >>> 0,
    days: Math.max(1, Math.min(31, Math.round(days))),
    rule: 'classic',
  };
}

/**
 * The daily challenge everyone in the world gets, derived from the date alone.
 *
 * The date is passed in rather than read, because a module that reads the clock
 * cannot be tested and cannot be replayed.
 */
export function skyOfTheDay(isoDate: string): ChallengeSpec {
  let hash = 0x811c9dc5;
  for (let i = 0; i < isoDate.length; i++) {
    hash ^= isoDate.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return createChallenge(hash);
}

export function encodeChallenge(spec: ChallengeSpec): string {
  const ruleIndex = Math.max(0, RULES.indexOf(spec.rule));
  const payload = new ByteWriter()
    .u8((spec.version << 4) | ruleIndex)
    .uint(spec.seed, 4)
    .u8(spec.days)
    .done();
  return encodeShort(CHALLENGE_PREFIX, payload);
}

export function decodeChallenge(code: string): ChallengeSpec | null {
  const payload = decodeShort(CHALLENGE_PREFIX, code, 6);
  if (!payload) return null;

  const reader = new ByteReader(payload);
  const head = reader.u8();
  const version = head >> 4;
  const rule = RULES[head & 0x0f];
  const seed = reader.uint(4);
  const days = reader.u8();

  if (version !== 1 || !rule || days < 1 || days > 31) return null;
  return { version, seed, days, rule };
}

/* ------------------------------------------------------------------ *
 * What a run came to
 * ------------------------------------------------------------------ */

export interface RunLedger {
  days: number;
  cupsSold: number;
  revenue: number;
  ingredientCost: number;
  grossProfit: number;
  /** Gross profit per cup — price and cost, blended. */
  marginPerCup: number;
  fixedCost: number;
  spoiledLemons: number;
  spoilageCost: number;
  profit: number;
  avgPrice: number;
}

/**
 * Rebuilds the whole run from its day records.
 *
 * Ingredient cost is recomputed with `ingredientCostOf` rather than stored,
 * because that function is the single source of truth for what a cup costs and
 * it already accounts for cutting a whole lemon for the last cup.
 */
export function runLedger(history: DayRecord[]): RunLedger {
  let cupsSold = 0;
  let revenue = 0;
  let ingredientCost = 0;
  let fixedCost = 0;
  let spoiledLemons = 0;

  for (const day of history) {
    cupsSold += day.cupsSold;
    revenue = round2(revenue + day.revenue);
    ingredientCost = round2(ingredientCost + ingredientCostOf(day.cupsSold).total);
    fixedCost = round2(fixedCost + (day.fixedCost ?? ECON.STAND_FEE));
    spoiledLemons += day.spoiledLemons ?? 0;
  }

  const spoilageCost = round2(spoiledLemons * ECON.LEMON_COST);
  const grossProfit = round2(revenue - ingredientCost);

  return {
    days: history.length,
    cupsSold,
    revenue,
    ingredientCost,
    grossProfit,
    marginPerCup: cupsSold > 0 ? grossProfit / cupsSold : 0,
    fixedCost,
    spoiledLemons,
    spoilageCost,
    profit: round2(grossProfit - fixedCost - spoilageCost),
    avgPrice: cupsSold > 0 ? revenue / cupsSold : 0,
  };
}

/* ------------------------------------------------------------------ *
 * The result code
 * ------------------------------------------------------------------ */

export interface RunResult {
  seed: number;
  who: string;
  days: number;
  profit: number;
  cupsSold: number;
  revenue: number;
  /**
   * Revenue minus ingredients, carried rather than recomputed.
   *
   * A whole lemon is cut even for one cup, so the ingredient cost of a week is
   * not the ingredient cost of the week's total cups. Recomputing it from the
   * total was out by a few cents a day, which meant the four lines of the
   * comparison did not quite add up to the gap — and a screen whose numbers do
   * not reconcile is worse than no screen.
   */
  grossProfit: number;
  avgPriceCents: number;
  spoiledLemons: number;
  fixedCost: number;
  badges: number;
}

/** Trims a name to what a code can carry: eight letters, no punctuation. */
export function tidyName(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'FRIEND';
}

export function summariseRun(
  seed: number,
  who: string,
  history: DayRecord[],
  badges = 0,
): RunResult {
  const ledger = runLedger(history);
  return {
    seed: seed >>> 0,
    who: tidyName(who),
    days: ledger.days,
    profit: ledger.profit,
    cupsSold: ledger.cupsSold,
    revenue: ledger.revenue,
    grossProfit: ledger.grossProfit,
    avgPriceCents: Math.round(ledger.avgPrice * 100),
    spoiledLemons: ledger.spoiledLemons,
    fixedCost: ledger.fixedCost,
    badges,
  };
}

/**
 * Profit is signed, and a bad week is a real outcome we must be able to send,
 * so it is stored as cents offset by half the range rather than as a raw uint.
 */
const PROFIT_OFFSET = 500_000;

export function encodeResult(result: RunResult): string {
  const letters = tidyName(result.who);
  const writer = new ByteWriter()
    .u8(1)
    .uint(result.seed, 4)
    .u8(result.days)
    .uint(Math.round(result.profit * 100) + PROFIT_OFFSET, 3)
    .uint(Math.round(result.revenue * 100), 3)
    .uint(Math.round(result.grossProfit * 100) + PROFIT_OFFSET, 3)
    .uint(result.cupsSold, 2)
    .uint(result.avgPriceCents, 2)
    .uint(Math.min(9999, result.spoiledLemons), 2)
    .uint(Math.round(result.fixedCost * 100), 3)
    .u8(result.badges)
    .u8(letters.length);
  for (let i = 0; i < 8; i++) {
    writer.u8(i < letters.length ? letters.charCodeAt(i) : 32);
  }
  return encodeShort(RESULT_PREFIX, writer.done());
}

const RESULT_BYTES = 1 + 4 + 1 + 3 + 3 + 3 + 2 + 2 + 2 + 3 + 1 + 1 + 8;

export function decodeResult(code: string): RunResult | null {
  const payload = decodeShort(RESULT_PREFIX, code, RESULT_BYTES);
  if (!payload) return null;

  const reader = new ByteReader(payload);
  if (reader.u8() !== 1) return null;

  const seed = reader.uint(4);
  const days = reader.u8();
  const profit = round2((reader.uint(3) - PROFIT_OFFSET) / 100);
  const revenue = round2(reader.uint(3) / 100);
  const grossProfit = round2((reader.uint(3) - PROFIT_OFFSET) / 100);
  const cupsSold = reader.uint(2);
  const avgPriceCents = reader.uint(2);
  const spoiledLemons = reader.uint(2);
  const fixedCost = round2(reader.uint(3) / 100);
  const badges = reader.u8();
  const nameLength = Math.min(8, reader.u8());

  let who = '';
  for (let i = 0; i < 8; i++) {
    const char = reader.u8();
    if (i < nameLength) who += String.fromCharCode(char);
  }

  if (days < 1 || days > 31) return null;
  return {
    seed,
    who: who || 'FRIEND',
    days,
    profit,
    cupsSold,
    revenue,
    grossProfit,
    avgPriceCents,
    spoiledLemons,
    fixedCost,
    badges,
  };
}

/* ------------------------------------------------------------------ *
 * Why the gap is the size it is
 * ------------------------------------------------------------------ */

export interface DiffLine {
  label: string;
  /** Dollars this factor moved in the reader's favour. Negative means against. */
  dollars: number;
  /** One sentence in the kid's own numbers. */
  note: string;
}

export interface Comparison {
  sameSky: boolean;
  winner: 'you' | 'them' | 'tie';
  gap: number;
  mine: RunResult;
  theirs: RunResult;
  lines: DiffLine[];
  /** Who is ahead and by how much. Short, because it goes in the sign font. */
  headline: string;
  /**
   * Which single factor did most of the work.
   *
   * Kept apart from the headline: as one sentence it ran to four lines of
   * display type, and the *cause* is the part worth reading slowly anyway.
   */
  cause: string | null;
}

/**
 * Splits the profit gap into the four things that could have caused it.
 *
 * The decomposition is the standard price/volume one — the difference in what
 * you keep per cup, valued at their number of cups, plus the difference in cups
 * valued at your margin — and then the two cost lines, which need no
 * decomposition because they are simply owed. The four lines sum to the gap, and
 * a test holds them to that.
 */
export function compareRuns(mine: RunResult, theirs: RunResult): Comparison {
  const sameSky = mine.seed === theirs.seed && mine.days === theirs.days;

  const myMargin = mine.cupsSold > 0 ? mine.grossProfit / mine.cupsSold : 0;
  const theirMargin = theirs.cupsSold > 0 ? theirs.grossProfit / theirs.cupsSold : 0;

  const marginEdge = round2((myMargin - theirMargin) * theirs.cupsSold);
  const volumeEdge = round2((mine.cupsSold - theirs.cupsSold) * myMargin);
  const fixedEdge = round2(theirs.fixedCost - mine.fixedCost);
  const spoilEdge = round2(
    (theirs.spoiledLemons - mine.spoiledLemons) * ECON.LEMON_COST,
  );

  const lines: DiffLine[] = [
    {
      label: 'What you kept per cup',
      dollars: marginEdge,
      note: `You kept ${money(myMargin)} a cup, they kept ${money(theirMargin)}.`,
    },
    {
      label: 'Cups sold',
      dollars: volumeEdge,
      note: `You sold ${mine.cupsSold}, they sold ${theirs.cupsSold}.`,
    },
    {
      label: 'Rent and wages',
      dollars: fixedEdge,
      note: `You owed ${money(mine.fixedCost)} whatever happened, they owed ${money(theirs.fixedCost)}.`,
    },
    {
      label: 'Lemons thrown away',
      dollars: spoilEdge,
      note: `You wasted ${mine.spoiledLemons}, they wasted ${theirs.spoiledLemons}.`,
    },
  ];

  const gap = round2(mine.profit - theirs.profit);
  const winner: Comparison['winner'] = gap > 0 ? 'you' : gap < 0 ? 'them' : 'tie';

  return {
    sameSky,
    winner,
    gap,
    mine,
    theirs,
    lines: lines.filter((line) => Math.abs(line.dollars) >= 0.5),
    headline: headlineFor(winner, gap, sameSky),
    cause: causeFor(lines, sameSky, winner),
  };
}

function headlineFor(
  winner: Comparison['winner'],
  gap: number,
  sameSky: boolean,
): string {
  if (!sameSky) return 'Different weeks';
  if (winner === 'tie') return 'Dead level';
  return winner === 'you'
    ? `You are ahead by ${money(Math.abs(gap))}`
    : `You are behind by ${money(Math.abs(gap))}`;
}

function causeFor(
  lines: DiffLine[],
  sameSky: boolean,
  winner: Comparison['winner'],
): string | null {
  if (!sameSky) {
    return 'You did not get the same weather, so the numbers are worth comparing but it is not a fair race.';
  }
  if (winner === 'tie') return 'Same sky, same money, different routes.';

  const biggest = [...lines].sort((a, b) => Math.abs(b.dollars) - Math.abs(a.dollars))[0];
  if (!biggest || Math.abs(biggest.dollars) < 0.5) return null;
  return `Most of it was ${biggest.label.toLowerCase()}.`;
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
