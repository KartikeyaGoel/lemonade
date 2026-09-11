/**
 * When each of the first stage's decisions arrives.
 *
 * The rule this file exists to hold is the one in `levers.ts`'s own doc
 * comment: **a lever that has ever been available stays available.** A control
 * that appears and then disappears is indistinguishable, to a nine-year-old,
 * from a game that has broken — and the grade lever is worse than most, because
 * `gradeDemandFactor` reads *yesterday's* recipe for word of mouth, so demand
 * would keep moving for a decision the child could no longer see.
 */
import { describe, expect, it } from 'vitest';
import {
  LEVER_ARRIVES,
  LEVER_INTRO,
  gradeEverChosen,
  leverArrivingOn,
  leverReady,
  type Lever,
} from '../src/lib/levers';
import { ECON } from '../src/lib/simulation';

const ALL = Object.keys(LEVER_ARRIVES) as Lever[];

describe('levers arrive and never leave', () => {
  it('is monotonic in days played, for every lever, across the whole arc', () => {
    /*
     * Swept rather than spot-checked. The failure that matters is not "it
     * appeared late", which a child forgives, but "it went away", which they
     * cannot tell from a bug. Forty days is longer than any run.
     */
    for (const lever of ALL) {
      let wasReady = false;
      for (let day = 0; day <= 40; day++) {
        const ready = leverReady(lever, day);
        if (wasReady) expect(ready, `${lever} vanished on day ${day}`).toBe(true);
        wasReady = ready;
      }
      expect(wasReady, `${lever} never arrived at all`).toBe(true);
    }
  });

  it('keeps a lever the child has already used, however early they used it', () => {
    /*
     * The `alreadyUsed` escape hatch. A save written before the levers were
     * staggered can hold posh lemons on day two, and `ShopScreen` is reachable
     * on *resume* rather than only on a first morning — so without this, that
     * child comes back to a shop that no longer sells what they bought.
     */
    for (const lever of ALL) {
      for (let day = 0; day <= 5; day++) {
        expect(leverReady(lever, day, true), `${lever} on day ${day}`).toBe(true);
      }
    }
  });

  it('reads a recipe out of a real history, and ignores days that predate recipes', () => {
    expect(gradeEverChosen([])).toBe(false);
    // A record from before grades existed. It was the normal lemon.
    expect(gradeEverChosen([{}, {}])).toBe(false);
    expect(gradeEverChosen([{ grade: 'regular' }])).toBe(false);
    expect(gradeEverChosen([{ grade: 'regular' }, { grade: 'organic' }])).toBe(true);
    expect(gradeEverChosen([{ grade: 'value' }])).toBe(true);
  });

  it('puts price and batch on the first morning and nothing else', () => {
    /*
     * FRAMEWORK.md §1 asks for "1–2 exploratory rounds without a target", and
     * an exploratory round is only exploratory if it is about one question. A
     * child on their first morning has watched nobody decide anything.
     */
    const firstMorning = ALL.filter((lever) => leverReady(lever, 0));
    expect(firstMorning.sort()).toEqual(['batch', 'price']);
  });

  it('hands over exactly one lever a day, and never two', () => {
    /*
     * §26's rule, which the game already applies to vocabulary: one card a
     * day, one word a day, one finger. Two new controls on one morning is the
     * stacked-worksheet failure it was written to fix.
     */
    const byDay = new Map<number, Lever[]>();
    for (let day = 0; day <= 40; day++) {
      const arriving = ALL.filter((lever) => LEVER_ARRIVES[lever] === day && day > 0);
      if (arriving.length > 0) byDay.set(day, arriving);
      expect(arriving.length, `two levers arrived on day ${day}`).toBeLessThanOrEqual(1);
    }
    // And `leverArrivingOn` agrees with that table rather than having its own.
    for (let day = 0; day <= 40; day++) {
      expect(leverArrivingOn(day)).toBe(byDay.get(day)?.[0] ?? null);
    }
  });

  it('lands the new lever after the goal, not on top of it', () => {
    /*
     * The cadence is the whole design: explore, then a target, then a new tool
     * to hit it with. A lever arriving on the same morning as the profit goal
     * would be two new things at once, and one arriving before it would be a
     * third question during the exploratory rounds.
     */
    const goalArrivesOnDay = ECON.ACT1_EXPLORE_DAYS + 1;
    for (const lever of ALL) {
      const arrivesOnDay = LEVER_ARRIVES[lever] + 1;
      if (LEVER_ARRIVES[lever] === 0) continue;
      expect(arrivesOnDay, `${lever} shares its morning with the goal`).toBeGreaterThan(
        goalArrivesOnDay,
      );
    }
  });

  it('has something to say about every lever it can hand over', () => {
    /*
     * §40: a mechanic wired to nothing. The staggering is only worth doing if
     * the arrival is a *moment* — otherwise a control silently appears and the
     * child has no more idea what it does than they did when it was buried in
     * a shopping list on day one.
     */
    for (const lever of ALL) {
      const lines = LEVER_INTRO[lever];
      expect(lines, lever).toBeDefined();
      expect(lines.length, `${lever} says nothing`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.length, `${lever}: "${line}"`).toBeGreaterThan(10);
        /*
         * Names the choice and the trade, never the answer — `guide.ts`'s
         * rule, matched on advice rather than on vocabulary.
         *
         * The first version of this pattern banned the word "charge" outright
         * and failed on "What you charge decides who stops", which is a
         * statement about the mechanic and the most useful sentence in the
         * game. What makes a line advice is an imperative or a direction, so
         * that is what is matched: a bare verb is not the problem, "charge
         * more" is.
         */
        expect(line, lever).not.toMatch(
          /\b(you should|charge (more|less)|pick the|buy the|try the|make more|go for)\b/i,
        );
      }
    }
  });
});
