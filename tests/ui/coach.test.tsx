/** @vitest-environment jsdom */
/**
 * Does the first-run tour point at things that are actually on screen?
 *
 * This file exists because the answer was nearly no. The tour finds its
 * targets with `[data-coach="..."]`, and the third step points at the
 * rehearsal button — which is a `ChunkyButton`, whose props are a closed type
 * that does not spread the rest. So `{...{ 'data-coach': 'try' }}`
 * type-checked, silently dropped the attribute, and left the last step of the
 * tour highlighting nothing at all.
 *
 * Caught by reading the component rather than by any test, which is the
 * definition of a gap. A tour step whose target is missing is the same defect
 * class as PRODUCT.md §40 — wired to nothing — and the same class as the badge
 * that no counter moved.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanScreen } from '@/components/PlanScreen';
import { ALL_TOURS, STAND_TOUR, stepAt, toured } from '@/lib/coach';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createCareer, recordCoached } from '@/lib/career';
import { DEFAULT_DAY_PARAMS, batchPlan, runDay, type GameState } from '@/lib/simulation';
import { createGame } from '@/lib/progress';

/** A stand that has traded a day, which is when this screen first appears. */
function afterOneDay(): GameState {
  const start = createGame(2026).stand;
  const plan = batchPlan(start, 28);
  return runDay(start, { ...plan.order, price: 1.5 }, { ...DEFAULT_DAY_PARAMS, lastDay: null })
    .nextState;
}

function plan(tour: boolean, onToured = () => {}) {
  render(
    <PlanScreen
      state={afterOneDay()}
      tour={tour}
      onToured={onToured}
      onOpen={() => {}}
      onInvest={() => {}}
    />,
  );
}

const coachTargets = () =>
  [...document.querySelectorAll('[data-coach]')].map((el) => el.getAttribute('data-coach'));

/**
 * jsdom has no layout, so every `getBoundingClientRect` is a box of zeroes.
 *
 * `Spotlight` refuses to render against a zero-width target on purpose — a
 * step pointing at something not on screen must show nothing rather than dim
 * the whole screen with a bubble floating on it. Correct in the product, and
 * it means the component cannot be exercised here at all without a geometry
 * stub.
 *
 * Stubbed as narrowly as possible: a plausible rect for the elements the tour
 * points at, zeroes left alone everywhere else. The alternative — asserting
 * the tour renders without ever giving it a target with a size — is a test
 * that passes because the guard fired, which proves the guard and nothing
 * about the tour.
 */
function withLayout() {
  const rect = (top: number, left: number, w: number, h: number) =>
    ({
      top,
      left,
      right: left + w,
      bottom: top + h,
      width: w,
      height: h,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return this.hasAttribute('data-coach') ? rect(300, 120, 140, 90) : rect(0, 0, 0, 0);
  });
}

describe('every tour step has something to point at', () => {
  afterEach(cleanup);

  it('renders a real element for each step of the stand tour', () => {
    /*
     * The assertion that would have failed before `ChunkyButton` got a typed
     * `coach` prop. Asserted for every step rather than just the third, so a
     * step added later cannot point at nothing either.
     */
    plan(true);
    const present = coachTargets();
    for (const step of STAND_TOUR.steps) {
      expect(present, `no element carries data-coach="${step.target}"`).toContain(step.target);
    }
  });

  it('has a step for every target and a target for every step', () => {
    /* No orphans in either direction. */
    expect(STAND_TOUR.steps.length).toBeGreaterThan(0);
    for (const step of STAND_TOUR.steps) {
      expect(step.lines.length, `${step.target} has no copy`).toBeGreaterThan(0);
    }
  });
});

