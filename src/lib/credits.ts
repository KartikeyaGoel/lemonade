/**
 * What a deed is worth, and what credits can buy.
 *
 * This module is the one the customer's Level 2 note asked for — "credits could
 * come from: applying the stock framework correctly, researching before buying,
 * writing a thesis, diversifying…" — and it is also the one that had to be
 * squared with a position this product already took. Both are recorded here
 * because a payout table with no argument attached to it is how a game ends up
 * paying for the wrong thing.
 *
 * PRODUCT.md §16 is titled "The trophy case, and why it is not XP", and it
 * says: *"XP rewards time spent, so it rewards grinding, so the fastest way to
 * the top is to stop thinking. We would be building the exact habit that ruins
 * people in markets: activity mistaken for skill."*
 *
 * A currency is not automatically XP. What makes XP corrosive is **what it
 * pays for**, and §16 already wrote down the test that separates the two: a
 * badge is awarded for "a specific decision that can only be made by someone
 * who understood something." Every row below has to pass that test, and three
 * rules keep it passing:
 *
 *  1. **No row pays for arriving.** There is no deed for opening the app —
 *     `Deed` is a closed union and none of its members is "turned up".
 *  2. **Every row is capped per day.** A behaviour that can be repeated for
 *     more money is a grind, however good the behaviour is. Reading one
 *     company's accounts is worth something; reading eight in a row to farm it
 *     is worth the same as reading three.
 *  3. **The best-paying rows are the ones a child would rather not do.**
 *     Passing on a good business at a bad price, reviewing a mistake, and
 *     holding when nothing has changed pay the most. Buying pays the least.
 *
 * Pure module. No React, no I/O.
 */

import type { Deed, Ledger } from './ledger';
import { balance, didToday, record, spend, timesToday } from './ledger';

export interface Earner {
  deed: Deed;
  /** Credits per time, up to the daily cap. */
  worth: number;
  /** How many times a day this can pay. */
  perDay: number;
  /** What the child is told they did. Their words, past tense. */
  label: string;
  /**
   * Why this one is worth paying for, in the terms §16 asks for: the
   * understanding it cannot be done without.
   */
  because: string;
}

/**
 * The payout table.
 *
 * Ordered by what it pays, which is the honest way to read a reward table: the
 * top of this list is what the product is actually asking a child to become.
 * That it opens with "passed on it because the price was too high" rather than
 * with "bought something" is the entire design.
 */
