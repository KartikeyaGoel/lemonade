/**
 * The question at lunchtime.
 *
 * ## Why this exists
 *
 * Five children played the game and four of them closed it inside five
 * minutes. The note that explains it best is the one about this screen:
 *
 * > All kids who played the game and went to open the lemonade stand, used the
 * > speed it up and let them come option. So it seems like a not useful
 * > visualization.
 *
 * And, later in the same document: *"At one point laksh told the other boys to
 * just press the speed up button to get through it fast."*
 *
 * `RunDayScreen` had already tried to answer this once. It has an `interactive`
 * mode that hands the pace to the child — eight taps a day, so "the payoff
 * [becomes] something they are causing". The pilot is that experiment's result.
 * Controlling the *pace* of an outcome that is already decided is not agency;
 * it is a progress bar you have to hold down. The tell is which control they
 * reached for: **"Let the rest come"**, the button that ends the pretence.
 *
 * PRODUCT.md §68 works out why a loop stops being worth repeating. A turn has
 * to present a decision whose outcome is *uncertain*, and the price-and-batch
 * question is genuinely uncertain for about two days. By day three a child has
 * found a price that works and the same inputs produce the same outputs. The
 * pilot's own wording is "after Day 3".
 *
 * So the day gets a decision inside it, and the decision is drawn fresh from
 * the weather every single day. There is no price a child can find that makes
 * tomorrow's afternoon predictable, which is what makes this one permanent
 * rather than good for two more days.
 *
 * ## What it is allowed to say
 *
 * `guide.ts` has the load-bearing rule and it applies here more than anywhere:
 * **name what happened, never say what to do.** This module therefore reports
 * *facts about the morning* — cups gone, people who walked, cups left — and
 * offers the same three answers in every situation, including the wrong one. A
 * child who raises the price on a day nobody is buying is allowed to, and
 * should be, because that is where the learning is.
 *
 * The `lean` field is the only judgement, and it is a judgement about **the
 * shape of the day, not the right answer**. It decides whether there is a
 * question worth stopping for at all: a day that is tracking comfortably gets
 * no interruption, because a beat with nothing at stake teaches a child that
 * the beat does not matter.
 *
 * Pure module. No React, no I/O.
 */

import { MORNING_SHARE, WEATHER_COPY, type Customer, type DayOutcome } from './simulation';
import { money, plural } from './copy';

/**
 * How far the sign may move at lunchtime, in cents.
 *
 * Twenty-five, which is five steps of the price slider. Small enough that it is
 * an adjustment rather than a new business, and large enough to be visible in
 * the afternoon's takings — a five-cent nudge on half a crowd is a rounding
 * error, and a decision whose consequence is invisible is worse than no
 * decision.
 */
export const MIDDAY_STEP_CENTS = 25;

/** Which way the morning is leaning. Never which way to move the sign. */
export type Lean = 'running-out' | 'not-selling';

export interface MiddayCall {
  lean: Lean;
  /** Cups left in the jug when the child is asked. */
  cupsLeft: number;
  /** Cups gone, including regulars. */
  cupsGone: number;
  /** People who read the sign this morning and kept walking. */
  walkedOn: number;
  /** The sign as it stands. */
  price: number;
  /**
   * What happened this morning, in one or two sentences.
   *
   * Facts with the child's own figures in them, and no verb in the imperative.
   */
  says: string[];
}

/** Passers-by only, in arrival order. Regulars prepaid and decide nothing. */
function walkUps(customers: readonly Customer[]): Customer[] {
  return customers.filter((customer) => customer.kind === 'passerby');
}

/**
 * Is there a question worth stopping the day for, and what are the facts?
 *
 * Returns `null` on a day that is simply going fine, which is most days with a
 * well-chosen price and a forecast that held. That is deliberate: the beat has
 * to mean something when it arrives.
 *
 * Read off the outcome of the day as it would run *without* a change, which is
 * exactly what the caller has in hand — `page.tsx` runs the day at the morning
 * price, shows the morning, and re-runs it with an answer.
 */
