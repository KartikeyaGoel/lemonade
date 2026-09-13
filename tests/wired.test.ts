/**
 * Is everything the game can say actually reachable from a screen?
 *
 * ## The defect class
 *
 * Several systems here work in two halves: a **library** decides *what* to say
 * and a **screen** opts in to the subset that belongs on it. Pip's beats work
 * that way — `nextBeat` picks the one line worth saying, and each screen lists
 * the beats it is willing to show via `guideOn(...)`. So do the coach tours: the
 * tours live in `coach.ts` and a screen has to pass `tour={showTour(X.id)}`.
 *
 * Nothing kept the two halves in agreement, and three separate things were
 * wired to nothing before this file existed:
 *
 *  - **`act2-rival`** — written, unit-tested, chosen by `nextBeat`, and listed
 *    by no screen at all. The most valuable thing Pip can say in the business
 *    stage, said to nobody.
 *  - **`act2-shop`** — listed on the act-intro screen, which was right while
 *    the shop was a stage of its own and wrong the moment it became a mid-stage
 *    rung. It fires on the day two stands have taught the lesson a door
 *    answers, and no act intro is on screen then.
 *  - **`act4-open-sold`** — pre-existing. Two doors lead into the market and
 *    they are not the same story; a child who *sold* their company got the
 *    line for a founder who listed, or nothing.
 *
 * And beats fail worse than silently. `nextBeat` returns **one** line, so a
 * beat that is chosen and then dropped by the screen also blocks every beat
 * behind it — which is how a dead `act2-open` on a seeded save silently
 * swallowed the rival beat in a browser check.
 *
 * ## Why it reads the source
 *
 * The wiring lives in JSX props, which no amount of unit testing can see. This
 * is ugly and is the only honest way to check it: read the opt-in lists out of
 * `page.tsx` and compare them against the libraries' own inventories.
 *
 * PRODUCT.md §40 is the rule — *a mechanic written, exported, and wired to
 * nothing.* `scripts/check-dead-code.mjs` catches the version where nothing
 * *names* the export. This catches the version where something names it and no
 * child ever sees it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { allBeats } from '../src/lib/guide';
import * as coach from '../src/lib/coach';
import { ALL_TOURS } from '../src/lib/coach';

const PAGE = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

/** Every id a screen has opted in to showing, from a given prop helper. */
function optedIn(helper: string): Set<string> {
  const out = new Set<string>();
  const calls = PAGE.matchAll(new RegExp(`${helper}\\(([^)]*)\\)`, 'g'));
  for (const call of calls) {
    for (const quoted of call[1].matchAll(/'([^']+)'/g)) out.add(quoted[1]);
    /*
     * Tours are passed by constant, not by string: `showTour(YARD_TOUR.id)`.
     * So the constant is resolved through the module rather than guessed from
     * its name — `STAND_TOUR` is `the-stand`, and a naming rule that happened
     * to work today is exactly the kind of thing that rots.
     */
    for (const ident of call[1].matchAll(/\b([A-Z][A-Z0-9_]*_TOUR)\.id\b/g)) {
      const tour = (coach as Record<string, unknown>)[ident[1]] as { id?: string } | undefined;
      if (tour?.id) out.add(tour.id);
    }
  }
  return out;
}

describe('everything the game can say has a screen that shows it', () => {
  it('opts in to every one of Pip’s beats somewhere', () => {
    const shown = optedIn('guideOn');
    expect(shown.size, 'no guideOn calls found — has the wiring moved?').toBeGreaterThan(3);

    const orphaned = allBeats().filter((beat) => !shown.has(beat));
    expect(
      orphaned,
      `beats no screen ever shows: ${orphaned.join(', ')}. ` +
        'nextBeat returns one line, so an orphan also blocks every beat behind it.',
    ).toEqual([]);
  });

  it('never opts in to a beat that does not exist', () => {
    /*
     * The other direction, which is how a rename goes quiet: a screen still
     * listing `act5-open` after the ladder became four stages long would show
     * nothing and say nothing about it.
     */
    const known = new Set<string>(allBeats());
    const ghosts = [...optedIn('guideOn')].filter((id) => !known.has(id));
    expect(ghosts, `screens list beats that no longer exist: ${ghosts.join(', ')}`).toEqual([]);
  });

  it('mounts every coach tour on some screen', () => {
    /*
     * Same shape, different system. A tour that nothing passes `showTour` for
     * is three steps of copy, a career key, and a `markFor` call that never
     * happens — and `check-dead-code.mjs` cannot see it, because `ALL_TOURS`
     * names the constant.
     */
    const mounted = optedIn('showTour');
    expect(mounted.size, 'no showTour calls found — has the wiring moved?').toBeGreaterThan(2);

    const orphaned = ALL_TOURS.filter((tour) => !mounted.has(tour.id));
    expect(
      orphaned.map((t) => t.id),
      `tours no screen ever mounts: ${orphaned.map((t) => t.id).join(', ')}`,
    ).toEqual([]);
  });
});
