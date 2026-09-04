/** @vitest-environment jsdom */
/**
 * Putting the game down, and picking it back up.
 *
 * The phase is not persisted. Closing the app is therefore identical to
 * reloading it, and `start` — the "Keep going" button — has to rebuild from
 * the save alone which screen a child was on. That reconstruction was wrong in
 * the one place it matters most: it sent every Act 1 save to the morning
 * screen, including a save whose week was already over.
 *
 * What that produced was not a wrong screen, it was a dead game. The morning
 * leads to the plan, the plan to the price, and the price's only forward
 * button calls `runDay` — which enforces "one week is seven days" by throwing.
 * The throw happened inside a click handler, and React routes those nowhere:
 * not to `error.tsx`, not anywhere a child can see. The button just stopped
 * working. Tapping it again did the same nothing.
 *
 * And the end of a week is the most natural moment in the entire product to
 * put it down — the screen literally says the week is over. So the bug was
 * reachable by doing the most ordinary possible thing, on the first week
 * anybody plays, and it cost the run.
 *
 * Every existing test missed it for the same reason: they all arrive at the
 * week-end screen by pressing through the close screen, which is the one route
 * that cannot hit this. It took a browser and a save left on disk.
 *
 * So this file asserts the general property rather than the instance: whatever
 * screen a resume lands on, the controls it offers must do something.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame, act1Complete } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { UNLOCK_COPY } from '@/lib/unlocks';
import {
  ECON,
  DEFAULT_DAY_PARAMS,
  orderForTargetCups,
  runDay,
  type GameState,
} from '@/lib/simulation';

function body(): string {
  return document.body.textContent ?? '';
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

function find(pattern: RegExp): HTMLButtonElement | undefined {
  return buttons().find((b) => pattern.test(b.textContent ?? ''));
}

/**
 * A real week, played out by the real simulation.
 *
 * Built by running seven days rather than by hand-writing a `history` array
 * and a `status`. PRODUCT.md §49 records why: four separate hand-built
 * fixtures turned out to describe states the game correctly refuses, and
 * `as never` hid three of them. A save that the simulation itself produced
 * cannot be wrong about its own invariants.
 */
function playAWeek(): GameState {
  let state = createGame(4242).stand;
  for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
    const order = orderForTargetCups(state, 40);
    state = runDay(state, { ...order, price: 1 }, DEFAULT_DAY_PARAMS).nextState;
  }
  return state;
}

/**
 * Leaves a save on disk exactly as closing the app at that moment would.
 *
 * The career is seeded with every unlock already announced. A fresh one has
 * `announced: []`, which means the boot queues a reward card for each place
 * the game has ever opened and buries the title screen behind them — §26's one
 * card at a time, correct behaviour, wrong fixture. This file is about the
 * resume, so the queue is drained before it starts rather than during.
 */
function leaveOnDisk(stand: GameState): void {
  const game = { ...createGame(4242), version: SAVE_VERSION, stand };
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(game));
  window.localStorage.setItem(
    'lemonade.career.v1',
    JSON.stringify({ ...createCareer(), announced: Object.keys(UNLOCK_COPY) }),
  );
}

/** Clears any reward card standing between the boot and the title screen. */
async function dismissRewards(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const card = find(/Got it|Skip for now|TAP TO CLOSE|BADGE EARNED|WORD EARNED|Dismiss/i);
    if (!card) return;
    await userEvent.click(card);
  }
}

async function resume(): Promise<void> {
  render(<Page />);
  await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
  await dismissRewards();
  await waitFor(() => expect(find(/Keep going/)).toBeDefined());
  await userEvent.click(find(/Keep going/)!);
}

describe('picking the game back up', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('a played-out week really is finished, or this file proves nothing', () => {
    const stand = playAWeek();
    expect(stand.history).toHaveLength(ECON.TOTAL_DAYS);
    expect(stand.status).toBe('finished');
    expect(act1Complete(stand)).toBe(true);
  });

  it('resumes a finished week on the week screen, not another morning', async () => {
    leaveOnDisk(playAWeek());
    await resume();

    /*
     * Asserted as "not the day flow" rather than by matching the week screen's
     * copy, because the copy is tuned often and the defect was never about
     * wording. Any screen that offers to run an eighth day is the bug.
     */
    await waitFor(() => expect(body()).not.toMatch(/Probably cool|Open up shop/i));
    expect(find(/Open up shop/), 'offered to open an eighth day').toBeUndefined();
    expect(body()).toMatch(/week/i);
  });

  it('never leaves a resumed screen whose forward button does nothing', async () => {
    leaveOnDisk(playAWeek());
    await resume();

    /*
     * The property the original bug broke. Not "this button works" — every
     * control the resumed screen offers has to change something, because a
     * control that changes nothing is indistinguishable, to a nine-year-old,
     * from a game that has broken.
     *
     * Walked for several steps because the dead end was three taps past the
     * resume: morning, plan, price, and only then a button that did nothing.
     */
    for (let step = 0; step < 6; step++) {
      /*
       * Stop at the day animation.
       *
       * It is a real `setInterval` walking one customer past the stand at a
       * time, so its controls are *supposed* to change nothing until the clock
       * moves — pressing "Tap to speed up" and seeing a still screen is
       * correct behaviour, not a dead button. `journey.test.tsx` drives that
       * screen properly with fake timers; measuring it here would only teach
       * this property to lie.
       */
      if (/sold|passed|Hurrying|Tap to speed up/i.test(body())) break;

      const before = body();
      /*
       * Back arrows are not forward controls, and neither is the reset.
       *
       * This walk takes the *last* button in the DOM, and the reset is mounted
       * last on every screen — outside the phase switch, so that there is no
       * screen it is missing from. Left in, it would be the only button this
       * test ever pressed, and it would pass while measuring nothing: wiping
       * the device does change the screen.
       */
      const forward = buttons().filter(
        (b) =>
          !/^←$/.test(b.textContent?.trim() ?? '') &&
          b.getAttribute('aria-label') !== 'Start over on this device',
      );
      if (forward.length === 0) break;

      const control = forward[forward.length - 1];
      const label = control.textContent?.trim() ?? '(unlabelled)';
      await userEvent.click(control);
      await waitFor(() => expect(document.body).toBeTruthy());

      expect(
        body(),
        `step ${step}: pressing "${label}" changed nothing on screen`,
      ).not.toBe(before);
    }
  });

  it('refuses to run an eighth day even if the day flow is reached anyway', async () => {
    /*
     * The second guard, from the other side. `start` is fixed, so the route
     * that found this is closed — but the reason the failure was severe was
     * the shape of it, not the frequency: a lib guard that throws, called from
     * an event handler, produces silence. This asserts the handler refuses
     * towards a screen instead.
     */
    const stand = playAWeek();
    expect(() => runDay(stand, { ...orderForTargetCups(stand, 40), price: 1 })).toThrow(
      /week is over/i,
    );

    leaveOnDisk(stand);
    await resume();
    // Nothing on the resumed screen may lead to that throw.
    expect(find(/Open the stand/)).toBeUndefined();
  });

  it('still resumes mid-week on the morning, which is the whole point', async () => {
    let state = createGame(4242).stand;
    for (let day = 0; day < 3; day++) {
      const order = orderForTargetCups(state, 40);
      state = runDay(state, { ...order, price: 1 }, DEFAULT_DAY_PARAMS).nextState;
    }
    expect(state.status).toBe('playing');

    leaveOnDisk(state);
    await resume();

    await waitFor(() => expect(screen.getByText(/Open up shop/i)).toBeInTheDocument());
  });
});
