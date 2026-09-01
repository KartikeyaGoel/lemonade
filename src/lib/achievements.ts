/**
 * The trophy case.
 *
 * XP is the obvious mechanic here and it is the wrong one. XP pays for time
 * spent, so it pays for grinding, so the fastest route to the top of the board
 * is to stop thinking — which is precisely the habit that ruins people in
 * markets. We would be building activity-mistaken-for-skill on purpose.
 *
 * So every badge below is awarded for a *specific decision that can only be
 * made by someone who understood something*. Not "played ten days" —
 * "raised your price after buying the juicer and sold more cups anyway". You
 * cannot do that by accident, and you cannot repeat it without knowing why.
 *
 * Two rules keep this honest:
 *
 *  1. Every badge is derived from saved game state — the actual history of
 *     days, purchases, offers and trades. Nothing is awarded by a flag set
 *     when a screen was viewed.
 *  2. Some are genuinely hard, and a few most kids will never get. A trophy
 *     case that fills up on its own is worth nothing to look at.
 *
 * Pure module. No React, no I/O.
 */

import { type DayRecord } from './simulation';
import { HANDS_OFF_DAYS_REQUIRED, type BusinessState } from './business';
import { GROWING_MULTIPLE, judgeDealChoice, type OwnershipState } from './ownership';
import { DIVERSIFIED_MIN_HOLDINGS, type PortfolioState } from './market';
import { GLOSSARY } from './glossary';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'legend';

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  /** The concept this badge is evidence of. Shown on the back of the card. */
  proves: string;
  /** How to get it, in kid language. Shown while it is still locked. */
  how: string;
  tier: BadgeTier;
  act: 1 | 2 | 3 | 4 | 'social';
}

export interface BadgeContext {
  history: DayRecord[];
  business: BusinessState;
  ownership: OwnershipState;
  portfolio: PortfolioState | null;
  learned: string[];
  /** Same-sky challenges finished, from the career record. */
  challengesPlayed: number;
  /** Weeks survived in an investment club. */
  clubWeeks: number;
  /** Proposals the kid talked the club into. */
  clubProposalsPassed: number;
  /** Buys made with a written reason. */
  thesisCount: number;
}

interface BadgeDef extends Badge {
  test: (ctx: BadgeContext) => boolean;
}

/* ------------------------------------------------------------------ *
 * Small honest predicates over real history
 * ------------------------------------------------------------------ */

/**
 * Did they ever put the price up and make more money than before?
 *
 * This is the one that proves they understand which way the demand curve runs,
 * so it is deliberately strict: a real rise, the same kind of weather, and more
 * profit than the cheaper day produced.
 */
function raisedPriceAndEarnedMore(history: DayRecord[]): boolean {
  for (let i = 0; i < history.length; i++) {
    for (let j = i + 1; j < history.length; j++) {
      const cheap = history[i];
      const dear = history[j];
      if (dear.weather !== cheap.weather) continue;
      if (dear.price < cheap.price + 0.2) continue;
      if (dear.profit > cheap.profit) return true;
    }
  }
  return false;
}

/** Their worst day, and what they did the day after it. */
function reactionToWorstDay(history: DayRecord[]): number | null {
  const judgeable = history.filter((day) => history.some((other) => other.day === day.day + 1));
  if (judgeable.length === 0) return null;
  const worst = judgeable.reduce((a, day) => (day.profit < a.profit ? day : a), judgeable[0]);
  const next = history.find((day) => day.day === worst.day + 1);
  if (!next) return null;
  return Math.abs(next.price - worst.price);
}

/** Did they hold their own against a rival rather than undercutting them? */
function heldTheLine(history: DayRecord[]): boolean {
  return history.some(
    (day) =>
      day.marketShare !== undefined &&
      day.marketShare < 1 &&
      day.marketShare >= 0.5 &&
      day.profit > 0,
  );
}

/** A cold day that still cleared the fixed costs. */
function profitInTheCold(history: DayRecord[]): boolean {
  return history.some((day) => day.weather === 'cold' && day.profit > 0);
}

function servedEveryone(history: DayRecord[]): boolean {
  return history.some((day) => day.cupsSold > 0 && day.cupsSold >= day.cupsWanted);
}

/** Sold out on a hot day: demand they could see and could not reach. */
function soldOutHot(history: DayRecord[]): boolean {
  return history.some((day) => day.weather === 'hot' && day.cupsWanted > day.cupsSold);
}

/**
 * Did the round carry a cold day?
 *
 * The lesson of recurring revenue is not that it exists, it is that it shows up
 * when nothing else does — so the badge asks for exactly that day.
 */
function roundCarriedAColdDay(history: DayRecord[]): boolean {
  return history.some(
    (day) => day.weather === 'cold' && (day.subscriberCups ?? 0) >= Math.ceil(day.cupsSold / 2),
  );
}

