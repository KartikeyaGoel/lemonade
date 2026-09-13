/**
 * Pip, and why a mascot is the cheapest fix left in the product.
 *
 * `grep -rn "<Coach" src/` finds five speech bubbles and all five are in Act 1,
 * day one, and all five are interface instruction: tap the sign, slide it, buy
 * lemons first. So the game has a voice for one day out of twenty-one and then
 * goes silent — which is the precise shape of the two complaints we have from
 * real people.
 *
 * A parent said: my kid opens this, sees a lemonade stand, and the thing you
 * told me it teaches is the stock market. The road on the title screen already
 * answers that as a *picture* (see `journey.ts`), and a picture of a locked
 * destination is not the same as somebody telling you that is where you are
 * going. A kid played to day eighteen and quit bored, three days from the sale
 * the whole arc builds towards, having never been told the sale was coming.
 *
 * Both are continuity problems. Neither is fixed by another lever on the stand.
 *
 * ## What Pip is allowed to say
 *
 * This is the load-bearing rule and it is not a style preference.
 *
 * **Pip may name what happened. Pip may never say what to do next.**
 *
 *   ok:  "You sold out by lunchtime. Forty people wanted a cup. You had 28."
 *   no:  "Make more cups tomorrow."
 *
 * The first makes a constraint visible and leaves the decision where it
 * belongs. The second is the game playing the game: it destroys the demand
 * curve the kid is here to discover, and it turns everything the grown-up
 * report claims into a measure of how well a child follows instructions. A kid
 * who does what the duck said has taught us nothing we can honestly report.
 *
 * Stating the *objective* is not advice — "your stand can run without you" is
 * the goal of the act, not a strategy for reaching it. Naming a cost line is
 * not advice either. Suggesting a price, a batch size or a purchase is.
 *
 * ## Why Pip talking makes the daily ledger collapsible
 *
 * The profit and loss runs to a dozen rows and it renders every day for
 * twenty-one days. The kid who quit described it as so much text that he
 * skipped it — which means that from about day four it was producing no
 * familiarity at all. Twenty-one exposures were three readings and eighteen
 * skips.
 *
 * So the ledger folds after the third day, and Pip carries one line of it out
 * front. Three rules keep that from being a downgrade:
 *
 *  1. Pip names a *line item* and its real number, and rotates through them
 *     over the arc — rent, ingredients, gross profit, spoilage, regulars. One
 *     a day, in a speech bubble, is read. Eleven rows are not. This is the
 *     same decision `progress.ts` already made about vocabulary, which queues
 *     one word a day rather than printing a list.
 *  2. Pip never simply restates the profit. That number is already the biggest
 *     thing on the screen. Pip's job is the cause, so Pip's line is one number
 *     short on purpose, and the missing number is in the ledger.
 *  3. `ledgerNoveltyOf` forces the whole statement open on any day that is
 *     structurally new — a first loss, a first spoiled lemon, a first wage. A
 *     kid can never miss a line he has not met. He only ever gets the folded
 *     version of a statement he has already read three times.
 *
 * Rule 3 is "no concept before the wall that motivates it", applied to the
 * ledger itself, and it is derived from history rather than stored.
 *
 * Pure module. No React, no I/O, no storage.
 */

import type { Act } from './progress';
import { ECON, totalFixedCost, type DayOutcome, type DayRecord } from './simulation';
import { plural } from './copy';

export const GUIDE_NAME = 'Pip';

/** Days of full ledger before it folds. Three is two more than it needs. */
export const LEDGER_OPEN_DAYS = 3;

/* ------------------------------------------------------------------ *
 * The thread
 * ------------------------------------------------------------------ */

/**
 * The moments Pip speaks at, once each, ever.
 *
 * Every one of these sits on a screen that already exists. Pip adds no screen
 * and gates nothing — a beat is dismissible and never blocks a button.
 *
 * There is deliberately no beat for the bench. `PlanScreen` has carried its own
 * bubble for that since before Pip existed, conditioned on there being a
 * yesterday to rehearse against *and* the kid having touched a dial, and sited
 * next to the button it is about. A beat would have said the same thing worse.
 */
export type Beat =
  | 'welcome'
  | 'act2-open'
  | 'act2-rival'
  | 'act2-stall'
  | 'act3-open'
  | 'act4-open'
  | 'act5-open'
  | 'act5-open-sold'
  | 'market';

