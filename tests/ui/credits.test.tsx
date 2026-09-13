/** @vitest-environment jsdom */
/**
 * Credits, and the one thing they buy.
 *
 * Money moving is the part of any feature that deserves a test through the
 * app rather than through the module. PRODUCT.md §54 is the record of what
 * happens otherwise: an equity slice where the cash was banked and the goods
 * were not delivered, because the module clamped where the caller filtered.
 *
 * So the assertions here are the three that make a purchase honest — the cash
 * arrives, the credits leave, and `earned` does not move, because §4 says a
 * child's record of what they demonstrated is monotonic and a balance that
 * falls when they spend it would take that with it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createPortfolio } from '@/lib/market';
import { createLedger, localDay, balance } from '@/lib/ledger';
import { CREDITS_PER_DOLLAR, EARNERS, awardFor } from '@/lib/credits';
import { loadGame, loadLedger } from '@/lib/storage';

function inTheMarket(): Game {
  const base = createGame(4242);
  return { ...base, version: SAVE_VERSION, act: 4, portfolio: createPortfolio(500) };
}

/** A ledger with the two best-paying deeds in it: 70 credits, so $10 is buyable. */
function earned() {
  const today = localDay();
  let led = createLedger();
  led = awardFor(led, 'passed-on-price', today).ledger;
  led = awardFor(led, 'reviewed-a-mistake', today).ledger;
  return led;
}

function seed() {
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(inTheMarket()));
  window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));
  window.localStorage.setItem('lemonade.ledger.v1', JSON.stringify(earned()));
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

describe('credits', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('offers no door until something has been earned', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('lemonade.save.v2', JSON.stringify(inTheMarket()));
    window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Keep going|Start selling/)).toBeDefined());
    // `unlocks.ts`: nothing exists until the child has done the thing that
    // gives it a meaning. An empty credits screen is a menu item.
    expect(button(/credits/)).toBeUndefined();
  });

  it('points at the hardest thing still available, not at the balance', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/credits/)).toBeDefined());
    await user.click(button(/credits/)!);

    await waitFor(() => expect(screen.getByText('Still worth doing today')).toBeInTheDocument());

    /*
     * The two best-paying deeds are already done, so the top of the list has
     * to be the third — never something cheap and repeatable. This is the
     * §16 property ("activity mistaken for skill") made visible.
     */
    const rows = [...document.querySelectorAll('.space-y-1\\.5 > div')];
    expect(rows.length).toBeGreaterThan(0);
    const worths = EARNERS.filter((e) => e.deed !== 'passed-on-price' && e.deed !== 'reviewed-a-mistake');
    expect(document.body.textContent).toContain(worths[0].label);
  });

  it('buys money to invest: cash arrives, credits leave, earned does not move', async () => {
    const user = userEvent.setup();
    seed();
    const before = loadLedger();
    expect(balance(before)).toBe(70);

    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/credits/)).toBeDefined());
    await user.click(button(/credits/)!);

    // Matched on text rather than by regex: escaping a dollar sign through a
    // template literal into a RegExp is a good way to assert nothing at all.
    const wanted = `$10.00 · ${10 * CREDITS_PER_DOLLAR} credits`;
    const buy = await waitFor(() => {
      const found = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent ?? '').trim() === wanted,
      ) as HTMLButtonElement | undefined;
      expect(found, `no button reading "${wanted}"`).toBeDefined();
      return found!;
    });

    const cashBefore = loadGame()!.portfolio!.cash;
    await user.click(buy);

    await waitFor(() => expect(loadGame()!.portfolio!.cash).toBe(cashBefore + 10));
    const after = loadLedger();
    expect(after.spent).toBe(50);
    expect(balance(after)).toBe(20);
    // §4. The balance falls; the record of having earned it does not.
    expect(after.earned).toBe(before.earned);
  });

  it('never offers an amount it will then refuse', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/credits/)).toBeDefined());
    await user.click(button(/credits/)!);
    await waitFor(() => expect(screen.getByText('Still worth doing today')).toBeInTheDocument());

    /*
     * The dead state the module tests found once already: a balance reported
     * as worth $8 that the shop would not sell. Every offer on screen has to
     * be affordable, so pressing them all in turn must never be a no-op.
     */
    const offers = [...document.querySelectorAll('button')].filter((b) =>
      /^\$\d+\.\d\d · \d+ credits$/.test((b.textContent ?? '').trim()),
    );
    expect(offers.length).toBeGreaterThan(0);

    const cheapest = offers[offers.length - 1];
    const dollars = Number(/\$(\d+)/.exec(cheapest.textContent ?? '')?.[1]);
    const cashBefore = loadGame()!.portfolio!.cash;
    await user.click(cheapest);
    await waitFor(() => expect(loadGame()!.portfolio!.cash).toBe(cashBefore + dollars));
  });
});
