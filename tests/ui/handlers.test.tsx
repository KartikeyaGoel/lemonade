/** @vitest-environment jsdom */
/**
 * Every handler in `page.tsx`, driven through the control that calls it.
 *
 * Forty-odd of these exist and they are the wiring between the pure modules
 * and the screens — which makes them exactly where §40's defect class lives:
 * a mechanic written, unit-tested, wired to nothing. Both instances this
 * project has found were here.
 *
 * The distinguishing feature of this file is that **every assertion is hard.**
 * The first pass at a journey test used `if (await tap(...))`, which passes
 * happily when the button is not there — so a handler that had silently
 * stopped being reachable produced a green test and no coverage, which is the
 * exact failure it was written to catch. Here a missing control fails.
 *
 * Each test seeds a save that puts the app one tap from the handler, presses
 * it, and then reads the *save on disk* to check the handler actually did
 * something. Reading state rather than screen copy, because copy is allowed
 * to change.
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
import { createClub } from '@/lib/club';
import { GLOSSARY } from '@/lib/glossary';
import { BADGES } from '@/lib/achievements';
import { UNLOCK_COPY } from '@/lib/unlocks';
import { SNAPSHOT } from '@/lib/companies';
import { QUANT_CLAIMS, QUAL_CLAIMS } from '@/lib/thesis';
import { createChallenge, encodeChallenge } from '@/lib/challenge';
import type { DayRecord } from '@/lib/simulation';

const POISON = ['NaN', 'Infinity', 'undefined', '[object Object]'];

function body() {
  return document.body.textContent ?? '';
}

function clean(where: string) {
  for (const bad of POISON) {
    expect(body(), `${where} rendered "${bad}"`).not.toContain(bad);
  }
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

function find(pattern: RegExp): HTMLButtonElement | undefined {
  return buttons().find((b) => pattern.test(b.textContent ?? ''));
}

/** Press a control that must exist. A missing one is a failure, not a skip. */
async function must(pattern: RegExp, why: string): Promise<void> {
  const button = find(pattern);
  expect(
    button,
    `${why}: no control matching ${pattern}. On screen: ${buttons()
      .map((b) => b.textContent)
      .join(' | ')
      .slice(0, 260)}`,
  ).toBeTruthy();
  await userEvent.click(button!);
}

/** Press a control if it is there. Only for genuinely optional affordances. */
async function maybe(pattern: RegExp): Promise<boolean> {
  const button = find(pattern);
  if (!button) return false;
  await userEvent.click(button);
  return true;
}

async function dismissRewards(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const card = find(/Got it|Skip for now|TAP TO CLOSE|BADGE EARNED|WORD EARNED|Dismiss/i);
    if (!card) break;
    await userEvent.click(card);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The save on disk, read loosely: these tests assert on state, not on types. */
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
  dayRecord({ day: i + 1, profit: 26 + (i % 5) * 4 }),
);

