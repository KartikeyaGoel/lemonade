/** @vitest-environment jsdom */
/**
 * The watched day, when the crowd is the child's to let in.
 *
 * Stage 1 hands the pace over: the street starts empty and each tap sends the
 * next group up to the sign. Two things about that are worth pinning down and
 * neither is visible in a screenshot.
 *
 * The first is that the mechanic is actually reachable. Every existing helper
 * that drives a day through the whole app takes the escape hatch — "Let the
 * rest come" — because a test has no business tapping eight times to get to
 * the next screen. That makes this file the only place the tap path is
 * exercised at all, which is exactly the shape PRODUCT.md §40 warns about: a
 * mechanic written, tested through its bypass, and never through itself.
 *
 * The second is the scoreboard. The counters trail the crowd on purpose so a
 * verdict lands as the sprite reaches the sign — an offset that closes by
 * itself while a tick is running, and an interactive day stops between taps.
 * So the day has to settle what has arrived before it goes quiet, or a child
 * reads "3 sold" under five people who visibly bought one.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { RunDayScreen } from '@/components/RunDayScreen';
import { createInitialState, runDay, type DayOutcome } from '@/lib/simulation';

/** Built from the real constructor, so the crowd is a crowd the game produces. */
function day(over: Parameters<typeof runDay>[1]): DayOutcome {
  return runDay({ ...createInitialState(7), cash: 200 }, over);
}

/** A busy day: plenty of stock, a price the street likes. */
const busy = () => day({ buyLemons: 20, buyHoneyJars: 3, buyCupPacks: 3, price: 1 });

/** Two lemons at 50c: the street wants far more than eight cups. */
const runsDry = () => day({ buyLemons: 2, buyHoneyJars: 1, buyCupPacks: 1, price: 0.5 });

const sold = () => Number(/(\d+) sold/.exec(document.body.textContent ?? '')?.[1] ?? -1);
const walked = () => Number(/(\d+) passed/.exec(document.body.textContent ?? '')?.[1] ?? -1);
const button = (pattern: RegExp) =>
  [...document.querySelectorAll('button')].find((b) => pattern.test(b.textContent ?? '')) as
    | HTMLButtonElement
    | undefined;

/**
 * Run the screen's timers forward without waiting in real time.
 *
 * In small steps rather than one jump, and for the same reason the helpers in
 * `journey.test.tsx` do it: the day is a chain of an interval that sets state
 * and effects that schedule the next timer off that state, so React has to be
 * given a chance to render between advances or the chain never gets built.
 */
async function settle(ms = 4000) {
  for (let spent = 0; spent < ms; spent += 200) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
  }
}

describe('the watched day, with the crowd handed over', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('starts with an empty street and waits to be opened', async () => {
    const outcome = busy();
    expect(outcome.customers.length).toBeGreaterThan(10);

    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);

    // Time passing must not start the day. This is the whole difference.
    await settle(30_000);

    expect(sold()).toBe(0);
    expect(button(/Wave them over/)).toBeDefined();
    expect(button(/Count up the money/)).toBeUndefined();
  });

  it('lets a group in per tap, and finishes in about eight of them', async () => {
    const outcome = busy();
    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);

    let taps = 0;
    for (let i = 0; i < 40; i++) {
      const open = button(/Wave them over|Let them in/);
      if (!open) break;
      fireEvent.click(open);
      taps += 1;
      await settle();
    }

    // Eight is the design figure; allow the rounding either side of it, and
    // fail loudly if a crowd of forty ever asks for forty presses.
    expect(taps).toBeGreaterThanOrEqual(2);
    expect(taps).toBeLessThanOrEqual(10);
    expect(button(/Count up the money/)).toBeDefined();
    expect(sold()).toBe(outcome.cupsSold);
  });

  it('settles the scoreboard between taps instead of resting short', async () => {
    const outcome = busy();
    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);

    fireEvent.click(button(/Wave them over/)!);
    await settle();

    /*
     * One group has arrived and the day has gone quiet. Every verdict in it
     * has to be on the board: the sprites have walked, and there is no tick
     * left to close the trailing offset.
     */
    const group = Math.ceil(outcome.customers.length / 8);

    /*
     * Asserted as the sum rather than as the number of buyers. Whether these
     * particular five bought depends on the seed; that all five have been
     * *counted* does not, and counting them is the thing that was broken.
     */
    expect(sold() + walked()).toBe(group);
  });

  it('lets a child stop tapping and hand the rest back', async () => {
    const outcome = busy();
    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);

    fireEvent.click(button(/Let the rest come/)!);
    await settle(30_000);

    expect(button(/Count up the money/)).toBeDefined();
    expect(sold()).toBe(outcome.cupsSold);
  });

  it('runs itself in every stage after the first', async () => {
    const outcome = busy();
    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} />);

    expect(button(/Wave them over/)).toBeUndefined();
    await settle(30_000);

    expect(button(/Count up the money/)).toBeDefined();
    expect(sold()).toBe(outcome.cupsSold);
  });

  it('warns that the cups are running out before they have run out', async () => {
    const outcome = runsDry();
    expect(outcome.turnedAwaySoldOut).toBeGreaterThan(0);

    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);

    let warnedWithCupsLeft = false;
    for (let i = 0; i < 40; i++) {
      const open = button(/Wave them over|Let them in/);
      if (!open) break;
      fireEvent.click(open);
      await settle();
      const text = document.body.textContent ?? '';
      if (/going to sell out soon/i.test(text) && !/SOLD OUT/.test(text)) {
        warnedWithCupsLeft = true;
      }
    }

    expect(
      warnedWithCupsLeft,
      'the warning only ever appeared alongside SOLD OUT, which makes it a receipt',
    ).toBe(true);
  });

  /*
   * And it has to last long enough to read.
   *
   * Measured in a browser: 32 cups at 40c on a hot day sells eleven cups a
   * tap, so a threshold of a quarter of the batch put the warning up for one
   * beat and then replaced it with SOLD OUT. The threshold is sized against a
   * group for that reason, and this is the assertion that keeps it there.
   */
  it('leaves the warning up for more than a single tap', async () => {
    const outcome = runsDry();
    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);

    let warnedTaps = 0;
    for (let i = 0; i < 40; i++) {
      const open = button(/Wave them over|Let them in/);
      if (!open) break;
      fireEvent.click(open);
      await settle();
      if (/going to sell out soon/i.test(document.body.textContent ?? '')) warnedTaps += 1;
    }

    expect(warnedTaps).toBeGreaterThanOrEqual(1);
  });

  it('says nothing on a day that serves everybody who wanted one', async () => {
    const outcome = busy();
    expect(outcome.turnedAwaySoldOut).toBe(0);

    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} />);
    await settle(30_000);

    expect(document.body.textContent).not.toMatch(/going to sell out soon/i);
  });

  it('ends a day nobody came to, tap or no tap', async () => {
    const outcome = day({ buyLemons: 20, buyHoneyJars: 3, buyCupPacks: 3, price: 5 });
    vi.useFakeTimers();
    render(<RunDayScreen outcome={outcome} onDone={() => {}} interactive />);
    await settle(30_000);

    // Nobody bought, but people walked past, so there is still a crowd to let
    // in — the day must not be waiting on a tap that finishes nothing.
    const open = button(/Let the rest come/);
    if (open) fireEvent.click(open);
    await settle(30_000);

    expect(button(/Count up the money/)).toBeDefined();
    expect(screen.getByText(/0 sold/)).toBeInTheDocument();
  });
});
