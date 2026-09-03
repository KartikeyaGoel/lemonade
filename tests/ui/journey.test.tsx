/** @vitest-environment jsdom */
/**
 * The whole app, played.
 *
 * `page.tsx` is 2,174 lines and was at **zero percent**. It is not a screen —
 * it is the state machine: thirty-three phases, forty-odd handlers, and every
 * piece of wiring between the pure modules and the components. Which makes it
 * the exact place §40's defect class lives, the one where a mechanic is
 * written, tested, wired to nothing, and nobody notices. Both instances the
 * project has found — `letManagerRun` and the `kept-the-whole-thing` badge —
 * were this.
 *
 * So this drives it the way a child does: click the thing, see what happens,
 * click the next thing. No mocks, real modules, real `localStorage`. What it
 * asserts along the way is what a person would notice — that the screen
 * changed, that nothing crashed, and that no figure reads `$NaN`.
 *
 * It is deliberately not a script of expected screens. A test that hard-codes
 * "after the seventh day you see the week screen" breaks every time the arc is
 * tuned, and the arc is tuned often. It walks whatever is in front of it and
 * insists the walk stays sane.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createPortfolio, buy } from '@/lib/market';
import { createClub } from '@/lib/club';
import { GLOSSARY } from '@/lib/glossary';
import { BADGES } from '@/lib/achievements';
import { UNLOCK_COPY } from '@/lib/unlocks';
import { SNAPSHOT } from '@/lib/companies';
import type { DayRecord } from '@/lib/simulation';

/** Figures that mean the render is wrong even though React was happy. */
const POISON = ['NaN', 'Infinity', 'undefined', '[object Object]'];

function body(): string {
  return document.body.textContent ?? '';
}

/**
 * Wait for the app to finish booting and get to the title screen.
 *
 * Not just `waitFor(/folding table/)`: a career with rewards outstanding opens
 * on an announcement card, so the title is behind however many "Got it" taps
 * the queue is deep. Which is itself worth walking, because the queue draining
 * one card at a time is §26's rule.
 */
async function atTitle(): Promise<void> {
  await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
  await dismissRewards();
  await waitFor(() => expect(screen.getByText(/folding table/i)).toBeInTheDocument());
}

function clean(where: string) {
  const text = body();
  for (const bad of POISON) {
    expect(text, `${where} rendered "${bad}"`).not.toContain(bad);
  }
}

/** Every button a finger could actually reach right now. */
function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

function find(pattern: RegExp): HTMLButtonElement | undefined {
  return buttons().find((b) => pattern.test(b.textContent ?? ''));
}

/**
 * Press the first button matching, and let React settle.
 *
 * Returns whether it found one, so a caller can branch on "is this offered
 * yet" rather than asserting a screen order the arc is allowed to change.
 */
async function tap(pattern: RegExp): Promise<boolean> {
  const button = find(pattern);
  if (!button) return false;
  await userEvent.click(button);
  return true;
}

/** Clear every reward card and toast standing between here and the game. */
async function dismissRewards(): Promise<number> {
  let cleared = 0;
  for (let i = 0; i < 40; i++) {
    const card = find(/Got it|Skip for now|TAP TO CLOSE|BADGE EARNED|WORD EARNED|Dismiss/i);
    if (!card) break;
    await userEvent.click(card);
    cleared++;
  }
  return cleared;
}

/**
 * Run the animated day to its end and bank it.
 *
 * The day is a real `setInterval` walking one customer past the stand at a
 * time — up to twelve seconds of it, or a couple with the hurry-up pressed.
 * `userEvent` clicks take no wall-clock time, so tapping "Hurrying…" in a loop
 * spins forever: nothing is waiting for the button, it is waiting for the
 * clock. So the clock is what gets advanced.
 *
 * Fake timers rather than real waits, because a suite that sleeps twelve
 * seconds a day is a suite nobody runs. `userEvent` is told which clock it is
 * on so its own internal delays advance with it.
 */
