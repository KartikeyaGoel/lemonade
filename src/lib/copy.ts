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
export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