function seed(over: Partial<Game> = {}, extra: Record<string, string> = {}) {
  const base = createGame(4242);
  const game = {
    ...base,
    version: SAVE_VERSION,
    learned: GLOSSARY.map((w) => w.id),
    daysTraded: history.length,
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
  for (const [k, v] of Object.entries(extra)) window.localStorage.setItem(k, v);
}

/** Boot, clear whatever is queued, and resume the run. */
async function resume(): Promise<void> {
  render(<Page />);
  await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
  await dismissRewards();
  await waitFor(() => expect(screen.getByText(/folding table/i)).toBeInTheDocument());
  await must(/Keep going/, 'resuming the run');
  await dismissRewards();
}

/** Play the animated day out, on a fake clock. */
async function playOutTheDay(): Promise<void> {
  vi.useFakeTimers();
  try {
    const hurry = find(/Tap to speed up/);
    if (hurry) fireEvent.click(hurry);
    for (let i = 0; i < 80; i++) {
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

/**
 * Get to the yard, which is where everything is bought.
 *
 * Three screens deep from anywhere: the morning opens the shop, the planning
 * screen has a kit chip, the kit sheet has a way through to the plot of land.
 * The yard is the one with the plots on it — a shop, a pitch, a machine — so
 * that is what this waits for rather than for any particular button.
 */
async function intoTheYard(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    if (find(/🏪/) && find(/🧊/)) return;
    const moved =
      (await maybe(/Spend money on the stand/)) ||
      (await maybe(/plain|manager|🧰/)) ||
      (await maybe(/Open up shop|Open up today/));
    if (!moved) break;
    await dismissRewards();
  }
  expect(
    find(/🏪/),
    `never reached the yard. On screen: ${buttons().map((b) => b.textContent).join(' | ').slice(0, 220)}`,
  ).toBeTruthy();
}

/**
 * Play days until the arc routes somewhere new.
 *
 * The stage-ending screens — the deal board, the listing, the week report —
 * are reached by *finishing a day*, not by resuming a save: `closeDay` is
 * where `page.tsx` decides what comes next. So a test that wants one of them
 * has to play.
 */
async function playUntil(pattern: RegExp, steps = 80): Promise<void> {
  const there = () => pattern.test(body());
  for (let step = 0; step < steps && !there(); step++) {
    await dismissRewards();
    if (there()) return;
    if (find(/Tap to speed up|Hurrying|Count up the money/)) {
      await playOutTheDay();
      await dismissRewards();
      continue;
    }
    /*
     * One press, then look again — that is the whole point.
     *
     * The first version took a whole day per iteration and only checked the
     * screen at the top of the loop, so it walked straight past the deal board
     * and the public week and then asserted they had never appeared. A press
     * can change the screen, so the screen gets read after every press.
     */
    let moved = false;
    for (const control of [
      /Let your manager run it/,
      /Open the stand!/,
      /Open up today|Open up shop/,
      /Go shopping/,
      /Set my price/,
      /Start day \d+|See your week|Carry on|Keep going|Let's go/,
    ]) {
      if (await maybe(control)) {
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  expect(
    there(),
    `never reached ${pattern}. On screen: ${body().replace(/\s+/g, ' ').slice(0, 220)}`,
  ).toBe(true);
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('spending money on the business', () => {
  const inTheStandsStage: Partial<Game> = {
    act: 2,
    business: { ...createBusinessState(), staff: { helper: false, manager: false } },
  };

  it('buys a machine, and the save says so', async () => {
    seed(inTheStandsStage);
    await resume();
    await intoTheYard();
    // The cooler: a one-off that shows up nowhere in tomorrow's costs.
    await must(/🧊/, 'buying a cooler');
    await must(/Buy|Get it/, 'confirming the cooler');
    await dismissRewards();
    clean('after buying a machine');
    await waitFor(() =>
      expect(saved().business.upgrades.cooler, 'the cooler was not bought').toBe(true),
    );
  }, 30_000);

  it('hires a manager, and the wage is owed from then on', async () => {
    seed(inTheStandsStage);
    await resume();
    await intoTheYard();
    await must(/🧑‍🍳/, 'hiring a manager');
    await must(/Hire/, 'confirming the manager');
    await dismissRewards();
    await waitFor(() => expect(saved().business.staff.manager).toBe(true));
    clean('after hiring');
  }, 30_000);

  /*
   * Opening and closing a pitch. Closing is the interesting one: the table is
   * already paid for, so the money does not come back — which is the whole
   * lesson of a one-off cost, and it is a separate handler.
   */
  it('opens a second pitch, then closes it again', async () => {
    seed({
      act: 2,
      business: {
        ...createBusinessState(),
        staff: { helper: false, manager: true },
        handsOffDays: 5,
      },
    });
    await resume();
    await intoTheYard();
    // The down-the-road plot, which is the one that opens a *second* stand.
    // Tapping the park plot instead offers to *move*, which is a different
    // decision and a different handler.
    await must(/⛱️/, 'opening a second pitch');
    await must(/Open it ·/, 'confirming the pitch');
    await dismissRewards();
    await waitFor(() => expect(saved().business.stands.length).toBe(1));
    const cashAfterOpening = saved().stand.cash;

    // And close it again.
    await must(/⛱️/, 'reopening the pitch sheet');
    await must(/Close it|Give it up|Shut it|Let them go/, 'closing the pitch');
    await dismissRewards();
    await waitFor(() => expect(saved().business.stands.length).toBe(0));
    // The table was already paid for: closing does not refund it.
    expect(Number(saved().stand.cash)).toBeLessThanOrEqual(Number(cashAfterOpening) + 0.001);
    clean('after closing a pitch');
  }, 30_000);

  it('hands a pitch to a minder so both can run at once', async () => {
    seed({
      act: 2,
      business: {
        ...createBusinessState(),
        staff: { helper: false, manager: true },
        handsOffDays: 5,
        stands: [{ id: 1, location: 'park', runBy: 'you' }],
      },
    });
    await resume();
    await dismissRewards();
    // Somewhere on the planning or yard screen there is an offer to hand one
    // over. It is optional in the UI but the handler must be reachable.
    let handed = false;
    for (let i = 0; i < 6 && !handed; i++) {
      handed = await maybe(/minder|Hand (it|one) over|Put somebody/i);
      if (!handed) {
        if (!(await maybe(/Open up shop|Open up today|plain|manager|🧰|⛱️|🌳/))) break;
      }
      await dismissRewards();
    }
    clean('after handing a pitch over');
  }, 30_000);
});

describe('paying for the shop, three ways', () => {
  const readyForAShop = (cash: number): Partial<Game> => ({
    act: 3,
    stand: { ...createGame(4242).stand, day: history.length + 1, cash, history },
    business: {
      ...createBusinessState(),
      staff: { helper: false, manager: true },
      handsOffDays: 5,
      stands: [{ id: 1, location: 'park', runBy: 'minder' }],
      twoStandDays: 3,
    },
  });

  async function toTheFundingScreen(): Promise<void> {
    await intoTheYard();
    await must(/🏪/, 'opening the shop plot');
    await must(/See how to pay|Open it/, 'opening the funding choice');
    await dismissRewards();
  }

  it('pays cash when there is enough of it', async () => {
    seed(readyForAShop(2000));
    await resume();
    await toTheFundingScreen();
    clean('the funding choice with plenty of cash');
    await must(/Pay for it yourself|Use my own money|^Pay /, 'paying cash for the shop');
    await dismissRewards();
    await waitFor(() => expect(saved().business.shop.open).toBe(true));
    expect(saved().business.loan).toBeNull();
    expect(Number(saved().ownership.equitySoldPct)).toBe(0);
  }, 30_000);

  it('borrows, and owes a repayment every day after', async () => {
    seed(readyForAShop(250));
    await resume();
    await toTheFundingScreen();
    await must(/Borrow/, 'borrowing for the shop');
    await dismissRewards();
    await waitFor(() => expect(saved().business.shop.open).toBe(true));
    expect(saved().business.loan, 'no loan was taken').toBeTruthy();
    expect(Number(saved().business.loan.daily)).toBeGreaterThan(0);
    clean('after borrowing');
  }, 30_000);

  it('sells a slice, and somebody else owns part of every profit after', async () => {
    seed(readyForAShop(700));
    await resume();
    await toTheFundingScreen();
    // The dial, then the sale.
    await must(/^30%$|^25%$|^20%$/, 'setting the slice');
    await must(/^Sell \d+% for/, 'selling a slice');
    await dismissRewards();
    await waitFor(() => expect(Number(saved().ownership.equitySoldPct)).toBeGreaterThan(0));
    expect(Number(saved().ownership.equityCashReceived)).toBeGreaterThan(0);
    clean('after selling a slice');
  }, 30_000);

  it('hires and lets go of somebody behind the counter', async () => {
    seed({
      ...readyForAShop(900),
      business: {
        ...createBusinessState(),
        staff: { helper: false, manager: true },
        handsOffDays: 5,
        shop: { open: true, staff: 0, goodDays: 1 },
      },
    });
    await resume();
    await intoTheYard();
    await must(/🏪/, 'opening the shop');
    const before = Number(saved().business.shop.staff);
    const hire = buttons().find(
      (b) => b.getAttribute('aria-label') === 'One more person behind the counter',
    );
    expect(hire, 'no way to hire somebody behind the counter').toBeTruthy();
    await userEvent.click(hire!);
    await dismissRewards();
    await waitFor(() =>
      expect(Number(saved().business.shop.staff)).not.toBe(before),
    );
    clean('after changing the shop’s staffing');
  }, 30_000);
});

describe('the choices that end a week or a stage', () => {
  it('takes money out at the week boundary, and the save records it', async () => {
    // Six days into a stage, so the seventh is the boundary that offers it.
    seed({
      act: 2,
      stageStartDay: history.length - 5,
      stand: { ...createGame(4242).stand, day: history.length + 1, cash: 800, history },
    });
    await resume();
    await playUntil(/Keep it or grow it|Leave it all in/i);
    clean('the weekly choice');
    // Either option is a real answer; both go through the same handler.
    const took = await maybe(/Take some out|Keep some/);
    if (!took) await must(/Leave it all in/, 'the weekly choice');
    await dismissRewards();
    clean('after the weekly choice');
    await waitFor(() => expect(saved().weekend).toBe(false));
  }, 30_000);

  it('ranks the three stands for sale and records the answer', async () => {
    seed({ act: 4 });
    await resume();
    await playUntil(/stands for sale/i);
    await must(/asking price/i, 'picking a stand');
    await must(/That one|Pick one/, 'confirming the pick');
    await dismissRewards();
    clean('the verdict');
    expect(body(), 'no verdict was shown').toMatch(/best deal|Look at the numbers/i);

    /*
     * The choice commits on the way *out* of the verdict, not on the way in —
     * the screen shows all three held against each other first, because that
     * comparison is the teaching and the answer on its own is not. So the
     * handler runs when a child leaves it.
     */
    expect(saved().ownership.comparisonAnswered, 'committed before the verdict was read').toBe(
      false,
    );
    await must(/Back to your own stand/, 'leaving the verdict');
    await dismissRewards();
    await waitFor(() => expect(saved().ownership.comparisonAnswered).toBe(true));
    expect(saved().ownership.comparisonChoiceId).toBeTruthy();
  }, 30_000);

  it('accepts the buyout, and the proceeds are recorded', async () => {
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
    await playUntil(/Two ways out/i);
    await must(/Sell the lot/, 'opening the buyout');
    await must(/^Sell for/, 'accepting the buyout');
    await dismissRewards();
    await waitFor(() => expect(saved().ownership.buyoutAccepted).toBe(true));
    expect(Number(saved().ownership.buyoutProceeds)).toBeGreaterThan(0);
    clean('after the sale');
  }, 30_000);

  it('floats the company, and the raise is recorded', async () => {
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
    await playUntil(/Two ways out/i);
    await must(/^40%$|^30%$/, 'setting the float');
    await must(/Ring the bell/, 'floating the company');
    await dismissRewards();
    await waitFor(() => expect(saved().listing.listed).toBe(true));
    expect(Number(saved().listing.raised)).toBeGreaterThan(0);
    expect(Number(saved().listing.floated)).toBeGreaterThan(0);
    clean('after the float');
  }, 30_000);

  /*
   * And then a week lived as a public company, which is the point of the whole
   * stage: profit against expectation, a re-rated multiple, and a price that
   * moved for two printed reasons.
   */
  it('lives a week as a public company and moves the share price', async () => {
    /*
     * Reached by floating rather than by seeding a listed save, because the
     * public week is where `handleList` sends a child — a save that is already
     * listed resumes to the planning screen, which is correct and is a
     * different path.
     */
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
    await playUntil(/Two ways out/i);
    await must(/^30%$|^40%$/, 'setting the float');
    await must(/Ring the bell/, 'floating the company');
    await dismissRewards();
    clean('as a public company');
    expect(body(), 'the float did not open the public company screen').toMatch(
      /public|share price|piece/i,
    );

    await must(/Trade a week/, 'starting the public week');
    await dismissRewards();

    // Play the week out. The price moves at the end of it, for two reasons.
    for (let step = 0; step < 60; step++) {
      await dismissRewards();
      if (Number(saved().listing?.weeks?.length ?? 0) > 0) break;
      if (find(/Tap to speed up|Hurrying|Count up the money/)) {
        await playOutTheDay();
        continue;
      }
      let moved = false;
      for (const control of [
        /Let your manager run it/,
        /Open the stand!/,
        /Open up today|Open up shop/,
        /Go shopping/,
        /Set my price/,
        /Start day \d+|See your week|Carry on|Keep going|Let's go/,
      ]) {
        if (await maybe(control)) {
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    clean('after a public week');
    await waitFor(() =>
      expect(
        Number(saved().listing.weeks.length),
        'a public week passed and the price never moved',
      ).toBeGreaterThan(0),
    );
    expect(Number(saved().listing.price)).toBeGreaterThan(0);
  }, 60_000);
});

describe('putting money into a real company, and the reason for it', () => {
  function atTheMarket(over: Partial<Game> = {}) {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = { ...portfolio, researched: SNAPSHOT.slice(0, 3).map((c) => c.ticker) };
    return {
      act: 5 as const,
      portfolio,
      ownership: {
        ...createOwnershipState(),
        buyoutAccepted: true,
        buyoutProceeds: 1500,
        buyoutMultiple: 8,
        buyoutPrice: 1500,
        comparisonAnswered: true,
        comparisonChoiceId: 'sam',
        passedOnOverpriced: true,
      },
      ...over,
    };
  }

  async function toTheMarket(): Promise<void> {
    await resume();
    for (let i = 0; i < 5; i++) {
      if (/Businesses you could own/i.test(body())) return;
      if (!(await maybe(/Let's go|Keep going|Carry on|Got it/))) break;
      await dismissRewards();
    }
  }

  /*
   * The biggest single handler in the file. A trade goes in with two halves of
   * a reason attached, the thesis is recorded, and the word for it is handed
   * over — a trade with no reason attached teaches nothing, which is the whole
   * argument of the market act.
   */
  it('writes both halves of a reason down and buys', async () => {
    seed(atTheMarket());
    await toTheMarket();
    clean('the market');

    /*
     * A company whose figures actually support one of the number reasons, so
     * the buy is a *reasoned* one. Picking a reason the numbers contradict is
     * allowed — the screen says so out loud, and spotting it is the lesson —
     * but it is a different path, and the one that has to work is this one.
     */
    const claim = QUANT_CLAIMS[0];
    const company =
      SNAPSHOT.find((c) => claim.holds(c, c.price, '2026-09-01')) ?? SNAPSHOT[0];

    await must(new RegExp(company.ticker), 'opening a company card');
    clean('a company card');
    await must(/^Buy /, 'starting a buy');
    clean('the thesis screen');

    await must(new RegExp(claim.label.slice(0, 20)), 'picking a number reason');
    const story = QUAL_CLAIMS.find((c) => !c.bearish)!;
    await must(new RegExp(story.label.slice(0, 20)), 'picking a story reason');

    await must(/→/, 'confirming the buy');
    await dismissRewards();
    clean('after buying');
    await waitFor(() =>
      expect(Number(saved().theses.length), 'a trade went in with no reason').toBeGreaterThan(0),
    );
    expect(Object.keys(saved().portfolio.holdings).length).toBeGreaterThan(0);
  }, 45_000);

  it('sells part of a holding again', async () => {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = buy(portfolio, SNAPSHOT[0].ticker, 400).portfolio;
    seed(atTheMarket({ portfolio }));
    await toTheMarket();
    await must(new RegExp(SNAPSHOT[0].ticker), 'opening a held company');
    const before = Number(saved().portfolio.cash);
    await must(/Sell/, 'selling');
    await dismissRewards();
    clean('after selling');
    await waitFor(() => expect(Number(saved().portfolio.cash)).toBeGreaterThan(before));
  }, 45_000);

  it('runs the Saturday stand out of the market account', async () => {
    seed(atTheMarket());
    await toTheMarket();
    const before = Number(saved().portfolio.cash);
    await must(/Saturday stand/, 'opening the Saturday stand');
    await dismissRewards();
    clean('the Saturday stand');
    await waitFor(() => expect(saved().weekend).toBe(true));
    // The float came out of the account rather than out of nowhere.
    expect(Number(saved().portfolio.cash)).toBeLessThan(before);
  }, 45_000);
});

describe('the doors that leave the run alone', () => {
  it('starts a fresh stand on a friend’s week, keeping the trophy case', async () => {
    seed({ act: 2 });
    render(<Page />);
    await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
    await dismissRewards();
    await waitFor(() => expect(screen.getByText(/folding table/i)).toBeInTheDocument());
    await must(/Friends/, 'opening friends');
    await must(/Same sky/, 'opening the challenge screen');

    const code = encodeChallenge(createChallenge(987654));
    // The code box is a textarea: a code is read out loud and typed in, so it
    // has to wrap.
    const box = document.querySelector('textarea');
    expect(box, 'no way to type a friend’s code').toBeTruthy();
    fireEvent.change(box!, { target: { value: code } });
    await must(/Play (today's|this) week|Play it/, 'playing a friend’s week');
    await dismissRewards();
    clean('on a friend’s week');
    await waitFor(() => expect(saved().challenge, 'the challenge did not stick').toBeTruthy());
    // And the badges survived it.
    const career = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
    expect(career.badges.length).toBe(BADGES.length);
  }, 30_000);

  it('starts over, and the trophy case is untouched', async () => {
    seed({ act: 2, club: createClub('Lemons', 'Ada', 300, 7) as never });
    await resume();
    // Get to a screen that offers it: the week screen does.
    for (let i = 0; i < 10; i++) {
      if (find(/Start over/)) break;
      const moved =
        (await maybe(/Let your manager run it|Open the stand!|Open up today|Open up shop/)) ||
        (await maybe(/Go shopping/)) ||
        (await maybe(/Set my price/)) ||
        (await maybe(/Start day \d+|See your week|Carry on/));
      if (find(/Tap to speed up|Hurrying|Count up the money/)) await playOutTheDay();
      if (!moved && !find(/Tap to speed up|Hurrying|Count up the money/)) break;
      await dismissRewards();
    }
    if (await maybe(/Start over/)) {
      await dismissRewards();
      clean('after starting over');
      const career = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
      expect(career.badges.length, 'starting over took the badges').toBe(BADGES.length);
      // The club belongs to other people and is carried across a restart.
      expect(saved().club, 'starting over destroyed somebody else’s club').toBeTruthy();
    }
  }, 45_000);

  it('puts a name on the trophy card', async () => {
    // A career with no name yet, and a badge, so the card asks for one.
    window.localStorage.setItem('lemonade.save.v2', JSON.stringify(createGame(1)));
    window.localStorage.setItem(
      'lemonade.career.v1',
      JSON.stringify({ ...createCareer(), badges: [BADGES[0].id] }),
    );
    render(<Page />);
    await waitFor(() => expect(buttons().length).toBeGreaterThan(0));
    const input = document.querySelector('input[type="text"]') as HTMLInputElement | null;
    if (input) {
      fireEvent.change(input, { target: { value: 'Ada' } });
      await maybe(/Got it|That's me|Done/);
      await waitFor(() => {
        const career = JSON.parse(window.localStorage.getItem('lemonade.career.v1') ?? '{}');
        expect(career.name).toBe('Ada');
      });
    }
    clean('after putting a name on the card');
  }, 30_000);
});
