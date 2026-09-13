/**
 * What made today different from yesterday, asked rather than told.
 *
 * ## Two rows of the specification and one pilot note, answered together
 *
 * FRAMEWORK.md §1's Stage 1 table has a line nothing in the product answers:
 *
 * | **Diagnostic feedback** | Short explanation such as "Customers liked the quality, but your price was too high." |
 *
 * What got built instead was an itemised profit and loss. That is *accounting* —
 * it says what the day cost, not what decided it. §15 audited Stage 1 against
 * this table and missed the gap, because a twelve-row statement looks like more
 * feedback than one sentence rather than less.
 *
 * And the pilot, unprompted, asked for the same thing from the other side:
 *
 * > Most kids who played the game, asked laksh how much money he made in day 1
 * > and day 2 — **so a compare option might be great.**
 *
 * They invented day-against-day comparison for themselves. That is the shape
 * this takes, and it is also the shape the rest of the game already teaches:
 * `bench.ts` exists because "a kid could charge more and earn less and never
 * find out whether the price did it or the weather did, because both moved at
 * once. That is not a difficulty problem, it is a *measurement* problem."
 *
 * ## Why it is a question rather than a sentence
 *
 * > When Day 1 is over, the summary is one page with the big, start day 2. **No
 * > kid read the results**, they all looked at how much money and immediately
 * > went to day 2.
 *
 * A well-written diagnosis would be skipped exactly as the ledger is. §68's
 * cause D is that the whole teaching layer is prose aimed at an audience that
 * does not read, and the foundational move is: **where the game explains, make
 * it ask.**
 *
 * It is not a wall. The customer's own suggestion — blur everything until the
 * duck has been read — is refused in §68 for the same reason this exists:
 * forcing a nine-year-old through text teaches them the software wastes their
 * time. This is one tap, the answer lands immediately, and what it teaches is
 * what they need for tomorrow's dials. A child who skips it goes to day two
 * knowing less, and that is the only honest incentive available.
 *
 * `checkin.ts` already asks the market's six-step ritual one question at a
 * time, for §26's reason. This is the same move in the first stage.
 *
 * ## Why *different from yesterday* rather than *decided today*
 *
 * The first version asked what decided today and measured four effects as a
 * share of the day. A sweep of 280 days: **price won 241 of them.** Not a bug —
 * a refusal rate is structurally around a half at any sensible price, because
 * the demand curve runs from sixty down, so "most people walked past your
 * price" is true on a good day and a bad one alike. A question whose answer is
 * nearly always the same teaches a child to stop reading it, which is the
 * failure this module exists to fix.
 *
 * Asked as a *difference*, every option is a real delta the child either caused
 * or did not, all four are reachable, and the answer changes with what they
 * actually did. It also teaches the thing `bench.ts` is about: when two things
 * move at once, attribute the money to the one that moved.
 *
 * So this needs a yesterday, and is silent on day one. Day one has nothing to
 * compare against, and inventing one would be the only dishonest thing this
 * module could do.
 *
 * Pure module. No React, no I/O.
 */

import {
  WEATHER_COPY,
  cupsWantedWith,
  gradeDemandFactor,
  resolveDayParams,
  weatherFactor,
  type DayOutcome,
  type DayRecord,
  type LemonGrade,
} from './simulation';
import { money, plural } from './copy';

/** The things a child can point at when a day comes out different. */
export type Cause = 'batch' | 'price' | 'quality' | 'rival' | 'weather';

export interface Answer {
  cause: Cause;
  /** What a child taps. A claim about today that could be false. */
  label: string;
}

export interface Diagnosis {
  /** The one that is true. */
  cause: Cause;
  answers: Answer[];
  /** Yesterday's profit and today's, which is the comparison they asked for. */
  yesterdayProfit: number;
  todayProfit: number;
  /**
   * The sentence once they have answered — right or wrong.
   *
   * Carries the figure, because the figure is the part that changes tomorrow's
   * decision. Never says what to do with it.
   */
  because: string;
  /** Said when they got it wrong, before `because`. Names, never scolds. */
  correction: string;
}

/**
 * The smallest change worth asking about, in cups.
 *
 * Three. Below that the two days were the same day and there is nothing to
 * attribute — and a question turning on one cup is one a child cannot answer by
 * reading the screen. Once they have met one of those they stop trusting the
 * rest.
 */
export const WORTH_ASKING_CUPS = 3;

