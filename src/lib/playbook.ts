/**
 * The playbook.
 *
 * Clash Royale is a game about war, which is not a subject an eleven-year-old
 * has any business being good at, and they get good at it anyway. The mechanism
 * is not the battles. It is the **deck**: eight cards you choose, name, save,
 * copy off somebody better, tweak, and test. The strategy is an object you own.
 * That is what turns "I like this game" into "I watched forty minutes of deck
 * guides on YouTube", which is the only kind of learning that actually
 * compounds — the kind nobody assigned.
 *
 * This game had no deck. It had decisions, one at a time, each argued from
 * scratch. A kid could play the whole of Act 4 well and still not be able to
 * say what their strategy *was*, because there was nowhere for a strategy to
 * live.
 *
 * So: a playbook is up to four rule cards, with a name. It is the deck.
 *
 * Two things make it teach rather than decorate:
 *
 *  1. **It runs.** The rules are executable, and the game plays them out over
 *     real market history without the kid touching anything. Strategy stops
 *     being a feeling and becomes a thing with an outcome.
 *
 *  2. **It runs everywhere.** Not on one twelve-week stretch — on *every*
 *     twelve-week stretch in five years of real prices, all two hundred-odd of
 *     them. So the answer is never "your rules made 8%", it is "your rules made
 *     money in 137 stretches out of 224, lost in 87, and the worst one was
 *     −19%". That single change is the difference between a game that teaches
 *     investing and a game that teaches gambling, because it makes the shape of
 *     a strategy visible instead of the result of one roll of it.
 *
 * A kid who has internalised "one good result is not evidence" has learned the
 * most valuable thing in this entire product, and they will have learned it by
 * tinkering with a deck.
 *
 * Pure module. No React, no I/O.
 */

import {
  SNAPSHOT,
  hasAccountsBy,
  metricsFor,
  type Company,
} from './companies';
import {
  HISTORY_WEEKS,
  MARKET_WEEKS,
  realClose,
  weekDate,
  windowStartFor,
} from './market';
import { round2 } from './simulation';
import { ByteReader, ByteWriter, decodeShort, encodeShort } from './sharecode';

/** Four. Small enough to hold in your head, big enough to have a shape. */
export const DECK_SIZE = 4;

export type RuleKind = 'pick' | 'size' | 'hold';

export interface RuleCard {
  id: string;
  name: string;
  emoji: string;
  kind: RuleKind;
  /** What the rule does, as the kid would say it. */
  says: string;
  /** The idea underneath. Shown on the back of the card. */
  teaches: string;
  /** `pick` rules: is this company allowed in? */
  allows?: (company: Company, price: number, asOf: string) => boolean;
  /** `size` rules: the most that may go into any one company. */
  cap?: number;
  /** `hold` rules: sell a holding once it is down this far, or never. */
  sellBelow?: number;
}

/*
 * The collection.
 *
 * Every card is a heuristic a real investor would recognise, and — this is the
 * part that matters — **none of them is right**. Each one is a trade that costs
 * something: refusing loss-makers means never owning a young company, selling
 * on a fall means locking in every dip, spreading wide means your best idea
 * cannot carry you. The kid finds out which costs they mind by running them.
 */