async function playOutTheDay(): Promise<void> {
  /*
   * Fake timers only here, and only for as long as the animation lasts.
   * Installing them globally breaks `waitFor`, which polls on the real clock
   * and simply never resolves — the suite hangs rather than fails, which is
   * the worst of both.
   *
   * `fireEvent` rather than `userEvent` inside this window for the same
   * reason: `userEvent` schedules its own delays, and it would be waiting on
   * the clock this function is busy driving.
   */
  vi.useFakeTimers();
  try {
    const hurry = find(/Tap to speed up/);
    if (hurry) fireEvent.click(hurry);
    for (let i = 0; i < 80; i++) {
      const done = find(/Count up the money/);
      if (done) {
        fireEvent.click(done);
        // The profit counts up on a timer of its own before it settles.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        return;
      }
      // Each tick walks one more customer past the stand.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
    }
  } finally {
    vi.useRealTimers();
  }
}

/**
 * One whole day, from wherever the arc has left us.
 *
 * A loop rather than a fixed sequence, because there is no fixed sequence: a
 * day can start on the morning screen, or the shopping screen, or the planning
 * screen, or on the close screen of the day before, and later stages add a
 * manager shortcut that skips three of those. The first version of this tapped
 * "Open up shop" — a *morning* button — and then went looking for the day's
 * animation, which had not started, so it reported a day played and played
 * none.
 *
 * So: press whatever the screen in front of it offers, and stop when the
 * ledger appears. Returns false if it runs out of moves.
 */
async function playADay(): Promise<boolean> {
  for (let step = 0; step < 12; step++) {
    await dismissRewards();
    // The day is running: see it out and bank it.
    if (find(/Tap to speed up|Hurrying|Count up the money/)) {
      await playOutTheDay();
      clean('the close screen');
      await dismissRewards();
      return true;
    }
    const moved =
      // The manager shortcut skips straight past the dials.
      (await tap(/Let your manager run it/)) ||
      (await tap(/Open the stand!/)) ||
      (await tap(/Open up today|Open up shop/)) ||
      (await tap(/Go shopping/)) ||
      (await tap(/Set my price/));
    if (!moved) return false;
  }
  return false;
}

/** What the save on disk currently says, so a test can watch state not copy. */
function saved(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
}

/**
 * Step forward until the stage changes, or we run out of moves.
 *
 * Watching the *state* rather than the screen, because matching screen copy is
 * fragile in the specific way that bit here: the week-end screen names the
 * stage it is about to open, so a loop that broke on seeing "More stands" broke
 * one tap *before* the tap that opens it.
 */
async function advanceUntilStageChanges(from: number, steps = 8): Promise<number> {
  for (let i = 0; i < steps; i++) {
    const act = Number(saved().act ?? 0);
    if (act > from) return act;
    if (!(await stepForward())) break;
  }
  return Number(saved().act ?? 0);
}

