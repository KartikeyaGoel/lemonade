/**
 * The first time a screen changes how the game is played.
 *
 * There is one place in Act 1 where the interaction model changes underneath
 * the child, and it is not a small change.
 *
 * Day one runs `morning → shop → price`: three screens, one decision each, a
 * slider in the middle and a button at the bottom. `ShopScreen`'s own comment
 * records that this path "is only ever reached on a run's first day ... and
 * every later day goes straight to the stand".
 *
 * Day two goes straight to the stand — and the same two decisions are now
 * hotspots on a picture of a lemonade stand. Nothing tells the child that the
 * sign *is* yesterday's price screen and the crate of lemons *is* yesterday's
 * shopping screen. They learned one model on Tuesday and were handed another
 * on Wednesday.
 *
 * `StandScene` already suspected this. It renders "tap the sign" under the
 * price and `PlanScreen` adds a bubble saying to tap the sign and the lemons.
 * Both were there, and the customer still played a day and did not know the
 * stand was touchable — which is the evidence that a line of text next to a
 * new interaction model is not enough to teach it.
 *
 * So this module holds the tour: what to point at, in what order, and what Pip
 * says. Copy lives here rather than in the component because `lib` is where
 * the reading-level gate looks, and because the order is a design decision
 * worth being able to read in one place.
 *
 * Three steps, and no more. The point is not to explain the stand — it is to
 * establish that the stand is *made of controls*, after which a child can find
 * the other four hotspots themselves. See FRAMEWORK.md §13 on bounding the
 * number of decisions rather than the number of things drawn.
 *
 * Pure module. No React, no I/O.
 */

/** Tours that only ever run once, keyed for `Career.coached`. */
export type TourId = 'the-stand';

export interface CoachStep {
  /**
   * The `data-coach` attribute of the thing being pointed at.
   *
   * An attribute rather than a class or an aria-label, because the first two
   * are styling that a redesign will move and the third is copy that
   * translation will change. This is the only reason the attribute exists, and
   * `tests/ui/coach.test.tsx` fails if a step points at nothing.
   */
  target: string;
  /** What Pip says. Kept to two short lines; a third is a paragraph. */
  lines: readonly string[];
}

export interface Tour {
  id: TourId;
  steps: readonly CoachStep[];
}

/**
 * Meeting the stand for the first time.
 *
 * The order is deliberate and it is the loop's order, not the screen's: price,
 * then how much to make, then the free rehearsal. Price comes first because it
 * is the decision the child already made yesterday, so the first thing the
 * tour does is connect the new screen to the old one rather than teach
 * anything new.
 *
 * The third step is the one that is not a bridge. Trying a plan against
 * yesterday's crowd is the mechanic that makes this a game a child can be
 * curious in rather than a form they fill in, and it is a button nobody
 * pressed because nobody knew what it did.
 */
export const STAND_TOUR: Tour = {
  id: 'the-stand',
  steps: [
    {
      target: 'price',
      lines: [
        'Yesterday you picked a price on its own screen.',
        'Now it lives on your sign. Tap it to change it.',
      ],
    },
    {
      target: 'batch',
      lines: [
        'The lemons are how much you make today.',
        'Tap them for more cups, or fewer.',
      ],
    },
    {
      target: 'try',
      lines: [
        'Not sure? Try your plan on yesterday.',
        'Being wrong here costs you nothing.',
      ],
    },
  ],
};

/** Has this child been shown this tour? */
export function toured(coached: readonly string[], id: TourId): boolean {
  return coached.includes(id);
}

/**
 * The step to show, or `null` when the tour is over.
 *
 * Returning `null` rather than clamping to the last step matters: a tour that
 * cannot end is a mascot standing between a child and the button they were
 * reaching for, which is the one thing `Pip.tsx` says must never happen.
 */
export function stepAt(tour: Tour, index: number): CoachStep | null {
  return tour.steps[index] ?? null;
}
