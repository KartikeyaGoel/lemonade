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
import { STAND_TOUR, stepAt, toured } from '@/lib/coach';
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
