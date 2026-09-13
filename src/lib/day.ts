/**
 * One day, banked. The single place a day changes the game.
 *
 * ## Why this file exists
 *
 * It exists because of a pattern rather than a bug, and the pattern is worth
 * stating plainly: every redesign of this game has been followed by a fortnight
 * of bugs found by *opening a screen*, never by a test going red. That is not
 * bad luck and it is not carelessness about any one feature. It has a cause.
 *
 * There were **two implementations of playing a day**. `src/app/page.tsx` had
 * one, split across `settleDay` and `closeDay`; `src/lib/demo.ts` had another
 * in `playDay`, and `tests/arc.test.ts` walks the second one to prove the game
 * is finishable. Each redesign added a term to whichever it was standing in
 * front of, and the other drifted.
 *
 * What that cost, concretely: `advanceRival` was in the app and not in the
 * harness. So every measurement ever taken of Stage 2 was taken with the
 * competitor switched off — including the one in `tests/wordbudget.test.ts`
 * that set `ACT2_DAYS = 16`, and including the arc test's proof that the stage
 * can be finished at all. With the rival restored, the old policy finishes the
 * stage **3 times in 10**, takes 13.9 of its 16 days and ends $56 down. The
 * suite was green for all of it, because the suite was measuring a game with
 * no competitor in it.
 *
 * PRODUCT.md §62 already had the rule that would have caught this — *a fact
 * with more than one home disagrees with itself*. It had only ever been applied
 * to figures on screens. This is the same rule applied to **behaviour**: a day
 * advances the game in exactly one function, and the app, the demo harness and
 * every test call it. A term cannot go missing from one path because there is
 * only one path.
 *
 * ## What belongs here and what does not
 *
 * Here: everything that is *true of the game* after a day — the stand, the
 * counters, the streaks, the competitor, the words earned. All of it derived
 * from the pre-day game and the final outcome, so it is safe to call once, at
 * the end, after the child has answered the lunchtime question and the day has
 * been re-run.
 *
 * Not here: anything about *where the child goes next*. Routing is the app's
 * business and stays in `page.tsx` — it reads the settled game and picks a
 * screen. Sounds, toasts, tours and the career record stay there too.
 *
 * Pure module. No React, no I/O.
 */

import {
  advanceRival,
  deriveAct2Insights,
  deriveAct3Insights,
  updateHandsOff,
  updateTwoStandDays,
  type BusinessState,
} from './business';
import { repayLoan, updateShopDays } from './retail';
import { deriveDayParams } from './business';
import { recordInvestorCut } from './ownership';
import { recurringRevenueInsight, unrecorded } from './glossary';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  deriveInsights,
  round2,
  type DayOutcome,
  type DayParams,
  type Insight,
} from './simulation';
import { act1Complete, act2Complete, act3Complete, type Game } from './progress';
import { listingOffer } from './listing';

/* ------------------------------------------------------------------ *
 * Today's rules
 * ------------------------------------------------------------------ */

/**
 * What kind of day this is, economically.
 *
 * The other half of the duplication this file exists to end. `page.tsx` had
 * two copies of this — one in `openStand` for the day being played and one in
 * a `dayParams` memo for the planning screen to read — and `demo.ts` had a
 * third that differed from both: it called `deriveDayParams` unconditionally,
 * so the demo's Stage 1 ran on the business's economics instead of the flat
 * `DEFAULT_DAY_PARAMS` that FRAMEWORK.md §1 specifies for it.
 *
 * Three answers to "what are today's rules" is two too many, and it is the
 * same failure as three answers to "what does today change".
 */