export function middayCall(outcome: DayOutcome): MiddayCall | null {
  const crowd = walkUps(outcome.customers);
  /*
   * Nobody to ask about.
   *
   * A day with a handful of passers-by has no afternoon worth pricing, and the
   * arithmetic below divides by the crowd.
   */
  if (crowd.length < 4) return null;

  const morning = crowd.slice(0, Math.floor(crowd.length * MORNING_SHARE));
  const afternoon = crowd.length - morning.length;
  if (morning.length === 0 || afternoon === 0) return null;

  const boughtThisMorning = morning.filter((customer) => customer.outcome === 'bought').length;
  const walkedOn = morning.filter((customer) => customer.outcome === 'too-expensive').length;
  /* Regulars are served first, so their cups are already out of the jug. */
  const cupsGone = outcome.subscriberCups + boughtThisMorning;
  const cupsLeft = Math.max(0, outcome.cupsMakeable - cupsGone);

  const weather = WEATHER_COPY[outcome.weather];

  /*
   * Going to run out.
   *
   * Two conditions, and neither is a threshold anybody guessed.
   *
   * `turnedAwaySoldOut` is the day, run at the morning price, reporting that
   * somebody wanted a cup and there was none. So it is not "the jug looks
   * low" — it is "this batch does not reach the end of this day", which is the
   * fact a price rise would act on. A first pass used a quarter-of-the-batch
   * threshold instead and a sweep across eight prices and six batch sizes
   * showed why that was wrong: at low prices the jug empties long before
   * lunch, so the threshold was measuring how *fast* the day was going rather
   * than whether there was anything left to decide.
   *
   * And `cupsLeft > 0`, because a child holding an empty jug has no decision
   * to make. Telling them they have run out is the receipt this beat exists to
   * replace. (The interesting question on that day is whether to go and buy
   * more lemons, which is a second beat and is not built — see PRODUCT.md §69.)
   */
  if (cupsLeft > 0 && outcome.turnedAwaySoldOut > 0) {
    return {
      lean: 'running-out',
      cupsLeft,
      cupsGone,
      walkedOn,
      price: outcome.price,
      says: [
        `${weather} — and ${plural(cupsGone, 'cup')} already gone.`,
        `${plural(cupsLeft, 'cup')} left, and the afternoon crowd is still coming.`,
      ],
    };
  }

  /*
   * Not selling.
   *
   * More people said no than yes, *and* most of the jug is still full. The
   * second half matters: a thin crowd on a cold day is a quiet morning, not a
   * price problem, and a child who drops their price because the street was
   * empty has been taught the wrong thing by the interruption.
   */
  if (
    walkedOn > boughtThisMorning &&
    cupsLeft > outcome.cupsMakeable * 0.5 &&
    outcome.cupsMakeable > 0
  ) {
    return {
      lean: 'not-selling',
      cupsLeft,
      cupsGone,
      walkedOn,
      price: outcome.price,
      says: [
        `${plural(walkedOn, 'person', 'people')} read ${money(outcome.price)} and kept walking.`,
        `${plural(boughtThisMorning, 'cup')} sold, and ${cupsLeft} still in the jug.`,
      ],
    };
  }

  return null;
}

/**
 * The three answers, in the order they appear on screen.
 *
 * Always three, always in the same order, and always including the one that
 * does nothing. A screen that offers "raise it" on a busy day and "drop it" on
 * a quiet one is a screen that tells a child the answer and then asks them to
 * confirm it, which is the game playing the game.
 *
 * The middle option is not a cancel button. Holding a price while the day
 * misbehaves is a real strategy and one of the four readiness criteria is
 * about exactly that steadiness, so it gets equal billing.
 */
export interface MiddayOption {
  id: 'down' | 'hold' | 'up';
  price: number;
  label: string;
}

export function middayOptions(price: number): MiddayOption[] {
  /* In cents throughout, because a price is a decimal quantity and
     `price - 0.25` on a $1.45 sign is not $1.20. See `centsApart`. */
  const cents = Math.round(price * 100);
  const down = Math.max(0, cents - MIDDAY_STEP_CENTS) / 100;
  const up = (cents + MIDDAY_STEP_CENTS) / 100;
  return [
    { id: 'down', price: down, label: `Drop to ${money(down)}` },
    { id: 'hold', price, label: `Keep ${money(price)}` },
    { id: 'up', price: up, label: `Raise to ${money(up)}` },
  ].map((option) => ({ ...option, price: Math.round(option.price * 100) / 100 })) as MiddayOption[];
}

/** The line that names what the change did, for the close screen. */
export function middayResult(outcome: DayOutcome): string | null {
  if (outcome.afternoonPrice === outcome.price) return null;
  const up = outcome.afternoonPrice > outcome.price;
  return (
    `You changed the sign at lunchtime: ${money(outcome.price)} in the morning, ` +
    `${money(outcome.afternoonPrice)} after. ` +
    `${plural(outcome.morningCups, 'cup')} went at the first price and ` +
    `${plural(outcome.afternoonCups, 'cup')} at the ${up ? 'higher' : 'lower'} one.`
  );
}
