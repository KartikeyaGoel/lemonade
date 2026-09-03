/** @vitest-environment jsdom */
/**
 * The duel, and the screen that settles it.
 *
 * `ChallengeScreen` had 90 uncovered statements and 71 of them were one
 * component: `CompareView`, the side-by-side that says who won and why. It was
 * uncovered because it only exists after a friend's score code has been pasted
 * in and decoded, and nothing had ever pasted one.
 *
 * That is the same shape of gap as the resume bug in §50 — a screen the game
 * can reach that no test had ever reached, because reaching it needs a
 * plausible piece of *other people's* data. So the codes here are made with
 * the real encoder rather than typed as literals: a hand-written code that the
 * decoder happens to reject proves nothing, and a hand-written one it happens
 * to accept proves less.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengeScreen } from '@/components/meta/ChallengeScreen';
import { encodeResult, summariseRun, type Comparison } from '@/lib/challenge';
import {
  DEFAULT_DAY_PARAMS,
  batchPlan,
  runDay,
  type DayRecord,
  type GameState,
} from '@/lib/simulation';
import { createGame } from '@/lib/progress';

/** A week of real days, at a price the caller picks, so two runs can differ. */
function aWeek(price: number, seed = 4242): DayRecord[] {
  let state: GameState = createGame(seed).stand;
  for (let day = 0; day < 7; day++) {
    const plan = batchPlan(state, 30);
    state = runDay(state, { ...plan.order, price }, DEFAULT_DAY_PARAMS).nextState;
  }
  return state.history;
}

const SEED = 4242;

/** A friend's score, built by the encoder the friend's device would use. */
function theirCode(name: string, price: number): string {
  return encodeResult(summariseRun(SEED, name, aWeek(price), 3));
}

function duel(overrides: Partial<Parameters<typeof ChallengeScreen>[0]> = {}) {
  const onCompared = vi.fn();
  render(
    <ChallengeScreen
      seed={SEED}
      me="Sam"
      history={aWeek(1.6)}
      badges={4}
      today="2026-09-03"
      onPlayChallenge={() => {}}
      onCompared={onCompared}
      onBack={() => {}}
      {...overrides}
    />,
  );
  return { onCompared };
}

async function paste(code: string) {
  await userEvent.type(screen.getByRole('textbox', { name: 'RUN-...' }), code);
  await userEvent.click(screen.getByRole('button', { name: /Compare us/i }));
}

describe('pasting a friend’s score', () => {
  afterEach(cleanup);

  it('opens the comparison and names a winner', async () => {
    const { onCompared } = duel();
    // A cheaper week: more cups, less money. The interesting kind of loss.
    await paste(theirCode('Ada', 0.8));

    /*
     * The friend is named and the kid is "You" — not their own name. Worth
     * asserting rather than assuming: a comparison screen that called them
     * "SAM" would read like two strangers' numbers instead of theirs and a
     * friend's.
     */
    expect(screen.getByText(/ADA/)).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(onCompared).toHaveBeenCalledTimes(1);

    const comparison: Comparison = onCompared.mock.calls[0][0];
    expect(['you', 'them', 'tie']).toContain(comparison.winner);

    // The headline names the result and the cause explains it. Both on screen,
    // because "you lost" without "because you priced under your costs" is a
    // scoreboard rather than a lesson.
    expect(screen.getByText(comparison.headline)).toBeInTheDocument();
    if (comparison.cause) expect(screen.getByText(comparison.cause)).toBeInTheDocument();
  });

  it('shows both runs in cups and average price, not just profit', async () => {
    duel();
    await paste(theirCode('Ada', 0.8));
    // "N cups at about $X" — the line that stops profit being the only number.
    expect(screen.getAllByText(/cups? at about/i).length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a code that is not a score code, and says what to check', async () => {
    duel();
    await paste('RUN-NOPE-NOPE');
    expect(screen.getByText(/not right/i)).toBeInTheDocument();
    expect(screen.queryByText(/ADA/)).not.toBeInTheDocument();
  });

  it('refuses to compare when the kid has not played yet', async () => {
    /*
     * The order matters and the copy knows it: with no run of your own there
     * is nothing to put beside theirs, and the screen says so rather than
     * showing a comparison against zero.
     */
    duel({ history: [] });
    await paste(theirCode('Ada', 0.8));
    expect(screen.getByText(/Play a day of your own first/i)).toBeInTheDocument();
  });

  it('goes back to the duel screen from the comparison', async () => {
    duel();
    await paste(theirCode('Ada', 0.8));
    expect(screen.getByText(/ADA/)).toBeInTheDocument();

    const back = screen.getAllByRole('button').find((b) => /back|done|→|←/i.test(b.textContent ?? ''));
    expect(back).toBeDefined();
    await userEvent.click(back!);
    // Back on the duel screen, which offers the paste field again.
    expect(screen.getByRole('textbox', { name: 'RUN-...' })).toBeInTheDocument();
  });

  it('fires onCompared once, not once per render', async () => {
    /*
     * `onCompared` is what banks the duel on the career, so a second call
     * would count one duel twice. The screen is explicit that it "fires once,
     * when a friend's score has actually been read in".
     */
    const { onCompared } = duel();
    await paste(theirCode('Ada', 0.8));
    expect(onCompared).toHaveBeenCalledTimes(1);
  });
});
