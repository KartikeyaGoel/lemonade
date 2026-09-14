/**
 * Calendar arithmetic, in one place.
 *
 * ## The defect class this closes
 *
 * There were three implementations of "how many days apart are these two
 * dates", and **two of them were exported under the same name**:
 *
 * | where | contract |
 * |---|---|
 * | `ledger.ts` `daysBetween` | signed, `Date.UTC` parsing, no guard |
 * | `live.ts` `daysBetween` | clamped at zero, `Date.parse`, 0 on unparseable |
 * | `companies.ts` `pricesBehind` | clamped, and `Math.floor` rather than `Math.round` |
 *
 * Two exported functions with one name and two contracts is worse than two
 * with different names, because the import that picks the wrong one is
 * invisible at the call site and an editor will write it for you. §75.
 *
 * This is the one arithmetic. The clamp is not part of it: a caller that
 * needs a non-negative answer says `Math.max(0, ...)` where it needs it, so
 * the guarantee is written at the place that depends on it.
 *
 * Dates here are `YYYY-MM-DD` at midnight UTC, which is why `Math.round` and
 * `Math.floor` agree — there is no daylight saving in UTC and no partial day
 * to round. The round stays because it is the honest operation on a
 * millisecond difference that is meant to be whole.
 */

/**
 * Whole days from `a` to `b`. Negative when `b` is the earlier date.
 *
 * Returns 0 rather than `NaN` for an unparseable date, because every caller
 * is deciding how stale something is and "no idea" is safer read as "not
 * stale" than as a `NaN` that silently poisons a comparison.
 */
export function daysBetween(a: string, b: string): number {
  const from = Date.parse(`${a}T00:00:00Z`);
  const to = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}
