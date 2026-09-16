/**
 * The two figure formatters, and the rule they share.
 *
 * **The sign is decided from the figure that will actually be printed.** Both
 * of these got that wrong, in the same way, eighteen months apart, and both
 * were found by looking at a screen rather than by a test:
 *
 *  - `money` had nine private copies and six of them wrote `$-5.00`, which
 *    reached the profit card on day one of a losing week. §84.
 *  - `percent` did not exist: seven screens put `{up ? '+' : ''}` next to
 *    `{(pct * 100).toFixed(1)}%`, so a change of −0.02% printed as
 *    **"-0.0% this week"** on the market's first week. §87. The gate that
 *    was then written for the shape found five more, including two more
 *    private formatters nobody had grepped for.
 *
 * A rounded zero is zero, and zero has no sign. That sentence is the whole
 * content of this file, and it is the assertion `scripts/check-money.mjs`
 * cannot make — it reads source, so it can stop the shape being *written* but
 * it cannot tell you what the shape prints.
 */
import { describe, it, expect } from 'vitest';
import { direction, money, moneyRound, moneyFromCents, percent } from '../src/lib/copy';

describe('money', () => {
  it('puts the sign in front of the dollar, the way a ledger is read', () => {
    expect(money(-4.16)).toBe('-$4.16');
    expect(money(4.16)).toBe('$4.16');
    expect(money(0)).toBe('$0.00');
  });

  it('never writes a sign on a figure that prints as zero', () => {
    /* The §84 shape, one decimal place down: a loss too small to show is not
       a loss the screen should put a minus on. */
    expect(money(-0.004)).toBe('$0.00');
    expect(moneyRound(-0.4)).toBe('$0');
  });

  it('agrees with itself across the three forms', () => {
    expect(moneyFromCents(-416)).toBe(money(-4.16));
    expect(moneyRound(-1234.5)).toBe('-$1235');
    expect(moneyFromCents(150)).toBe('$1.50');
  });
});

describe('percent', () => {
  it('signs a real change', () => {
    expect(percent(0.083)).toBe('+8.3%');
    expect(percent(-0.083)).toBe('-8.3%');
    expect(percent(0.083, 0)).toBe('+8%');
  });

  /**
   * The defect, quoted.
   *
   * The market's first week moved a portfolio from $4,760.14 to $4,759.15 —
   * −0.0208% — and the week report said "-0.0% this week". Mutating the sign
   * back to the unrounded value must fail here.
   */
  it('does not put a minus in front of a rounded zero', () => {
    const asPlayed = (4759.15 - 4760.14) / 4760.14;
    expect(asPlayed).toBeLessThan(0);
    expect(percent(asPlayed)).toBe('0.0%');
    expect(percent(asPlayed)).not.toContain('-');
  });

  it('does not put a plus there either', () => {
    expect(percent(0.00002)).toBe('0.0%');
    expect(percent(0.004, 0)).toBe('0%');
    expect(percent(0)).toBe('0.0%');
  });

  /* The boundary in both directions, so the rounding itself is pinned. */
  it('signs the smallest change that survives rounding', () => {
    expect(percent(0.0005)).toBe('+0.1%');
    expect(percent(-0.0005)).toBe('-0.1%');
    expect(percent(0.0004)).toBe('0.0%');
    expect(percent(-0.0004)).toBe('0.0%');
  });
});

/**
 * The other half of the same defect.
 *
 * Once `percent` printed "0.0%" for the market's first week, the heading above
 * it still said "Your money dipped" — because the screen derived its wording
 * from `changePct >= 0` on the raw value. Two figures shown together that do
 * not reconcile is §4, and the fix is that the sentence and the number are
 * decided by the same function.
 */
describe('direction', () => {
  it('agrees with what percent prints, including at zero', () => {
    for (const fraction of [0.083, -0.083, 0.0004, -0.0004, 0, 0.0005, -0.0005, 1, -1]) {
      const shown = percent(fraction);
      const went = direction(fraction);
      if (went === 'up') expect(shown.startsWith('+'), shown).toBe(true);
      else if (went === 'down') expect(shown.startsWith('-'), shown).toBe(true);
      else expect(shown, `${fraction} is flat but prints ${shown}`).toMatch(/^0\.0%$/);
    }
  });

  it('calls the week that started all this flat, not a dip', () => {
    const asPlayed = (4759.15 - 4760.14) / 4760.14;
    expect(direction(asPlayed)).toBe('flat');
  });

  it('respects the places it is asked about', () => {
    expect(direction(0.004, 0)).toBe('flat');
    expect(direction(0.004, 1)).toBe('up');
  });
});
