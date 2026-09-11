/**
 * When each decision arrives.
 *
 * ## The principle, which the game already believed and did not apply here
 *
 * FRAMEWORK.md §13 settled a research question about how much may be on a
 * screen, and the answer was that **what has to be bounded is the number of
 * choices in front of a player at the moment they choose, not the number of
 * things drawn**. Clash Royale holds a hundred cards, a deck of eight and a
 * hand of four, and the hundred are learned over months: "chunking and
 * progressive disclosure".
 *
 * The build applies that in two places. Companies arrive eight at a time by
 * tier. Vocabulary arrives one word a day, and `Game.pendingInsights` exists
 * for no other reason — day one earns three words and hands over one, because
 * "three explanations stacked under the first P&L a kid has ever read is a
 * worksheet".
 *
 * It did not apply it to the first stage's own levers. Price, batch size and
 * lemon grade were all on screen on **day one**, inside the first two minutes,
 * before a child had seen a single customer decide anything. So the stage
 * front-loaded its entire decision set and then had nothing left to give.
 *
 * ## Why that is the five-minute wall
 *
 * PRODUCT.md §68: a turn is worth repeating when it opens a decision that was
 * not available before. Day four offered exactly day three's choices, and the
 * pilot's wording is *"After Day 3 I got the feeling the game is getting too
 * repetitive"*. Not day two, not day six. Day three is where the pricing
 * question runs out — and under the old arrangement there was nothing behind
 * it.
 *
 * So the levers are staggered, and the cadence is the one the stage already
 * has:
 *
 * | Day | What is new |
 * |---|---|
 * | 1–2 | price and batch. FRAMEWORK.md §1's "1–2 exploratory rounds without a target" |
 * | 3 | the profit goal. §1's "introduce a clear profit goal after exploration" |
 * | 4 | **the lemon grade** — a new way to move the numbers, now that there is a number to hit |
 *
 * Nothing is removed and nothing is added. The third lever simply arrives on
 * the day a child would otherwise have run out of questions, and it arrives
 * with a moment of its own instead of as a third row on a shopping list nobody
 * read. That is also the answer to a separate pilot note — *"I could not tell
 * easily that choosing good lemons will make less people come back"* — which
 * was never a copy problem: the choice was introduced on the busiest screen in
 * the game, on the day the child had least idea what any of it meant.
 *
 * ## The one rule this module must obey
 *
 * **A lever that has ever been available stays available.** A returning child
 * whose save says day nine must not find a control missing because some
 * condition read the wrong field, and a child who used posh lemons on day four
 * must never be handed a stand that cannot buy them. Everything here is a
 * monotonic function of days played, and `tests/levers.test.ts` sweeps every
 * day of the arc to hold that.
 *
 * Pure module. No React, no I/O.
 */

/** The decisions the first stage can put in front of a child. */
export type Lever = 'price' | 'batch' | 'grade';

/**
 * The day each lever first appears, counted in days *played*.
 *
 * Zero means "from the first morning". `grade` is 3, so it appears once three
 * days are in the history — which is the fourth day a child plays.
 */
export const LEVER_ARRIVES: Record<Lever, number> = {
  price: 0,
  batch: 0,
  grade: 3,
};

/**
 * Is this lever in the child's hands yet?
 *
 * Read from days played rather than from the act, because a save can enter
 * stage two on day five or on day nine and a lever that vanished on promotion
 * would be worse than one that arrived late. Every later stage is past every
 * threshold, so this is `true` for everything from stage two onwards.
 *
 * `alreadyUsed` is the monotonicity escape hatch and it is not theoretical.
 * Two tests in `tests/ui/goal.test.tsx` describe a defect found in a real
 * session: `ShopScreen` claimed in its own comment to be "only ever reached on
 * a run's first day", and *resume* disproves it — a reloaded stage-one save
 * goes `morning → shop → price` again. Under a bare day threshold, a save from
 * before the levers were staggered could hold posh lemons on day two and come
 * back to a shop that no longer sells them, with `gradeDemandFactor` still
 * reading yesterday's grade for word of mouth. Demand would move for a
 * decision the child could no longer see, let alone change.
 *
 * So a lever that has ever been used is available for ever. Callers pass what
 * the history says rather than this module reaching for it, because `levers.ts`
 * is about *when* a decision arrives and should not need to know the shape of a
 * `DayRecord` to answer that.
 */
export function leverReady(lever: Lever, daysPlayed: number, alreadyUsed = false): boolean {
  return alreadyUsed || daysPlayed >= LEVER_ARRIVES[lever];
}

/**
 * Has the recipe ever been anything but the default?
 *
 * The `alreadyUsed` argument for the grade lever, in the one place that knows
 * how to answer it. A record from before grades existed reads back as
 * `undefined`, which is `regular`, which is what it was.
 */
export function gradeEverChosen(history: readonly { grade?: string }[]): boolean {
  return history.some((day) => day.grade !== undefined && day.grade !== 'regular');
}

/**
 * The lever arriving *today*, if one is, so a screen can make a moment of it.
 *
 * Exactly one or none, ever. Two new controls on one morning is the stacked-
 * worksheet failure §26 already fixed once for vocabulary.
 */
export function leverArrivingOn(daysPlayed: number): Lever | null {
  const arriving = (Object.keys(LEVER_ARRIVES) as Lever[]).filter(
    (lever) => LEVER_ARRIVES[lever] === daysPlayed && daysPlayed > 0,
  );
  return arriving[0] ?? null;
}

/**
 * What Pip says when a lever arrives.
 *
 * Names the choice and the trade, and stops. Not what to pick — `guide.ts`'s
 * rule holds here too, and the whole value of the grade lever is that the
 * dearer lemon is only worth it above about a dollar a cup, which is a thing a
 * child has to find out rather than be told.
 */
export const LEVER_INTRO: Record<Lever, readonly string[]> = {
  price: ['Your sign is the whole business.', 'What you charge decides who stops.'],
  batch: ['The lemons are how much you can make.', 'What you do not sell, you still paid for.'],
  grade: [
    'The shop has three kinds of lemon now.',
    'Better ones cost more and bring more people back.',
  ],
};