export const EARNERS: readonly Earner[] = [
  {
    deed: 'passed-on-price',
    worth: 40,
    perDay: 1,
    label: 'Turned one down because the price was too high',
    because: 'Saying no to a good business at a bad price is the hardest thing on this list.',
  },
  {
    deed: 'reviewed-a-mistake',
    worth: 30,
    perDay: 2,
    label: 'Went back over one that went wrong',
    because: 'Nobody wants to reread a bad decision. It is where all the learning is.',
  },
  {
    deed: 'held-when-nothing-changed',
    worth: 25,
    perDay: 1,
    label: 'Did nothing, on purpose',
    because: 'Most days the right move is no move. Sitting still is a decision.',
  },
  {
    deed: 'held-a-while',
    worth: 25,
    perDay: 2,
    label: 'Held one for a month without touching it',
    /*
     * "Staying invested over time", which is the last item on the customer's
     * credit list and the one their example was about — "you held a stock for
     * 3 days, here's 50".
     *
     * Distinct from the streak, which counts days the *child* did something.
     * This counts weeks the *position* was left alone, which is the harder and
     * more valuable thing: a child can turn up every day and still churn.
     *
     * Paid once per holding, not once per week — see `HELD_A_WHILE_WEEKS` and
     * the check on the ledger at the call site. Paying every week would turn
     * patience into a salary.
     */
    because: 'Leaving something alone for a month is harder than buying it was.',
  },
  {
    deed: 'checked-a-thesis',
    worth: 25,
    perDay: 3,
    label: 'Checked whether your reason still holds',
    because: 'A reason you never check again is a guess you got attached to.',
  },
  {
    deed: 'told-news-from-noise',
    worth: 20,
    perDay: 1,
    label: 'Told company news from market noise',
    because: 'Knowing which of the two moved your price is most of what news is for.',
  },
  {
    deed: 'trimmed-concentration',
    worth: 20,
    perDay: 1,
    label: 'Noticed too much was in one company',
    because: 'Spotting your own concentration before it costs you is rare at any age.',
  },
  {
    deed: 'taught-a-grown-up',
    worth: 20,
    perDay: 1,
    label: 'Explained one to a grown-up',
    because: 'You do not know a thing until you have had to say it out loud.',
  },
  {
    deed: 'named-the-mover',
    worth: 15,
    perDay: 1,
    label: 'Worked out why the market moved',
    because: 'A price that moves for no reason you can name is a price you are gambling on.',
  },
  {
    deed: 'answered-the-check-in',
    worth: 15,
    perDay: 1,
    label: "Answered today's check-in",
    /*
     * Paid for the answer, never for the visit. FRAMEWORK.md §16 records the
     * reasoning: the ritual's own fourth step is "does my portfolio need
     * action — sometimes yes, often no", so a child who correctly says
     * "nothing to do today" has done the thing being taught. Opening the app
     * and closing it again pays nothing, which is what keeps §15 true.
     */
    because: 'You read what happened and worked out whether it touched you.',
  },
  {
    deed: 'rated-a-business',
    worth: 15,
    perDay: 4,
    label: 'Rated a business against the framework',
    because: 'Six questions about the business, before a word about the share price.',
  },
  {
    deed: 'diversified',
    worth: 15,
    perDay: 1,
    label: 'Spread your money out',
    because: 'One company can be wrong for reasons nobody saw. Several rarely are, together.',
  },
  {
    deed: 'sized-a-position',
    worth: 10,
    perDay: 3,
    label: 'Decided how much, not just what',
    because: 'How much you put in matters more than what you put it in.',
  },
  {
    deed: 'read-accounts',
    worth: 10,
    perDay: 3,
    label: 'Read a company\u2019s real accounts',
    because: 'Before buying, not after. That order is the whole habit.',
  },
  {
    deed: 'wrote-a-thesis',
    worth: 10,
    perDay: 3,
    label: 'Wrote down why, before spending',
    because: 'A reason written before is a reason. Written after, it is an excuse.',
  },
  {
    deed: 'held-through-a-loss',
    worth: 10,
    perDay: 1,
    label: 'Kept your nerve after a bad day',
    because: 'One bad day is mostly weather. Reacting to it is how people lose money.',
  },
  {
    deed: 'hit-the-goal',
    worth: 10,
    perDay: 1,
    label: 'Hit the day\u2019s goal',
    because: 'You aimed at a number and got there.',
  },
  {
    deed: 'ran-a-day',
    worth: 2,
    perDay: 2,
    label: 'Ran a day at the stand',
    /*
     * The smallest award in the table, and it is the only one that is close to
     * paying for activity. Two credits, twice a day, against forty for turning
     * down an overpriced business: the ratio is the message. It is here at all
     * because a stage-1 child has no other way to earn, and a currency you
     * cannot start earning until stage 5 is a currency that arrives as a
     * mystery.
     */
    because: 'Every day at the stand is practice at the same three decisions.',
  },
];

const BY_DEED = new Map(EARNERS.map((earner) => [earner.deed, earner]));

export function earnerFor(deed: Deed): Earner | undefined {
  return BY_DEED.get(deed);
}

/**
 * What this deed would pay right now — 0 once the day's cap is reached.
 *
 * Exported so a screen can say "you have already had today's credit for this"
 * rather than silently paying nothing, which reads as a bug.
 */
export function worthNow(ledger: Ledger, deed: Deed, on: string): number {
  const earner = BY_DEED.get(deed);
  if (!earner) return 0;
  return timesToday(ledger, deed, on) >= earner.perDay ? 0 : earner.worth;
}

export function cappedToday(ledger: Ledger, deed: Deed, on: string): boolean {
  const earner = BY_DEED.get(deed);
  if (!earner) return false;
  return timesToday(ledger, deed, on) >= earner.perDay;
}

export interface Award {
  ledger: Ledger;
  /** What was actually paid. 0 when the cap was already reached. */
  credits: number;
  /** True when the deed was recorded but paid nothing. */
  capped: boolean;
}

/**
 * Record a deed and pay for it.
 *
 * The deed is written down **either way**, capped or not, because the log is a
 * record of what a child did and quietly dropping the fourth company they read
 * today would make every screen that reads the log lie. Only the money is
 * capped.
 */
export function awardFor(ledger: Ledger, deed: Deed, on: string, what?: string): Award {
  const credits = worthNow(ledger, deed, on);
  return {
    ledger: record(ledger, deed, on, credits, what),
    credits,
    capped: credits === 0 && BY_DEED.has(deed),
  };
}

/* ------------------------------------------------------------------ *
 * What credits buy
 * ------------------------------------------------------------------ */