/**
 * How many cups each change moved, today against yesterday.
 *
 * Exact, not estimated. `runDay` builds demand as
 * `cupsWantedWith(price, weather, params) * gradeDemandFactor(grade, history)`,
 * so holding two of the three fixed and moving the third gives that one's
 * contribution with nothing else mixed in. This is the decomposition
 * `bench.ts` says a child cannot do for themselves when two dials move at once.
 *
 * The jug is the exception and is not a demand effect at all: it is how many
 * cups there were to sell, which caps everything downstream of it.
 *
 * ## The fifth term, and the three days it was missing
 *
 * `marketShare` was not in this decomposition, and it is a plain multiplicative
 * factor inside `cupsWantedWith` exactly like the other three. So on the day a
 * rival opened across the road the four terms below summed to roughly nothing
 * while the day itself lost four fifths of its profit, and the residual landed
 * on whichever of the four happened to twitch.
 *
 * Measured, at $1.80 with the cooler bought, on the day the rival arrives:
 *
 * | seed | yesterday | today | what this said |
 * |---|---|---|---|
 * | 1 | $33.82 | $6.11 | *the weather was different* — on 4.4 cups of weather |
 * | 99 | $32.92 | $5.11 | *you made a different number of cups* |
 * | 2026 | $17.22 | $5.61 | nothing at all — every term under the threshold |
 *
 * Blaming the sky for a competitor is worse than saying nothing, because the
 * whole of PRODUCT.md §4 is that two figures shown together have to reconcile,
 * and worse again because *the child can do something about a rival*. Stage 2
 * is winnable in five days by whoever works out that being different beats
 * being cheaper, and unwinnable inside its sixteen-day clock by whoever does
 * not. This question is the one place the game was ever going to say so.
 */
export function changesSince(outcome: DayOutcome, yesterday: DayRecord): Record<Cause, number> {
  const params = resolveDayParams(outcome.params);
  const at = (price: number) => cupsWantedWith(price, 'mild', params);

  /*
   * The recipe, as the factor each day's demand was actually multiplied by.
   *
   * Today's factor is the average of today's kind and yesterday's, which is
   * what makes it word of mouth; yesterday's was the average of its own kind
   * and the day before's, but that day is not on hand here and the difference
   * it makes is a quarter of a quarter. Passing `[]` reads yesterday on its own
   * choice, which is the same simplification `gradeDemandFactor` already makes
   * for day one.
   */
  const gradeToday = gradeDemandFactor(outcome.grade, [yesterday]);
  const gradeYesterday = gradeDemandFactor((yesterday.grade ?? 'regular') as LemonGrade, []);

  /*
   * The same day with a different share of the street, which is the only thing
   * a rival changes. Share multiplies demand, so this is the identical
   * hold-the-others-still move the price term makes one line up.
   *
   * Yesterday defaults to today's share rather than to 1, so a save from
   * before the field existed — and every day of Stage 1, which has no rival
   * ever — reports no change instead of inventing a competitor.
   */
  const shareToday = params.marketShare;
  const shareYesterday = yesterday.marketShare ?? shareToday;
  const atShare = (share: number) =>
    cupsWantedWith(outcome.price, 'mild', { ...params, marketShare: share });

  const base = at(outcome.price);
  return {
    price: at(outcome.price) - at(yesterday.price),
    weather:
      base * weatherFactor(outcome.weather, params.indoorShare) -
      base * weatherFactor(yesterday.weather, params.indoorShare),
    quality: base * gradeToday - base * gradeYesterday,
    /*
     * Only the part of the jug that actually bit.
     *
     * This was a bare difference of the two batches, and a bare difference
     * claims a day was decided by cups that were never going to be sold: a
     * jug cut from 44 to 24 on a day sixteen people wanted a cup changed
     * nothing whatsoever, and reported twenty. On seed 99, the day the rival
     * arrived, that phantom twenty beat the nineteen cups the rival really
     * took and the child was told they had made a different number of cups.
     *
     * So it is capped by today's demand on both sides — the same
     * hold-everything-else-still move every other term makes. Two jugs that
     * both clear the queue difference to zero, which is the truth, and the
     * question falls through to whichever thing did decide the day.
     */
    batch:
      Math.min(outcome.cupsWanted, outcome.cupsAvailable) -
      Math.min(outcome.cupsWanted, yesterday.cupsMade ?? yesterday.cupsSold),
    rival: atShare(shareToday) - atShare(shareYesterday),
  };
}

/**
 * What made today different, or null when nothing much did.
 *
 * The biggest change of the four, or five where there is a rival. Each option
 * is a claim that is either true
 * or false of the two days in front of the child, rather than a judgement about
 * them.
 */
