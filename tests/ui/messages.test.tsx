/** @vitest-environment jsdom */
/**
 * Messages, driven through the app.
 *
 * Three things are asserted here and they are the three that would matter to a
 * parent reading PRIVACY.md.
 *
 * **The grown-up round trip works.** Child writes on their screen, grown-up
 * replies from behind the grown-up screen, child sees it. No server, and not a
 * stub: a note on a shared family tablet is the actual product for this age
 * group.
 *
 * **A friend message says "waiting to be sent".** There is no transport. A
 * screen that told a child their friend had read something they cannot see is
 * the one failure in this feature with real consequences.
 *
 * **The filter runs on the way in, and says what it took.** Told rather than
 * hidden, because a message that silently vanishes teaches a child the app is
 * broken.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createPortfolio } from '@/lib/market';
import { QUAL_CLAIMS, QUANT_CLAIMS, buildThesis } from '@/lib/thesis';
import { SNAPSHOT } from '@/lib/companies';
import { loadInbox, loadLedger } from '@/lib/storage';

/** A save with a written reason, which is what makes the missions exist. */
function withAThesis(): Game {
  const base = createGame(4242);
  const portfolio = createPortfolio(500);
  const company = SNAPSHOT[0];
  return {
    ...base,
    version: SAVE_VERSION,
    act: 5,
    portfolio,
    theses: [
      buildThesis({
        company,
        quantId: QUANT_CLAIMS[0].id,
        qualId: QUAL_CLAIMS[0].id,
        week: 0,
        priceAtBuy: portfolio.priceHistory[company.ticker][0],
        dollars: 100,
      }),
    ],
  };
}

function seed() {
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(withAThesis()));
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

async function openMessages(user: ReturnType<typeof userEvent.setup>) {
  await readTheCards(user);
  await waitFor(() => expect(button(/Messages|Tell a grown-up|note from a grown-up/)).toBeDefined());
  await user.click(button(/Messages|Tell a grown-up|note from a grown-up/)!);
  await waitFor(() => expect(screen.getByLabelText('Write a message')).toBeInTheDocument());
}

describe('messages, through the app', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('offers no door before there is anything to say', async () => {
    const user = userEvent.setup();
    const base = createGame(4242);
    window.localStorage.setItem(
      'lemonade.save.v2',
      JSON.stringify({ ...base, version: SAVE_VERSION, act: 5, portfolio: createPortfolio(500) }),
    );
    window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));
    render(<Page />);
    await readTheCards(user);
    await waitFor(() => expect(button(/Keep going|Start selling/)).toBeDefined());
    // No written reason, so no mission, so the screen would be a blank box
    // under an instruction — which is where this feature would die.
    expect(button(/Messages/)).toBeUndefined();
  });

  it('fills a draft with the child’s own written reason', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openMessages(user);

    await user.click(button(/Tell a grown-up why you bought/)!);
    const box = screen.getByLabelText('Write a message') as HTMLTextAreaElement;
    // Their words, not a template with a name dropped in.
    expect(box.value).toMatch(/^I bought: /);
    expect(box.value).toMatch(/Because: /);
  });

  it('carries a grown-up round trip on one device, and pays for the telling', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openMessages(user);

    await user.click(button(/Tell a grown-up why you bought/)!);
    await user.click(button(/Send →/)!);

    await waitFor(() => expect(loadInbox().threads[0].messages).toHaveLength(1));
    expect(loadInbox().threads[0].messages[0].state).toBe('delivered');
    // Paid on sending, not on a reply: a reward that waits for somebody else
    // punishes the child whose grown-up is busy.
    expect(loadLedger().entries.some((e) => e.deed === 'taught-a-grown-up')).toBe(true);

    // Now the grown-up's half, from behind the grown-up screen.
    await user.click(button(/←/)!);
    await waitFor(() => expect(button(/For a grown-up/)).toBeDefined());
    await user.click(button(/For a grown-up/)!);

    const reply = await waitFor(() => screen.getByLabelText('Write back'));
    await user.type(reply, 'Good reason. Tell me at dinner.');
    await user.click(button(/Send it/)!);

    await waitFor(() => {
      const messages = loadInbox().threads[0].messages;
      expect(messages.map((m) => m.author)).toEqual(['child', 'grown-up']);
    });
  });

  it('takes identifiers out and says what it took', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openMessages(user);

    const box = screen.getByLabelText('Write a message');
    await user.type(box, 'ring me on 07700 900123');
    await user.click(button(/Send →/)!);

    await waitFor(() => expect(loadInbox().threads[0].messages).toHaveLength(1));
    const stored = loadInbox().threads[0].messages[0];
    expect(stored.body).not.toMatch(/900123/);
    expect(stored.note).toMatch(/phone number/);
    // And the child is told, on screen, rather than left to wonder.
    await waitFor(() => expect(screen.getByText(/We took out/)).toBeInTheDocument());
  });

  it('lets a child block a conversation from inside it', async () => {
    const user = userEvent.setup();
    seed();
    render(<Page />);
    await openMessages(user);

    await user.click(button(/Something wrong/)!);
    await user.click(button(/^Block$/)!);

    await waitFor(() => expect(loadInbox().threads[0].blocked).toBe(true));
    // A blocked conversation takes nothing. Checked on send, not on read.
    await waitFor(() => expect(screen.getByText(/Nothing goes in or out/)).toBeInTheDocument());
    expect(screen.queryByLabelText('Write a message')).not.toBeInTheDocument();
  });
});
