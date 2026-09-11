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

/** The four things a child can point at when a day comes out different. */
export type Cause = 'batch' | 'price' | 'quality' | 'weather';

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

  const base = at(outcome.price);
  return {
    price: at(outcome.price) - at(yesterday.price),
    weather:
      base * weatherFactor(outcome.weather, params.indoorShare) -
      base * weatherFactor(yesterday.weather, params.indoorShare),
    quality: base * gradeToday - base * gradeYesterday,
    batch: outcome.cupsMakeable - (yesterday.cupsMade ?? yesterday.cupsSold),
  };
}

/**
 * What made today different, or null when nothing much did.
 *
 * The biggest of the four changes. Each option is a claim that is either true
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

  const moved = changesSince(outcome, yesterday);
  /*
   * Ties broken in a fixed order, so the same two days always get the same
   * answer. The order is by how much a child can *do* about it, which is the
   * right tie-break for a stage whose job is teaching that decisions matter:
   * the sign and the jug are theirs today, the lemons are theirs a day late,
   * and the sky is nobody's.
   */
  const ranked = (['price', 'batch', 'quality', 'weather'] as Cause[]).sort(
    (a, b) => Math.abs(moved[b]) - Math.abs(moved[a]),
  );
  const cause = ranked[0];
  if (Math.abs(moved[cause]) < WORTH_ASKING_CUPS) return null;

  const cups = Math.round(Math.abs(moved[cause]));
  const up = moved[cause] > 0;

  /*
   * All four options, in the same order, every time.
   *
   * Fixed order so the *position* of the right answer is never the thing a
   * child learns — the only way to answer is to read the two days. And all four
   * every time so a child meets the complete set of things that make one day
   * differ from another, which is the shape of the whole stage in four lines.
   *
   * Four options is one decision, which is what §13 says to bound; the deal
   * board asks the same of a child with three.
   */
  const wording: Record<Cause, string> = {
    price: 'You changed what you charged',
    batch: 'You made a different number of cups',
    quality: 'You used a different kind of lemon',
    weather: 'The weather was different',
  };
  const answers: Answer[] = (['price', 'batch', 'quality', 'weather'] as Cause[]).map((id) => ({
    cause: id,
    label: wording[id],
  }));

  const because: Record<Cause, string> = {
    price: `${money(yesterday.price)} yesterday, ${money(outcome.price)} today. That alone ${
      up ? 'brought' : 'cost you'
    } about ${plural(cups, 'customer')}.`,
    batch: `You made ${plural(yesterday.cupsMade ?? yesterday.cupsSold, 'cup')} yesterday and ${outcome.cupsMakeable} today — ${cups} ${up ? 'more' : 'fewer'} to sell.`,
    quality: `The lemons ${up ? 'brought' : 'cost you'} about ${plural(cups, 'customer')} against yesterday's. Yesterday's kind still counts today — that is word of mouth.`,
    weather: `${WEATHER_COPY[yesterday.weather]} yesterday. ${WEATHER_COPY[outcome.weather]} today. About ${plural(cups, 'person', 'people')} ${up ? 'more' : 'fewer'} wanted a cup, and you chose none of it.`,
  };

  const correction: Record<Cause, string> = {
    price: 'The sign moved more than anything else:',
    batch: 'The jug moved more than anything else:',
    quality: 'The lemons moved more than anything else:',
    weather: 'The sky moved more than anything else:',
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
