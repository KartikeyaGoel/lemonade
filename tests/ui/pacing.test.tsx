/** @vitest-environment jsdom */
/**
 * How the game paces what it hands over, driven through the real app.
 *
 * `queueWords` and `handOverOne` are the enforcement of §26 — one card a day,
 * one word a day — and they are the two functions in `page.tsx` that decide
 * what a child is interrupted by. `handOverOne` exists because the listing
 * earns four words at once and putting four through the full-screen card
 * produced a stack of four panels over the biggest moment in the game, which
 * is the exact failure §26 records and had already fixed once.
 *
 * A pacing rule is invisible in a unit test and invisible in a screenshot. It
 * is only visible in a sequence: earn four things, and count the cards.
 *
 * Also here: the handlers reachable only from the live market and from a
 * finished run, which is everything `page.tsx` had left.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '@/app/page';
import { SAVE_VERSION, createGame, type Game } from '@/lib/progress';
import { createCareer } from '@/lib/career';
import { createBusinessState } from '@/lib/business';
import { createOwnershipState } from '@/lib/ownership';
import { createPortfolio, buy } from '@/lib/market';
import { createLivePortfolio } from '@/lib/live';
import { GLOSSARY } from '@/lib/glossary';
import { BADGES } from '@/lib/achievements';
import { UNLOCK_COPY } from '@/lib/unlocks';
import { SNAPSHOT } from '@/lib/companies';
import { QUANT_CLAIMS, QUAL_CLAIMS } from '@/lib/thesis';
import type { DayRecord } from '@/lib/simulation';

const body = () => document.body.textContent ?? '';

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

const find = (pattern: RegExp) => buttons().find((b) => pattern.test(b.textContent ?? ''));

async function must(pattern: RegExp, why: string): Promise<void> {
  const button = find(pattern);
  expect(
    button,
    `${why}: nothing matching ${pattern}. On screen: ${buttons()
      .map((b) => b.textContent)
      .join(' | ')
      .slice(0, 240)}`,
  ).toBeTruthy();
  await userEvent.click(button!);
}

async function maybe(pattern: RegExp): Promise<boolean> {
  const button = find(pattern);
  if (!button) return false;
  await userEvent.click(button);
  return true;
}

/** How many word cards are on screen right now. Should never be more than one. */
function wordCardsOnScreen(): number {
  return buttons().filter((b) => /WORD EARNED|New word/i.test(b.textContent ?? '')).length;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function saved(): any {
  return JSON.parse(window.localStorage.getItem('lemonade.save.v2') ?? '{}');
}

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
    cashAfter: 900,
    spoiledLemons: 0,
    marketShare: 1,
    seedBefore: 1,
    subscriberCups: 0,
    ...over,
  };
}

const history = Array.from({ length: 24 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 26 + (i % 5) * 4, subscriberCups: 10 }),
);

/**
 * A save, and a career that has *not* yet been told the later words.
 *
 * `learned: []` is the point of this file: every other suite gives the child
 * the whole glossary so the reward queues stay out of the way, which is
 * exactly what makes those suites unable to see the pacing.
 */
function seed(over: Partial<Game> = {}, extra: Record<string, string> = {}) {
  const base = createGame(4242);
  window.localStorage.setItem(
    'lemonade.save.v2',
    JSON.stringify({
      ...base,
      version: SAVE_VERSION,
      learned: [],
      pendingInsights: [],
      daysTraded: history.length,
      stageStartDay: 7,
      stand: { ...base.stand, day: history.length + 1, cash: 1400, history },
      ...over,
    }),
  );
  window.localStorage.setItem(
    'lemonade.career.v1',
    JSON.stringify({
      ...createCareer('Ada'),
      badges: BADGES.map((b) => b.id),
      words: [],
      announced: Object.keys(UNLOCK_COPY),
      seasons: 2,
      lifetimeDays: 30,
    }),
  );
  for (const [k, v] of Object.entries(extra)) window.localStorage.setItem(k, v);
}

async function boot(): Promise<void> {
  render(<Page />);
  await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.getByText(/folding table/i)).toBeInTheDocument());
}

async function resume(): Promise<void> {
  await boot();
  await must(/Keep going/, 'resuming the run');
}