export interface GuideLine {
  id: Beat;
  /** One short sentence each. Rendered as lines in a single bubble. */
  says: string[];
}

/**
 * `welcome` and `market` are the two ends of one sentence, and `market` is the
 * only place in the product where a child is told the thesis the whole thing
 * rests on. It is in the README, it is the first line of the spec, it is the
 * pitch — and until this file it was never said to the person playing.
 */
const LINES: Record<Beat, GuideLine> = {
  /*
   * Three lines that have to cover where a child is standing *and* where this
   * goes, in that order.
   *
   * The middle line used to be "First you need a business of your own", and the
   * pilot found what was missing: *"Could not tell the game started with $20
   * and they have run a lemonade stand with that money."*
   *
   * Measured before changing anything — on a 375×812 phone the whole title
   * screen fits with no scrolling, and the sign reading "$20 and a folding
   * table" sits at 130px, directly under the title. So the fact was **on
   * screen and missed**, which makes this a problem of attention rather than
   * of absence, and the fix is not more words. It is that the only character
   * in the game named the destination and never the starting position: a
   * rotated sign under a big title reads as a tagline, and the same fact said
   * by Pip is a fact about *you*.
   *
   * §70 refuses a longer welcome speech on the grounds that it adds prose to a
   * reading problem. This is the same three lines with one of them carrying a
   * figure it should always have carried.
   *
   * The figure comes from `ECON.STARTING_CASH` rather than being typed,
   * because §62's rule is that a fact with two homes disagrees with itself —
   * and this one already has a second home on the title screen's sign.
   */
  welcome: {
    id: 'welcome',
    says: [
      `Hi! I am ${GUIDE_NAME}.`,
      `This is your lemonade stand. You have $${ECON.STARTING_CASH}.`,
      'One day you will own bits of real companies.',
    ],
  },
  'act2-open': {
    id: 'act2-open',
    says: ['You found a price people say yes to.', 'Now the queue is the problem.'],
  },
  'act2-stall': {
    id: 'act2-stall',
    says: ['Somebody else could mind this stand.', 'Then your hands would be free.'],
  },
  /*
   * The other stall, and the expensive one.
   *
   * Facts with the child's own figure in them and no verb in the imperative,
   * which is this file's rule. It does not say "buy the fresh-squeezed" — the
   * second line is what a share of the street *is*, and the third is the
   * arithmetic of a wage against a half-empty queue. Where to go from there is
   * theirs.
   */
  'act2-rival': {
    id: 'act2-rival',
    says: [
      'Somebody is selling across the road.',
      'Under half the street is walking to you now.',
      'The wages are the same either way.',
    ],
  },
  'act3-open': {
    id: 'act3-open',
    says: ['Two stands, and the rain still shuts both.', 'A door would not care.'],
  },
  'act4-open': {
    id: 'act4-open',
    says: ['The shop pays for its own door now.', 'So what is the whole thing worth?'],
  },
  /*
   * Two beats, because two doors lead here.
   *
   * A founder who listed has a share price of their own to compare against.
   * A founder who sold up has cash and no company, and telling them "your
   * company has a price now" is a line about a run they did not have.
   */
  'act5-open': {
    id: 'act5-open',
    says: ['Your company has a price now.', 'So does everybody else’s.'],
  },
  'act5-open-sold': {
    id: 'act5-open-sold',
    says: ['You sold your company.', 'Now you can buy a piece of somebody else’s.'],
  },
  market: {
    id: 'market',
    says: [
      'Every one of these is somebody’s lemonade stand.',
      'You already know how to read one.',
    ],
  },
};

export function lineFor(beat: Beat): GuideLine {
  return LINES[beat];
}

export function allBeats(): Beat[] {
  return Object.keys(LINES) as Beat[];
}

/* ------------------------------------------------------------------ *
 * When Pip speaks
 * ------------------------------------------------------------------ */