export const RULE_CARDS: RuleCard[] = [
  {
    id: 'profitable',
    name: 'Profit only',
    emoji: '💰',
    kind: 'pick',
    says: 'Only businesses that actually make a profit.',
    teaches: 'Safe, and it means you will never own a company in its fastest years.',
    allows: (c, price, asOf) => metricsFor(c, price, asOf).pe !== null,
  },
  {
    id: 'cheap',
    name: 'Nothing dear',
    emoji: '🏷️',
    kind: 'pick',
    says: 'Only if it costs under 30 years of profit.',
    teaches: 'Cheap is not the same as good. Sometimes it is cheap for a reason.',
    allows: (c, price, asOf) => {
      const pe = metricsFor(c, price, asOf).pe;
      return pe !== null && pe <= 30;
    },
  },
  {
    id: 'fat-margin',
    name: 'Keeps a lot',
    emoji: '🥇',
    kind: 'pick',
    says: 'Only if it keeps 20c or more of every dollar.',
    teaches: 'The margin you worked out on your own stand, one dollar at a time.',
    allows: (c, price, asOf) => metricsFor(c, price, asOf).netMargin >= 0.2,
  },
  {
    id: 'growing',
    name: 'Getting better',
    emoji: '📈',
    kind: 'pick',
    says: 'Only if profit is growing 10% a year or more.',
    teaches: 'Growth is what you are really buying. It is also what you are paying for.',
    allows: (c, price, asOf) => metricsFor(c, price, asOf).year.growth >= 0.1,
  },
  {
    id: 'more-customers',
    name: 'Getting bigger',
    emoji: '🌱',
    kind: 'pick',
    says: 'Only if sales are growing 15% a year or more.',
    teaches: 'Bigger and better are different. This rule does not care about profit.',
    allows: (c, price, asOf) => metricsFor(c, price, asOf).year.revenueGrowth >= 0.15,
  },
  {
    id: 'huge',
    name: 'Big and boring',
    emoji: '🐘',
    kind: 'pick',
    says: 'Only companies selling more than $50B a year.',
    teaches: 'Hard to knock over. Also hard to double.',
    allows: (c, price, asOf) => metricsFor(c, price, asOf).year.revenueM >= 50_000,
  },
  {
    id: 'i-use-it',
    name: 'Stuff I use',
    emoji: '🧒',
    kind: 'pick',
    says: 'Only the businesses you can see from your own house.',
    teaches: 'You can check on these yourself. That is worth more than it sounds.',
    allows: (c) => c.tier === 1,
  },
  {
    id: 'spread-thin',
    name: 'Spread it out',
    emoji: '🍰',
    kind: 'size',
    says: 'Never more than a quarter in any one company.',
    cap: 0.25,
    teaches: 'Nothing can ruin you. Nothing can save you either.',
  },
  {
    id: 'back-the-best',
    name: 'Back your best',
    emoji: '🎯',
    kind: 'size',
    says: 'Up to half your money in one company.',
    cap: 0.5,
    teaches: 'If you are right it is worth much more. If you are wrong it hurts much more.',
  },
  {
    id: 'hold-on',
    name: 'Sit on your hands',
    emoji: '🧘',
    kind: 'hold',
    says: 'Never sell, whatever happens.',
    teaches: 'Every fall you sat through, you also got the recovery.',
  },
  {
    id: 'stop-20',
    name: 'Cut it at 20%',
    emoji: '🚪',
    kind: 'hold',
    says: 'Sell anything that falls 20% below what you paid.',
    teaches: 'Caps the damage. Also sells the bottom, every single time.',
    sellBelow: 0.2,
  },
  {
    id: 'stop-10',
    name: 'Cut it at 10%',
    emoji: '🏃',
    kind: 'hold',
    says: 'Sell anything that falls 10% below what you paid.',
    teaches: 'Very safe, very twitchy. Watch how often it sells something that then recovers.',
    sellBelow: 0.1,
  },
];

export function ruleById(id: string): RuleCard | undefined {
  return RULE_CARDS.find((card) => card.id === id);
}

export interface Playbook {
  name: string;
  ruleIds: string[];
}

export function createPlaybook(name = '', ruleIds: string[] = []): Playbook {
  return { name, ruleIds: ruleIds.slice(0, DECK_SIZE) };
}

/** Toggling a card in or out, respecting the deck size. */
export function toggleRule(playbook: Playbook, id: string): Playbook {
  if (playbook.ruleIds.includes(id)) {
    return { ...playbook, ruleIds: playbook.ruleIds.filter((r) => r !== id) };
  }
  if (playbook.ruleIds.length >= DECK_SIZE) return playbook;
  return { ...playbook, ruleIds: [...playbook.ruleIds, id] };
}

/** Defaults for anything the deck does not say. Both are the cautious answer. */
const DEFAULT_CAP = 0.35;

function rulesOf(playbook: Playbook): RuleCard[] {
  return playbook.ruleIds.map(ruleById).filter((r): r is RuleCard => Boolean(r));
}

export interface Backtest {
  windowStart: number;
  startedOn: string;
  endedOn: string;
  startValue: number;
  endValue: number;
  returnPct: number;
  /** The deepest the whole pot ever went below where it started. */
  worstFall: number;
  bought: string[];
  sold: string[];
  /** True when nothing passed the picking rules and the money sat in cash. */
  boughtNothing: boolean;
}

