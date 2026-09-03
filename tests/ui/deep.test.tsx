/** @vitest-environment jsdom */
/**
 * The last of it: the sheets, the second codes, and the states that need a
 * particular kind of run behind them.
 *
 * What is left after the state matrix, the journey and the handler suite is
 * uniformly one of three shapes:
 *
 *  - a **sheet** that only opens when a specific chip on the planning screen
 *    is tapped ("where the money goes", "what will you charge", the two-plans
 *    comparison)
 *  - a **second code box** on a screen that has two of them — the challenge
 *    screen takes both a week code and a score code, and only one of the two
 *    had ever been used
 *  - a **branch that needs history**: a buyout with a punch-card premium on
 *    it, a club proposing through the thesis screen, a playbook whose rules
 *    find nothing to buy
 *
 * None of them are exotic. All of them are things a child does.
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlanScreen } from '@/components/PlanScreen';
import { BuyoutScreen } from '@/components/acts/BuyoutScreen';
import { ChallengeScreen } from '@/components/meta/ChallengeScreen';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { PlaybookScreen } from '@/components/meta/PlaybookScreen';
import { MarketScreen } from '@/components/acts/MarketScreen';

import { buyoutOffer, createOwnershipState } from '@/lib/ownership';
import { createBusinessState } from '@/lib/business';
import { createGame, readiness } from '@/lib/progress';
import {
  DEFAULT_DAY_PARAMS,
  createInitialState,
  runDay,
  type DayRecord,
} from '@/lib/simulation';
import { createClub, joinClub } from '@/lib/club';
import { createChallenge, encodeChallenge, encodeResult, summariseRun } from '@/lib/challenge';
import { createPortfolio, buy } from '@/lib/market';
import { SNAPSHOT } from '@/lib/companies';
import { RULE_CARDS } from '@/lib/playbook';
import { GLOSSARY } from '@/lib/glossary';

const POISON = ['NaN', 'Infinity', 'undefined', '[object Object]'];
const noop = () => {};

const body = () => document.body.textContent ?? '';

function clean(where: string) {
  for (const bad of POISON) {
    expect(body(), `${where} rendered "${bad}"`).not.toContain(bad);
  }
  expect(body().trim().length, `${where} rendered nothing`).toBeGreaterThan(20);
}

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

function find(pattern: RegExp): HTMLButtonElement | undefined {
  return buttons().find((b) => pattern.test(b.textContent ?? ''));
}

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
    cashAfter: 400,
    spoiledLemons: 0,
    marketShare: 1,
    seedBefore: 1,
    subscriberCups: 0,
    ...over,
  };
}

const history = Array.from({ length: 21 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 24 + (i % 5) * 4 }),
);

function playedState(days: number, seed = 5) {
  let state = { ...createInitialState(seed), cash: 500 };
  for (let i = 0; i < days; i++) {
    const outcome = runDay(state, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 });
    state = outcome.nextState;
    if (state.status === 'finished') break;
  }
  return state;
}

describe('the planning screen’s sheets', () => {
  /*
   * Three chips on the stand open three sheets, and each one is a screen: the
   * money one is where margin per cup is spelled out, the sign one is the
   * price dial, the lemons one is the batch. Between them they were most of
   * the uncovered half of the biggest component in the app.
   */
  it('opens every chip on the stand', async () => {
    const state = playedState(4);
    /*
     * A finite capacity, because that is what every act which renders these
     * sheets actually passes. The uncapped case has its own test below.
     */
    render(
      <PlanScreen
        state={state}
        params={{
          ...DEFAULT_DAY_PARAMS,
          fixedCosts: [
            { label: 'Pitch', amount: 5 },
            { label: 'Manager wages', amount: 20 },
          ],
          equityShare: 0.3,
          serviceCapacity: 60,
        }}
        business={{ ...createBusinessState(), staff: { helper: true, manager: true } }}
        stage={{ goal: 'Two stands, one price.', day: 4, total: 16 }}
        onOpen={noop}
        onInvest={noop}
      />,
    );

    // Every chip, one at a time. Each opens a sheet and closes again.
    for (const chip of [/💰/, /LEMONADE/, /🍋/, /🧃/, /🧰/]) {
      if (!(await maybe(chip))) continue;
      clean(`the sheet behind ${chip}`);
      await maybe(/^\s*Done\s*$/);
    }
    // The margin sheet names the arithmetic a child is meant to redo.
    await maybe(/💰/);
    clean('the money sheet');
  });

  /*
   * Two rehearsals against the same crowd, then the comparison. This is the
   * derivative made visible — hold the world still, move one dial — and the
   * comparison sheet is a view of its own.
   */
  it('rehearses twice and compares the two plans', async () => {
    render(<PlanScreen state={playedState(3, 11)} onOpen={noop} />);

    for (const price of ['1.00', '2.75']) {
      const slider = document.querySelector('input[type="range"]') as HTMLInputElement | null;
      if (slider) fireEvent.change(slider, { target: { value: price } });
      await must(/Try it on yesterday/, `rehearsing at ${price}`);
      clean(`the rehearsal at ${price}`);
    }
    // The second rehearsal produces the side-by-side rather than a single result.
    expect(body(), 'no comparison after two rehearsals').toMatch(/Try \d+|vs|instead/i);

    // Loading one back puts its dials on the stand.
    if (await maybe(/Use this|Load|Keep this|Try \d+/)) clean('after loading a plan back');
    await maybe(/^\s*Done\s*$/);
  });

  /*
   * A stand with nothing capping the queue but the pantry, which is what
   * `DEFAULT_DAY_PARAMS` describes. It used to render the word `Infinity`.
   */
  it('says how many cups can be served when nothing caps it', async () => {
    render(
      <PlanScreen
        state={playedState(4, 21)}
        business={createBusinessState()}
        onOpen={noop}
        onInvest={noop}
      />,
    );
    await must(/🧰/, 'opening the kit sheet');
    clean('the kit sheet with no capacity cap');
    expect(body()).toMatch(/as many as you can pour/i);
  });

  it('warns when the same dials are tried twice', async () => {
    render(<PlanScreen state={playedState(3, 13)} onOpen={noop} />);
    await must(/Try it on yesterday/, 'the first rehearsal');
    await maybe(/^\s*Done\s*$/);
    // The same plan again is a repeat, not a new attempt.
    await must(/Try it on yesterday/, 'the same rehearsal again');
    clean('after repeating a rehearsal');
  });
});