export interface GuideContext {
  act: Act;
  /** Days of stand history, across the whole run. */
  daysPlayed: number;
  /** Day within Act 2, when that is where they are. */
  act2Day: number;
  hasManager: boolean;
  /**
   * Share of the street coming to them today. 1 means nobody is competing.
   *
   * Optional so every existing caller and test still means what it meant:
   * absent reads as an uncontested street, which is what Stage 1 always is.
   */
  marketShare?: number;
  /** Whether either of the two things that answer a rival has been bought. */
  differentiated?: boolean;
  /** True on the market screen itself. */
  inMarket: boolean;
  /**
   * Whether the kid took the company public rather than selling it.
   *
   * The only thing that decides which of the two market beats is true.
   */
  listed: boolean;
}

/** Act 2 runs a fortnight and a bit. Nagging before halfway is nagging. */
export const STALL_DAY = 7;

/**
 * The one beat worth speaking now, or nothing.
 *
 * Order matters: the beat that belongs to the screen the kid is on wins over
 * a beat that is merely due. Anything already in `seen` is silent for ever,
 * which is what keeps a mascot from becoming wallpaper.
 */
export function nextBeat(context: GuideContext, seen: readonly string[]): GuideLine | null {
  const unseen = (beat: Beat) => !seen.includes(beat);

  if (context.inMarket && unseen('market')) return LINES.market;

  if (context.daysPlayed === 0 && unseen('welcome')) return LINES.welcome;

  if (context.act === 5) {
    const beat: Beat = context.listed ? 'act5-open' : 'act5-open-sold';
    if (unseen(beat)) return LINES[beat];
  }
  if (context.act === 4 && unseen('act4-open')) return LINES['act4-open'];
  if (context.act === 3 && unseen('act3-open')) return LINES['act3-open'];
  if (context.act === 2 && unseen('act2-open')) return LINES['act2-open'];

  /*
   * The two ways Stage 2 stalls, and it only ever detected one.
   *
   * `!hasManager` was the whole condition, so the child this beat exists for
   * — the one grinding identical days with the goal strip repeating itself —
   * was silent for exactly half of them. Hiring a manager cleared the flag and
   * the help stopped, whether or not anything had started moving.
   *
   * The half it missed is the expensive one. A rival opens on day three of the
   * stage and takes about 54% of the street, and a stand paying a manager
   * twenty dollars a day into a half-empty queue loses money about two days in
   * three — so `handsOffDays`, which ticks *down* on a loss, never reaches
   * three, and the stage runs its full sixteen days without completing.
   * Measured over ten seeds: 3 of 10 finish, 13.9 days, $56 down. With the
   * fifty-five dollars of kit that answers him: 10 of 10, 5.1 days, $192 up.
   *
   * Which makes this the most valuable thing Pip can say in the whole stage,
   * and it was unreachable. The rival beat goes first because it is the one
   * that is costing money right now.
   *
   * Both still wait for `STALL_DAY`. Nagging before halfway is nagging, and
   * the rival arriving is not by itself a problem — a child who buys the kit
   * early never sees this, which is correct.
   */
  if (context.act === 2) {
    /*
     * The rival beat is not on the clock, and that is the point.
     *
     * `STALL_DAY` is the right gate for the manager nudge: that beat states an
     * objective the child has not started, and saying it on day two would be
     * nagging somebody who is still finding their feet. The rival is the
     * opposite kind of fact. He opens on day three of the stage and takes
     * about 54% of the street that afternoon, and the money is gone from that
     * day forward — so waiting until day seven means four losing days in which
     * the game knew and did not say.
     *
     * The condition is evidence rather than a timer: the street *is* shared and
     * nothing that answers him has been bought. A child who buys the kit on
     * the first contested day never sees this, which is correct — there is
     * nothing to tell them.
     *
     * This is also the honest version of "is this child trying". Software
     * cannot know, and a score for it would be a guess wearing a number's
     * clothes. What it can see is that the information has been on screen and
     * nothing has changed, which is all this condition claims.
     */
    const contested = (context.marketShare ?? 1) < 1;
    if (contested && !context.differentiated && unseen('act2-rival')) {
      return LINES['act2-rival'];
    }
    // The boredom beat. Only once past halfway, and only while the thing that
    // ends the act has not been done.
    if (context.act2Day >= STALL_DAY && !context.hasManager && unseen('act2-stall')) {
      return LINES['act2-stall'];
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * The end of a day
 * ------------------------------------------------------------------ */

/**
 * Was today structurally new?
 *
 * Returns the thing that is new, for a caller that wants to say so, or null.
 * A day that introduces a row the kid has never seen shows the whole statement
 * whatever day number it is — folding a ledger the kid has read three times is
 * fine, folding one with an unfamiliar line in it is not.
 *
 * Everything here is derived from history, so nothing has to be remembered.
 */
export function ledgerNoveltyOf(outcome: DayOutcome, history: readonly DayRecord[]): string | null {
  const before = history.filter((day) => day.day < outcome.day);

  if (outcome.profit < 0 && !before.some((day) => day.profit < 0)) {
    return 'first losing day';
  }
  if (outcome.spoiledLemons > 0 && !before.some((day) => (day.spoiledLemons ?? 0) > 0)) {
    return 'first spoiled lemons';
  }
  if (outcome.subscriberCups > 0 && !before.some((day) => (day.subscriberCups ?? 0) > 0)) {
    return 'first regulars';
  }
  // A new fixed cost is a wage or a bigger pitch. Both are new rows.
  const worstFixedBefore = before.reduce((most, day) => Math.max(most, day.fixedCost ?? 0), 0);
  if (before.length > 0 && totalFixedCost(outcome.fixedCostLines) > worstFixedBefore + 0.005) {
    return 'a new daily cost';
  }
  return null;
}

/**
 * Should the full profit and loss be open before the kid taps anything?
 *
 * The first three days, and any day with a row they have not met.
 */
export function ledgerStartsOpen(outcome: DayOutcome, history: readonly DayRecord[]): boolean {
  if (outcome.day <= LEDGER_OPEN_DAYS) return true;
  return ledgerNoveltyOf(outcome, history) !== null;
}

/**
 * What Pip says about the day just finished.
 *
 * Observation only, and never the profit on its own — that number is already
 * the largest thing on the screen, and repeating it would make Pip a substitute
 * for the ledger rather than a door into it. Every branch names a *line* of the
 * statement and gives its real number, so a kid who only ever reads Pip still
 * meets revenue, ingredients, rent, spoilage and capacity across the arc.
 *
 * The order is by how much the line explains about today, so the sentence is
 * about the thing that actually decided the day.
 */
export function closingLine(outcome: DayOutcome): string {
  const cups = outcome.cupsSold;
  const dollars = (amount: number) => `$${amount.toFixed(2)}`;

  // Sold out with people still wanting one: capacity decided the day.
  /* `cupsAvailable`, not `cupsMakeable`: on a day the child sent out for more
     at lunchtime, "you had 28" is wrong by the twelve they bought. */
  if (outcome.cupsWanted > outcome.cupsAvailable && outcome.cupsSold >= outcome.cupsAvailable) {
    return `You sold every cup. ${plural(Math.round(outcome.cupsWanted), 'person', 'people')} wanted one and you had ${outcome.cupsAvailable}.`;
  }

  // Nobody bought anything. "Each cup sold for $3.00" is false when no cup
  // sold, and "cost $0.00 to make" is not a fact about anything — on a day
  // with no sales the only real line is the one owed regardless.
  if (outcome.cupsSold === 0) {
    return `Nobody bought a cup at ${dollars(outcome.price)}. The stand still cost you ${dollars(totalFixedCost(outcome.fixedCostLines))}.`;
  }

  // A loss, with the line that caused it.
  if (outcome.profit < 0) {
    if (outcome.grossProfit > 0) {
      return `Your cups made ${dollars(outcome.grossProfit)}, and the costs you owe anyway were ${dollars(totalFixedCost(outcome.fixedCostLines))}.`;
    }
    return `Each cup sold for ${dollars(outcome.price)} and cost ${dollars(outcome.ingredients.perCup)} to make.`;
  }

  if (outcome.spoiledLemons > 0) {
    return `${plural(outcome.spoiledLemons, 'lemon')} went off before anyone drank them. That is ${dollars(outcome.spoilageCost)} gone.`;
  }

  if (outcome.subscriberCups > 0) {
    return `${outcome.subscriberCups} of your ${plural(cups, 'cup')} went to regulars. They come whatever the weather does.`;
  }

  // The ordinary good day. Name the gap between what came in and what it cost.
  return `${plural(cups, 'cup')} brought in ${dollars(outcome.revenue)}. Making them cost ${dollars(outcome.ingredients.total)}.`;
}