/**
 * Plays the rules out over one real twelve-week stretch.
 *
 * Buys once, at the start, equally across everything the picking rules allow,
 * subject to the size cap. That is a simplification and a deliberate one: the
 * question this answers is "what do these rules do", not "could you have timed
 * it". Timing is the thing the game refuses to teach.
 */
export function backtest(playbook: Playbook, windowStart: number, cash = 1000): Backtest {
  const rules = rulesOf(playbook);
  const picks = rules.filter((r) => r.kind === 'pick');
  const cap = rules.find((r) => r.kind === 'size')?.cap ?? DEFAULT_CAP;
  const sellBelow = rules.find((r) => r.kind === 'hold')?.sellBelow;

  const asOf = weekDate(windowStart, 0);
  const allowed = SNAPSHOT.filter((company) => {
    if (!hasAccountsBy(company, asOf)) return false;
    const price = realClose(company.ticker, windowStart, 0);
    return picks.every((rule) => rule.allows?.(company, price, asOf) ?? true);
  });

  if (allowed.length === 0) {
    return {
      windowStart,
      startedOn: asOf,
      endedOn: weekDate(windowStart, MARKET_WEEKS),
      startValue: cash,
      endValue: cash,
      returnPct: 0,
      worstFall: 0,
      bought: [],
      sold: [],
      boughtNothing: true,
    };
  }

  // Equally weighted, then trimmed to the cap. Whatever the cap refuses stays
  // in cash, which is itself a result the kid should see.
  const perName = Math.min(cash / allowed.length, cash * cap);
  const holdings = allowed.map((company) => {
    const price = realClose(company.ticker, windowStart, 0);
    return { ticker: company.ticker, shares: perName / price, paid: perName, open: true };
  });
  let idle = round2(cash - perName * allowed.length);

  const sold: string[] = [];
  let worstFall = 0;

  for (let week = 1; week <= MARKET_WEEKS; week++) {
    let invested = 0;
    for (const holding of holdings) {
      if (!holding.open) continue;
      const price = realClose(holding.ticker, windowStart, week);
      const value = holding.shares * price;

      if (sellBelow !== undefined && value < holding.paid * (1 - sellBelow)) {
        holding.open = false;
        idle = round2(idle + value);
        sold.push(holding.ticker);
        continue;
      }
      invested += value;
    }
    const total = invested + idle;
    worstFall = Math.min(worstFall, total / cash - 1);
  }

  let endValue = idle;
  for (const holding of holdings) {
    if (!holding.open) continue;
    endValue += holding.shares * realClose(holding.ticker, windowStart, MARKET_WEEKS);
  }
  endValue = round2(endValue);

  return {
    windowStart,
    startedOn: asOf,
    endedOn: weekDate(windowStart, MARKET_WEEKS),
    startValue: cash,
    endValue,
    returnPct: endValue / cash - 1,
    worstFall,
    bought: allowed.map((c) => c.ticker),
    sold,
    boughtNothing: false,
  };
}

/** Every distinct twelve-week stretch the data can offer. */
export function allWindows(): number[] {
  const windows = new Set<number>();
  for (let seed = 0; seed < HISTORY_WEEKS * 8; seed++) windows.add(windowStartFor(seed));
  return [...windows].sort((a, b) => a - b);
}

export interface Record {
  windows: number;
  /** Stretches where the rules ended ahead. */
  won: number;
  winRate: number;
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  /** The deepest the pot fell in the unluckiest stretch. */
  worstFall: number;
  /** How often the rules found nothing to buy at all. */
  satOutCount: number;
  /** How many different companies the rules ever allowed. */
  namesEverBought: number;
  /** The single sentence worth reading. */
  headline: string;
}

/**
 * The rules, run over every stretch of real history there is.
 *
 * This is the whole point of the module. A kid who reads "you made 11%" learns
 * that they are good at this. A kid who reads "these rules made money in 6
 * stretches out of 10, the best was +24% and the worst was −18%" has learned
 * what a strategy actually is, and there is no lecture that does that.
 */