export function paramsForDay(game: Game, price: number): DayParams {
  /*
   * The Saturday stand is a folding table again.
   *
   * It deliberately does not inherit the cooler, the pitch or the manager: the
   * child sold that business. It also runs with no cash floor, because the
   * mercy rule that stops a nine-year-old going broke on day three would
   * quietly print money into an investment account.
   */
  if (game.weekend) return { ...DEFAULT_DAY_PARAMS, lastDay: null, cashFloor: null };

  /*
   * Stage 1 is flat by specification: demand "driven only by price + quality
   * ... No weather, competition, location". A duel is a one-day Stage 1, so
   * the last day comes from the challenge rather than from `ECON`.
   */
  if (game.act === 1) {
    return { ...DEFAULT_DAY_PARAMS, lastDay: game.challenge?.spec.days ?? ECON.TOTAL_DAYS };
  }

  return {
    ...deriveDayParams(game.business, price),
    /*
     * Auntie Ro's slice plus whatever went to the public at the float. Two
     * separately recorded things that add up to one number, in one place.
     */
    equityShare: round2(game.ownership.equitySoldPct + game.listing.floated),
    // Stage 2 onwards the stand keeps trading; there is no fixed final day.
    lastDay: null,
  };
}

/**
 * Words handed over on an ordinary day.
 *
 * One. Day one earns three, and three explanations stacked under the first
 * profit and loss a child has ever read is a worksheet. The rest wait their
 * turn — see `Game.pendingInsights`.
 */
export const WORDS_PER_DAY = 1;

/**
 * How many words may be waiting before the game starts catching up.
 *
 * ## Why a flat one-a-day stopped working
 *
 * One a day is a *ration*, and a ration only makes sense against a supply. The
 * stand stages used to run twenty-eight days and the queue emptied inside them
 * with room to spare. They now run eighteen for sensible play, because the
 * sixteen-day stands cap turned out to have been measured in a game with no
 * competitor in it — see `ACT2_DAYS` — and at eighteen days the ration strands
 * words the child has already earned. Measured on the seed the file tests:
 * `delegation`, `break-even` and `interest` were earned, queued, and never
 * handed over.
 *
 * That is the one outcome this whole mechanism exists to prevent. A word never
 * earned is a word the child did not reach. A word earned and withheld is the
 * game having decided they demonstrated something and then not telling them.
 *
 * ## Why catching up is not the worksheet the ration guards against
 *
 * The reason for the ration is a real one and it is about **day one**: three
 * explanations under the first profit and loss a child has ever read is
 * homework, and PRODUCT.md §26's one-card-a-day rule comes from watching that
 * fail. Nothing about that argument applies to a backlog on day fifteen. By
 * then the card is a familiar shape, the child has met a dozen of them, and
 * the queue being three deep means the game has already judged three things
 * owed.
 *
 * So: one a day while the queue is short, two while it is backed up. It is
 * self-limiting — the queue drains until it is short again and the pace goes
 * back to one.
 */
export const WORD_BACKLOG = 3;

/**
 * How many words to hand over today, given how many were **already waiting**.
 *
 * The argument is the queue as it stood at the start of the day, deliberately
 * not counting what today earned. The first version counted both and so fired
 * on day one, which earns three words at once and is the exact day the ration
 * exists to protect: `tests/day.test.ts` caught it, which is the whole reason
 * that test asks about day one specifically.
 *
 * Read the other way round, this is what "backed up" honestly means — words
 * that have been *kept waiting*, rather than words that arrived together.
 *
 * Exported so the tests can assert the rule rather than re-implement it, which
 * is how `tests/wordbudget.test.ts` came to be measuring a day of its own
 * invention in the first place.
 */
export function wordsForToday(alreadyWaiting: number): number {
  return alreadyWaiting >= WORD_BACKLOG ? WORDS_PER_DAY + 1 : WORDS_PER_DAY;
}

export interface DaySettlement {
  /** The game after the day. Nothing else about it needs fixing up. */
  game: Game;
  /** The words to show now. Already recorded as learned on `game`. */
  handedOver: Insight[];
}

export interface SettleOptions {
  /**
   * Did the manager run it, rather than the child?
   *
   * Only a manager-run day can advance the hands-off streak, which is what
   * makes "it runs without you" a demonstration rather than a sticker.
   */
  ranByManager: boolean;
  /**
   * Which day of the current stage this is, counting today.
   *
   * Passed rather than derived, because it is derived from the *pre-day*
   * history — `actDay` reads `stand.history.length` and this function is about
   * to append to it. Handing it in keeps the off-by-one out of the arithmetic
   * entirely instead of leaving a subtraction for each caller to get wrong.
   */
  stageDay: number;
}

