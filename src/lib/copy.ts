/**
 * Copy helpers shared by the pure modules and the screens.
 *
 * Lives in `lib` rather than in `ui.tsx` because most of the sentences a child
 * reads are not written in components at all — they are the insight and
 * evidence strings built by `simulation.ts`, `guide.ts`, `mastery.ts` and
 * `parent.ts`. Those modules deliberately import no React, so a helper they
 * cannot reach is a helper that only fixes half the product.
 */

/**
 * A count and its noun, agreeing.
 *
 * Added after a browser sweep read "1 days left" off the goal strip on the
 * last day of the week, and a scan then found forty more of the same shape
 * across the copy — most of them reachable rather than theoretical. One cup
 * left is on screen near the end of almost every day; one lemon spoils
 * constantly; "1 people looked at $1.00 and kept walking" is an ordinary
 * Tuesday.
 *
 * Small, and worth a helper rather than forty ternaries, because this product
 * is read aloud by people who are learning to read. A child sounding out "one
 * cups" has been handed a tiny reason to distrust the sentence, and every
 * screen here is an argument that the numbers can be trusted.
 *
 * Only whole ones take the singular: "1.5 cups" is correct, and so is
 * "0 cups".
 */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Dollars, the way every figure in the game is written.
 *
 * There were three of these: one in `ui.tsx` for the screens, one private to
 * `progress.ts` for the readiness details, and — briefly — a hand-written
 * `$${...}` in `ownership.ts` that had lost its dollar sign and told a child a
 * stand "earns the same 100 a week". PRODUCT.md §62 is about exactly that: a
 * fact with more than one home is a fact that will disagree with itself.
 *
 * The sign goes in front of the dollar, not in front of the digits, because
 * "-$4.16" is how a ledger is read and "$-4.16" is how nothing is.
 */
/**
 * Dollars to a given number of places, signed.
 *
 * `money` and `moneyRound` were this twice, differing only in the places —
 * and `check-duplicates.mjs` blinds numbers, so it called them clones and was
 * right to. One body, and the precision is the argument.
 *
 * The sign comes from the figure that will be *printed*, not the one that came
 * in. §84 moved the minus to the front of the dollar and left this half of it
 * wrong, so `money(-0.004)` still returned `-$0.00` — a minus in front of a
 * zero, which is the §87 defect in a different currency. Found by the test in
 * `tests/copy.test.ts`, written after `percent` had taught the same lesson.
 */
function dollars(n: number, places: number): string {
  const shown = Number(n.toFixed(places));
  const sign = shown < 0 ? '-' : '';
  return `${sign}$${Math.abs(shown).toFixed(places)}`;
}

export function money(n: number): string {
  return dollars(n, 2);
}

/**
 * Dollars with the cents dropped, for a chart axis or a round number.
 *
 * Same sign rule as `money`, and here for the same reason: `cap.toFixed(0)`
 * and `maxProfit.toFixed(0)` were each written by hand next to a `$`, and a
 * chart axis on a week where every day lost money drew "$-5".
 */
export function moneyRound(n: number): string {
  return dollars(n, 0);
}

/**
 * Dollars from a whole number of cents.
 *
 * `classroom.ts` keeps prices in cents so that a room full of children
 * comparing them never meets a floating-point tail. It had its own formatter;
 * this is that formatter, in the one place formatters live.
 */
export function moneyFromCents(cents: number): string {
  return money(cents / 100);
}

/**
 * A change, as a signed percentage.
 *
 * **The sign is decided from the figure that will actually be printed**, not
 * from the one that went in. Seven screens did it the other way —
 * `{up ? '+' : ''}` next to `{(pct * 100).toFixed(1)}%` — which puts a minus
 * in front of a rounded zero. Found by playing: the market's first week moved
 * a portfolio by two hundredths of a percent and the week report said
 *
 *     Your money dipped · $4759.15 · -0.0% this week
 *
 * "-0.0%" is not a number a child can do anything with, and the screen had
 * already decided the week was a dip on the strength of it.
 *
 * Same lesson as §84's `money` and the same shape of fix: one home, and the
 * sign and the digits produced together so they cannot disagree. A figure that
 * rounds to zero is zero, and zero has no sign.
 */
export function percent(fraction: number, places = 1): string {
  const shown = Number((fraction * 100).toFixed(places));
  const sign = shown > 0 ? '+' : shown < 0 ? '-' : '';
  return `${sign}${Math.abs(shown).toFixed(places)}%`;
}

/**
 * Which way a change went, judged on the figure that will be printed.
 *
 * `percent` fixed the number and left the sentence. The market's first week
 * moved a portfolio by two hundredths of a percent, and once the figure
 * correctly read "0.0%" the heading above it still said **"Your money
 * dipped"** — because it was derived from `changePct >= 0` on the raw value.
 * A heading that claims a dip next to a figure that says nothing happened is
 * PRODUCT.md §4: two figures shown together that do not reconcile.
 *
 * So the wording and the number come from the same place. `flat` is a real
 * third case and screens have to say something for it; a week where nothing
 * happened is a true and useful thing for a child to be told.
 */
export function direction(fraction: number, places = 1): 'up' | 'down' | 'flat' {
  const shown = Number((fraction * 100).toFixed(places));
  return shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat';
}
