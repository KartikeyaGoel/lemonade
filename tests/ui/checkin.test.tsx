/** @vitest-environment jsdom */
/**
 * The check-in, driven through the real app.
 *
 * This file exists because of PRODUCT.md §40 — a mechanic written, tested, and
 * wired to nothing. `tests/checkin.test.ts` proves the ritual's arithmetic and
 * would go on passing forever with no way to reach it, and the dead-code gate
 * cannot tell the difference because a test counts as a caller.
 *
 * So what is asserted here is reachability and payment: the door appears, the
 * six steps arrive one at a time, the credits land in the ledger, and opening
 * it twice in a day does not pay twice.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createPortfolio } from '@/lib/market';
import { loadLedger } from '@/lib/storage';
import { STEPS } from '@/lib/checkin';
import { buy } from '@/lib/market';
import { SNAPSHOT } from '@/lib/companies';

/**
 * A save that has reached the market, which is what gives the ritual a subject.
 *
 * `weeks` matters more than it looks. A portfolio one week old holds a single
 * price per company, so there is no week-over-week move to talk about and the
 * ritual honestly drops the two questions that are *about* the move — see
 * `stepsFor`. So the six-step path and the four-step path are two different
 * fixtures, not two different assertions about one.
 */
function inTheMarket(weeks: number): Game {
  const base = createGame(4242);
  const portfolio = createPortfolio(500);
  const priceHistory = Object.fromEntries(
    Object.entries(portfolio.priceHistory).map(([ticker, series]) => [
      ticker,
      weeks <= 1 ? series : [series[0], series[0] * 1.03],
    ]),
  );
  return {
    ...base,
    version: SAVE_VERSION,
    act: 4,
    portfolio: { ...portfolio, week: weeks - 1, priceHistory },
  };
}

function seed(weeks = 2) {
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(inTheMarket(weeks)));
  window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));
}

const button = (pattern: RegExp) =>
  [...document.querySelectorAll('button')].find((b) => pattern.test(b.textContent ?? '')) as
    | HTMLButtonElement
    | undefined;

/**
 * Clear whatever the queues want to say first.
 *
 * A save that has reached the market has unlock cards owed to it — the
 * investment club, in this fixture — and §26's queue deliberately shows them
 * *before* the title. So a test looking for a door on the title screen has to
 * do what a child does and read the cards. Skipping this looked exactly like
 * "the door does not exist".
 */
async function readTheCards(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 8; i += 1) {
    const card = button(/Got it →|Nice →|Next →/);
    if (!card) return;
    if (button(/Start selling|Keep going/)) return;
    await user.click(card);
  }
}

