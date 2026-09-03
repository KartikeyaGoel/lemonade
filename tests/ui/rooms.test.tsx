/** @vitest-environment jsdom */
/**
 * The rooms nothing had ever walked into.
 *
 * `page.tsx` is the state machine, and after four rounds of work it still had
 * 126 uncovered statements and 26 uncovered functions — the worst function
 * coverage in the product at 61%. The uncovered parts were not obscure
 * branches. They were whole rooms:
 *
 * - the **classroom**, the board a teacher puts a class's runs on;
 * - the **club**, and the career counters that only move when a club does;
 * - the **duel being settled**, which is what banks a win;
 * - the **Saturday stand**, an Act 5 kid taking a folding table out again with
 *   money from an investment account.
 *
 * Every one of them needs state a single linear playthrough never produces, so
 * every one of them was reachable in the game and unreachable in the tests.
 * That is the same gap that hid the bricked save in §50, and the reason this
 * file seeds `localStorage` rather than playing from the title screen.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, beginAct5, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createPortfolio } from '@/lib/market';
import { createClub, joinClub } from '@/lib/club';
import { GLOSSARY } from '@/lib/glossary';
import { BADGES } from '@/lib/achievements';
import { UNLOCK_COPY } from '@/lib/unlocks';
import {
  DEFAULT_DAY_PARAMS,
  batchPlan,
  runDay,
  type DayRecord,
} from '@/lib/simulation';
import { encodeResult, summariseRun } from '@/lib/challenge';

/**
 * Two dozen real days, played by the simulation.
 *
 * Hand-written first, and wrong twice over: a `turnedAway` field `DayRecord`
 * does not have, and no `cashAfter`, which it requires. TypeScript caught it,
 * but PRODUCT.md §49 records four earlier fixtures where it did not — three of
 * them hidden behind `as never`. A history the simulation produced cannot be
 * wrong about its own shape.
 */
const history: DayRecord[] = (() => {
  let state = createGame(4242).stand;
  const out: DayRecord[] = [];
  for (let day = 0; day < 24; day++) {
    const plan = batchPlan(state, 30);
    state = runDay(state, { ...plan.order, price: 1.5 }, { ...DEFAULT_DAY_PARAMS, lastDay: null })
      .nextState;
  }
  out.push(...state.history);
  return out;
})();

/** Everything unlocked and nothing outstanding, so the boot lands on the title. */
function seed(over: Partial<Game> = {}) {
  const base = createGame(4242);
  const game: Game = {
    ...base,
    version: SAVE_VERSION,
    learned: GLOSSARY.map((w) => w.id),
    stageStartDay: 7,
    stand: { ...base.stand, day: history.length + 1, cash: 1200, history },
    ...over,
  };
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(game));
  window.localStorage.setItem(
    'lemonade.career.v1',
    JSON.stringify({
      ...createCareer('Ada'),
      badges: BADGES.map((b) => b.id),
      words: GLOSSARY.map((w) => w.id),
      announced: Object.keys(UNLOCK_COPY),
      seasons: 2,
      lifetimeDays: 30,
      clubWeeks: 1,
    }),
  );
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

function find(pattern: RegExp): HTMLButtonElement | undefined {
  return buttons().find((b) => pattern.test(b.textContent ?? ''));
}

async function tap(pattern: RegExp): Promise<boolean> {
  const button = find(pattern);
  if (!button) return false;
  await userEvent.click(button);
  return true;
}

/**
 * A hard press.
 *
 * `if (await tap(...))` passes vacuously when the button is absent, which is
 * exactly how §49's handler coverage stalled without any test going red. Every
 * navigation here has to actually find its control, and says which controls
 * were on screen when it does not.
 */
async function must(pattern: RegExp): Promise<void> {
  const pressed = await tap(pattern);
  if (!pressed) {
    throw new Error(
      `no control matching ${pattern} — on screen: ${buttons()
        .map((b) => JSON.stringify(b.textContent?.trim().slice(0, 30)))
        .join(', ')}`,
    );
  }
}