/* ------------------------------------------------------------------ *
 * The case itself
 * ------------------------------------------------------------------ */

export const BADGES: BadgeDef[] = [
  {
    id: 'open-for-business',
    name: 'Open for business',
    emoji: '🍋',
    proves: 'You have to commit money before you know how the day will go.',
    how: 'Run your stand for one day.',
    tier: 'bronze',
    act: 1,
    test: (c) => c.history.length >= 1,
  },
  {
    id: 'cold-day-profit',
    name: 'Made money in the cold',
    emoji: '🧣',
    proves: 'Fixed costs are owed whatever the weather does.',
    how: 'Finish a cold day with a profit anyway.',
    tier: 'bronze',
    act: 1,
    test: (c) => profitInTheCold(c.history),
  },
  {
    id: 'priced-up-won',
    name: 'Charged more, made more',
    emoji: '📈',
    proves: 'Cheaper is not the same as better. Fewer cups can be more money.',
    how: 'Put your price up at least 20c and beat an earlier day in the same weather.',
    tier: 'silver',
    act: 1,
    test: (c) => raisedPriceAndEarnedMore(c.history),
  },
  {
    id: 'served-everyone',
    name: 'Served everyone',
    emoji: '✅',
    proves: 'Matching what you make to what people want is its own skill.',
    how: 'Pour enough that nobody who wanted a cup went without.',
    tier: 'bronze',
    act: 1,
    test: (c) => servedEveryone(c.history),
  },
  {
    id: 'saw-the-queue',
    name: 'Saw the queue',
    emoji: '🚶',
    proves: 'Demand you cannot serve is money on the pavement.',
    how: 'Sell out on a hot day and watch people be turned away.',
    tier: 'bronze',
    act: 1,
    test: (c) => soldOutHot(c.history),
  },
  {
    id: 'steady-hand',
    name: 'Steady hand',
    emoji: '🧘',
    proves: 'One bad day is mostly weather. Reacting to it is how people lose money.',
    how: 'After your worst day, move your price by 10c or less.',
    tier: 'gold',
    act: 1,
    test: (c) => {
      const swing = reactionToWorstDay(c.history);
      return swing !== null && c.history.length >= 4 && swing <= 0.1;
    },
  },
  {
    id: 'first-machine',
    name: 'Bought a machine',
    emoji: '🧊',
    proves: 'Spending once to earn every day afterwards is different from paying rent.',
    how: 'Buy any upgrade for the stand.',
    tier: 'bronze',
    act: 2,
    test: (c) => Object.values(c.business.upgrades).some(Boolean),
  },
  {
    id: 'hired-someone',
    name: 'Hired someone',
    emoji: '🧑‍🍳',
    proves: 'A wage is owed every single day, whether or not the day was good.',
    how: 'Take on a helper or a manager.',
    tier: 'bronze',
    act: 2,
    test: (c) => c.business.staff.helper || c.business.staff.manager,
  },
  {
    id: 'held-the-line',
    name: 'Held the line',
    emoji: '🛡️',
    proves: 'A price war is a race to the bottom. Being worth more is the way out.',
    how: 'Keep half the street and stay profitable while somebody undercuts you.',
    tier: 'gold',
    act: 2,
    test: (c) => heldTheLine(c.history),
  },
  {
    id: 'pricing-power',
    name: 'Pricing power',
    emoji: '💪',
    proves: 'Being different lets you charge more for the same cup.',
    how: 'Go fresh-squeezed, then charge more than the stand down the street.',
    tier: 'gold',
    act: 2,
    test: (c) => c.business.upgrades.freshSqueeze && heldTheLine(c.history),
  },
  {
    id: 'started-a-round',
    name: 'Started a round',
    emoji: '🥛',
    proves: 'Money that arrives without being re-won is worth more than money that does not.',
    how: 'Sign your first neighbour up for a cup a day.',
    tier: 'silver',
    act: 2,
    test: (c) => c.business.regulars > 0,
  },
  {
    id: 'round-carried-a-day',
    name: 'The round carried a day',
    emoji: '☔',
    proves: 'This is what recurring revenue actually feels like from the inside.',
    how: 'Have your regulars be most of your sales on a cold day.',
    tier: 'gold',
    act: 2,
    test: (c) => roundCarriedAColdDay(c.history),
  },
  {
    id: 'hands-off',
    name: 'It runs without you',
    emoji: '🏖️',
    proves: 'Owning a business and working in one are two different jobs.',
    how: `Have your manager run it profitably for ${HANDS_OFF_DAYS_REQUIRED} days.`,
    tier: 'gold',
    act: 2,
    test: (c) => c.business.handsOffDays >= HANDS_OFF_DAYS_REQUIRED,
  },
  {
    id: 'paid-yourself',
    name: 'Paid yourself',
    emoji: '💵',
    proves: 'Money taken out is safe. It also stops working for you.',
    how: 'Move some profit out of the business into savings.',
    tier: 'bronze',
    act: 2,
    test: (c) => c.business.savings > 0,
  },
  {
    id: 'kept-the-whole-thing',
    name: 'Kept the whole thing',
    emoji: '🧱',
    proves: 'Selling a slice cheap is the most common mistake a founder makes.',
    how: 'Turn down the investor and keep 100% of your stand.',
    tier: 'gold',
    act: 3,
    test: (c) => c.ownership.equityOfferSeen && c.ownership.equitySoldPct === 0,
  },
  {
    id: 'took-the-money',
    name: 'Took the money',
    emoji: '🤲',
    proves: 'Cash today for a slice of forever. Sometimes that is the right trade.',
    how: 'Sell a slice of the stand to the investor.',
    tier: 'bronze',
    act: 3,
    test: (c) => c.ownership.equitySoldPct > 0,
  },
  {
    id: 'read-the-multiple',
    name: 'Read the multiple',
    emoji: '📐',
    proves: 'You can compare any two businesses once you count in years of profit.',
    how: 'Pick the better of the stands for sale, and be right.',
    tier: 'gold',
    act: 3,
    test: (c) => {
      const id = c.ownership.comparisonChoiceId;
      return Boolean(id && judgeDealChoice(id).correct);
    },
  },
  {
    id: 'walked-away',
    name: 'Walked away',
    emoji: '🚪',
    proves: 'A great business at a silly price is still a bad buy.',
    how: 'Turn down the famous kiosk purely because of what it costs.',
    tier: 'legend',
    act: 3,
    test: (c) => c.ownership.passedOnOverpriced,
  },
  {
    id: 'sold-the-stand',
    name: 'Sold the stand',
    emoji: '🤝',
    proves: 'A business is worth some number of times what it earns. Yours had a number.',
    how: 'Accept the buyout.',
    tier: 'silver',
    act: 3,
    test: (c) => c.ownership.buyoutAccepted,
  },
  {
    id: 'growth-premium',
    name: 'Earned the premium',
    emoji: '🚀',
    proves: 'Buyers pay more per dollar for profits that are climbing.',
    how: `Be growing when you sell, and get ${GROWING_MULTIPLE} weeks of profit or better.`,
    tier: 'legend',
    act: 3,
    test: (c) => c.ownership.buyoutMultiple >= GROWING_MULTIPLE,
  },
  {
    id: 'named-the-number',
    name: 'Named the number',
    emoji: '🔤',
    proves: 'You can now say "P/E ratio" and mean something exact by it.',
    how: 'Get to the end of the sale and see your own multiple given its real name.',
    tier: 'silver',
    act: 3,
    test: (c) => c.learned.includes('pe-ratio'),
  },
  {
    id: 'did-the-homework',
    name: 'Did the homework',
    emoji: '🔍',
    proves: 'Reading the numbers before buying is the entire job.',
    how: 'Look properly at six different companies.',
    tier: 'silver',
    act: 4,
    test: (c) => (c.portfolio?.researched.length ?? 0) >= 6,
  },
  {
    id: 'wrote-it-down',
    name: 'Wrote it down',
    emoji: '✍️',
    proves: 'A reason written before you buy is the only way to grade the decision later.',
    how: 'Buy three companies, each with a reason.',
    tier: 'silver',
    act: 4,
    test: (c) => c.thesisCount >= 3,
  },
  {
    id: 'spread-out',
    name: 'Spread out',
    emoji: '🧺',
    proves: 'One mistake should never be able to end the game.',
    how: `Own ${DIVERSIFIED_MIN_HOLDINGS} companies at the same time.`,
    tier: 'gold',
    act: 4,
    test: (c) => Object.keys(c.portfolio?.holdings ?? {}).length >= DIVERSIFIED_MIN_HOLDINGS,
  },
  {
    id: 'sat-still',
    name: 'Sat still',
    emoji: '🪑',
    proves: 'Doing nothing during a fall is a skill, and a rare one.',
    how: 'Watch something you own fall hard, and keep it.',
    tier: 'legend',
    act: 4,
    test: (c) =>
      Object.values(c.portfolio?.holdings ?? {}).some((h) => h.heldThroughDrawdown && !h.soldWhileDown),
  },
  {
    id: 'called-it-luck',
    name: 'Called it luck',
    emoji: '🍀',
    proves: 'Telling a good decision from a lucky one is most of getting better.',
    how: 'Make money on a company where your reason turned out to be wrong, and be told so.',
    tier: 'legend',
    act: 4,
    test: (c) => c.learned.includes('luck-vs-skill'),
  },
  {
    id: 'word-collector',
    name: 'Word collector',
    emoji: '📚',
    proves: 'You can hold your end of a conversation about a business now.',
    how: `Earn ${GLOSSARY.length - 6} of the ${GLOSSARY.length} words.`,
    tier: 'legend',
    act: 4,
    test: (c) => {
      const held = new Set(c.learned);
      return GLOSSARY.filter((w) => held.has(w.id)).length >= GLOSSARY.length - 6;
    },
  },
  {
    id: 'same-sky',
    name: 'Same sky',
    emoji: '⚔️',
    proves: 'Identical weather, different decisions. The gap was all you.',
    how: 'Finish a challenge against a friend on the same seed.',
    tier: 'silver',
    act: 'social',
    test: (c) => c.challengesPlayed >= 1,
  },
  {
    id: 'club-member',
    name: 'Club member',
    emoji: '🧑‍🤝‍🧑',
    proves: 'Other people will ask you why, and "it went up" is not an answer.',
    how: 'Get through a week of an investment club.',
    tier: 'silver',
    act: 'social',
    test: (c) => c.clubWeeks >= 1,
  },
  {
    id: 'carried-the-vote',
    name: 'Carried the vote',
    emoji: '🗳️',
    proves: 'Defending a number to somebody who can vote you down is how you learn to value things.',
    how: 'Get one of your proposals voted through by the club.',
    tier: 'gold',
    act: 'social',
    test: (c) => c.clubProposalsPassed >= 1,
  },
];