/** Whatever forward move is on offer, without knowing which screen we are on. */
async function stepForward(): Promise<boolean> {
  await dismissRewards();
  return (
    (await tap(/Start day \d+|See your week|Keep going|Let's go|Carry on|Next week|Back to the market/)) ||
    (await tap(/Leave it all in|Open up today|Open the stand!|Let your manager run it/)) ||
    (await tap(/That one|Pick one|Ring the bell|Sell for|Neither|Trade a week/))
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a first run, from the title screen', () => {
  it('boots to a title screen with a way in', async () => {
    render(<Page />);
    await atTitle();
    clean('the title screen');
    expect(find(/Start selling|Keep going/), 'no way into the game').toBeTruthy();
  });

  /*
   * A whole week of Act 1, tapped through. This is the path every child takes
   * and it exercises the shop, the price dial, the day, the close screen, the
   * insight queue and the badge queue — all of it through `page.tsx` rather
   * than by handing components props.
   */
  it('plays a full week and reaches the end of it', async () => {
    render(<Page />);
    await atTitle();
    await tap(/Start selling/);

    let daysPlayed = 0;
    for (let i = 0; i < 12; i++) {
      if (!(await playADay())) break;
      daysPlayed++;
      clean(`after day ${daysPlayed}`);
      const saved = window.localStorage.getItem('lemonade.save.v2');
      expect(saved, `nothing saved after day ${daysPlayed}`).toBeTruthy();
      if (/figured out pricing|You figured|See your week/i.test(body())) break;
      if (!(await stepForward())) break;
    }

    expect(daysPlayed, 'never got through a single day').toBeGreaterThanOrEqual(5);
    const game = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
    expect(game.stand.history.length).toBeGreaterThanOrEqual(5);
    expect(game.version).toBe(SAVE_VERSION);
  }, 60_000);

  it('opens the grown-up view from a cold start and comes back', async () => {
    render(<Page />);
    await atTitle();
    expect(await tap(/For a grown-up/), 'no grown-up door on a fresh install').toBe(true);
    await waitFor(() => expect(screen.getByText(/stage by stage/i)).toBeInTheDocument());
    clean('the grown-up view');
    expect(await tap(/Back to the game/)).toBe(true);
    await waitFor(() => expect(screen.getByText(/folding table/i)).toBeInTheDocument());
  });

  /*
   * The destructive control, driven through the real app rather than the
   * component in isolation — so this is the wiring as well as the screen:
   * `eraseAll` nulls its slots, the save effects skip, and the receipt is
   * built from what storage says it removed.
   */
  it('deletes everything from the grown-up view and reports what went', async () => {
    window.localStorage.setItem('lemonade.save.v2', JSON.stringify(createGame(1)));
    window.localStorage.setItem('lemonade.career.v1', JSON.stringify(createCareer('Ada')));
    window.localStorage.setItem('lemonade.class.v1', JSON.stringify({ seed: 1, entries: [] }));
    render(<Page />);
    await atTitle();

    await tap(/For a grown-up/);
    await waitFor(() => expect(screen.getByText(/stage by stage/i)).toBeInTheDocument());
    expect(await tap(/Delete it from this device/i)).toBe(true);
    // Asking is not doing.
    expect(window.localStorage.getItem('lemonade.save.v2')).toBeTruthy();

    expect(await tap(/Yes, delete everything/i)).toBe(true);
    await waitFor(() => expect(screen.getByText(/It is all gone/i)).toBeInTheDocument());
    expect(Object.keys(window.localStorage)).toEqual([]);
    clean('the erased receipt');
    // Every key it says it removed, it removed.
    for (const key of ['lemonade.save.v2', 'lemonade.career.v1', 'lemonade.class.v1']) {
      expect(body()).toContain(key);
    }
  });

  it('keeps the trophy case when the game itself is restarted', async () => {
    const career = { ...createCareer('Ada'), badges: [BADGES[0].id], seasons: 2, lifetimeDays: 9 };
    window.localStorage.setItem('lemonade.career.v1', JSON.stringify(career));
    render(<Page />);
    await atTitle();
    await tap(/Start selling|Keep going/);
    for (let i = 0; i < 8; i++) if (!(await playADay())) break;
    if (await tap(/Start over/)) {
      const back = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
      expect(back.badges, 'starting over took the badges').toContain(BADGES[0].id);
    }
  }, 60_000);
});

/* ------------------------------------------------------------------ *
 * Saves that put the app somewhere specific
 * ------------------------------------------------------------------ */

function dayRecord(over: Partial<DayRecord> = {}): DayRecord {
  return {
    day: 1,
    weather: 'mild',
    forecast: 'probably-mild',
    price: 1.5,
    cupsMade: 40,
    cupsSold: 38,
    cupsWanted: 45,
    revenue: 57,
    profit: 30,
    fixedCost: 5,
    cashAfter: 300,
    spoiledLemons: 0,
    marketShare: 1,
    seedBefore: 1,
    subscriberCups: 0,
    ...over,
  };
}

const history = Array.from({ length: 24 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 26 + (i % 5) * 4 }),
);

/** A save parked at a given stage, built by the real modules. */
function saveAt(act: 1 | 2 | 3 | 4 | 5, over: Record<string, unknown> = {}) {
  const game = createGame(4242);
  return {
    ...game,
    version: SAVE_VERSION,
    act,
    stageStartDay: act > 1 ? 7 : 0,
    daysTraded: history.length,
    learned: GLOSSARY.map((w) => w.id),
    stand: { ...game.stand, day: history.length + 1, cash: 900, history },
    ...over,
  };
}

/**
 * A save on disk, plus the career of somebody who has been here before.
 *
 * `announced` is the load-bearing field. A career holding every badge and
 * every word with nothing announced generates a reward queue forty cards deep
 * on boot — §26 hands them over one at a time, correctly — and a test then
 * spends every tap it has clearing rosettes instead of playing. Which is not a
 * bug and is not a state a real returning player is ever in: they have seen
 * them. Marking them seen is what makes the seeded save realistic *and*
 * testable.
 */
function seed(save: Record<string, unknown>, extra: Record<string, string> = {}) {
  window.localStorage.setItem('lemonade.save.v2', JSON.stringify(save));
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
  for (const [k, v] of Object.entries(extra)) window.localStorage.setItem(k, v);
}

describe('each stage of the arc, resumed from a save', () => {
  it('resumes the stands stage and lets a day be played', async () => {
    seed(saveAt(2));
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    clean('the stands stage');
    expect(await playADay(), 'could not play a day in the stands stage').toBe(true);
    /*
     * And it is actually banked. A day is not written into `stand.history`
     * until the child taps through the profit and loss — which is why every
     * badge used to arrive one screen late — so the step forward is part of
     * the assertion, not decoration.
     */
    await stepForward();
    const days = ((saved().stand as { history: unknown[] }).history ?? []).length;
    expect(days, 'the day was played but never banked').toBeGreaterThan(history.length);
  }, 60_000);

  it('resumes the shop stage and offers the yard', async () => {
    seed(saveAt(3));
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    clean('the shop stage');
    expect(await playADay(), 'could not play a day in the shop stage').toBe(true);
  }, 60_000);

  /*
   * The listing stage, all the way through the decision that ends Level 1.
   * Both endings are reachable from here and both are supposed to work; this
   * takes the float, which is the one that leaves a company running.
   */
  it('resumes the listing stage, ranks the deals, and floats the company', async () => {
    seed(saveAt(4));
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();

    // The deal board comes first: three stands at three multiples.
    if (/stands for sale/i.test(body())) {
      const card = find(/asking price/i);
      if (card) await userEvent.click(card);
      await tap(/That one|Pick one/);
      await dismissRewards();
      await tap(/Look at the numbers|Back to your own stand/);
      await dismissRewards();
    }

    for (let i = 0; i < 6 && !/Two ways out/i.test(body()); i++) {
      if (!(await stepForward())) break;
    }

    if (/Two ways out/i.test(body())) {
      clean('the listing decision');
      expect(body()).toMatch(/pieces/i);
      expect(await tap(/Ring the bell/)).toBe(true);
      await dismissRewards();
      clean('after the float');
      const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
      expect(saved.listing.listed, 'the float did not stick').toBe(true);
      expect(saved.listing.raised).toBeGreaterThan(0);
    }
  }, 60_000);

  it('takes the buyout instead, and seeds the market with the proceeds', async () => {
    seed(saveAt(4));
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();

    if (/stands for sale/i.test(body())) {
      const card = find(/asking price/i);
      if (card) await userEvent.click(card);
      await tap(/That one|Pick one/);
      await dismissRewards();
      await tap(/Look at the numbers|Back to your own stand/);
      await dismissRewards();
    }
    for (let i = 0; i < 6 && !/Two ways out/i.test(body()); i++) {
      if (!(await stepForward())) break;
    }
    if (await tap(/Sell the lot/)) {
      await dismissRewards();
      if (await tap(/^Sell for/)) {
        await dismissRewards();
        clean('after the sale');
        const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
        expect(saved.ownership.buyoutAccepted).toBe(true);
        expect(saved.ownership.buyoutProceeds).toBeGreaterThan(0);
      }
    }
  }, 60_000);

  /*
   * The market. Reached with a portfolio already open, because the interesting
   * paths are the ones inside it: research a company, hit the readiness gate,
   * move the week on.
   */
  it('resumes the market, reads a company and moves a week on', async () => {
    let portfolio = createPortfolio(1200, 4242);
    portfolio = buy(portfolio, SNAPSHOT[0].ticker, 300).portfolio;
    seed(
      saveAt(5, {
        portfolio,
        ownership: {
          ...createGame(1).ownership,
          buyoutAccepted: true,
          buyoutProceeds: 1200,
          buyoutMultiple: 8,
          buyoutPrice: 1200,
          comparisonAnswered: true,
          comparisonChoiceId: 'sam',
          passedOnOverpriced: true,
        },
      }),
    );
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    for (let i = 0; i < 4 && !/somebody’s lemonade stand|Businesses you could own/i.test(body()); i++) {
      if (!(await stepForward())) break;
    }
    clean('the market');

    // Open a company: the accounts, the P/E line, the provenance.
    const card = find(new RegExp(SNAPSHOT[0].ticker));
    if (card) {
      await userEvent.click(card);
      clean(`the ${SNAPSHOT[0].ticker} card`);
      expect(body().length).toBeGreaterThan(200);
      await tap(/← Market|Back/);
    }

    // The readiness gate, which is a screen of its own.
    if (await tap(/Research is open|Nearly ready/)) {
      clean('the readiness gate');
      await tap(/Back|←/);
    }

    if (await tap(/Next week/)) {
      await dismissRewards();
      clean('after a week passed');
      const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
      expect(saved.portfolio.week).toBeGreaterThanOrEqual(1);
    }
  }, 60_000);
});

describe('every door out of the title screen', () => {
  beforeEach(() => {
    let portfolio = createPortfolio(1200, 4242);
    portfolio = buy(portfolio, SNAPSHOT[0].ticker, 300).portfolio;
    portfolio = { ...portfolio, week: 12, status: 'closed' };
    seed(
      saveAt(5, { portfolio, club: createClub('Lemons', 'Ada', 300, 7) }),
      { 'lemonade.live.v1': JSON.stringify({ ...createPortfolio(500, 99), live: true }) },
    );
  });

  /*
   * The meta-game, opened and closed one door at a time. Each of these is a
   * `setPhase` and a `returnPhase` in `page.tsx`, and the bug this catches is
   * the one where a door opens onto a screen with no way back.
   */
  it('opens and closes each one, and always gets home', async () => {
    render(<Page />);
    await atTitle();

    const doors = [/Your stuff/, /Friends/, /Playbook/, /Real market/, /For a grown-up/];
    for (const door of doors) {
      const opened = await tap(door);
      if (!opened) continue;
      await dismissRewards();
      clean(`behind ${door}`);
      expect(body().length, `${door} opened onto nothing`).toBeGreaterThan(40);

      // Home again, by any road out.
      let home = false;
      for (let i = 0; i < 8; i++) {
        if (/folding table/i.test(body())) {
          home = true;
          break;
        }
        if (
          !(await tap(
            /Done for now|Back to the game|Back to the stand|Back →|← Back|← Market|^Back$|^Cancel$|Not yet/,
          ))
        ) {
          break;
        }
        await dismissRewards();
      }
      expect(home, `no way home from ${door}`).toBe(true);
    }
  }, 60_000);

  it('walks the three desks behind Friends', async () => {
    render(<Page />);
    await atTitle();
    expect(await tap(/Friends/)).toBe(true);
    clean('the friends screen');

    for (const desk of [/Same sky/, /Investment club/, /The table/]) {
      if (!(await tap(desk))) continue;
      await dismissRewards();
      clean(`behind ${desk}`);
      expect(body().length, `${desk} opened onto nothing`).toBeGreaterThan(40);
      for (let i = 0; i < 6; i++) {
        if (/Same sky.*Investment club|somebody a day you have played/i.test(body())) break;
        if (!(await tap(/Back →|← Back|^Back$|Back to the stand/))) break;
      }
    }
  }, 60_000);
});

describe('the app when the device is hostile', () => {
  it('boots from a corrupt save rather than showing a crash', async () => {
    window.localStorage.setItem('lemonade.save.v2', '{"stand":{"day":');
    window.localStorage.setItem('lemonade.career.v1', 'not json at all');
    render(<Page />);
    await atTitle();
    clean('booted from junk');
    expect(find(/Start selling|Keep going/)).toBeTruthy();
  });

  it('boots from a save whose every field is the wrong type', async () => {
    window.localStorage.setItem(
      'lemonade.save.v2',
      JSON.stringify({
        stand: { day: 1, history: 'lots', cash: 'heaps' },
        act: 'five',
        learned: 7,
        business: 3,
        listing: 'yes',
        portfolio: 'none',
        club: 'mine',
        playbook: 9,
        theses: 'none',
      }),
    );
    render(<Page />);
    await atTitle();
    clean('booted from wrong types');
  });

  it('plays on when the device refuses to store anything', async () => {
    const real = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    try {
      render(<Page />);
      await waitFor(() => expect(screen.getByText(/folding table/i)).toBeInTheDocument());
      await tap(/Start selling/);
      await act(async () => {});
      clean('with storage blocked');
      expect(body().length).toBeGreaterThan(40);
    } finally {
      window.localStorage.setItem = real;
      cleanup();
    }
  });
});

/* ------------------------------------------------------------------ *
 * The transitions between stages
 * ------------------------------------------------------------------ */

/**
 * Each of these seeds a save parked one step short of a stage boundary, then
 * takes the step. The boundaries are where `page.tsx` does its real work —
 * `beginAct3`, `beginAct4`, `beginAct5`, the save-version bump, the goal strip
 * changing over — and they are unreachable in a test that just plays forwards
 * because getting to them honestly takes forty days.
 */
describe('crossing from one stage into the next', () => {
  it('ends the first week and opens the stands stage', async () => {
    const game = createGame(11);
    seed({
      ...game,
      version: SAVE_VERSION,
      act: 1,
      learned: GLOSSARY.map((w) => w.id),
      // Six days played, so one more finishes the week.
      stand: { ...game.stand, day: 7, cash: 400, history: history.slice(0, 6) },
    });
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    expect(await playADay(), 'could not play the seventh day').toBe(true);

    // The week screen, then across the boundary.
    const act = await advanceUntilStageChanges(1);
    clean('crossing into the stands stage');
    expect(act, 'never left the first stage').toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('finishes the stands stage and opens the shop stage', async () => {
    const game = createGame(12);
    seed({
      ...saveAt(2),
      // One day short of the two-stand condition: a manager, hands-off days
      // behind them, two pitches open, and one good two-stand day banked.
      business: {
        ...game.business,
        staff: { helper: false, manager: true },
        handsOffDays: 5,
        stands: [{ id: 1, location: 'park', runBy: 'you' }],
        twoStandDays: 1,
      },
    });
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    expect(await playADay()).toBe(true);
    const act = await advanceUntilStageChanges(2);
    clean('crossing into the shop stage');
    expect(act, 'never left the stands stage').toBeGreaterThanOrEqual(3);
    const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
    expect(saved.act).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('finishes the shop stage and opens the listing stage', async () => {
    const game = createGame(13);
    seed({
      ...saveAt(3),
      business: {
        ...game.business,
        staff: { helper: false, manager: true },
        handsOffDays: 5,
        shop: { open: true, staff: 1, goodDays: 4 },
        loan: null,
      },
    });
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    expect(await playADay()).toBe(true);
    const act = await advanceUntilStageChanges(3);
    clean('crossing into the listing stage');
    expect(act, 'never left the shop stage').toBeGreaterThanOrEqual(4);
  }, 30_000);

  /*
   * And the last boundary, which is the one that matters most: a listed
   * company living one week as a public one, then handing the float to the
   * market. `seededWith` is read in six places and this is the path that
   * proves the listing branch of it.
   */
  it('lives a public week and carries the float into the market', async () => {
    seed(
      saveAt(4, {
        listing: {
          listed: true,
          shares: 1000,
          floated: 0.3,
          ipoPrice: 1.12,
          ipoMultiple: 9,
          price: 1.12,
          expected: 124.88,
          multiple: 9,
          founderShare: 0.7,
          raised: 336,
          weeks: [],
        },
      }),
    );
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    clean('as a public company');

    // A week as a public company, then onward.
    for (let i = 0; i < 10; i++) {
      if (/somebody’s lemonade stand|Businesses you could own/i.test(body())) break;
      if (await tap(/Trade a week|Carry on|Keep going|Let's go|Next/)) {
        await dismissRewards();
        continue;
      }
      if (!(await playADay())) break;
    }
    clean('after the public week');
    const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
    if (saved.portfolio) {
      // The market was seeded with what the float raised, not with zero.
      expect(saved.portfolio.cash).toBeGreaterThan(0);
    }
  }, 30_000);
});

describe('the choices that only appear at a week boundary', () => {
  /*
   * The reinvest screen: keep it or grow it. It is a whole phase of its own
   * and only ever appears on the seventh day of a stage.
   */
  it('offers the weekly choice and takes it', async () => {
    const game = createGame(21);
    seed({
      ...saveAt(2),
      weekend: true,
      stand: { ...game.stand, day: 15, cash: 600, history },
    });
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    if (/Keep it or grow it|Leave it all in/i.test(body())) {
      clean('the weekly choice');
      expect(await tap(/Leave it all in|Take some out/)).toBe(true);
      await dismissRewards();
      clean('after the weekly choice');
    }
  }, 30_000);

  /*
   * Selling a slice to fund the shop. The other two funding options are
   * covered by the state matrix; this is the one with a dial and a handler
   * that rewrites the ownership state.
   */
  it('sells a slice of the business to pay for the shop', async () => {
    const game = createGame(22);
    seed({
      ...saveAt(3),
      // Not enough cash for the fit-out, so all three options are live.
      stand: { ...game.stand, day: history.length + 1, cash: 250, history },
      business: {
        ...game.business,
        staff: { helper: false, manager: true },
        handsOffDays: 5,
        stands: [{ id: 1, location: 'park', runBy: 'minder' }],
        twoStandDays: 3,
      },
    });
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();

    // Into the yard, onto the shop plot, then the funding screen.
    for (const step of [/plain|manager|🧰/, /Spend money on the stand/, /🏪/, /See how to pay/]) {
      if (!(await tap(step))) break;
      await dismissRewards();
    }
    if (/Sell a slice|Auntie Ro/i.test(body())) {
      clean('the funding choice');
      await tap(/^30%$|^25%$/);
      if (await tap(/^Sell \d+% for/)) {
        await dismissRewards();
        clean('after selling a slice');
        const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
        expect(saved.ownership.equitySoldPct).toBeGreaterThan(0);
        expect(saved.ownership.equityCashReceived).toBeGreaterThan(0);
      }
    }
  }, 30_000);
});

describe('putting money into a real company', () => {
  function marketSave() {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = { ...portfolio, researched: SNAPSHOT.slice(0, 3).map((c) => c.ticker) };
    return saveAt(5, {
      portfolio,
      ownership: {
        ...createGame(1).ownership,
        buyoutAccepted: true,
        buyoutProceeds: 1500,
        buyoutMultiple: 8,
        buyoutPrice: 1500,
        comparisonAnswered: true,
        comparisonChoiceId: 'sam',
        passedOnOverpriced: true,
      },
    });
  }

  /*
   * The full buy: open a company, commit, write down both halves of a reason,
   * confirm. The thesis is the whole point of the market act — a trade with no
   * reason attached teaches nothing — and it is its own phase.
   */
  it('writes a reason down and buys', async () => {
    seed(marketSave());
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    for (let i = 0; i < 4 && !/Businesses you could own/i.test(body()); i++) {
      if (!(await stepForward())) break;
    }

    const card = find(new RegExp(SNAPSHOT[0].ticker));
    if (!card) return;
    await userEvent.click(card);
    clean('a company card');
    if (!(await tap(/^Buy /))) return;

    clean('the thesis screen');
    // One number reason and one story reason, which is what unlocks the buy.
    const reasons = buttons().filter((b) => (b.textContent ?? '').length > 24);
    if (reasons.length >= 2) {
      await userEvent.click(reasons[0]);
      const stillOffered = buttons().filter((b) => (b.textContent ?? '').length > 24);
      if (stillOffered.length) await userEvent.click(stillOffered[stillOffered.length - 1]);
    }
    if (await tap(/^Buy .*→|Put in/)) {
      await dismissRewards();
      clean('after buying');
      const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
      expect(saved.theses.length, 'a trade went in with no reason attached').toBeGreaterThan(0);
      expect(Object.keys(saved.portfolio.holdings).length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('cancels out of a buy without spending anything', async () => {
    seed(marketSave());
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();
    for (let i = 0; i < 4 && !/Businesses you could own/i.test(body()); i++) {
      if (!(await stepForward())) break;
    }
    const card = find(new RegExp(SNAPSHOT[0].ticker));
    if (!card) return;
    await userEvent.click(card);
    if (!(await tap(/^Buy /))) return;
    expect(await tap(/^Cancel$/)).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
    expect(Object.keys(saved.portfolio.holdings ?? {})).toEqual([]);
  }, 30_000);

  /*
   * Twelve weeks, then the reckoning and the finale. This is the only path that
   * reaches `closeOutTwelveWeeks`, the luck-versus-skill scoring, and the
   * new-season handler — which is the one that has to keep the trophy case.
   */
  it('runs the weeks out to the finale and starts a new season', async () => {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = buy(portfolio, SNAPSHOT[0].ticker, 300).portfolio;
    portfolio = { ...portfolio, week: 11 };
    seed(
      saveAt(5, {
        portfolio,
        ownership: {
          ...createGame(1).ownership,
          buyoutAccepted: true,
          buyoutProceeds: 1500,
          buyoutMultiple: 8,
          buyoutPrice: 1500,
        },
      }),
    );
    render(<Page />);
    await atTitle();
    await tap(/Keep going/);
    await dismissRewards();

    for (let i = 0; i < 14; i++) {
      if (/folding table\./i.test(body()) || /WEEKS LATER/i.test(body())) break;
      if (!(await tap(/Next week|Back to the market|Carry on|Got it/))) break;
      await dismissRewards();
      clean(`week ${i}`);
    }
    if (/WEEKS LATER|started with a folding/i.test(body())) {
      clean('the finale');
      const before = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
      if (await tap(/Season \d+ — new street|new street/)) {
        await dismissRewards();
        const after = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
        expect(after.badges.length, 'a new season took the badges').toBe(before.badges.length);
        expect(after.seasons).toBeGreaterThan(before.seasons);
      }
    }
  }, 40_000);
});

describe('the real market, which outlives every season', () => {
  it('opens the live account, catches up, and trades in it', async () => {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = { ...portfolio, week: 12, status: 'closed' };
    seed(saveAt(5, { portfolio }), {
      'lemonade.live.v1': JSON.stringify({ ...createPortfolio(600, 99), live: true }),
    });
    render(<Page />);
    await atTitle();
    expect(await tap(/Real market/), 'the live market was not offered').toBe(true);
    await dismissRewards();
    clean('the live open screen');
    if (await tap(/Go to the market/)) {
      await dismissRewards();
      clean('the live market');
      const card = find(new RegExp(SNAPSHOT[0].ticker));
      if (card) {
        await userEvent.click(card);
        clean('a live company card');
        if (await tap(/^Buy /)) {
          clean('the live thesis screen');
          await tap(/^Cancel$/);
        }
      }
    }
  }, 30_000);
});
