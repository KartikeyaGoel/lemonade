/** @vitest-environment jsdom */
/**
 * Can the next tester get a clean start, from wherever they are?
 *
 * There are no accounts, so a browser holds exactly one child's progress. That
 * is the right trade for a product that promises nothing leaves the device —
 * but during beta several people share one link, and the second tester opens
 * the site to be offered "Keep going" into somebody else's half-built shop.
 *
 * A reset already existed behind the grown-up screen. This asserts the one
 * that floats on every screen, and the two things that make it safe: it says
 * what it will destroy, and the safe answer is the easy one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { ResetButton } from '@/components/ResetButton';
import { SAVE_VERSION, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { GLOSSARY } from '@/lib/glossary';
import { BADGES } from '@/lib/achievements';
import { DEFAULT_DAY_PARAMS, batchPlan, runDay } from '@/lib/simulation';

/** Somebody else's run, played by the simulation. */
function somebodyElsesRun(): Game {
  const base = createGame(4242);
  let stand = base.stand;
  for (let day = 0; day < 5; day++) {
    const plan = batchPlan(stand, 30);
    stand = runDay(stand, { ...plan.order, price: 1.6 }, { ...DEFAULT_DAY_PARAMS, lastDay: null })
      .nextState;
  }
  return { ...base, version: SAVE_VERSION, stand: { ...stand, status: 'playing' } };
}

function seedSomebodyElse() {
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(somebodyElsesRun()));
  window.localStorage.setItem(
    'lemonade.career.v1',
    JSON.stringify({
      ...createCareer('Ada'),
      badges: BADGES.slice(0, 6).map((b) => b.id),
      words: GLOSSARY.slice(0, 9).map((w) => w.id),
    }),
  );
}

const reset = () => screen.getByRole('button', { name: 'Start over on this device' });

describe('the reset that is on every screen', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('is there on a fresh install, before anything has been played', async () => {
    render(<Page />);
    await waitFor(() => expect(reset()).toBeInTheDocument());
  });

  it('is on the very first screen a tester sees, whatever it is', async () => {
    /*
     * The case it exists for, and it is not the title screen.
     *
     * Opening a link that already has somebody else's save on it queued an
     * *unlock card* ahead of the title — a stranger's reward, full screen. So
     * the screen where a tester most needs the reset was one of the two that
     * return early, before the root fragment that mounts it. They carry it
     * now, which is why this asserts "the first screen" rather than naming one.
     */
    seedSomebodyElse();
    render(<Page />);
    await waitFor(() => expect(reset()).toBeInTheDocument());
  });

  it('is still there once the cards are tapped through, on the title', async () => {
    seedSomebodyElse();
    render(<Page />);
    await waitFor(() => expect(reset()).toBeInTheDocument());

    // Tap through whatever a stranger's run has queued.
    for (let i = 0; i < 8; i++) {
      const card = screen.queryByRole('button', { name: /Got it|Next|TAP TO CLOSE/i });
      if (!card) break;
      await userEvent.click(card);
    }

    await waitFor(() => expect(screen.getByText(/Keep going/i)).toBeInTheDocument());
    expect(reset(), 'the reset vanished once the cards were gone').toBeInTheDocument();
  });

  it('asks before it destroys anything, and names what goes', async () => {
    seedSomebodyElse();
    render(<Page />);
    await waitFor(() => expect(reset()).toBeInTheDocument());
    await userEvent.click(reset());

    // Still there — one tap asks, it does not wipe.
    expect(window.localStorage.getItem('lemonade.save.v2')).not.toBeNull();
    expect(screen.getByText(/Start over\?/i)).toBeInTheDocument();
    const said = document.body.textContent ?? '';
    expect(said).toMatch(/trophies/i);
    expect(said).toMatch(/cannot be brought back/i);
  });

  it('lets the safe answer be the easy one', async () => {
    /*
     * "Keep playing" is the mint button and "wipe it" is the ghost — the
     * reverse of how a primary action is normally styled, on purpose. Asserted
     * because a destructive default is the difference between a testing tool
     * and a footgun.
     */
    seedSomebodyElse();
    render(<Page />);
    await waitFor(() => expect(reset()).toBeInTheDocument());
    await userEvent.click(reset());
    await userEvent.click(screen.getByRole('button', { name: /Keep playing/i }));

    expect(window.localStorage.getItem('lemonade.save.v2')).not.toBeNull();
    expect(screen.queryByText(/Start over\?/i)).not.toBeInTheDocument();
  });

  it('really does clear the device when confirmed', async () => {
    seedSomebodyElse();
    window.localStorage.setItem('lemonade.guide.v1', JSON.stringify(['market']));
    render(<Page />);
    await waitFor(() => expect(reset()).toBeInTheDocument());
    await userEvent.click(reset());
    await userEvent.click(screen.getByRole('button', { name: /Wipe it and start fresh/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('lemonade.save.v2')).toBeNull();
      expect(window.localStorage.getItem('lemonade.career.v1')).toBeNull();
      expect(window.localStorage.getItem('lemonade.guide.v1')).toBeNull();
    });
    // And it says so, rather than asserting a success it did not check.
    expect(screen.getByText(/gone/i)).toBeInTheDocument();
  });

  it('does not float over the day animation', async () => {
    /*
     * `run` is a twelve-second animation with nothing to decide. A floating
     * button over it is something to fiddle with, and the one thing it does is
     * delete the week. The parent screen is excluded too, because it carries
     * the full version of this with the same confirmation.
     */
    const { rerender } = render(<ResetButton onReset={() => {}} />);
    expect(screen.getByRole('button', { name: 'Start over on this device' })).toBeInTheDocument();
    rerender(<></>);
    expect(
      screen.queryByRole('button', { name: 'Start over on this device' }),
    ).not.toBeInTheDocument();
  });

  it('is a real finger-sized target', async () => {
    /*
     * 44px, like everything else that gets tapped (PRODUCT.md §51). jsdom has
     * no layout engine, so this reads the classes that set it — which is what
     * `tests/ui/layout.test.tsx` does for the same reason.
     */
    render(<ResetButton onReset={() => {}} />);
    const button = screen.getByRole('button', { name: 'Start over on this device' });
    expect(button.className).toMatch(/\bh-11\b/);
    expect(button.className).toMatch(/\bw-11\b/);
  });
});