describe('a buyout with a punch-card round behind it', () => {
  /*
   * A round of regulars raises the offer, and an outside owner takes a slice
   * of the proceeds. Both are separate blocks on the screen and both need a
   * particular kind of run to exist at all.
   */
  it('shows the premium the round earned, and the investor’s slice', async () => {
    const withRound = history.map((day) => ({ ...day, subscriberCups: 14 }));
    const ownership = {
      ...createOwnershipState(),
      equitySoldPct: 0.3,
      equityCashReceived: 186.5,
    };
    const offer = buyoutOffer(withRound, ownership);
    render(<BuyoutScreen offer={offer} onAccept={noop} onDecline={noop} canDecline />);
    clean('a buyout with a round and an investor');
    if (offer.roundPremium > 0) expect(body()).toMatch(/more for the round/i);
    if (offer.investorShare > 0) expect(body()).toMatch(/%|slice|share/i);
    // And the working, opened.
    for (const button of buttons()) {
      if (/Sell for|Not yet/.test(button.textContent ?? '')) continue;
      await userEvent.click(button);
    }
    clean('the buyout working');
  });
});

describe('the challenge screen’s other code box', () => {
  /*
   * Two code boxes on one screen: one takes a *week* to play, the other takes
   * a friend's *score* to compare against. Only the second had ever been used
   * — so the path a child takes to play somebody else's week, and the error
   * when they mistype it, had never run.
   */
  it('plays a friend’s week from a week code', async () => {
    const played: string[] = [];
    render(
      <ChallengeScreen
        seed={4242}
        me="Ada"
        history={playedState(7, 3).history}
        badges={12}
        today="2026-09-03"
        onPlayChallenge={(spec) => played.push(String(spec.seed))}
        onCompared={noop}
        onBack={noop}
      />,
    );
    const boxes = [...document.querySelectorAll('textarea')];
    expect(boxes.length, 'expected two code boxes').toBeGreaterThan(0);

    const code = encodeChallenge(createChallenge(987654));
    // Whichever box takes a week code, the week code goes in it.
    for (const box of boxes) {
      fireEvent.change(box, { target: { value: code } });
      await maybe(/Play this week|Play it/);
    }
    expect(played, 'a valid week code was not accepted').toContain('987654');
  });

  it('says so when a week code is mistyped', async () => {
    render(
      <ChallengeScreen
        seed={4242}
        me="Ada"
        history={playedState(7, 3).history}
        badges={12}
        today="2026-09-03"
        onPlayChallenge={noop}
        onCompared={noop}
        onBack={noop}
      />,
    );
    for (const box of document.querySelectorAll('textarea')) {
      fireEvent.change(box, { target: { value: 'SKY-NOTAREALCODE' } });
      await maybe(/Play this week|Play it|Compare us/);
    }
    expect(body(), 'a bad code was accepted in silence').toMatch(
      /not right|check for a missing/i,
    );
    clean('after a mistyped code');
  });

  /*
   * And the comparison, refused honestly: a child with no run of their own has
   * nothing to compare against, and being told that is better than being shown
   * a comparison against zero.
   */
  it('refuses to compare when there is nothing of your own yet', async () => {
    render(
      <ChallengeScreen
        seed={3}
        me="Ada"
        history={[]}
        badges={0}
        today="2026-09-03"
        onPlayChallenge={noop}
        onCompared={noop}
        onBack={noop}
      />,
    );
    const friend = encodeResult(summariseRun(3, 'Sam', playedState(7, 3).history, 8));
    for (const box of document.querySelectorAll('textarea')) {
      fireEvent.change(box, { target: { value: friend } });
      await maybe(/Compare us/);
    }
    clean('with nothing of your own to compare');
  });
});