async function playOutTheDay(): Promise<void> {
  vi.useFakeTimers();
  try {
    // Stage 1 hands the pace to the child, so the day offers a way in
    // rather than a way to hurry. Either door gets a test through it.
    const hurry = find(/Tap to speed up|Let the rest come/);
    if (hurry) fireEvent.click(hurry);
    for (let i = 0; i < 80; i++) {
      /*
       * The lunchtime question, answered by holding the price.
       *
       * A day now stops halfway and asks, and it stops for a hurrying child
       * too — that is the point of it. So a harness that drives a day has to
       * answer, exactly as a child does. "Keep" is chosen because it is the
       * answer that changes nothing, which keeps every figure these tests
       * assert on identical to what it was before the beat existed.
       */
      const lunch = find(/^Keep \$/);
      if (lunch) fireEvent.click(lunch);
      const done = find(/Count up the money/);
      if (done) {
        fireEvent.click(done);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        return;
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
    }
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('one card at a time, however many were earned at once', () => {
  /*
   * The listing earns four words in one beat: shares, share price, market cap,
   * going public. `handOverOne` gives the child the first and parks the rest.
   * The assertion is a *count*, taken at every step: never two cards at once,
   * and nothing silently dropped.
   */
  it('hands over one word for a float that earned several', async () => {
    seed({
      act: 4,
      ownership: {
        ...createOwnershipState(),
        comparisonAnswered: true,
        comparisonChoiceId: 'sam',
        passedOnOverpriced: true,
      },
    });
    await resume();

    // To the listing, counting cards on the way.
    for (let step = 0; step < 40 && !/Two ways out/i.test(body()); step++) {
      expect(wordCardsOnScreen(), 'two word cards at once').toBeLessThanOrEqual(1);
      if (await maybe(/Got it|TAP TO CLOSE|BADGE EARNED|WORD EARNED/i)) continue;
      if (find(/Tap to speed up|Let the rest come|Wave them over|Hurrying|Count up the money/)) {
        await playOutTheDay();
        continue;
      }
      const moved =
        (await maybe(/Let your manager run it/)) ||
        (await maybe(/Open the stand!/)) ||
        (await maybe(/Open up today|Open up shop/)) ||
        (await maybe(/Go shopping/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/asking price/)) ||
        (await maybe(/That one|Back to your own stand/)) ||
        (await maybe(/Start day \d+|See your week|Carry on|Keep going|Let's go/));
      if (!moved) break;
    }
    expect(body(), 'never reached the listing').toMatch(/Two ways out/i);

    await must(/^30%$|^40%$/, 'setting the float');
    await must(/Ring the bell/, 'floating the company');

    // One card now. The rest are parked for the days after it.
    expect(wordCardsOnScreen(), 'a stack of cards over the float').toBeLessThanOrEqual(1);
    await waitFor(() => expect(saved().listing.listed).toBe(true));
    const parked = saved().pendingInsights ?? [];
    expect(Array.isArray(parked)).toBe(true);

    // Nothing lost: what was handed over plus what was parked covers it all.
    const known = new Set<string>([
      ...(saved().learned ?? []),
      ...parked.map((insight: { id: string }) => insight.id),
    ]);
    expect(known.size, 'the float taught nothing at all').toBeGreaterThan(0);

    // Drain the queue: still one at a time.
    for (let i = 0; i < 12; i++) {
      expect(wordCardsOnScreen()).toBeLessThanOrEqual(1);
      if (!(await maybe(/Got it|TAP TO CLOSE|WORD EARNED|BADGE EARNED/i))) break;
    }
  }, 60_000);

  /*
   * And the queue survives a reload, because a child who closes the tab
   * mid-week is still owed the words the week earned.
   */
  it('keeps a parked word across a reload', async () => {
    seed({
      act: 2,
      pendingInsights: [
        {
          id: GLOSSARY[0].id,
          term: GLOSSARY[0].word,
          evidence: 'You did the thing.',
          carriesForward: 'And it means this.',
        } as never,
      ],
    });
    await boot();
    expect(saved().pendingInsights.length, 'the parked word was dropped on boot').toBe(1);
  }, 30_000);
});

describe('the manager shortcut', () => {
  /*
   * "Let your manager run it" skips the dials entirely — the point of paying a
   * wage is that the day happens without you. It is its own handler and its
   * own path through `closeDay`.
   */
  it('runs a day without the child touching a dial', async () => {
    seed({
      act: 2,
      business: {
        ...createBusinessState(),
        staff: { helper: false, manager: true },
        handsOffDays: 2,
      },
    });
    await resume();

    // Get to a close screen, which is where the shortcut is offered.
    for (let step = 0; step < 24 && !find(/Let your manager run it/); step++) {
      if (await maybe(/Got it|TAP TO CLOSE|BADGE EARNED|WORD EARNED/i)) continue;
      if (find(/Tap to speed up|Let the rest come|Wave them over|Hurrying|Count up the money/)) {
        await playOutTheDay();
        continue;
      }
      const moved =
        (await maybe(/Open the stand!/)) ||
        (await maybe(/Open up today|Open up shop/)) ||
        (await maybe(/Go shopping/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/Start day \d+|See your week|Carry on/));
      if (!moved) break;
    }
    expect(find(/Let your manager run it/), 'the manager was never offered').toBeTruthy();

    const before = Number(saved().stand.history.length);
    const handsOffBefore = Number(saved().business.handsOffDays);
    await must(/Let your manager run it/, 'handing the day over');
    await playOutTheDay();
    for (let i = 0; i < 10; i++) if (!(await maybe(/Got it|TAP TO CLOSE|WORD EARNED|BADGE EARNED/i))) break;
    await maybe(/Start day \d+|See your week|Carry on/);

    await waitFor(() =>
      expect(Number(saved().stand.history.length), 'the manager’s day was not banked').toBeGreaterThan(
        before,
      ),
    );

    /*
     * It counts as a hands-off day — up on a profit, down on a loss.
     *
     * This used to assert the streak never went backwards, and it passed for a
     * reason that was a bug. `game.stand` was advanced only in `closeDay`, so
     * at a close screen the stand was still sitting on that morning. Handing
     * over from there ran `openStand` against the *pre-day* state: the day the
     * child had just played was silently discarded and replayed under the
     * manager, on the same seed and so the same weather — and because the
     * counters had already been banked for it, one calendar day moved the
     * hands-off streak twice. A child could fill the streak by tapping the
     * shortcut without a day passing.
     *
     * With the transition in one place (`src/lib/day.ts`) the day is banked
     * before the close screen renders, so the shortcut starts *tomorrow*,
     * which is what the arrow on the button always said it did. Tomorrow has
     * its own weather, and `updateHandsOff` ticks down by one on a loss — so
     * the honest property is that the day was **counted**, in whichever
     * direction it earned.
     */
    const days = saved().stand.history as Array<{ profit: number }>;
    const managersDay = days[days.length - 1];
    const handsOffAfter = Number(saved().business.handsOffDays);
    expect(
      handsOffAfter,
      `the manager made $${managersDay.profit} and the streak went ${handsOffBefore} → ${handsOffAfter}`,
    ).toBe(managersDay.profit > 0 ? handsOffBefore + 1 : Math.max(0, handsOffBefore - 1));
  }, 60_000);

  it('starts tomorrow rather than replaying the day on screen', async () => {
    /*
     * The bug above, pinned on its own so it cannot come back quietly.
     *
     * The shortcut sits on the close screen next to "Start day N →". Both are
     * ways of leaving that screen and both must leave it forward. What made
     * the old behaviour hard to see is that it looked right: a day appeared, it
     * had a plausible result, and the only tell was that the seed had not
     * moved, so the weather was yesterday's again.
     */
    seed({
      act: 2,
      business: {
        ...createBusinessState(),
        staff: { helper: false, manager: true },
        handsOffDays: 1,
      },
    });
    await resume();

    for (let step = 0; step < 24 && !find(/Let your manager run it/); step++) {
      if (await maybe(/Got it|TAP TO CLOSE|BADGE EARNED|WORD EARNED/i)) continue;
      if (find(/Tap to speed up|Let the rest come|Wave them over|Hurrying|Count up the money/)) {
        await playOutTheDay();
        continue;
      }
      const moved =
        (await maybe(/Open the stand!/)) ||
        (await maybe(/Open up today|Open up shop/)) ||
        (await maybe(/Go shopping/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/Start day \d+|See your week|Carry on/));
      if (!moved) break;
    }
    expect(find(/Let your manager run it/), 'the manager was never offered').toBeTruthy();

    /*
     * The day on screen is already in the history by the time the shortcut is
     * offered, which is the whole fix: there is nothing left to replay.
     */
    const bankedBefore = (saved().stand.history as Array<{ day: number }>).map((d) => d.day);

    await must(/Let your manager run it/, 'handing the day over');
    await playOutTheDay();
    for (let i = 0; i < 10; i++) if (!(await maybe(/Got it|TAP TO CLOSE|WORD EARNED|BADGE EARNED/i))) break;

    await waitFor(() => {
      const after = (saved().stand.history as Array<{ day: number }>).map((d) => d.day);
      expect(after.length, 'the handed-over day was not banked').toBe(bankedBefore.length + 1);
      // A genuinely new day, not the one that was on screen a second ago.
      expect(
        new Set(after).size,
        `the same day was banked twice: ${after.join(',')}`,
      ).toBe(after.length);
    });
  }, 60_000);
});

describe('the end-of-week fork on a stage boundary', () => {
  /*
   * The fork now fires on the last day of a stage as well as every seventh
   * day, because sensible play finishes the stands stage on day five or six
   * and so never reached it — see `afterDay` in `src/lib/day.ts`.
   *
   * That created a second, sharper bug, and it is the reason this test is at
   * the UI level rather than in `tests/day.test.ts`: the fork now has to be
   * able to hand over to the *next act*, and the routing helper was reading
   * the game off a React closure. So `setGame` applied the child's choices,
   * routing ran against the pre-fork game, and `beginAct3` overwrote them —
   * sixteen neighbours signed up and silently thrown away. No pure test could
   * have seen it. It was found by ticking the box in a browser and reading the
   * save.
   */
  it('keeps what the child chose when the stage hands over', async () => {
    seed({
      act: 2,
      business: {
        ...createBusinessState(),
        staff: { helper: false, manager: true },
        upgrades: { cooler: true, bigSign: true, freshSqueeze: true },
        handsOffDays: 5,
        stands: [
          { id: 'home', location: 'sidewalk', open: true },
          { id: 'second', location: 'park', open: true },
        ],
        twoStandDays: 1,
      } as never,
    });
    await resume();

    /* Play whatever day we land on until the fork appears. */
    for (let step = 0; step < 30 && !find(/Leave it|Take it/); step++) {
      if (await maybe(/Got it|TAP TO CLOSE|BADGE EARNED|WORD EARNED/i)) continue;
      if (find(/Tap to speed up|Let the rest come|Count up the money|Hurrying/)) {
        await playOutTheDay();
        continue;
      }
      const moved =
        (await maybe(/Open the stand!/)) ||
        (await maybe(/Open up today|Open up shop/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/Start day \d+|See your week|Carry on/));
      if (!moved) break;
    }

    expect(body(), 'the stage ended without offering the fork').toMatch(/Keep it or grow it/i);

    /* Sign up the round — the mechanic that was unreachable for good play. */
    const expected = body().match(/About (\d+) would say yes/);
    expect(expected, 'the fork did not offer the round').toBeTruthy();
    await must(/signing up regulars/i, 'ticking the round');
    await must(/Leave it|Take it/, 'committing the choice');

    await waitFor(() => {
      expect(
        Number(saved().business.regulars),
        'the neighbours signed up at the fork were discarded by the act handover',
      ).toBe(Number(expected![1]));
    });
    expect(Number(saved().business.roundDrives)).toBe(1);
  }, 60_000);
});

describe('the real market, which is a different account', () => {
  /*
   * A buy in the live market goes through the same reason screen and the same
   * thesis, but into a *different* portfolio — one that outlives the season.
   * Getting that wrong would put a child's practice trade into their real
   * account or the other way round, so it is its own handler.
   */
  it('buys in the live account without touching the run', async () => {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = { ...portfolio, week: 12, status: 'closed' };
    seed(
      {
        act: 5,
        portfolio,
        learned: GLOSSARY.map((w) => w.id),
        ownership: {
          ...createOwnershipState(),
          buyoutAccepted: true,
          buyoutProceeds: 1500,
          buyoutMultiple: 8,
          buyoutPrice: 1500,
        },
      },
      { 'lemonade.live.v1': JSON.stringify({ ...createPortfolio(800, 99), live: true }) },
    );
    await boot();
    await must(/Real market/, 'opening the live account');
    await maybe(/Go to the market/);

    const claim = QUANT_CLAIMS[0];
    const company = SNAPSHOT.find((c) => claim.holds(c, c.price, '2026-09-01')) ?? SNAPSHOT[0];
    await must(new RegExp(company.ticker), 'opening a live company card');
    await must(/^Buy /, 'starting a live buy');
    await must(new RegExp(claim.label.slice(0, 20)), 'picking a number reason');
    const story = QUAL_CLAIMS.find((c) => !c.bearish)!;
    await must(new RegExp(story.label.slice(0, 20)), 'picking a story reason');
    await must(/→/, 'confirming the live buy');

    // The live account moved; the run's portfolio did not.
    await waitFor(() => {
      const live = JSON.parse(window.localStorage.getItem('lemonade.live.v1') ?? '{}');
      expect(Object.keys(live.holdings ?? {}).length, 'the live buy went nowhere').toBeGreaterThan(
        0,
      );
    });
    expect(
      Object.keys(saved().portfolio.holdings ?? {}).length,
      'a live buy landed in the run’s portfolio',
    ).toBe(0);
  }, 60_000);

  it('sells in the live account too', async () => {
    /*
     * Anchored the way the app anchors it — `createLivePortfolio` sits on the
     * newest week, where `createPortfolio` sits in the replay window and the
     * holding would belong to a different set of prices.
     *
     * And the stake is under the position cap. A $300 buy out of $800 is 37%
     * of the account and `maxSpendOn` refuses it, correctly: no single company
     * gets a quarter of a child's money. The first version of this fixture was
     * silently buying nothing.
     */
    let live = createLivePortfolio(2000);
    const bought = buy(live, SNAPSHOT[0].ticker, 300);
    expect(bought.ok, `the fixture’s own buy was refused: ${bought.reason ?? ''}`).toBe(true);
    live = bought.portfolio;
    seed(
      {
        act: 5,
        portfolio: { ...createPortfolio(1500, 4242), week: 12, status: 'closed' },
        learned: GLOSSARY.map((w) => w.id),
      },
      { 'lemonade.live.v1': JSON.stringify({ ...live, live: true }) },
    );
    await boot();
    await must(/Real market/, 'opening the live account');
    await maybe(/Go to the market/);
    await must(new RegExp(SNAPSHOT[0].ticker), 'opening a held live company');
    const before = JSON.parse(window.localStorage.getItem('lemonade.live.v1') ?? '{}').cash;
    await must(/Sell/, 'selling in the live account');
    await waitFor(() => {
      const after = JSON.parse(window.localStorage.getItem('lemonade.live.v1') ?? '{}').cash;
      expect(after, 'the live sale did not settle').toBeGreaterThan(before);
    });
  }, 60_000);
});

describe('the market a child arrives at, from either ending', () => {
  /*
   * Two doors into the market and they are not the same story: a founder who
   * listed still owns most of a company and has a price of their own; one who
   * sold up has money and no business. Telling the second one they have a
   * price of their own would be a sentence about somebody else's run.
   *
   * The greeting is on the stage's opening screen, so it is only reachable by
   * *finishing* the stage before it — which is the point: it is the sentence
   * that names what just happened.
   */
  async function finishAct4(how: 'list' | 'sell'): Promise<void> {
    seed({
      act: 4,
      learned: GLOSSARY.map((w) => w.id),
      ownership: {
        ...createOwnershipState(),
        comparisonAnswered: true,
        comparisonChoiceId: 'sam',
        passedOnOverpriced: true,
      },
    });
    await resume();
    for (let step = 0; step < 40 && !/Two ways out/i.test(body()); step++) {
      if (await maybe(/Got it|TAP TO CLOSE|BADGE EARNED|WORD EARNED/i)) continue;
      if (find(/Tap to speed up|Let the rest come|Wave them over|Hurrying|Count up the money/)) {
        await playOutTheDay();
        continue;
      }
      const moved =
        (await maybe(/Let your manager run it/)) ||
        (await maybe(/Open the stand!/)) ||
        (await maybe(/Open up today|Open up shop/)) ||
        (await maybe(/Go shopping/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/Start day \d+|See your week|Carry on|Keep going|Let's go/));
      if (!moved) break;
    }
    expect(body(), 'never reached the listing decision').toMatch(/Two ways out/i);

    if (how === 'list') {
      await must(/^30%$|^40%$/, 'setting the float');
      await must(/Ring the bell/, 'floating');
    } else {
      await must(/Sell the lot/, 'opening the buyout');
      await must(/^Sell for/, 'selling up');
    }
    // Onward until the market's own opening screen.
    for (let step = 0; step < 30; step++) {
      if (/price of your own|money and no business/i.test(body())) return;
      if (await maybe(/Got it|TAP TO CLOSE|BADGE EARNED|WORD EARNED/i)) continue;
      if (find(/Tap to speed up|Let the rest come|Wave them over|Hurrying|Count up the money/)) {
        await playOutTheDay();
        continue;
      }
      const moved =
        (await maybe(/Trade a week|Carry on|Keep going|Let's go|Next/)) ||
        (await maybe(/Let your manager run it|Open the stand!|Open up today|Open up shop/)) ||
        (await maybe(/Go shopping/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/Start day \d+|See your week/));
      if (!moved) break;
    }
  }

  it('tells a founder who listed that they have a price of their own', async () => {
    await finishAct4('list');
    expect(body(), 'the listed founder was not told they have a price').toMatch(
      /price of your own/i,
    );
  }, 60_000);

  it('tells a founder who sold up that they have money and no business', async () => {
    await finishAct4('sell');
    expect(body(), 'the founder who sold up was told they still have a price').toMatch(
      /money and no business/i,
    );
  }, 60_000);
});