export const BADGE_COUNT = BADGES.length;

/** Which badges the state actually supports, right now. */
export function earnedBadges(ctx: BadgeContext): string[] {
  return BADGES.filter((badge) => {
    try {
      return badge.test(ctx);
    } catch {
      // A half-migrated save must never take the trophy case down with it.
      return false;
    }
  }).map((badge) => badge.id);
}

export function badgeById(id: string): Badge | undefined {
  return BADGES.find((badge) => badge.id === id);
}

/* ------------------------------------------------------------------ *
 * Rank
 *
 * Derived from badges held, never from days played. The only way up is to
 * demonstrate something you could not demonstrate before.
 * ------------------------------------------------------------------ */

export interface Rank {
  index: number;
  name: string;
  emoji: string;
  badgesHeld: number;
  /** Badges needed for the next rung, or null at the top. */
  nextAt: number | null;
  nextName: string | null;
}

/*
 * The ladder runs on *standing*, not on badges alone.
 *
 * Badges alone made the ladder finish. There are thirty of them, the last rung
 * was at twenty-four, and a kid who got there had nothing left to climb — which
 * is the same completion trap the four acts had, one layer up. A ladder that
 * ends is a ladder you eventually stop looking at.
 *
 * Standing is the three collections added together: badges earned, words
 * earned, and companies whose accounts the kid has actually read. All three
 * grow when the game grows — there are twenty-four companies now and there is
 * no reason there will not be forty — so the ladder stretches with the content
 * rather than being a percentage of a fixed total.
 *
 * It is still not experience points. Nothing here counts time, sessions or
 * taps. Every point is a thing demonstrated once and kept: a behaviour the game
 * could observe, a word the kid was given for something they had already done,
 * or a set of real accounts they opened and looked at.
 */