describe('reaching the check-in', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('offers a door from the title once there is a market to check', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Check in/)).toBeDefined());
  });

  it('walks the six steps one at a time and pays for the answers', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Check in/)).toBeDefined());
    await user.click(button(/Check in/)!);

    // Step one of six, and only step one. Six because this fixture has a week
    // behind it, so every question has a subject.
    await waitFor(() => expect(screen.getByText('1 of 6')).toBeInTheDocument());
    expect(screen.getByText('What happened?')).toBeInTheDocument();
    expect(screen.queryByText('Why did it happen?')).not.toBeInTheDocument();

    for (let step = 1; step <= STEPS.length; step += 1) {
      const next = button(/Next →/) ?? button(/Collect →/);
      expect(next, `no way forward on step ${step}`).toBeDefined();

      /*
       * A question has to be answered before it can be left. That is the point
       * of the ritual, so the button is disabled until something is picked —
       * which also means this loop has to actually answer, not just click on.
       */
      if (next!.disabled) {
        const choices = [...document.querySelectorAll('[data-coach="checkin-choices"] button')];
        expect(choices.length, `step ${step} blocks with nothing to pick`).toBeGreaterThan(0);
        await user.click(choices[0] as HTMLElement);
      }

      const go = button(/Next →/) ?? button(/Collect →/);
      const wasLast = /Collect/.test(go!.textContent ?? '');
      await user.click(go!);
      if (wasLast) break;
    }

    // Back where they came from, and paid.
    await waitFor(() => expect(button(/Start selling|Keep going/)).toBeDefined());
    const led = loadLedger();
    expect(led.entries.some((entry) => entry.deed === 'answered-the-check-in')).toBe(true);
    expect(led.earned).toBeGreaterThan(0);
    expect(led.days).toHaveLength(1);
  });

  it('does not pay twice on the same day', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);

    async function runIt() {
      await waitFor(() => expect(button(/Check in|Checked in/)).toBeDefined());
      await user.click(button(/Check in|Checked in/)!);
      for (let step = 0; step < STEPS.length + 2; step += 1) {
        const go = button(/Next →/) ?? button(/Collect →/);
        if (!go) break;
        if (go.disabled) {
          const choices = [...document.querySelectorAll('[data-coach="checkin-choices"] button')];
          if (choices.length > 0) await user.click(choices[0] as HTMLElement);
        }
        const press = button(/Next →/) ?? button(/Collect →/);
        if (!press) break;
        const wasLast = /Collect/.test(press.textContent ?? '');
        await user.click(press);
        if (wasLast) break;
      }
      await waitFor(() => expect(button(/Start selling|Keep going/)).toBeDefined());
    }

    await runIt();
    const once = loadLedger().earned;
    expect(once).toBeGreaterThan(0);

    await runIt();
    expect(loadLedger().earned).toBe(once);
  });

  it('says on the door that today is already done', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Check in/)).toBeDefined());
    await user.click(button(/Check in/)!);

    for (let step = 0; step < STEPS.length + 2; step += 1) {
      const go = button(/Next →/) ?? button(/Collect →/);
      if (!go) break;
      if (go.disabled) {
        const choices = [...document.querySelectorAll('[data-coach="checkin-choices"] button')];
        if (choices.length > 0) await user.click(choices[0] as HTMLElement);
      }
      const press = button(/Next →/) ?? button(/Collect →/);
      if (!press) break;
      const wasLast = /Collect/.test(press.textContent ?? '');
      await user.click(press);
      if (wasLast) break;
    }

    await waitFor(() => expect(button(/Checked in/)).toBeDefined());
  });

  /*
   * Both bugs a browser found on the first reachable check-in, asserted
   * through the app rather than through the module.
   *
   * A fresh portfolio has one price per company, so there is no week to talk
   * about. The ritual used to ask all six anyway — including "does it touch
   * anything you own?", which it then marked against a default, telling a
   * child holding Apple that they did not hold it. And the tally at the end
   * congratulated them on "all three right" when it had asked one question.
   */
  it('shrinks to the questions it can honestly ask, and counts them', async () => {
    const user = userEvent.setup();
    // One week only: nothing to compare, so nothing to ask about the compare.
    seed(1);
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Check in/)).toBeDefined());
    await user.click(button(/Check in/)!);

    // Four, not six, and the counter says so.
    await waitFor(() => expect(screen.getByText('1 of 4')).toBeInTheDocument());
    expect(screen.queryByText(/Why did it happen/)).not.toBeInTheDocument();

    for (let step = 0; step < 8; step += 1) {
      const go = button(/Next →/) ?? button(/Collect →/);
      if (!go) break;
      if (go.disabled) {
        const choices = [...document.querySelectorAll('[data-coach="checkin-choices"] button')];
        if (choices.length > 0) await user.click(choices[0] as HTMLElement);
      }
      const press = button(/Next →/) ?? button(/Collect →/);
      if (!press) break;
      if (/Collect/.test(press.textContent ?? '')) {
        // The last screen must not claim three answers when it asked one.
        expect(document.body.textContent).not.toMatch(/All three right/);
        expect(document.body.textContent).not.toMatch(/do not hold any/);
        await user.click(press);
        break;
      }
      await user.click(press);
    }

    await waitFor(() => expect(button(/Start selling|Keep going/)).toBeDefined());
  });
  /*
   * "Identifying excessive concentration" — one of the three credit
   * behaviours that sat in the payout table paying nothing.
   *
   * A child could read "Noticed too much was in one company — 20" on the
   * credits screen and there was no way in the game to do it. A reward you
   * cannot earn is worse than one that does not exist: it is a promise on a
   * screen.
   *
   * Paid for the *right* answer on a portfolio that really is concentrated,
   * never for picking the option.
   */
  it('pays for spotting concentration, and only when there is some', async () => {
    const user = userEvent.setup();

    // Two holdings: under the 35% single-position cap, over the concentration
    // line, which is the only shape of concentration a child can create.
    const base = createGame(4242);
    let portfolio = createPortfolio(500);
    const priceHistory = Object.fromEntries(
      Object.entries(portfolio.priceHistory).map(([t, series]) => [
        t,
        [series[0], series[0] * 1.02],
      ]),
    );
    portfolio = { ...portfolio, week: 1, priceHistory };
    for (const company of SNAPSHOT.slice(0, 2)) {
      portfolio = buy(portfolio, company.ticker, 150).portfolio;
    }

    window.localStorage.setItem(
      'lemonade.save.v2',
      JSON.stringify({ ...base, version: SAVE_VERSION, act: 4, portfolio }),
    );
    window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));

    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Check in/)).toBeDefined());
    await user.click(button(/Check in/)!);

    for (let step = 0; step < STEPS.length + 2; step += 1) {
      const go = button(/Next →/) ?? button(/Collect →/);
      if (!go) break;
      if (screen.queryByText('Does anything need doing?')) {
        // The right answer for this portfolio.
        await user.click(screen.getByRole('button', { name: /Spread my money out/ }));
      } else if (go.disabled) {
        const choices = [...document.querySelectorAll('[data-coach="checkin-choices"] button')];
        if (choices.length > 0) await user.click(choices[0] as HTMLElement);
      }
      const press = button(/Next →/) ?? button(/Collect →/);
      if (!press) break;
      const wasLast = /Collect/.test(press.textContent ?? '');
      await user.click(press);
      if (wasLast) break;
    }

    await waitFor(() =>
      expect(
        loadLedger().entries.some((entry) => entry.deed === 'trimmed-concentration'),
      ).toBe(true),
    );
  });
});