export function diagnose(outcome: DayOutcome, history: readonly DayRecord[]): Diagnosis | null {
  /*
   * Yesterday is the record before this day, which on the close screen is the
   * last entry of the *pre-day* history.
   */
  const yesterday = history[history.length - 1];
  if (!yesterday) return null;

  const params = resolveDayParams(outcome.params);
  const moved = changesSince(outcome, yesterday);
  /*
   * Ties broken in a fixed order, so the same two days always get the same
   * answer. The order is by how much a child can *do* about it, which is the
   * right tie-break for a stage whose job is teaching that decisions matter:
   * the sign and the jug are theirs today, the lemons are theirs a day late,
   * the rival is theirs only by being worth more than him, and the sky is
   * nobody's.
   */
  const ranked = (['price', 'batch', 'quality', 'rival', 'weather'] as Cause[]).sort(
    (a, b) => Math.abs(moved[b]) - Math.abs(moved[a]),
  );
  const cause = ranked[0];
  if (Math.abs(moved[cause]) < WORTH_ASKING_CUPS) return null;

  const cups = Math.round(Math.abs(moved[cause]));
  const up = moved[cause] > 0;

  /*
   * Every option that could be true here, in the same order, every time.
   *
   * Fixed order so the *position* of the right answer is never the thing a
   * child learns — the only way to answer is to read the two days. And the
   * whole set every time so a child meets the complete list of things that
   * make one day differ from another, which is the shape of the stage in four
   * or five lines.
   *
   * The rival is the one conditional option, and the condition is the world
   * rather than a difficulty dial: Stage 1 has no competitor at all —
   * FRAMEWORK.md §1 says its demand is "driven only by price + quality ... No
   * weather, competition, location" and `advanceRival` refuses to run below
   * Stage 2 — so offering it there would be an answer that can never be true
   * for a whole stage. Once somebody is across the road it goes in and stays
   * in, including on the days he did not move, exactly as "you changed what
   * you charged" stays in on a day the sign did not move.
   *
   * Five options is still one decision, which is what §13 says to bound.
   */
  const wording: Record<Cause, string> = {
    price: 'You changed what you charged',
    batch: 'You made a different number of cups',
    quality: 'You used a different kind of lemon',
    rival: 'Somebody else was selling lemonade',
    weather: 'The weather was different',
  };
  /*
   * Contested if the street was ever shared, today or yesterday. Read off the
   * share itself rather than off a rival flag, because the share is what the
   * arithmetic above actually used.
   */
  const contested = params.marketShare < 1 || (yesterday.marketShare ?? 1) < 1;
  const offered: Cause[] = contested
    ? ['price', 'batch', 'quality', 'rival', 'weather']
    : ['price', 'batch', 'quality', 'weather'];
  const answers: Answer[] = offered.map((id) => ({ cause: id, label: wording[id] }));

  const because: Record<Cause, string> = {
    price: `${money(yesterday.price)} yesterday, ${money(outcome.price)} today. That alone ${
      up ? 'brought' : 'cost you'
    } about ${plural(cups, 'customer')}.`,
    batch: `You made ${plural(yesterday.cupsMade ?? yesterday.cupsSold, 'cup')} yesterday and ${outcome.cupsMakeable} today — ${cups} ${up ? 'more' : 'fewer'} to sell.`,
    quality: `The lemons ${up ? 'brought' : 'cost you'} about ${plural(cups, 'customer')} against yesterday's. Yesterday's kind still counts today — that is word of mouth.`,
    weather: `${WEATHER_COPY[yesterday.weather]} yesterday. ${WEATHER_COPY[outcome.weather]} today. About ${plural(cups, 'person', 'people')} ${up ? 'more' : 'fewer'} wanted a cup, and you chose none of it.`,
    /*
     * The same two figures the stand shows when the rival is tapped — "Share
     * of the street coming to you" — so the two screens cannot disagree about
     * what happened. §62: one fact, and both homes read it off `marketShare`.
     */
    rival: `${Math.round((yesterday.marketShare ?? 1) * 100)}% of the street came to you yesterday, ${Math.round(params.marketShare * 100)}% today. That ${
      up ? 'brought' : 'cost you'
    } about ${plural(cups, 'customer')}. You do not have to be cheaper than him.`,
  };

  const correction: Record<Cause, string> = {
    price: 'The sign moved more than anything else:',
    batch: 'The jug moved more than anything else:',
    quality: 'The lemons moved more than anything else:',
    weather: 'The sky moved more than anything else:',
    rival: 'The stand across the road moved more than anything else:',
  };

  return {
    cause,
    answers,
    yesterdayProfit: yesterday.profit,
    todayProfit: outcome.profit,
    because: because[cause],
    correction: correction[cause],
  };
}

/**
 * What the recipe did to the queue today, whether or not it was the big story.
 *
 * Separate from the question on purpose. The pilot's note was *"I could not
 * tell easily that choosing good lemons will make less people come back"*, and
 * what they wanted was for it to be **legible**, not quizzed. Measured, the
 * recipe moves demand by at most a quarter and usually an eighth — the price
 * can move it by everything — so `quality` is rarely the biggest change between
 * two days, and a child who only ever met it as a quiz answer would almost
 * never meet it at all.
 *
 * Returns null on the ordinary lemon, where there is nothing to say.
 */
export function wordOfMouth(outcome: DayOutcome, history: readonly DayRecord[]): string | null {
  const factor = gradeDemandFactor(outcome.grade, history);
  if (factor === 1) return null;
  const plain = outcome.cupsWanted / factor;
  const cups = Math.round(outcome.cupsWanted - plain);
  if (cups === 0) return null;
  const yesterday = history[history.length - 1]?.grade;
  /* Only mention the memory when yesterday's kind was genuinely a different
     one, or the sentence claims a subtlety that did not happen. */
  const remembered =
    yesterday !== undefined && yesterday !== outcome.grade
      ? " Yesterday's kind counts too — half of today is what people remember."
      : '';
  return cups > 0
    ? `Your lemons brought about ${plural(cups, 'extra person', 'extra people')} to the stand.${remembered}`
    : `Your lemons cost you about ${plural(Math.abs(cups), 'customer')}.${remembered}`;
}