const LADDER: Array<{ at: number; name: string; emoji: string }> = [
  { at: 0, name: 'Kid with a jug', emoji: '🥤' },
  { at: 6, name: 'Stand owner', emoji: '🍋' },
  { at: 14, name: 'Corner trader', emoji: '🏪' },
  { at: 24, name: 'Operator', emoji: '⚙️' },
  { at: 34, name: 'Owner', emoji: '🔑' },
  { at: 44, name: 'Investor', emoji: '📈' },
  { at: 56, name: 'Analyst', emoji: '🧠' },
  { at: 70, name: 'Portfolio manager', emoji: '🗂️' },
];

export function rankFor(standing: number): Rank {
  const badgesHeld = standing;
  let index = 0;
  for (let i = 0; i < LADDER.length; i++) {
    if (standing >= LADDER[i].at) index = i;
  }
  const next = LADDER[index + 1] ?? null;
  return {
    index,
    name: LADDER[index].name,
    emoji: LADDER[index].emoji,
    badgesHeld,
    nextAt: next ? next.at : null,
    nextName: next ? next.name : null,
  };
}

/** Grouped for the trophy screen, locked ones included so they pull. */
export function trophyCase(held: string[]): Array<{
  act: Badge['act'];
  badges: Array<Badge & { held: boolean }>;
}> {
  const heldSet = new Set(held);
  const acts: Array<Badge['act']> = [1, 2, 3, 4, 'social'];
  return acts.map((act) => ({
    act,
    badges: BADGES.filter((badge) => badge.act === act).map((badge) => ({
      ...badge,
      held: heldSet.has(badge.id),
    })),
  }));
}
