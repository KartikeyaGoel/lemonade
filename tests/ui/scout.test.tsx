/** @vitest-environment jsdom */
/**
 * Stock Scout, driven through the app.
 *
 * The module's own tests prove the framework and the marking. This file proves
 * a child can reach it, that the questions arrive one at a time in the order
 * that matters, and that the verdict shows two scores rather than one.
 *
 * The order is the part worth asserting through the app rather than through the
 * data: all five business questions have to come before any price question, so
 * a child decides whether it is a good business *before* seeing what it costs.
 * A layout change could quietly reorder them and no unit test would notice.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createPortfolio } from '@/lib/market';
import { BUSINESS_QUESTIONS, SCOUT_QUESTIONS, STOCK_QUESTIONS } from '@/lib/scout';
import { loadLedger } from '@/lib/storage';

function inTheMarket(): Game {
  const base = createGame(4242);
  return { ...base, version: SAVE_VERSION, act: 5, portfolio: createPortfolio(500) };
}

function seed() {
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(inTheMarket()));
  window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));
}

const button = (pattern: RegExp) =>
  [...document.querySelectorAll('button')].find((b) => pattern.test(b.textContent ?? '')) as
    | HTMLButtonElement
    | undefined;

async function readTheCards(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 8; i += 1) {
    if (button(/Start selling|Keep going/)) return;
    const card = button(/Got it →|Nice →/);
    if (!card) return;
    await user.click(card);
  }
}

async function openScout(user: ReturnType<typeof userEvent.setup>) {
  await readTheCards(user);
  await waitFor(() => expect(button(/Rate a company|Rated \d/)).toBeDefined());
  await user.click(button(/Rate a company|Rated \d/)!);
  await waitFor(() => expect(screen.getByText(`1 of ${SCOUT_QUESTIONS.length}`)).toBeInTheDocument());
}

describe('Stock Scout, through the app', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('offers a door as soon as there is a market', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Rate a company/)).toBeDefined());
  });

  it('asks the business questions before it shows what it costs', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openScout(user);

    const asked: string[] = [];
    for (let i = 0; i < SCOUT_QUESTIONS.length; i += 1) {
      const heading = document.querySelector('h2');
      expect(heading, `no question on step ${i + 1}`).not.toBeNull();
      asked.push(heading!.textContent ?? '');

      // One question on screen, never two.
      expect(document.querySelectorAll('h2')).toHaveLength(1);

      await user.click(
        [...document.querySelectorAll('[data-coach="scout-answer"] button')][0] as HTMLElement,
      );
      const next = button(/Next →|See how you did →/);
      expect(next, `no way forward on step ${i + 1}`).toBeDefined();
      await user.click(next!);
    }

    const businessAsks = BUSINESS_QUESTIONS.map((q) => q.ask);
    const stockAsks = STOCK_QUESTIONS.map((q) => q.ask);
    const lastBusiness = Math.max(...businessAsks.map((ask) => asked.indexOf(ask)));
    const firstStock = Math.min(...stockAsks.map((ask) => asked.indexOf(ask)));

    // The order is the argument: the price cannot talk you into liking the
    // business if you have already decided about the business.
    expect(firstStock).toBeGreaterThan(lastBusiness);
  });

  it('shows the evidence as soon as an answer is given, not at the end', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openScout(user);

    await user.click(
      [...document.querySelectorAll('[data-coach="scout-answer"] button')][0] as HTMLElement,
    );
    // A child who finds out on screen eight that question one was wrong has
    // forgotten what they thought.
    await waitFor(() =>
      expect(screen.getByText(/✓ Right|✕ Not this time/)).toBeInTheDocument(),
    );
  });

  it('reports the two sides apart, and records the rating', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openScout(user);

    for (let i = 0; i < SCOUT_QUESTIONS.length; i += 1) {
      await user.click(
        [...document.querySelectorAll('[data-coach="scout-answer"] button')][0] as HTMLElement,
      );
      await user.click(button(/Next →|See how you did →/)!);
    }

    // Two scores. Never one out of eight.
    await waitFor(() => expect(screen.getByText('The business')).toBeInTheDocument());
    expect(screen.getByText('The price')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(new RegExp(`/${SCOUT_QUESTIONS.length}\\b`));

    await user.click(button(/Done →/)!);

    await waitFor(() => {
      const entry = loadLedger().entries.find((e) => e.deed === 'rated-a-business');
      expect(entry).toBeDefined();
      expect(entry!.what).toBeTruthy();
    });
  });

  it('moves on to a different company once one is rated', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openScout(user);

    const first = document.querySelector('h1')?.textContent;
    for (let i = 0; i < SCOUT_QUESTIONS.length; i += 1) {
      await user.click(
        [...document.querySelectorAll('[data-coach="scout-answer"] button')][0] as HTMLElement,
      );
      await user.click(button(/Next →|See how you did →/)!);
    }
    await user.click(button(/Done →/)!);

    await waitFor(() => expect(button(/Rated 1/)).toBeDefined());
    await user.click(button(/Rated 1/)!);
    await waitFor(() => expect(screen.getByText(`1 of ${SCOUT_QUESTIONS.length}`)).toBeInTheDocument());
    // §16's rule about the collection: not farmable by re-rating a familiar one.
    expect(document.querySelector('h1')?.textContent).not.toBe(first);
  });
});