export function record(playbook: Playbook, cash = 1000): Record {
  const windows = allWindows();
  const runs = windows.map((start) => backtest(playbook, start, cash));
  const returns = runs.map((r) => r.returnPct).sort((a, b) => a - b);
  const won = runs.filter((r) => r.returnPct > 0).length;
  const satOut = runs.filter((r) => r.boughtNothing).length;
  const names = new Set(runs.flatMap((r) => r.bought));

  const winRate = runs.length > 0 ? won / runs.length : 0;
  const median = returns.length > 0 ? returns[Math.floor(returns.length / 2)] : 0;
  const worstFall = Math.min(0, ...runs.map((r) => r.worstFall));

  return {
    windows: runs.length,
    won,
    winRate,
    medianReturn: median,
    bestReturn: returns[returns.length - 1] ?? 0,
    worstReturn: returns[0] ?? 0,
    worstFall,
    satOutCount: satOut,
    namesEverBought: names.size,
    headline: headlineFor(winRate, median, satOut, runs.length, names.size),
  };
}

function pct(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(0)}%`;
}

function headlineFor(
  winRate: number,
  median: number,
  satOut: number,
  windows: number,
  names: number,
): string {
  if (satOut === windows) {
    return 'These rules never let you buy anything. Your money stayed in cash the whole time, every time.';
  }
  if (satOut > windows / 3) {
    return `These rules find nothing to buy in ${Math.round((satOut / windows) * 100)}% of stretches. Being that fussy is a decision too.`;
  }
  if (names <= 2) {
    return `Only ${names === 1 ? 'one company' : 'two companies'} ever gets past these rules. That is a bet on ${names === 1 ? 'it' : 'them'}, not a strategy.`;
  }
  if (winRate >= 0.7) {
    return `Ahead in ${Math.round(winRate * 100)}% of stretches, usually by ${pct(median)}. Worth asking what it is giving up to be that reliable.`;
  }
  if (winRate <= 0.4) {
    return `Behind more often than not: ahead in only ${Math.round(winRate * 100)}% of stretches. The wins would have to be big to make up for that.`;
  }
  return `Ahead in ${Math.round(winRate * 100)}% of stretches, typically ${pct(median)}. Roughly a coin-flip with a lean — which is what most real strategies look like.`;
}

/* ------------------------------------------------------------------ *
 * Sharing
 * ------------------------------------------------------------------ */

export const PLAYBOOK_PREFIX = 'PLAY';

/**
 * Cards are sent by their index in `RULE_CARDS`, so a code is tiny.
 *
 * Adding a card is safe; reordering or removing one is not, which is why the
 * decoder checks the range and refuses anything it does not recognise rather
 * than silently handing back a different strategy from the one that was sent.
 */
/**
 * Fixed width — a version byte, a count, and four card slots.
 *
 * `decodeShort` verifies a checksum against a known payload length, so the
 * payload cannot be variable. Empty slots are sent as 0xFF, which is never a
 * valid card index.
 */
const EMPTY_SLOT = 0xff;
const PLAYBOOK_BYTES = 2 + DECK_SIZE;

export function encodePlaybook(playbook: Playbook): string {
  const writer = new ByteWriter().u8(1).u8(playbook.ruleIds.length);
  for (let slot = 0; slot < DECK_SIZE; slot++) {
    const id = playbook.ruleIds[slot];
    const index = id ? RULE_CARDS.findIndex((card) => card.id === id) : -1;
    writer.u8(index >= 0 ? index : EMPTY_SLOT);
  }
  return encodeShort(PLAYBOOK_PREFIX, writer.done());
}

export function decodePlaybook(code: string, name = 'A friend'): Playbook | null {
  const bytes = decodeShort(PLAYBOOK_PREFIX, code, PLAYBOOK_BYTES);
  if (!bytes) return null;
  const reader = new ByteReader(bytes);
  if (reader.u8() !== 1) return null;

  const count = reader.u8();
  if (count > DECK_SIZE) return null;

  const ruleIds: string[] = [];
  for (let slot = 0; slot < DECK_SIZE; slot++) {
    const index = reader.u8();
    if (index === EMPTY_SLOT) continue;
    const card = RULE_CARDS[index];
    // An unknown or repeated card means the code came from a different build.
    // Handing back a strategy that is not the one somebody sent is worse than
    // saying the code is bad.
    if (!card || ruleIds.includes(card.id)) return null;
    ruleIds.push(card.id);
  }
  if (ruleIds.length !== count) return null;
  return { name, ruleIds };
}