/** Everything a day teaches, filtered against what has already been handed over. */
function wordsEarned(game: Game, outcome: DayOutcome): Insight[] {
  const act1 = deriveInsights(outcome, outcome.nextState.history);
  const act2 =
    game.act >= 2 ? deriveAct2Insights(outcome, game.business, outcome.nextState.history) : [];
  /*
   * Break-even and interest, and only for a child who has a rent or a
   * repayment to be taught them by.
   */
  const act3 = game.act >= 3 ? deriveAct3Insights(outcome, game.business) : [];
  /*
   * The round earns its word the first day somebody on it is served, and the
   * copy leans on a cold day if that is what happened — because turning up
   * when nobody else did is the entire point of recurring revenue.
   */
  const round =
    outcome.subscriberCups > 0
      ? [recurringRevenueInsight(outcome.subscriberCups, outcome.subscriberPrice, outcome.weather)]
      : [];

  /*
   * Filtered against what is queued as well as what has been given, or a word
   * waiting its turn would be earned again tomorrow and end up in the queue
   * twice.
   */
  return unrecorded(
    [...act1, ...act2, ...act3, ...round],
    [...game.learned, ...game.pendingInsights.map((insight) => insight.id)],
  );
}

/**
 * Everything a day changes about the business.
 *
 * The four counters, the competitor and the pitch. The Saturday stand is
 * excluded from all of it by the caller, because a folding table paid for out
 * of an investment account is not the business any of these are about.
 */
function businessAfter(
  game: Game,
  outcome: DayOutcome,
  { ranByManager, stageDay }: SettleOptions,
): BusinessState {
  return {
    ...updateHandsOff(game.business, ranByManager, outcome.profit),
    twoStandDays: updateTwoStandDays(game.business, outcome.profit).twoStandDays,
    shop: updateShopDays(game.business.shop, outcome.profit),
    loan: repayLoan(game.business.loan),
    /*
     * The competitor.
     *
     * This line is the whole reason the file exists. It was in the app and not
     * in the harness, so the harness proved things about a game with nobody
     * across the road. `advanceRival` carries its own guard for stages below
     * two — FRAMEWORK.md §1 says Stage 1's demand is "driven only by price +
     * quality ... No weather, competition, location" — so the act goes in
     * rather than a condition being written here.
     */
    rival: advanceRival(game.business, stageDay, outcome.price, game.act),
    daysAtPark:
      game.business.location === 'park' ? game.business.daysAtPark + 1 : game.business.daysAtPark,
  };
}

/**
 * The day is over. Work out what it taught and what it changed.
 *
 * Called once, at the end, from wherever a day ends: the close screen in the
 * app and the loop in `demo.ts`. Everything is computed from the pre-day game
 * and the final outcome, which is what makes that safe — the child may have
 * answered the lunchtime question and had the whole day re-run underneath
 * them, and nothing here was banked early.
 */
