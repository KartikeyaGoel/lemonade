/** @vitest-environment jsdom */
/**
 * Two playbooks, backtested against each other.
 *
 * `PlaybookScreen` had 46 uncovered statements in three blocks: the friend's
 * deck, the paste field that decodes one, and `verdict` — the sentence that
 * says which of two strategies was actually better and why.
 *
 * `verdict` is the interesting one, because it is the only place in the product
 * that compares two *strategies* rather than two outcomes, and it deliberately
 * refuses to answer on hit rate alone: it reads the worst stretch too. A rule
 * set that wins more often and falls further is not obviously better, and the
 * copy is written to say so. None of those branches had ever run.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybookScreen } from '@/components/meta/PlaybookScreen';
import {
  DECK_SIZE,
  RULE_CARDS,
  createPlaybook,
  encodePlaybook,
  record,
  type Playbook,
} from '@/lib/playbook';

/** A full deck, taken from the front of the real card list. */
function deck(from = 0): Playbook {
  const ids = RULE_CARDS.slice(from, from + DECK_SIZE).map((card) => card.id);
  return createPlaybook('Sam', ids);
}

/** A different full deck, so a comparison has something to compare. */
function otherDeck(): Playbook {
  const ids = RULE_CARDS.slice(-DECK_SIZE).map((card) => card.id);
  return createPlaybook('Ada', ids);
}

function book(playbook: Playbook = deck()) {
  render(<PlaybookScreen playbook={playbook} onChange={() => {}} onBack={() => {}} />);
}

const testIt = () => userEvent.click(screen.getByRole('button', { name: /Test it/i }));

/** Paste a friend's deck and press the button that reads it in. */
async function pasteTheirs(code: string) {
  await userEvent.type(screen.getByRole('textbox', { name: 'PLAY-...' }), code);
  await userEvent.click(screen.getByRole('button', { name: 'Test theirs' }));
}

describe('backtesting a playbook', () => {
  afterEach(cleanup);

  it('runs the history only when the kid asks', async () => {
    /*
     * The comment on `mine` is explicit that testing is a deliberate act — two
     * hundred-odd backtests are cheap, but doing them unasked would turn a
     * decision into a readout.
     */
    book();
    expect(screen.queryByText(/hit rate/i)).not.toBeInTheDocument();
    await testIt();
    expect(screen.getByRole('button', { name: /Test it again/i })).toBeInTheDocument();
  });

  it('produces a real record over real windows', () => {
    /*
     * 224 windows of real market history. Asserted because the whole screen is
     * downstream of it: if the backtest ever returns nothing, every verdict
     * below becomes a sentence about no data.
     */
    const mine = record(deck());
    expect(mine.windows).toBeGreaterThan(100);
    expect(Number.isFinite(mine.winRate)).toBe(true);
    expect(Number.isFinite(mine.worstFall)).toBe(true);
  });
});

describe('comparing playbooks with a friend', () => {
  afterEach(cleanup);

  it('shows their deck once a code is pasted', async () => {
    book();
    await testIt();
    await pasteTheirs(encodePlaybook(otherDeck()));
    expect(screen.getByText(/Their playbook/i)).toBeInTheDocument();
  });

  it('refuses a code that is not a playbook, and says what to check', async () => {
    book();
    await testIt();
    await pasteTheirs('PLAY-NOT-A-REAL-CODE');
    expect(screen.getByText(/not right/i)).toBeInTheDocument();
    expect(screen.queryByText(/Their playbook/i)).not.toBeInTheDocument();
  });

  it('gives a verdict that weighs the worst stretch, not just the hit rate', async () => {
    book();
    await testIt();
    await pasteTheirs(encodePlaybook(otherDeck()));

    /*
     * Asserted as "a verdict exists and mentions the downside vocabulary"
     * rather than by matching one of the four sentences, because which branch
     * fires depends on real market history and would change with a data
     * refresh. What must not change is that the answer talks about more than
     * winning more often.
     */
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/worst|safer|steadier|deeper|rougher|same hit rate/i);
  });

  it('handles a friend whose deck is identical to yours', async () => {
    /*
     * The near-tie branch: `Math.abs(mine - theirs) < 0.03`. Identical decks
     * make it exact, which is the one input that guarantees the branch.
     */
    const same = deck();
    book(same);
    await testIt();
    await pasteTheirs(encodePlaybook(createPlaybook('Ada', same.ruleIds)));
    expect(screen.getByText(/Almost the same hit rate/i)).toBeInTheDocument();
  });
});