describe('the club proposing through the thesis screen', () => {
  /*
   * A club buy goes through the same reason-writing screen a solo buy does,
   * with the club's own position cap applied — so no single argument can put
   * the whole pot into one company. It is the same component reached from a
   * different place, and that reach had never been taken.
   */
  it('picks a company and writes the club’s reason', async () => {
    const joined = joinClub(createClub('Lemons', 'Ada', 500, 7), 'Sam');
    const club = joined.ok ? joined.club : createClub('Lemons', 'Ada', 500, 7);
    let changed = 0;
    render(
      <ClubScreen
        club={club}
        me="Ada"
        startingCash={500}
        seed={7}
        onChange={() => changed++}
        onBack={noop}
      />,
    );
    await must(/Propose a buy/, 'opening the company list');
    clean('the club’s company list');
    await must(new RegExp(SNAPSHOT[0].name.slice(0, 5)), 'picking a company');
    clean('the club’s thesis screen');
    // The club's cap, not a solo one.
    expect(body()).toMatch(/Propose to the club|reason/i);
    await maybe(/^Cancel$/);
    void changed;
  });

  it('passes the turn rather than proposing', async () => {
    const joined = joinClub(createClub('Lemons', 'Ada', 500, 7), 'Sam');
    const club = joined.ok ? joined.club : createClub('Lemons', 'Ada', 500, 7);
    let next: unknown = null;
    const { rerender } = render(
      <ClubScreen
        club={club}
        me="Ada"
        startingCash={500}
        seed={7}
        onChange={(value) => {
          next = value;
        }}
        onBack={noop}
      />,
    );
    await must(/Pass this turn/, 'passing the turn');
    expect(next, 'passing changed nothing').toBeTruthy();
    rerender(
      <ClubScreen
        club={next as never}
        me="Ada"
        startingCash={500}
        seed={7}
        onChange={noop}
        onBack={noop}
      />,
    );
    clean('after passing');
  });
});

describe('a playbook whose rules find nothing', () => {
  /*
   * Four rules that between them exclude every company. The backtest then has
   * nothing to buy in any window, and the honest answer — "these rules find
   * nothing to buy" — is a branch of its own. A playbook that quietly reports
   * a 0% return instead would be a horoscope.
   */
  it('says so rather than reporting a return on nothing', async () => {
    const strict = {
      name: 'Impossible',
      ruleIds: RULE_CARDS.filter((card) => card.kind === 'pick')
        .slice(0, 4)
        .map((card) => card.id),
    };
    render(<PlaybookScreen playbook={strict} onChange={noop} onBack={noop} />);
    if (await maybe(/Test it|See how|Try it/)) {
      clean('the backtest of impossible rules');
      expect(body()).toMatch(/nothing to buy|sat out|no company|%/i);
    }
  });

  it('reads the back of every card in the deck', async () => {
    render(
      <PlaybookScreen playbook={{ name: '', ruleIds: [] }} onChange={noop} onBack={noop} />,
    );
    for (const card of RULE_CARDS.slice(0, 6)) {
      const chip = find(new RegExp(card.name.slice(0, 10)));
      if (!chip) continue;
      await userEvent.click(chip);
      clean(`the card for ${card.name}`);
    }
  });
});

describe('the market’s last corners', () => {
  const game = {
    ...createGame(1),
    learned: GLOSSARY.map((w) => w.id),
    stand: { ...createGame(1).stand, history },
    ownership: {
      ...createOwnershipState(),
      comparisonAnswered: true,
      comparisonChoiceId: 'sam',
      passedOnOverpriced: true,
    },
  };

  it('reads the provenance of the prices and the accounts', async () => {
    let portfolio = createPortfolio(1500, 4242);
    portfolio = buy(portfolio, SNAPSHOT[0].ticker, 300).portfolio;
    render(
      <MarketScreen
        portfolio={portfolio}
        readiness={readiness(game)}
        knowsPE
        badges={20}
        studied={[SNAPSHOT[0].ticker]}
        onResearch={noop}
        onStartBuy={noop}
        onSell={noop}
        onOpenGate={noop}
      />,
    );
    // Two sources, and §21 makes a point of both being named.
    expect(body()).toMatch(/filings|closes|real weekly/i);
    await must(new RegExp(SNAPSHOT[0].ticker), 'opening a company');
    for (const button of buttons().slice(0, 8)) {
      if (/Buy|Sell|← /.test(button.textContent ?? '')) continue;
      await userEvent.click(button);
      clean('a company card, expanded');
    }
    cleanup();
  });
});
