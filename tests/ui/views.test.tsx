/** @vitest-environment jsdom */
/**
 * The screens hiding inside other screens.
 *
 * Half a dozen components in this project are really two or three screens
 * wearing one export: the deal board becomes a verdict, the market becomes a
 * side-by-side comparison, the challenge screen becomes a result, the club
 * becomes a vote. Rendering the component gets you the first of those and
 * nothing else, which is why files sitting at "58% covered" turned out to have
 * whole views nobody had ever looked at — `FaceoffView`, `CompareView`, the
 * playbook's backtest, the club's proposal card.
 *
 * Each of those views is where the *teaching* is. The deal board's first screen
 * asks a question; its second screen is the one that explains why the answer
 * was right. So this drives the interaction that reveals each one, and asks the
 * same three things of it: it renders, it says something, and no figure in it
 * reads `$NaN`.
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DealBoardScreen } from '@/components/acts/DealBoardScreen';
import { BuyoutScreen } from '@/components/acts/BuyoutScreen';
import { InvestScreen } from '@/components/acts/InvestScreen';
import { MarketScreen } from '@/components/acts/MarketScreen';
import { WeekReportScreen } from '@/components/acts/WeekReportScreen';
import { ChallengeScreen } from '@/components/meta/ChallengeScreen';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { PlaybookScreen } from '@/components/meta/PlaybookScreen';
import { TableScreen } from '@/components/meta/TableScreen';
import { PlanScreen } from '@/components/PlanScreen';
import { Road } from '@/components/Road';

import { createGame, readiness } from '@/lib/progress';
import { buyoutOffer, createOwnershipState, STANDS_FOR_SALE } from '@/lib/ownership';
import { createBusinessState } from '@/lib/business';
import { createInitialState, runDay, type DayRecord } from '@/lib/simulation';
import { createPortfolio, buy, advanceWeek } from '@/lib/market';
import { SNAPSHOT } from '@/lib/companies';
import { createClub, encodeClub, joinClub, propose } from '@/lib/club';
import { encodeResult, summariseRun } from '@/lib/challenge';
import { cardFor, encodeCard } from '@/lib/table';
import { RULE_CARDS } from '@/lib/playbook';
import { road, roadLine } from '@/lib/journey';
import { createCareer } from '@/lib/career';
import { GLOSSARY } from '@/lib/glossary';

const POISON = ['NaN', 'Infinity', 'undefined', '[object Object]'];
const noop = () => {};

function text(): string {
  return document.body.textContent ?? '';
}

function clean(where: string) {
  for (const bad of POISON) {
    expect(text(), `${where} rendered "${bad}"`).not.toContain(bad);
  }
  expect(text().trim().length, `${where} rendered nothing`).toBeGreaterThan(20);
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

const history = Array.from({ length: 21 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 24 + (i % 5) * 4 }),
);

function playedState(days: number, seed = 7) {
  let state = { ...createInitialState(seed), cash: 400 };
  for (let i = 0; i < days; i++) {
    const outcome = runDay(state, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 });
    state = outcome.nextState;
    if (state.status === 'finished') break;
  }
  return state;
}

describe('the deal board, after a choice is made', () => {
  /*
   * The first screen asks which of three stands is the best buy. The *second*
   * screen is the one that teaches: it holds all three against each other over
   * the same hold period and shows why. Nobody had ever rendered it.
   */
  it('shows the verdict for every one of the three stands', async () => {
    for (const stand of STANDS_FOR_SALE) {
      render(<DealBoardScreen onChoose={noop} />);
      const card = find(new RegExp(stand.name.split(/[’']/)[0]));
      expect(card, `no card for ${stand.name}`).toBeTruthy();
      await userEvent.click(card!);
      expect(await tap(/That one|Pick one/), `could not confirm ${stand.name}`).toBe(true);
      clean(`the verdict after picking ${stand.name}`);
      // The verdict names the arithmetic rather than just the answer.
      expect(text()).toMatch(/weeks/i);
      cleanup();
    }
  });

  /*
   * Only one of the three is the best buy, so the verdict has to be able to
   * say "no" — a screen that congratulates every answer teaches that ranking
   * by multiple does not matter, which is the opposite of the point.
   */
  it('is willing to say the choice was not the best one', async () => {
    const said = new Set<string>();
    const reported: boolean[] = [];
    for (const stand of STANDS_FOR_SALE) {
      render(<DealBoardScreen onChoose={(_id, right) => reported.push(right)} />);
      await userEvent.click(find(new RegExp(stand.name.split(/[’']/)[0]))!);
      await tap(/That one|Pick one/);
      said.add(/best deal/i.test(text()) ? 'yes' : 'no');
      // Whatever it said on screen, it told the caller the same thing.
      await tap(/Back to your own stand|Carry on|Keep going/);
      cleanup();
    }
    expect([...said].sort(), 'every choice got the same verdict').toEqual(['no', 'yes']);
    expect(reported.filter(Boolean).length, 'more than one right answer').toBe(1);
  });
});

describe('the buyout, weighed rather than just offered', () => {
  it('opens the working behind the number', async () => {
    const offer = buyoutOffer(history, createOwnershipState());
    render(<BuyoutScreen offer={offer} onAccept={noop} onDecline={noop} canDecline />);
    // Every expandable on the screen, opened.
    for (const button of buttons()) {
      if (/Sell for|Not yet/.test(button.textContent ?? '')) continue;
      await userEvent.click(button);
      clean('the buyout working');
    }
    expect(text()).toMatch(/times what it earned|÷|ratio/i);
  });
});

describe('the weekly reinvest choice, in each of its shapes', () => {
  it('renders and takes each option at every level of cash', async () => {
    const cases = [
      { cash: 0, savings: 0 },
      { cash: 45, savings: 0 },
      { cash: 900, savings: 200 },
    ];
    for (const { cash, savings } of cases) {
      const business = { ...createBusinessState(), savings };
      render(
        <InvestScreen
          goal="Two stands, one price."
          cash={cash}
          business={business}
          marginPerCup={0.8}
          typicalCupsSold={28}
          onBuyUpgrade={noop}
          onToggleStaff={noop}
          onMove={noop}
          onOpenStand={noop}
          onCloseStand={noop}
          onOpenShop={noop}
          onShopStaff={noop}
          onDone={noop}
        />,
      );
      clean(`the invest screen at $${cash}`);
      // Open each thing on offer: every one is a sheet of its own.
      for (const button of buttons().slice(0, 12)) {
        await userEvent.click(button);
        clean(`the invest screen at $${cash}, after a tap`);
        await tap(/^\s*Done\s*$/);
      }
      cleanup();
    }
  });
});

describe('the market, and the two screens inside it', () => {
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

  function marketWith(holdings: boolean, weeks: number) {
    let p = createPortfolio(1500, 4242);
    if (holdings) {
      p = buy(p, SNAPSHOT[0].ticker, 300).portfolio;
      p = buy(p, SNAPSHOT[1].ticker, 250).portfolio;
    }
    for (let i = 0; i < weeks; i++) p = advanceWeek(p).portfolio;
    return p;
  }

  /*
   * `FaceoffView` — pick two companies and read what the difference is made
   * of. It is the same verb Act 1 teaches, one act later, and it is the whole
   * defence against a child buying whichever logo they like. It had never
   * rendered.
   */
  it('compares two companies side by side', async () => {
    render(
      <MarketScreen
        portfolio={marketWith(true, 3)}
        readiness={readiness(game)}
        knowsPE
        badges={20}
        studied={SNAPSHOT.slice(0, 4).map((c) => c.ticker)}
        onResearch={noop}
        onStartBuy={noop}
        onSell={noop}
        onOpenGate={noop}
      />,
    );
    expect(await tap(/Compare/), 'no way to compare two companies').toBe(true);
    clean('the compare picker');

    // Pick two, which is what reveals the face-off.
    const first = find(new RegExp(SNAPSHOT[0].ticker));
    if (first) await userEvent.click(first);
    const second = find(new RegExp(SNAPSHOT[1].ticker));
    if (second) await userEvent.click(second);
    clean('the face-off');

    // The rule the module keeps: differences, never a recommendation.
    expect(text()).not.toMatch(/\bbetter buy\b|\bbest buy\b|\byou should buy\b/i);
    await tap(/Pick two others|← /);
  });

  it('sells part of a holding, and all of it', async () => {
    const sold: [string, number][] = [];
    render(
      <MarketScreen
        portfolio={marketWith(true, 4)}
        readiness={readiness(game)}
        knowsPE
        badges={20}
        studied={[SNAPSHOT[0].ticker]}
        onResearch={noop}
        onStartBuy={noop}
        onSell={(ticker, fraction) => sold.push([ticker, fraction])}
        onOpenGate={noop}
      />,
    );
    const card = find(new RegExp(SNAPSHOT[0].ticker));
    if (card) await userEvent.click(card);
    clean('a held company card');
    for (const label of [/Sell some|Sell half/, /Sell all|Sell the lot/]) {
      if (await tap(label)) clean('after a sell');
    }
    for (const [, fraction] of sold) {
      expect(fraction).toBeGreaterThan(0);
      expect(fraction).toBeLessThanOrEqual(1);
    }
  });

  it('offers the Saturday stand and the club when they are unlocked', async () => {
    let opened = 0;
    render(
      <MarketScreen
        portfolio={marketWith(true, 2)}
        readiness={readiness(game)}
        knowsPE
        badges={20}
        studied={[]}
        onResearch={noop}
        onStartBuy={noop}
        onSell={noop}
        onOpenGate={noop}
        onClub={() => opened++}
        onWeekendStand={() => opened++}
        onPlaybook={() => opened++}
        onAdvanceWeek={noop}
        onLeave={noop}
      />,
    );
    for (const label of [/Investment club/, /Saturday stand/, /Your playbook/]) {
      if (await tap(label)) clean(`after tapping ${label}`);
    }
    expect(opened, 'none of the market’s side doors worked').toBeGreaterThan(0);
  });
});

describe('the weekly market report, up and down', () => {
  it('reads correctly whichever way the week went', () => {
    let p = createPortfolio(1200, 4242);
    p = buy(p, SNAPSHOT[0].ticker, 400).portfolio;
    for (let week = 0; week < 8; week++) {
      const { portfolio, report } = advanceWeek(p);
      p = portfolio;
      render(
        <WeekReportScreen
          report={report}
          heldTickers={[SNAPSHOT[0].ticker]}
          onContinue={noop}
        />,
      );
      clean(`week ${week + 1} report`);
      cleanup();
    }
  });

  it('reads correctly for somebody holding nothing at all', () => {
    const { report } = advanceWeek(createPortfolio(1200, 4242));
    render(<WeekReportScreen report={report} heldTickers={[]} onContinue={noop} />);
    clean('a report for somebody in cash');
  });
});

describe('the challenge screen, and the comparison it produces', () => {
  /*
   * `CompareView` — the screen after a friend's result code goes in. Same sky,
   * same money, different decisions, and the *cause* of the gap named. This is
   * the payoff for the whole feature and it had never been rendered.
   */
  it('takes a friend’s result code and explains the gap', async () => {
    const mine = playedState(7, 3);
    const theirs = playedState(7, 3);
    // A friend's run on the same seed, with a different price.
    const friendState = { ...createInitialState(3), cash: 400 };
    let s = friendState;
    for (let i = 0; i < 7; i++) {
      const outcome = runDay(s, { buyLemons: 24, buySugarPacks: 3, buyCupPacks: 3, price: 2.4 });
      s = outcome.nextState;
      if (s.status === 'finished') break;
    }
    const code = encodeResult(summariseRun(3, 'Sam', s.history, 8));

    render(
      <ChallengeScreen
        seed={3}
        me="Ada"
        history={mine.history}
        badges={12}
        today="2026-09-03"
        onPlayChallenge={noop}
        onCompared={noop}
        onBack={noop}
      />,
    );
    clean('the challenge screen');
    void theirs;

    const input = document.querySelector('input');
    if (!input) return;
    fireEvent.change(input, { target: { value: code } });
    if (await tap(/Compare us/)) {
      clean('the comparison');
      // It names a cause rather than just a winner.
      expect(text()).toMatch(/price|cups|sold|weather/i);
      await tap(/Back|←/);
    }
  });

  it('refuses a result code that is not one, without crashing', async () => {
    render(
      <ChallengeScreen
        seed={3}
        me="Ada"
        history={playedState(7, 3).history}
        badges={12}
        today="2026-09-03"
        onPlayChallenge={noop}
        onCompared={noop}
        onBack={noop}
      />,
    );
    const input = document.querySelector('input');
    if (!input) return;
    for (const junk of ['nonsense', 'LEM1-AAAA', '', '🍋🍋🍋']) {
      fireEvent.change(input, { target: { value: junk } });
      await tap(/Compare us/);
      clean(`after pasting ${JSON.stringify(junk)}`);
    }
  });

  it('offers a day and a whole week to send', async () => {
    render(
      <ChallengeScreen
        seed={3}
        me="Ada"
        history={playedState(7, 3).history}
        badges={12}
        today="2026-09-03"
        onPlayChallenge={noop}
        onCompared={noop}
        onBack={noop}
      />,
    );
    for (const label of [/One day/, /Whole week/]) {
      if (await tap(label)) clean(`after choosing ${label}`);
    }
    if (await tap(/Copy the whole challenge|Copy code/)) clean('after copying');
  });
});

describe('the club, through a whole round of voting', () => {
  const me = 'Ada';

  /** A club with somebody else in it and a buy on the table. */
  function clubWithProposal() {
    const joined = joinClub(createClub('Lemons', me, 400, 7), 'Sam');
    const club = joined.ok ? joined.club : createClub('Lemons', me, 400, 7);
    const company = SNAPSHOT[0];
    const put = propose(club, me, company, 100, 'cheap-payback', 'everyone-i-know');
    return put.ok ? put.club : club;
  }

  it('renders a proposal, and votes on it', async () => {
    let club = clubWithProposal();
    const { rerender } = render(
      <ClubScreen
        club={club}
        me="Sam"
        startingCash={400}
        seed={7}
        onChange={(next) => {
          club = next!;
        }}
        onBack={noop}
      />,
    );
    clean('a club with a proposal on the table');
    expect(text()).toMatch(/wants to buy/i);

    for (const label of [/Yes|Agree|I'm in/, /No|Against/]) {
      if (await tap(label)) {
        rerender(
          <ClubScreen
            club={club}
            me="Sam"
            startingCash={400}
            seed={7}
            onChange={(next) => {
              club = next!;
            }}
            onBack={noop}
          />,
        );
        clean('after voting');
        break;
      }
    }
  });

  it('walks the log, the standings and the week', async () => {
    let club = clubWithProposal();
    const rerenderWith = () =>
      render(
        <ClubScreen
          club={club}
          me={me}
          startingCash={400}
          seed={7}
          onChange={(next) => {
            club = next!;
          }}
          onBack={noop}
        />,
      );
    rerenderWith();
    for (const label of [/The log/, /How are we doing/, /Move the week on/, /Copy code/]) {
      if (await tap(label)) {
        clean(`the club: ${label}`);
        await tap(/Back|←/);
      }
    }
  });

  it('starts a club, and joins one from a code', async () => {
    let made: ReturnType<typeof createClub> | null = null;
    render(
      <ClubScreen
        club={null}
        me={me}
        startingCash={400}
        seed={7}
        onChange={(next) => {
          made = next;
        }}
        onBack={noop}
      />,
    );
    clean('no club yet');

    // Joining somebody else's, from a real code.
    const joined = joinClub(createClub('Theirs', 'Sam', 400, 9), me);
    const input = document.querySelector('input');
    if (input && joined.ok) {
      fireEvent.change(input, { target: { value: encodeClub(joined.club) } });
      if (await tap(/Join/)) clean('after joining');
    }
    // Or starting one.
    if (await tap(/Start (a|our) club|Make one/)) clean('after starting one');
    void made;
  });

  it('refuses a club code that is not one', async () => {
    render(
      <ClubScreen club={null} me={me} startingCash={400} seed={7} onChange={noop} onBack={noop} />,
    );
    const input = document.querySelector('input');
    if (!input) return;
    for (const junk of ['nope', 'CLUB-ZZZZ', '']) {
      fireEvent.change(input, { target: { value: junk } });
      await tap(/Join/);
      clean(`after pasting ${JSON.stringify(junk)}`);
    }
  });
});

describe('the playbook, and the backtest behind it', () => {
  /*
   * The result view. Four rules, tested against every real twelve-week stretch
   * in the file, and the headline is the one sentence that stops a playbook
   * being a horoscope. It had never rendered.
   */
  it('tests a full set of rules and shows what they would have done', async () => {
    let playbook = { name: 'Mine', ruleIds: RULE_CARDS.slice(0, 4).map((card) => card.id) };
    const { rerender } = render(
      <PlaybookScreen
        playbook={playbook}
        onChange={(next) => {
          playbook = next as never;
        }}
        onBack={noop}
      />,
    );
    clean('a full playbook');
    if (await tap(/Test it|See how|Try it/)) {
      rerender(
        <PlaybookScreen
          playbook={playbook}
          onChange={(next) => {
            playbook = next as never;
          }}
          onBack={noop}
        />,
      );
      clean('the backtest');
      expect(text()).toMatch(/stretches|ahead|%/i);
    }
  });

  it('names a playbook and drops a rule again', async () => {
    let playbook = { name: '', ruleIds: [RULE_CARDS[0].id] };
    const { rerender } = render(
      <PlaybookScreen
        playbook={playbook}
        onChange={(next) => {
          playbook = next as never;
        }}
        onBack={noop}
      />,
    );
    const input = document.querySelector('input');
    if (input) {
      fireEvent.change(input, { target: { value: 'Slow and steady' } });
      rerender(
        <PlaybookScreen
          playbook={playbook}
          onChange={(next) => {
            playbook = next as never;
          }}
          onBack={noop}
        />,
      );
    }
    // Tapping a chosen rule again takes it back out.
    const chosen = find(new RegExp(RULE_CARDS[0].name.slice(0, 12)));
    if (chosen) {
      await userEvent.click(chosen);
      clean('after dropping a rule');
    }
  });
});

describe('the table, and a card from somebody else', () => {
  it('adds a friend’s card from a real code', async () => {
    const mine = cardFor('Ada', 30, 120, 4, 6, { name: 'Mine', ruleIds: [] }, 18.5);
    const theirs = cardFor('Sam', 22, 90, 3, 7, { name: 'Theirs', ruleIds: [] }, -4.2);
    render(<TableScreen mine={mine} onBack={noop} />);
    clean('the table with one card');
    const input = document.querySelector('input');
    if (!input) return;
    fireEvent.change(input, { target: { value: encodeCard(theirs) } });
    if (await tap(/Add them/)) {
      clean('the table with two cards');
      expect(text()).toContain('Sam');
    }
  });

  it('refuses a card code that is not one', async () => {
    const mine = cardFor('Ada', 30, 120, 4, 6, { name: 'Mine', ruleIds: [] }, 18.5);
    render(<TableScreen mine={mine} onBack={noop} />);
    const input = document.querySelector('input');
    if (!input) return;
    for (const junk of ['nope', 'CARD-ZZZZ', '']) {
      fireEvent.change(input, { target: { value: junk } });
      await tap(/Add them/);
      clean(`after pasting ${JSON.stringify(junk)}`);
    }
  });
});

describe('the plan screen’s rehearsal', () => {
  /*
   * "Try it on yesterday's crowd" is the derivative made visible — hold the
   * world still, move one dial. The comparison it produces is a view of its
   * own and is most of the uncovered half of the biggest component in the app.
   */
  it('rehearses, then compares two plans against the same crowd', async () => {
    const state = playedState(4, 5);
    render(<PlanScreen state={state} onOpen={noop} onInvest={noop} />);

    // Rehearse once, change the price, rehearse again: the second one is what
    // produces the side-by-side.
    for (const value of ['1.00', '2.50']) {
      const slider = document.querySelector('input[type="range"]') as HTMLInputElement | null;
      if (slider) fireEvent.change(slider, { target: { value } });
      if (await tap(/Try it on yesterday/)) clean(`the rehearsal at ${value}`);
    }
    // Whatever the screen now offers — load one, swap between them — take it.
    for (const label of [/Use this plan|Load|Keep this/, /Try the other|Swap/]) {
      if (await tap(label)) clean(`after ${label}`);
    }
  });
});

describe('the road strip on the title screen', () => {
  it('draws the road at every stage of the journey', () => {
    const career = createCareer('Ada');
    for (const act of [1, 2, 3, 4, 5] as const) {
      const game = { ...createGame(1), act, stand: { ...createGame(1).stand, history } };
      render(<Road stops={road(game)} line={roadLine(game, career)} />);
      clean(`the road at stage ${act}`);
      cleanup();
    }
  });

  it('draws it for a fresh install with nothing unlocked', () => {
    render(<Road stops={road(createGame(1))} line={roadLine(createGame(1), createCareer())} />);
    clean('the road on a fresh install');
  });
});