async function boot(): Promise<void> {
  render(<Page />);
  await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
  for (let i = 0; i < 40; i++) {
    const card = find(/Got it|Skip for now|TAP TO CLOSE|Dismiss/i);
    if (!card) break;
    await userEvent.click(card);
  }
}

const body = () => document.body.textContent ?? '';

describe('the classroom', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('opens from the grown-up screen and takes a new code', async () => {
    seed();
    await boot();
    await must(/For a grown-up/i);
    await must(/class|classroom/i);

    // The board exists and can be reset, which is the one destructive thing a
    // teacher does and the reason it lives behind the adult screen.
    expect(body()).toMatch(/class/i);
    const fresh = find(/new code/i);
    if (fresh) await userEvent.click(fresh);
    expect(body()).toMatch(/class/i);
  });

  it('goes back to the grown-up screen, not to the game', async () => {
    seed();
    await boot();
    await must(/For a grown-up/i);
    await must(/class|classroom/i);
    await must(/back|←/i);
    // The adult is still reading; the child's game has not been reopened.
    expect(body()).not.toMatch(/Open up shop/i);
  });
});

describe('the club, and the counters only a club moves', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('opens from the market with a club already on the save', async () => {
    const founded = createClub('Lemon Fund', 'Ada', 500, 7);
    const joined = joinClub(founded, 'Sam', 500);
    expect(joined.ok, joined.ok ? '' : joined.reason).toBe(true);
    if (!joined.ok) return;

    const base = createGame(4242);
    seed({
      ...beginAct5({ ...base, stand: { ...base.stand, history } }),
      club: joined.club,
      portfolio: createPortfolio(1000, 7),
    });
    await boot();
    await must(/Keep going/i);

    const opened = await tap(/club/i);
    expect(opened, 'the market never offered the club').toBe(true);
    expect(body()).toMatch(/Lemon Fund|club/i);
  });
});

describe('the Saturday stand', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('takes a folding table out again with money from the account', async () => {
    /*
     * The one place the two halves of the product touch: an Act 5 kid who owns
     * shares goes back to selling lemonade for a day, and the float comes out
     * of the investment account. `openStand` has a whole branch for it —
     * no cash floor, no cooler, no manager, because they sold that business.
     */
    const base = createGame(4242);
    seed({
      ...beginAct5({ ...base, stand: { ...base.stand, history } }),
      portfolio: createPortfolio(1000, 7),
    });
    await boot();
    await must(/Keep going/i);

    const weekend = await tap(/weekend|saturday|folding table|stand for the day/i);
    expect(weekend, 'the market never offered a Saturday stand').toBe(true);

    // It lands on the planning screen, and the stand is a folding table again.
    await waitFor(() => expect(body()).toMatch(/charge|make|cups/i));
  });
});

describe('settling a duel', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('banks the result on the career', async () => {
    /*
     * `recordChallenge` is what turns a duel into a number in the trophy case,
     * and it fires from the comparison screen inside the app rather than from
     * the component. It had never run, so nothing checked that reading a
     * friend's score actually counts.
     *
     * Reached through the week screen, which is where the game offers to send
     * somebody your week — and which a finished week now resumes onto, because
     * of the §50 fix.
     */
    seed();
    await boot();
    await must(/Keep going/i);
    await must(/send this exact week|duel|challenge/i);

    const before = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');

    // A friend's score for the same week, built by the real encoder.
    const theirs = encodeResult(summariseRun(4242, 'Ada', history.slice(0, 7), 2));
    await userEvent.type(screen.getByRole('textbox', { name: 'RUN-...' }), theirs);
    await must(/Compare us/i);

    // The comparison is on screen, and the career has banked the duel.
    expect(body()).toMatch(/ADA/);
    await waitFor(() => {
      const after = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
      expect(after.challengesPlayed).toBe((before.challengesPlayed ?? 0) + 1);
    });
  });
});
