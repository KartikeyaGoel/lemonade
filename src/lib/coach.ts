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
export type TourId =
  | 'the-stand'
  | 'the-yard'
  | 'the-funding'
  | 'the-listing'
  | 'the-market';

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
  /**
   * The stage whose new mechanics this tour introduces.
   *
   * Recorded so `tests/ui/coach.test.tsx` can assert there is one for every
   * stage. The customer's question was exactly this — "if you expose new
   * functionalities and you've been introduced them properly the user would be
   * confused" — and the answer at the time was four of five: Act 4, going
   * public, had none, which is the least familiar screen in the game.
   *
   * A stage without a tour now fails a test rather than waiting to be noticed.
   */
  act: 1 | 2 | 3 | 4 | 5;
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
  act: 1,
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

/**
 * The yard, the first time a child owns more than a folding table.
 *
 * Act 2's new interaction model, and a bigger jump than the stand was: the
 * screen stops being one stand with things on it and becomes a *place* with
 * four kinds of thing to buy in it. §13 measured ten plots in four labelled
 * groups, which is why this points at the groups rather than the plots.
 */
export const YARD_TOUR: Tour = {
  act: 2,
  id: 'the-yard',
  steps: [
    {
      target: 'plot-cooler',
      lines: ['Things you buy once and keep forever.', 'You pay today. It helps every day after.'],
    },
    {
      target: 'plot-manager',
      lines: ['People you pay every single day.', 'Even on a day nobody comes.'],
    },
    {
      target: 'plot-stand-park',
      lines: ['A second table, once someone minds the first.', 'Two places at once.'],
    },
  ],
};

/**
 * The three ways to pay for a door.
 *
 * Act 3, and the first decision in the game with a consequence that outlives
 * the run. The tour exists because "sell a slice" is a sentence a nine-year-old
 * has no reason to read carefully, and it is the one that costs them a fifth of
 * every future profit.
 */
export const FUNDING_TOUR: Tour = {
  act: 3,
  id: 'the-funding',
  steps: [
    {
      target: 'pay-cash',
      lines: ['Pay for it out of the cash box.', 'Nothing owed to anybody afterwards.'],
    },
    {
      target: 'borrow',
      lines: ['Borrow it, and pay a bit extra back.', 'The bank does not want a slice of you.'],
    },
    {
      target: 'sell-slice',
      lines: [
        'Or sell a slice of the whole business.',
        'Money today, and they keep a share forever.',
      ],
    },
  ],
};

/**
 * The market, where the money stops being lemonade.
 *
 * Act 5. The child has done everything here before — read a price, judge
 * whether it is worth it — but never on a company somebody else built, and the
 * cards look like reading rather than deciding.
 */
export const MARKET_TOUR: Tour = {
  act: 5,
  id: 'the-market',
  steps: [
    {
      target: 'company-card',
      lines: ['Every card is a real company.', 'Tap one to read its real numbers.'],
    },
    {
      target: 'gate',
      lines: ['These are the things you showed you understood.', 'That is what opened this up.'],
    },
  ],
};

/**
 * Going public, which is the least familiar screen in the game.
 *
 * Act 4. Everything before this has an obvious real-world shape — a stand, a
 * shop, a person you pay. Cutting a company into a thousand pieces and selling
 * some of them does not, and it is the concept FRAMEWORK.md §2 says the whole
 * product is pointing at. This was the last stage with no tour, which the
 * customer spotted: "if you expose new functionalities and you've been
 * introduced them properly the user would be confused".
 */
export const LISTING_TOUR: Tour = {
  act: 4,
  id: 'the-listing',
  steps: [
    {
      target: 'float-dial',
      lines: [
        'Your company is cut into 1,000 pieces.',
        'This is how many you sell to other people.',
      ],
    },
    {
      target: 'sell-instead',
      lines: ['Or sell the whole thing to one buyer.', 'More money now, and none of it is yours after.'],
    },
  ],
};

/** Every tour, so a test can check them all without listing them again. */
export const ALL_TOURS: readonly Tour[] = [
  STAND_TOUR,
  YARD_TOUR,
  FUNDING_TOUR,
  LISTING_TOUR,
  MARKET_TOUR,
];