export function settleDay(
  game: Game,
  outcome: DayOutcome,
  options: SettleOptions,
): DaySettlement {
  const earned = wordsEarned(game, outcome);
  const queue = [...game.pendingInsights, ...earned];
  const today = wordsForToday(game.pendingInsights.length);
  const handedOver = queue.slice(0, today);
  const waiting = queue.slice(today);

  return {
    handedOver,
    game: {
      ...game,
      stand: outcome.nextState,
      daysTraded: game.daysTraded + 1,
      /*
       * Only what was actually handed over counts as learned; that is what
       * gates the harder panels and fills the words tab.
       */
      learned: [...game.learned, ...handedOver.map((insight) => insight.id)],
      pendingInsights: waiting,
      /*
       * The Saturday stand changes none of the counters.
       *
       * It is not the business: the child sold that. It keeps no streak, pays
       * nothing off the loan and has no competitor.
       */
      business: game.weekend ? game.business : businessAfter(game, outcome, options),
      ownership: recordInvestorCut(game.ownership, outcome.investorCut),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Where the child goes next
 * ------------------------------------------------------------------ */

/**
 * How often the reinvest-or-take-it-out fork comes round inside a stage.
 *
 * Seven, unchanged, because a week is the frame the screen is written in. What
 * changed is that a week is no longer the *only* way to reach it — see
 * `afterDay`.
 */
export const WEEKLY_EVERY = 7;

/**
 * Where a child goes when they dismiss the close screen.
 *
 * A small union rather than a screen name, so this can be decided in a pure
 * function and tested. The caller maps each of these onto its own phase and
 * does the React work — `next-act` in particular means "call the right
 * `beginActN`", which this module deliberately does not do.
 */
export type AfterDay =
  | 'week-end'
  | 'weekly-choice'
  | 'next-act'
  | 'deals'
  | 'listing'
  | 'mark-week'
  | 'plan';

/**
 * The routing decision, extracted from `page.tsx` so it can be checked.
 *
 * ## Why this is not left in the component
 *
 * It was, and it was the single densest piece of untested logic in the
 * product: seven branches, two of them turning on `stageDay % 7`, deciding
 * which of nine screens a child sees at the end of every day of the game. The
 * only way to exercise it was to play to the day in question.
 *
 * ## The bug it was hiding
 *
 * The reinvest-or-take-it-out fork fired on `stageDay % WEEKLY_EVERY === 0`
 * and nowhere else. Measured against the stages as they actually run:
 *
 * | | reaches day 7 of the stands stage? |
 * |---|---|
 * | sensible play — finishes it on day 5 or 6 | **no** |
 * | careless play — runs to the ten-day cap | yes |
 * | sensible play in the shop — finishes on day 5 | **no** |
 *
 * So the fork, the savings account, and the entire round — `ROUND`,
 * `signUpRegulars`, the recurring-revenue word, twenty tests in
 * `tests/round.test.ts` — were reachable **only by playing badly.** A child who
 * understood the stage was shown none of it. That is PRODUCT.md §40's defect
 * class, a mechanic wired to nothing, and it survived because every
 * measurement of how long a stage takes was taken with the competitor switched
 * off and therefore said eleven days where the real answer is five.
 *
 * The fix is not to shorten the week. It is that **a stage does not end
 * without offering its fork**: the last day of a stage is an end-of-week
 * whatever the day number says, because it is the last chance the stage has.
 * Long stages keep the seven-day rhythm exactly as before, so careless play is
 * unaffected.
 *
 * `forkTaken` is what stops it looping: the fork routes back through here, and
 * the second pass skips it and falls through to the act boundary.
 */
export function afterDay(
  game: Game,
  stageDay: number,
  { forkTaken }: { forkTaken: boolean },
): AfterDay {
  if (game.act === 1) {
    return act1Complete(game.stand, game.challenge?.spec.days ?? ECON.TOTAL_DAYS)
      ? 'week-end'
      : 'plan';
  }

  if (game.act === 2 || game.act === 3) {
    const ending =
      game.act === 2
        ? act2Complete(game.business, stageDay)
        : act3Complete(game.business, stageDay);

    /*
     * The fork: on the rhythm, or on the way out, whichever comes first.
     *
     * A shop makes the same choice sharper rather than redundant — the rent is
     * owed either way, so money taken out of a business with a lease is money
     * it may need on Tuesday.
     */
    if (!forkTaken && (ending || stageDay % WEEKLY_EVERY === 0)) return 'weekly-choice';
    return ending ? 'next-act' : 'plan';
  }

  /*
   * The listing stage, in the order the beats have to arrive.
   *
   * The deal board first, because ranking three stands by what they cost per
   * dollar of profit is what makes a multiple mean anything — and it has to
   * happen before the child is handed one for their own company, or the number
   * on their own offer is the first multiple they have ever seen and they have
   * nothing to judge it against.
   *
   * Then the two ways out. Then, once listed, a week at a time: the day loop
   * carries on and the price is marked every seventh day, because that is what
   * being public is — you keep running the shop and somebody re-prices it
   * while you do.
   */
  if (game.act === 4) {
    if (!game.ownership.comparisonAnswered) return 'deals';
    if (!game.listing.listed) {
      // Nothing to price yet. The goal strip says why, and the day loop
      // carries on — one decent week is all it takes.
      return listingOffer(game.stand.history, game.ownership).worthAnything ? 'listing' : 'plan';
    }
    if (stageDay % WEEKLY_EVERY === 0) return 'mark-week';
  }

  return 'plan';
}