/**
 * Research money, and only research money.
 *
 * The customer's note suggested "you held a stock for 3 days, here's 50 for
 * more trading", and FRAMEWORK.md §16 flagged the contradiction: paying for
 * patience with a licence to trade more teaches that the reward for waiting is
 * more chances not to. The behaviour was right; the payout undid it.
 *
 * So credits buy **capital in the practice portfolio** — more money to hold
 * companies with, not permission to churn the ones already held. A child who
 * banks credits for a fortnight and spends them has a bigger position in
 * something they already reasoned about, which is what staying invested
 * actually looks like.
 *
 * There is nothing else to buy. No cosmetics, no boosts, no unlocks: §16's
 * ladder is derived from what has been demonstrated and there must be no way
 * to buy a rung of it.
 */
/**
 * Weeks a holding has to survive untouched before patience is paid.
 *
 * Four, which is a month of replayed market. Short enough that a child sees it
 * happen inside one sitting of the market act, long enough that it cannot be
 * had by accident on the way to selling.
 */
export const HELD_A_WHILE_WEEKS = 4;

export const CREDITS_PER_DOLLAR = 5;

/**
 * Top-ups come in fives.
 *
 * This was a minimum of $10 for one paragraph, and the tests in
 * `tests/ledger.test.ts` found the dead state in it immediately: the
 * hardest-paying deed in the game is 40 credits, which is $8, which is under
 * the minimum. A child who did the single best thing available to them all day
 * would be shown a balance, told it was worth $8, and then refused. The floor
 * was unreachable from the behaviour the whole table is built to reward.
 *
 * A step rather than a floor fixes it without reintroducing the thing the
 * floor was for — dollar-at-a-time churn — because the smallest purchase is
 * still a round $5, and there is no amount of credits that shows an affordable
 * figure the shop will not sell.
 */
export const TOPUP_STEP = 5;

export interface TopUp {
  ledger: Ledger;
  /** Dollars added to the practice portfolio. 0 when it could not be afforded. */
  dollars: number;
  why: string;
}

export function topUp(ledger: Ledger, dollars: number): TopUp {
  // Rounded down to a whole step, so an odd request buys what it can rather
  // than being refused on a technicality a child did not know about.
  const whole = Math.floor(dollars / TOPUP_STEP) * TOPUP_STEP;
  if (whole < TOPUP_STEP) {
    return { ledger, dollars: 0, why: `Top-ups go in $${TOPUP_STEP} steps.` };
  }

  const cost = whole * CREDITS_PER_DOLLAR;
  if (cost > balance(ledger)) {
    return {
      ledger,
      dollars: 0,
      why: `That costs ${cost} credits and you have ${balance(ledger)}.`,
    };
  }

  return {
    ledger: spend(ledger, cost),
    dollars: whole,
    why: `${cost} credits became $${whole} to invest.`,
  };
}

/**
 * The most a child could top up right now — always a figure the shop will sell.
 *
 * Rounded down to a whole step on purpose. Reporting the raw division would
 * hand every caller the same trap the old minimum had: a screen offering "$8"
 * that `topUp` then refuses.
 */
export function affordableDollars(ledger: Ledger): number {
  return Math.floor(balance(ledger) / CREDITS_PER_DOLLAR / TOPUP_STEP) * TOPUP_STEP;
}

/* ------------------------------------------------------------------ *
 * Saying it back
 * ------------------------------------------------------------------ */

export interface CreditsCard {
  balance: number;
  earned: number;
  /** Credits earned today. */
  today: number;
  /** What is still available to earn today, highest-paying first. */
  leftToday: Earner[];
  line: string;
}

/**
 * The credits screen, in one object.
 *
 * `leftToday` is the part that does work: it is the answer to "what should I do
 * now" and it is sorted by what it pays, so the top of the list is always the
 * hardest and most valuable thing still on offer. A child reading it is being
 * pointed at passing on an overpriced company, not at buying something.
 */
export function creditsCard(ledger: Ledger, on: string): CreditsCard {
  const leftToday = EARNERS.filter((earner) => !cappedToday(ledger, earner.deed, on));
  const today = ledger.entries
    .filter((entry) => entry.on === on)
    .reduce((sum, entry) => sum + entry.credits, 0);

  const have = balance(ledger);
  const dollars = affordableDollars(ledger);
  const line =
    dollars >= TOPUP_STEP
      ? `${have} credits — enough for $${dollars} more to invest.`
      : `${have} credits. ${TOPUP_STEP * CREDITS_PER_DOLLAR - have} more buys $${TOPUP_STEP} to invest.`;

  return { balance: have, earned: ledger.earned, today, leftToday, line };
}

/** Has the child done the ritual today? Asked by the check-in and the streak. */
export function checkedInToday(ledger: Ledger, on: string): boolean {
  return didToday(ledger, 'answered-the-check-in', on);
}