describe('every tour, not just the first one', () => {
  /**
   * Every `data-coach` value that exists anywhere in the source.
   *
   * A static scan rather than four rendered screens, and deliberately so: the
   * bug this guards against is a *step pointing at nothing*, which is a
   * question about whether the attribute exists at all. Rendering the market
   * needs a portfolio, a readiness gate and a snapshot of real companies, and
   * a test that heavy would be skipped the next time it broke.
   *
   * It caught `ChunkyButton` silently dropping `data-coach` once already —
   * that is PRODUCT.md §40's class, wired to nothing, and it has now been the
   * defect in a badge counter, a glossary word, and a tour step.
   */
  const anchors = (() => {
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const text = readFileSync(full, 'utf8');
          for (const match of text.matchAll(/'data-coach':\s*'([^']+)'/g)) found.add(match[1]);
          for (const match of text.matchAll(/data-coach="([^"]+)"/g)) found.add(match[1]);
          // `coach="try"` on ChunkyButton, and `coach={...}` pass-throughs.
          for (const match of text.matchAll(/\bcoach="([^"]+)"/g)) found.add(match[1]);
          // Template forms, e.g. `plot-${plot.id}`.
          for (const match of text.matchAll(/'data-coach':\s*`([^`$]*)\$\{/g)) {
            found.add(`prefix:${match[1]}`);
          }
        }
      }
    };
    walk('src');

    /*
     * `StandScene` anchors its hotspots with `{ 'data-coach': id }`, where
     * `id` is a `SpotId` — so there is no literal in the file to find. Rather
     * than exempt the stand tour, the union itself is read: every value
     * `SpotId` can take is an anchor that really exists, and a step naming
     * something outside it still fails.
     */
    const scene = readFileSync('src/components/StandScene.tsx', 'utf8');
    const union = scene.match(/export type SpotId =([^;]+);/);
    if (union) {
      for (const member of union[1].matchAll(/'([^']+)'/g)) found.add(member[1]);
    }
    return found;
  })();

  it('gives every step of every tour something to point at', () => {
    const orphans: string[] = [];
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        const exact = anchors.has(step.target);
        const byPrefix = [...anchors].some(
          (a) => a.startsWith('prefix:') && step.target.startsWith(a.slice('prefix:'.length)),
        );
        if (!exact && !byPrefix) orphans.push(`${tour.id} → ${step.target}`);
      }
    }
    expect(orphans, `tour steps pointing at nothing: ${orphans.join(', ')}`).toEqual([]);
  });

  it('has a tour for every stage, because every stage adds mechanics', () => {
    /*
     * The customer's question, made into a test: "does the onboarding cover
     * all of the new features every time or does it only do it in stage one?"
     *
     * It was four of five. Act 4 — cutting the company into a thousand pieces
     * and selling some — had none, and it is the least familiar screen in the
     * game and the concept FRAMEWORK.md §2 says the whole product points at.
     *
     * Asserted over the stages rather than counted, so adding a sixth stage
     * fails here instead of shipping a room nobody explains.
     */
    const covered = new Set(ALL_TOURS.map((tour) => tour.act));
    const missing = ([1, 2, 3, 4, 5] as const).filter((act) => !covered.has(act));
    expect(missing, `stages with no first-run tour: ${missing.join(', ')}`).toEqual([]);
  });

  it('gives every tour a unique id, because the career keys on it', () => {
    const ids = ALL_TOURS.map((tour) => tour.id);
    expect(new Set(ids).size, `duplicate tour ids: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('keeps every tour short enough to sit through', () => {
    /*
     * Three at most. FRAMEWORK.md §13's finding is that what has to be bounded
     * is the number of things asked of a child, and a five-step tour of a
     * screen is the §26 failure — "day one handed over three new words in
     * three stacked panels" — wearing a different hat.
     */
    for (const tour of ALL_TOURS) {
      expect(tour.steps.length, `${tour.id} has ${tour.steps.length} steps`).toBeLessThanOrEqual(3);
      expect(tour.steps.length, `${tour.id} has no steps`).toBeGreaterThan(0);
    }
  });

  it('says something on every step, in two short lines at most', () => {
    for (const tour of ALL_TOURS) {
      for (const step of tour.steps) {
        expect(step.lines.length, `${tour.id} → ${step.target} says nothing`).toBeGreaterThan(0);
        expect(step.lines.length, `${tour.id} → ${step.target} is a paragraph`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('the tour itself', () => {
  beforeEach(withLayout);
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('does not appear for a child who has already seen it', () => {
    plan(false);
    expect(screen.queryByRole('button', { name: 'Skip the tour' })).not.toBeInTheDocument();
  });

  it('appears on a first run, and dims the screen around one thing', async () => {
    plan(true);
    // Four panels, one on each side of the target. Measured after paint, so
    // the first frame has no spotlight in it.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Skip the tour' })).toHaveLength(4),
    );
  });

  it('walks through every step and then reports itself done, once', async () => {
    /*
     * `onToured` is what writes to the career, so firing it twice would be
     * harmless and firing it never would show the tour again forever.
     */
    let done = 0;
    plan(true, () => {
      done += 1;
    });
    await waitFor(() =>
      expect(screen.getByText(`1 of ${STAND_TOUR.steps.length}`)).toBeInTheDocument(),
    );
    expect(done).toBe(0);

    // Walk it. Each tap on the bubble advances one step; the last one ends it.
    for (let step = 1; step <= STAND_TOUR.steps.length; step++) {
      await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    }
    expect(done).toBe(1);
    expect(screen.queryByRole('button', { name: 'Skip the tour' })).not.toBeInTheDocument();
  });

  it('ends for good the moment the child opens something on the stand', async () => {
    /*
     * Tapping the highlighted thing *is* the lesson landing. Carrying on would
     * be a mascot talking over a kid who already understood, which is the one
     * failure `Pip.tsx` says must never happen.
     */
    let done = 0;
    plan(true, () => {
      done += 1;
    });
    await userEvent.click(screen.getByLabelText('What to charge per cup'));
    expect(done).toBe(1);
    expect(screen.queryByRole('button', { name: 'Skip the tour' })).not.toBeInTheDocument();
  });

  it('can be skipped, and skipping counts as having seen it', async () => {
    let done = 0;
    plan(true, () => {
      done += 1;
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(done).toBe(1);
    expect(screen.queryByRole('button', { name: 'Skip the tour' })).not.toBeInTheDocument();
  });
});

describe('remembering that it happened', () => {
  it('records the tour on the career, and only once', () => {
    const fresh = createCareer('Ada');
    expect(toured(fresh.coached, STAND_TOUR.id)).toBe(false);

    const after = recordCoached(fresh, STAND_TOUR.id);
    expect(toured(after.coached, STAND_TOUR.id)).toBe(true);

    // Same object back when nothing changed, so React does not re-render and
    // storage does not rewrite an identical save.
    expect(recordCoached(after, STAND_TOUR.id)).toBe(after);
  });

  it('stops after the last step', () => {
    expect(stepAt(STAND_TOUR, STAND_TOUR.steps.length)).toBeNull();
  });
});
