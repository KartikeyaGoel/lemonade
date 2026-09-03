/** @vitest-environment jsdom */
/**
 * Every screen, in every state that changes what it renders.
 *
 * The gap this closes was measured rather than guessed: the component layer was
 * at **26% of statements**, with eighteen screens at exactly zero. Everything
 * anybody had ever tested was a screen somebody had happened to walk through in
 * a browser, and that is how a crash on the friends screen — a real one, from a
 * club that failed to round-trip through storage — sat there unnoticed.
 *
 * So this is not a screenshot suite and it does not assert layout. It renders
 * each screen across the branches its own code takes, and asks three things of
 * every one:
 *
 *  1. it does not throw
 *  2. it puts something on the screen a person could read
 *  3. no figure shown to a child is `NaN`, `Infinity`, `undefined` or `null`
 *
 * The third is the one that earns its keep. A React component with a bad number
 * renders happily and prints `$NaN`, and every other kind of test agrees it is
 * fine.
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { BuyoutScreen } from '@/components/acts/BuyoutScreen';
import { DealBoardScreen } from '@/components/acts/DealBoardScreen';
import { FinaleScreen } from '@/components/acts/FinaleScreen';
import { FundingScreen } from '@/components/acts/FundingScreen';
import { GateScreen } from '@/components/acts/GateScreen';
import { ListedScreen } from '@/components/acts/ListedScreen';
import { ListingScreen } from '@/components/acts/ListingScreen';
import { WeekReportScreen } from '@/components/acts/WeekReportScreen';
import { WeeklyChoiceScreen } from '@/components/acts/WeeklyChoiceScreen';
import { ChallengeScreen } from '@/components/meta/ChallengeScreen';
import { ClubScreen } from '@/components/meta/ClubScreen';
import { ErasedScreen } from '@/components/meta/ErasedScreen';
import { PlaybookScreen } from '@/components/meta/PlaybookScreen';
import { TableScreen } from '@/components/meta/TableScreen';
import { ThesisScreen } from '@/components/meta/ThesisScreen';
import { TrophyScreen } from '@/components/meta/TrophyScreen';
import { UnlockCard } from '@/components/meta/UnlockCard';
import { WordCard } from '@/components/meta/WordCard';
import { NextUp } from '@/components/meta/NextUp';
import { ShopScreen } from '@/components/ShopScreen';
import { MorningScreen } from '@/components/MorningScreen';
import { RunDayScreen } from '@/components/RunDayScreen';
import { PlanScreen } from '@/components/PlanScreen';
import { MarketScreen } from '@/components/acts/MarketScreen';
import { ReckoningScreen } from '@/components/meta/ReckoningScreen';
import { PriceScreen } from '@/components/PriceScreen';
import { WeekEndScreen } from '@/components/WeekEndScreen';
import { CloseScreen } from '@/components/CloseScreen';

import { createGame, readiness, type Game } from '@/lib/progress';
import { createCareer, type Career } from '@/lib/career';
import {
  DEFAULT_DAY_PARAMS,
  createInitialState,
  runDay,
  type DayRecord,
  type GameState,
} from '@/lib/simulation';
import { buyoutOffer, createOwnershipState } from '@/lib/ownership';
import { createListing, listingOffer, markListedWeek, type Listing } from '@/lib/listing';
import { createPortfolio, summarisePortfolio, advanceWeek, buy } from '@/lib/market';
import { SNAPSHOT } from '@/lib/companies';
import { createClub } from '@/lib/club';
import { createBusinessState } from '@/lib/business';
import { cardFor } from '@/lib/table';
import { GLOSSARY } from '@/lib/glossary';
import { BADGES } from '@/lib/achievements';
import { UNLOCK_COPY } from '@/lib/unlocks';
import { scoreAll } from '@/lib/thesis';

/* ------------------------------------------------------------------ *
 * Fixtures, built by the real modules
 * ------------------------------------------------------------------ */

/** A day, so a history can be built without hand-writing DayRecords. */
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
    cashAfter: 200,
    spoiledLemons: 0,
    marketShare: 1,
    seedBefore: 1,
    subscriberCups: 0,
    ...over,
  };
}

const richHistory = Array.from({ length: 21 }, (_, i) =>
  dayRecord({ day: i + 1, profit: 24 + (i % 5) * 4 }),
);
/** A business that loses money, which every valuation has to survive. */
const losingHistory = Array.from({ length: 21 }, (_, i) =>
  dayRecord({ day: i + 1, profit: -12 - (i % 3), revenue: 4, cupsSold: 3 }),
);
/** A single day, which is the shortest history anything is ever handed. */
const thinHistory = [dayRecord()];

function playedState(days: number, seed = 7): GameState {
  let state = { ...createInitialState(seed), cash: 300 };
  for (let i = 0; i < days; i++) {
    const o = runDay(state, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 });
    state = o.nextState;
    if (state.status === 'finished') break;
  }
  return state;
}

function listedWith(actual: number) {
  const offer = listingOffer(richHistory, createOwnershipState());
  const base: Listing = {
    ...createListing(),
    listed: true,
    floated: 0.3,
    ipoPrice: offer.pricePerShare,
    ipoMultiple: offer.publicMultiple,
    price: offer.pricePerShare,
    expected: offer.weeklyProfit,
    multiple: offer.publicMultiple,
    founderShare: 0.7,
    raised: 300,
  };
  return markListedWeek(base, actual);
}

function portfolioWith(weeks: number, holdings: boolean) {
  let p = createPortfolio(1000, 4242);
  if (holdings) {
    p = buy(p, SNAPSHOT[0].ticker, 300).portfolio;
    p = buy(p, SNAPSHOT[1].ticker, 200).portfolio;
  }
  for (let i = 0; i < weeks; i++) p = advanceWeek(p).portfolio;
  return p;
}

const noop = () => {};

/* ------------------------------------------------------------------ *
 * What must be true of anything rendered
 * ------------------------------------------------------------------ */

/**
 * Figures that mean the render is broken even though React was happy.
 *
 * `$NaN` and `undefined` in the middle of a sentence are the two things a
 * component prints without complaint when its props are wrong, and they are
 * exactly what a coverage number does not catch.
 */
const POISON = [
  'NaN',
  'Infinity',
  '-Infinity',
  'undefined',
  'null',
  '[object Object]',
  '$-0.00',
];

function check(label: string, element: ReactElement) {
  let text = '';
  expect(() => {
    text = render(element).container.textContent ?? '';
  }, `${label} threw while rendering`).not.toThrow();

  // Something a person could read.
  expect(text.trim().length, `${label} rendered nothing`).toBeGreaterThan(10);

  for (const bad of POISON) {
    expect(text, `${label} rendered "${bad}"`).not.toContain(bad);
  }
  cleanup();
}

/* ------------------------------------------------------------------ *
 * The matrix
 * ------------------------------------------------------------------ */

describe('the stand', () => {
  it('renders the shop across pantry and cash states', () => {
    const cases: [string, GameState][] = [
      ['day one, nothing in the pantry', createInitialState(1)],
      ['mid-week with stock', playedState(3)],
      ['broke', { ...createInitialState(1), cash: 0 }],
      ['a penny left', { ...createInitialState(1), cash: 0.01 }],
      ['rich', { ...createInitialState(1), cash: 99999 }],
      ['a full pantry', { ...createInitialState(1), lemonLots: [{ lemons: 200, purchasedOnDay: 1 }], sugarServings: 200, cupsInStock: 200 }],
    ];
    for (const [label, state] of cases) {
      check(`shop: ${label}`, <ShopScreen state={state} onConfirm={noop} onBack={noop} />);
    }
  });

  it('renders the price dial with and without the words that annotate it', () => {
    for (const [label, learned] of [
      ['nothing learned', [] as string[]],
      ['margin learned', ['margin']],
      ['everything learned', GLOSSARY.map((w) => w.id)],
    ] as const) {
      for (const cups of [0, 1, 40, 100_000]) {
        check(
          `price: ${label}, ${cups} cups`,
          <PriceScreen
            state={playedState(2)}
            cupsMakeable={cups}
            learned={learned as string[]}
            onConfirm={noop}
            onBack={noop}
          />,
        );
      }
    }
  });

  /*
   * The close screen has the most branches of any screen in the game — the
   * ledger opens or not, the cash floor fires or not, fruit spoils or not,
   * stands split or not, an investor takes a cut or not. It is also the screen
   * whose arithmetic a child is told to check by hand.
   */
  it('renders the close screen across every ledger branch', () => {
    const cases: [string, ReturnType<typeof runDay>][] = [
      ['a first profitable day', runDay({ ...createInitialState(1), cash: 100 }, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 })],
      ['a sell-out', runDay({ ...createInitialState(2), cash: 100 }, { buyLemons: 4, buySugarPacks: 1, buyCupPacks: 1, price: 0.5 })],
      ['nothing sold', runDay({ ...createInitialState(3), cash: 100 }, { buyLemons: 30, buySugarPacks: 4, buyCupPacks: 4, price: 5 })],
      ['bought nothing at all', runDay({ ...createInitialState(4), cash: 100 }, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 1.5 })],
      [
        'the cash floor firing under a rent and a loan',
        runDay(
          { ...createInitialState(5), cash: 25 },
          { buyLemons: 2, buySugarPacks: 1, buyCupPacks: 1, price: 4 },
          { fixedCosts: [{ label: 'Rent', amount: 45 }, { label: 'Loan', amount: 25 }] },
        ),
      ],
      [
        'fruit in the bin',
        runDay(
          { ...createInitialState(6), day: 6, cash: 500, lemonLots: [{ lemons: 26, purchasedOnDay: 1 }], sugarServings: 40, cupsInStock: 40 },
          { buyLemons: 6, buySugarPacks: 0, buyCupPacks: 0, price: 1.5 },
        ),
      ],
      [
        'an investor taking a cut',
        runDay({ ...createInitialState(7), cash: 300 }, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 }, { equityShare: 0.3 }),
      ],
      [
        'subscribers served first',
        runDay({ ...createInitialState(8), cash: 300 }, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 2 }, { subscribers: 12, subscriberDiscount: 0.25 }),
      ],
      [
        'a shop with the weather floored',
        runDay({ ...createInitialState(9), cash: 800 }, { buyLemons: 40, buySugarPacks: 6, buyCupPacks: 6, price: 1.5 }, { indoorShare: 1, demandMultiplier: 3, fixedCosts: [{ label: 'Rent', amount: 45 }] }),
      ],
    ];
    for (const [label, outcome] of cases) {
      check(`close: ${label}`, <CloseScreen outcome={outcome} insights={[]} onNext={noop} />);
      // And with the extras the later stages hand it: a word to show, a
      // business behind it, a plan to compare against, a manager on offer.
      check(
        `close: ${label}, with everything on`,
        <CloseScreen
          outcome={outcome}
          insights={[
            {
              id: GLOSSARY[0].id,
              term: GLOSSARY[0].word,
              evidence: 'You did the thing.',
              carriesForward: 'And it means this.',
            } as never,
          ]}
          business={createBusinessState()}
          planned={null}
          managerAvailable
          onManagerRuns={noop}
          onNext={noop}
        />,
      );
    }
  });

  it('renders the week-end screen with and without a way onward', () => {
    const done = playedState(7);
    check('week end, replay only', <WeekEndScreen state={done} onReplay={noop} />);
    check('week end, can continue', <WeekEndScreen state={done} onReplay={noop} onContinue={noop} />);
    check(
      'week end, with a challenge',
      <WeekEndScreen state={done} onReplay={noop} onContinue={noop} onChallenge={noop} challengeResult />,
    );
    check('week end, one day played', <WeekEndScreen state={playedState(1)} onReplay={noop} />);
  });

  it('renders the weekly choice at every point in the arc', () => {
    for (const [label, props] of [
      ['week one, no regulars', { cash: 60, savings: 0, weekNumber: 1, regulars: 0, expectedSignups: 3 }],
      ['broke', { cash: 0, savings: 0, weekNumber: 2, regulars: 0, expectedSignups: 0 }],
      ['flush with regulars', { cash: 4000, savings: 900, weekNumber: 6, regulars: 18, expectedSignups: 5 }],
      ['a penny', { cash: 0.01, savings: 0.01, weekNumber: 3, regulars: 1, expectedSignups: 1 }],
    ] as const) {
      check(`weekly choice: ${label}`, <WeeklyChoiceScreen {...props} onChoose={noop} />);
    }
  });
});

describe('the ownership and listing act', () => {
  it('renders the deal board', () => {
    check('deal board', <DealBoardScreen onChoose={noop} />);
  });

  it('renders a buyout offer for a good business and a bad one', () => {
    for (const [label, history] of [
      ['profitable', richHistory],
      ['losing money', losingHistory],
      ['one day only', thinHistory],
    ] as const) {
      const offer = buyoutOffer(history, createOwnershipState());
      check(
        `buyout: ${label}`,
        <BuyoutScreen offer={offer} onAccept={noop} onDecline={noop} canDecline />,
      );
      check(
        `buyout: ${label}, cannot decline`,
        <BuyoutScreen offer={offer} onAccept={noop} onDecline={noop} canDecline={false} />,
      );
    }
  });

  it('renders the funding choice at every level of cash and prior dilution', () => {
    for (const cash of [0, 100, 599, 600, 5000]) {
      for (const sold of [0, 0.2, 0.45]) {
        check(
          `funding: $${cash}, ${sold * 100}% sold`,
          <FundingScreen
            cash={cash}
            history={richHistory}
            weeklyProfit={124.88}
            alreadySold={sold}
            onPayCash={noop}
            onBorrow={noop}
            onSellSlice={noop}
            onBack={noop}
          />,
        );
      }
    }
    // And a business earning nothing, which makes every slice worth nothing.
    check(
      'funding: a business earning nothing',
      <FundingScreen
        cash={50}
        history={losingHistory}
        weeklyProfit={0}
        alreadySold={0}
        onPayCash={noop}
        onBorrow={noop}
        onSellSlice={noop}
        onBack={noop}
      />,
    );
  });

  it('renders the listing decision, including for a company worth nothing', () => {
    for (const [label, history] of [
      ['profitable', richHistory],
      ['losing money', losingHistory],
      ['one day only', thinHistory],
    ] as const) {
      for (const sold of [0, 0.3]) {
        const ownership = { ...createOwnershipState(), equitySoldPct: sold };
        check(
          `listing: ${label}, ${sold * 100}% already sold`,
          <ListingScreen
            offer={listingOffer(history, ownership)}
            ownership={ownership}
            onList={noop}
            onSellInstead={noop}
            onBack={noop}
          />,
        );
      }
    }
  });

  /*
   * The share price moving is the point of the whole stage, and there are three
   * directions it can go. A fall must be shown as a fall, with the number that
   * caused it, and never dressed up.
   */
  it('renders a listed week up, down and flat', () => {
    for (const [label, actual] of [
      ['a week that beat expectations', 260],
      ['a week that missed', 40],
      ['a week exactly as expected', listingOffer(richHistory, createOwnershipState()).weeklyProfit],
      ['a week that earned nothing', 0],
      ['a week that lost money', -80],
    ] as const) {
      const { listing, move } = listedWith(actual);
      check(`listed: ${label}`, <ListedScreen listing={listing} move={move} onContinue={noop} />);
      // And the same week with the move not yet in hand, which is what the
      // screen gets on a reload.
      check(`listed: ${label}, no move`, <ListedScreen listing={listing} move={null} onContinue={noop} />);
    }
    check(
      'listed: before the first week',
      <ListedScreen
        listing={{ ...createListing(), listed: true, floated: 0.3, ipoPrice: 1.12, ipoMultiple: 9, price: 1.12, expected: 124, multiple: 9, founderShare: 0.7, raised: 300 }}
        move={null}
        onContinue={noop}
      />,
    );
  });
});

describe('the market act', () => {
  it('renders the readiness gate at every stage of readiness', () => {
    const bare = createGame(1);
    const learnedMargin: Game = { ...bare, learned: ['margin'] };
    const ranked: Game = {
      ...learnedMargin,
      stand: { ...bare.stand, history: richHistory },
      ownership: { ...createOwnershipState(), comparisonAnswered: true, comparisonChoiceId: 'sam', passedOnOverpriced: true },
    };
    for (const [label, game] of [
      ['nothing demonstrated', bare],
      ['one demonstrated', learnedMargin],
      ['most demonstrated', ranked],
    ] as const) {
      check(`gate: ${label}`, <GateScreen readiness={readiness(game)} onBack={noop} />);
    }
  });

  it('renders a weekly market report, up and down, held and not', () => {
    const held = portfolioWith(0, true);
    const { report } = advanceWeek(held);
    check('week report: holding', <WeekReportScreen report={report} heldTickers={[SNAPSHOT[0].ticker]} onContinue={noop} />);
    check('week report: holding nothing', <WeekReportScreen report={advanceWeek(portfolioWith(0, false)).report} heldTickers={[]} onContinue={noop} />);
  });

  it('renders the thesis screen for every company, and at the edges of the dial', () => {
    for (const company of SNAPSHOT.slice(0, 6)) {
      for (const max of [0, 1, 500, 100_000]) {
        check(
          `thesis: ${company.ticker}, max $${max}`,
          <ThesisScreen
            company={company}
            price={100}
            asOf="2026-09-01"
            maxDollars={max}
            actionLabel="Buy"
            onConfirm={noop}
            onCancel={noop}
          />,
        );
      }
    }
    // A company that loses money: the P/E line has no denominator.
    const loser = SNAPSHOT.find((c) => c.netIncomeM <= 0);
    if (loser) {
      check(
        'thesis: a company that loses money',
        <ThesisScreen company={loser} price={40} asOf="2026-09-01" maxDollars={500} actionLabel="Buy" onConfirm={noop} onCancel={noop} />,
      );
    }
  });

  it('renders the finale for both endings and every portfolio outcome', () => {
    for (const [label, weeks, holdings] of [
      ['twelve weeks holding', 12, true],
      ['twelve weeks in cash', 12, false],
      ['no weeks at all', 0, true],
    ] as const) {
      const portfolio = portfolioWith(weeks, holdings);
      for (const listed of [true, false]) {
        const summary = summarisePortfolio(portfolio, 749.28);
        check(
          `finale: ${label}, ${listed ? 'listed' : 'sold up'}`,
          <FinaleScreen
            summary={summary}
            portfolio={portfolio}
            ending={{ listed, hadShop: true, buyoutMultiple: 8, shares: 1000, sharePrice: 1.12, floated: 0.3 } as never}
            onParent={noop}
            onRestart={noop}
            onTrophies={noop}
            onNewSeason={noop}
            seasonNumber={2}
          />,
        );
      }
    }
    // No shop, no trophies, no new season: a first run that sold up early.
    const p = portfolioWith(12, true);
    check(
      'finale: the barest possible run',
      <FinaleScreen
        summary={summarisePortfolio(p, 100)}
        portfolio={p}
        ending={{ listed: false, hadShop: false, buyoutMultiple: 6, shares: 1000, sharePrice: 0, floated: 0 } as never}
        onParent={noop}
        onRestart={noop}
      />,
    );
  });
});

describe('the meta game', () => {
  it('renders the trophy case from empty to complete', () => {
    const empty = createGame(1);
    const full: Game = { ...empty, stand: { ...empty.stand, history: richHistory }, learned: GLOSSARY.map((w) => w.id) };
    const cases: [string, Game, Career, string[]][] = [
      ['nothing earned', empty, createCareer(), []],
      ['a first badge', empty, { ...createCareer('Ada'), badges: [BADGES[0].id] }, [BADGES[0].id]],
      [
        'everything earned',
        full,
        {
          ...createCareer('Ada'),
          badges: BADGES.map((b) => b.id),
          words: GLOSSARY.map((w) => w.id),
          seasons: 4,
          lifetimeDays: 90,
        },
        BADGES.map((b) => b.id),
      ],
    ];
    for (const [label, game, career, badges] of cases) {
      check(
        `trophies: ${label}`,
        <TrophyScreen game={game} career={career} learned={game.learned} badges={badges} onBack={noop} />,
      );
    }
  });

  it('renders the club with no club, a new one, and a busy one', () => {
    check('club: none yet', <ClubScreen club={null} me="Ada" startingCash={300} seed={7} onChange={noop} onBack={noop} />);
    const club = createClub('Lemons', 'Ada', 300, 7);
    check('club: freshly made', <ClubScreen club={club} me="Ada" startingCash={300} seed={7} onChange={noop} onBack={noop} />);
    check(
      'club: somebody else’s turn',
      <ClubScreen club={{ ...club, turn: 1, members: [...club.members, { name: 'Sam', joinedWeek: 1 } as never] }} me="Ada" startingCash={300} seed={7} onChange={noop} onBack={noop} />,
    );
  });

  it('renders the challenge screen with and without a week behind them', () => {
    for (const [label, history, badges, today] of [
      ['nothing played', [] as DayRecord[], 0, null],
      ['two days played', [dayRecord(), dayRecord({ day: 2 })], 3, '2026-09-03'],
      ['a full run', richHistory, 20, '2026-09-03'],
    ] as const) {
      check(
        `challenge: ${label}`,
        <ChallengeScreen
          seed={4242}
          me="Ada"
          history={history as DayRecord[]}
          badges={badges}
          today={today}
          onPlayChallenge={noop}
          onCompared={noop}
          onBack={noop}
        />,
      );
    }
  });

  it('renders the playbook empty, part-built and full', () => {
    check('playbook: empty', <PlaybookScreen playbook={{ name: '', ruleIds: [] }} onChange={noop} onBack={noop} />);
    check('playbook: named, one rule', <PlaybookScreen playbook={{ name: 'My rules', ruleIds: ['profit-only'] }} onChange={noop} onBack={noop} />);
    check(
      'playbook: a rule that no longer exists',
      <PlaybookScreen playbook={{ name: 'Stale', ruleIds: ['a-rule-we-deleted'] }} onChange={noop} onBack={noop} />,
    );
  });

  it('renders the table for a card with nothing on it and a strong one', () => {
    check(
      'table: a bare card',
      <TableScreen mine={cardFor('Ada', 0, 0, 0, 0, { name: '', ruleIds: [] }, 0)} onBack={noop} />,
    );
    check(
      'table: a strong card',
      <TableScreen
        mine={cardFor('Ada', 40, 150, 6, 8, { name: 'Rules', ruleIds: ['profit-only'] }, 42.5)}
        onBack={noop}
      />,
    );
    check(
      'table: a losing card',
      <TableScreen mine={cardFor('Ada', 5, -20, 1, 9, { name: '', ruleIds: [] }, -30)} onBack={noop} />,
    );
  });

  it('renders each reward card, including the one that asks for a name', () => {
    for (const unlock of Object.values(UNLOCK_COPY)) {
      check(`unlock: ${unlock.title}`, <UnlockCard unlock={unlock} onDone={noop} />);
    }
    const first = Object.values(UNLOCK_COPY)[0];
    check('unlock: asking for a name', <UnlockCard unlock={first} askIdentity onDone={noop} onSetIdentity={noop} />);

    for (const word of GLOSSARY.slice(0, 8)) {
      check(
        `word: ${word.word}`,
        <WordCard insight={{ id: word.id, term: word.word, evidence: 'You did the thing.', carriesForward: 'And it means this.' } as never} remaining={2} onDone={noop} />,
      );
    }
    check(
      'word: the last one in the queue',
      <WordCard insight={{ id: GLOSSARY[0].id, term: GLOSSARY[0].word, evidence: 'Evidence.', carriesForward: 'Forward.' } as never} remaining={0} onDone={noop} />,
    );
  });

  it('renders the erased receipt for one record and for none', () => {
    check('erased: nothing there', <ErasedScreen removed={[]} onStart={noop} />);
    check('erased: one record', <ErasedScreen removed={['lemonade.save.v2']} onStart={noop} />);
    check(
      'erased: everything',
      <ErasedScreen removed={['lemonade.save.v2', 'lemonade.career.v1', 'lemonade.class.v1', 'lemonade.live.v1', 'lemonade.guide.v1', 'lemonade.act1.v1']} onStart={noop} />,
    );
  });

  it('renders the next-up strip with one thing and with several', () => {
    check(
      'next up: one',
      <NextUp things={[{ emoji: '📈', title: 'Charge more', how: 'Try it tomorrow.' }]} />,
    );
    check(
      'next up: several, with a trophy door',
      <NextUp
        things={[
          { emoji: '📈', title: 'Charge more', how: 'Try it tomorrow.' },
          { emoji: '🧊', title: 'Buy a cooler', how: 'Serve more people.' },
          { emoji: '⚔️', title: 'Beat the rival', how: 'Hold your price.' },
        ]}
        onOpenTrophies={noop}
      />,
    );
    /* And nothing at all renders nothing at all, which is the right answer —
       an empty "try this next" strip is worse than no strip. */
    const { container } = render(<NextUp things={[]} onOpenTrophies={noop} />);
    expect(container.textContent?.trim()).toBe('');
    cleanup();
  });
});

/* ------------------------------------------------------------------ *
 * The screens with the most branches, driven rather than just rendered
 * ------------------------------------------------------------------ */

describe('the screens that were never rendered at all', () => {
  it('renders the morning across every forecast and day', () => {
    for (const forecast of ['probably-cold', 'probably-mild', 'probably-hot'] as const) {
      for (const day of [1, 4, 7]) {
        check(
          `morning: ${forecast}, day ${day}`,
          <MorningScreen state={{ ...playedState(day - 1), forecast }} onContinue={noop} />,
        );
      }
    }
  });

  /*
   * The day itself. Its whole job is to animate a queue, so the states worth
   * separating are the ones where the queue is a different shape: nobody came,
   * everybody was served, and the stand ran dry with people still waiting.
   */
  it('renders the day running, sold out, and with nobody there', () => {
    const cases: [string, ReturnType<typeof runDay>][] = [
      ['a normal day', runDay({ ...createInitialState(1), cash: 200 }, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 1.5 })],
      ['sold out with a queue', runDay({ ...createInitialState(2), cash: 200 }, { buyLemons: 2, buySugarPacks: 1, buyCupPacks: 1, price: 0.5 })],
      ['nobody bought anything', runDay({ ...createInitialState(3), cash: 200 }, { buyLemons: 20, buySugarPacks: 3, buyCupPacks: 3, price: 5 })],
      ['nothing to sell', runDay({ ...createInitialState(4), cash: 200 }, { buyLemons: 0, buySugarPacks: 0, buyCupPacks: 0, price: 1.5 })],
    ];
    for (const [label, outcome] of cases) {
      check(`run day: ${label}`, <RunDayScreen outcome={outcome} onDone={noop} />);
    }
  });

  /*
   * The reckoning asks whether the reason held, and the four answers are the
   * four corners: right for the right reason, right by luck, wrong having
   * reasoned well, and wrong having contradicted yourself.
   */
  it('renders the reckoning for every combination of right, wrong and lucky', () => {
    const base = {
      ticker: SNAPSHOT[0].ticker,
      quantId: 'cheap-payback',
      qualId: 'everyone-i-know',
      week: 0,
      priceAtBuy: 100,
      dollars: 300,
      asOf: '2026-09-01',
      who: 'Ada',
    };
    const corners = [
      { label: 'right for the right reason', quantHeld: true, contradiction: false, end: 140 },
      { label: 'right by luck', quantHeld: false, contradiction: true, end: 160 },
      { label: 'wrong having reasoned well', quantHeld: true, contradiction: false, end: 60 },
      { label: 'wrong and contradicted', quantHeld: false, contradiction: true, end: 55 },
    ];
    for (const corner of corners) {
      const report = scoreAll(
        [{ ...base, quantHeld: corner.quantHeld, contradiction: corner.contradiction } as never],
        () => corner.end,
      );
      check(`reckoning: ${corner.label}`, <ReckoningScreen report={report} onContinue={noop} />);
    }
    // And somebody who never wrote a reason down at all.
    check('reckoning: nothing written down', <ReckoningScreen report={scoreAll([], () => 100)} onContinue={noop} />);
  });
});

describe('the planning screen, which is where most of the game happens', () => {
  it('renders across every stage of the business', () => {
    const state = playedState(3);
    const cases: [string, Parameters<typeof PlanScreen>[0]][] = [
      ['one folding table', { state, onOpen: noop }],
      [
        'a goal strip and a day counter',
        { state, stage: { goal: 'Hire a manager so the first stand runs without you.', day: 4, total: 16 }, onOpen: noop },
      ],
      [
        'the guide talking',
        { state, guide: { lines: ['Tap the sign to change your price.'], onDismiss: noop }, onOpen: noop },
      ],
      ['a note under the dials', { state, note: 'You owe $39.00 before you open.', onOpen: noop }],
      [
        'a business with everything bought',
        {
          state,
          business: {
            ...createBusinessState(),
            upgrades: { cooler: true, bigSign: true, freshSqueeze: true },
            staff: { helper: true, manager: true },
          },
          onOpen: noop,
          onInvest: noop,
        },
      ],
      [
        'a shop, a loan and an investor',
        {
          state,
          params: {
            ...DEFAULT_DAY_PARAMS,
            fixedCosts: [
              { label: 'Rent', amount: 45 },
              { label: 'Loan', amount: 25 },
            ],
            equityShare: 0.3,
            indoorShare: 1,
            demandMultiplier: 3,
            serviceCapacity: 60,
            subscribers: 12,
            subscriberDiscount: 0.25,
          },
          onOpen: noop,
        },
      ],
      ['broke, with nothing in the pantry', { state: { ...createInitialState(1), cash: 0 }, onOpen: noop }],
    ];
    for (const [label, props] of cases) {
      check(`plan: ${label}`, <PlanScreen {...props} />);
    }
  });
});

describe('the market screen, driven through its own controls', () => {
  const bare = createGame(1);
  const ready: Game = {
    ...bare,
    learned: GLOSSARY.map((w) => w.id),
    stand: { ...bare.stand, history: richHistory },
    ownership: {
      ...createOwnershipState(),
      comparisonAnswered: true,
      comparisonChoiceId: 'sam',
      passedOnOverpriced: true,
    },
  };

  it('renders locked, unlocked, holding and empty', () => {
    for (const [label, game, holdings, weeks] of [
      ['gated, no holdings', bare, false, 0],
      ['ready, no holdings', ready, false, 0],
      ['ready and holding', ready, true, 3],
      ['at the end of the twelve weeks', ready, true, 12],
    ] as const) {
      check(
        `market: ${label}`,
        <MarketScreen
          portfolio={portfolioWith(weeks, holdings)}
          readiness={readiness(game)}
          knowsPE={game.learned.includes('pe-ratio')}
          badges={12}
          studied={holdings ? [SNAPSHOT[0].ticker] : []}
          onResearch={noop}
          onStartBuy={noop}
          onSell={noop}
          onAdvanceWeek={noop}
          onLeave={noop}
          onOpenGate={noop}
          onClub={noop}
          onWeekendStand={noop}
          onPlaybook={noop}
          guide={{ lines: ['Every one of these is somebody’s lemonade stand.'], onDismiss: noop }}
        />,
      );
    }
  });

  /*
   * Opening a company card is a different screen inside the same component,
   * and it is where the accounts and the P/E line live — the part a child is
   * meant to read before committing money. Rendering the list is not the same
   * as rendering that.
   */
  it('opens a company card for every company in the snapshot', async () => {
    for (const company of SNAPSHOT) {
      const { container, unmount } = render(
        <MarketScreen
          portfolio={portfolioWith(2, true)}
          readiness={readiness(ready)}
          knowsPE
          badges={20}
          studied={[company.ticker]}
          onResearch={noop}
          onStartBuy={noop}
          onSell={noop}
          onOpenGate={noop}
        />,
      );
      const card = [...container.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').includes(company.ticker),
      );
      expect(card, `no card for ${company.ticker}`).toBeTruthy();
      await userEvent.click(card!);
      const text = container.textContent ?? '';
      expect(text.length, `${company.ticker} card empty`).toBeGreaterThan(50);
      for (const bad of POISON) {
        expect(text, `${company.ticker} card rendered "${bad}"`).not.toContain(bad);
      }
      unmount();
    }
  });
});

describe('the screens whose tabs are separate screens', () => {
  it('walks every tab of the trophy case', async () => {
    const game = createGame(1);
    const full: Game = { ...game, stand: { ...game.stand, history: richHistory }, learned: GLOSSARY.map((w) => w.id) };
    const career: Career = {
      ...createCareer('Ada'),
      badges: BADGES.map((b) => b.id),
      words: GLOSSARY.map((w) => w.id),
      companiesStudied: [SNAPSHOT[0].ticker, SNAPSHOT[1].ticker],
      seasons: 3,
      lifetimeDays: 60,
    };
    const { container, unmount } = render(
      <TrophyScreen game={full} career={career} learned={full.learned} badges={career.badges} onBack={noop} />,
    );
    const tabs = [...container.querySelectorAll('button')].filter(
      (b) => (b.textContent ?? '').length < 24 && !/Back/.test(b.textContent ?? ''),
    );
    expect(tabs.length, 'no tabs found').toBeGreaterThan(2);
    for (const tab of tabs) {
      await userEvent.click(tab);
      const text = container.textContent ?? '';
      for (const bad of POISON) {
        expect(text, `trophy tab "${tab.textContent}" rendered "${bad}"`).not.toContain(bad);
      }
      expect(text.length).toBeGreaterThan(30);
    }
    unmount();
  });

  it('walks the playbook through picking and dropping a rule', async () => {
    let playbook = { name: '', ruleIds: [] as string[] };
    const { container, unmount, rerender } = render(
      <PlaybookScreen playbook={playbook} onChange={(next) => { playbook = next as never; }} onBack={noop} />,
    );
    const rules = [...container.querySelectorAll('button')].filter((b) =>
      /Only/.test(b.textContent ?? ''),
    );
    expect(rules.length, 'no rules offered').toBeGreaterThan(2);
    for (const rule of rules.slice(0, 4)) {
      await userEvent.click(rule);
      rerender(<PlaybookScreen playbook={playbook} onChange={(next) => { playbook = next as never; }} onBack={noop} />);
      const text = container.textContent ?? '';
      for (const bad of POISON) expect(text).not.toContain(bad);
    }
    expect(playbook.ruleIds.length).toBeGreaterThan(0);
    unmount();
  });

  it('walks the club through proposing and passing', async () => {
    let club: ReturnType<typeof createClub> | null = createClub('Lemons', 'Ada', 300, 7);
    const onChange = (next: typeof club) => { club = next; };
    const { container, unmount, rerender } = render(
      <ClubScreen club={club} me="Ada" startingCash={300} seed={7} onChange={onChange} onBack={noop} />,
    );
    for (const label of ['Propose a buy', 'The log', 'How are we doing', 'Pass this turn']) {
      const btn = [...container.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').includes(label),
      );
      if (!btn) continue;
      await userEvent.click(btn);
      rerender(<ClubScreen club={club} me="Ada" startingCash={300} seed={7} onChange={onChange} onBack={noop} />);
      const text = container.textContent ?? '';
      for (const bad of POISON) expect(text, `club "${label}" rendered "${bad}"`).not.toContain(bad);
      expect(text.length, `club "${label}" empty`).toBeGreaterThan(30);
    }
    unmount();
  });
});

describe('the planning screen, driven through its dials', () => {
  /*
   * Two thirds of this screen only exists after a tap: the price sheet, the
   * batch sheet and the rehearsal against yesterday's crowd. Rendering it and
   * walking away covered a fifth of it, which is how a screen with 850 lines
   * and the game's two most important dials sat at 23%.
   */
  it('opens the price sheet, the batch sheet and the rehearsal', async () => {
    const state = playedState(3);
    const { container, unmount } = render(
      <PlanScreen
        state={state}
        stage={{ goal: 'Find the best price.', day: 4, total: 16 }}
        onOpen={noop}
        onInvest={noop}
      />,
    );
    const clean = () => {
      const text = container.textContent ?? '';
      for (const bad of POISON) expect(text, `plan rendered "${bad}"`).not.toContain(bad);
    };

    // The sign and the lemons are the two dials. Both open a sheet.
    for (const label of ['tap the sign', 'cups']) {
      const opener = [...container.querySelectorAll('button')].find((b) =>
        new RegExp(label, 'i').test(b.textContent ?? ''),
      );
      if (!opener) continue;
      await userEvent.click(opener);
      clean();

      // Nudge whatever slider the sheet put up, at both ends of its range.
      for (const slider of container.querySelectorAll('input[type="range"]')) {
        const input = slider as HTMLInputElement;
        for (const value of [input.min, input.max, String((Number(input.min) + Number(input.max)) / 2)]) {
          fireEvent.change(input, { target: { value } });
          clean();
        }
      }
      // And the plus/minus, which round differently from the slider.
      for (const step of container.querySelectorAll('button')) {
        const t = step.textContent ?? '';
        if (t === '+' || t === '−' || t === '-') {
          for (let i = 0; i < 3; i++) await userEvent.click(step);
          clean();
        }
      }
      const done = [...container.querySelectorAll('button')].find((b) =>
        /^\s*Done\s*$/.test(b.textContent ?? ''),
      );
      if (done) await userEvent.click(done);
      clean();
    }

    // The rehearsal: same crowd, whatever plan is currently held.
    const tryIt = [...container.querySelectorAll('button')].find((b) =>
      /Try it on yesterday/i.test(b.textContent ?? ''),
    );
    if (tryIt) {
      await userEvent.click(tryIt);
      clean();
      expect((container.textContent ?? '').length).toBeGreaterThan(50);
    }
    unmount();
  });

  it('rehearses at the extremes of both dials without printing nonsense', async () => {
    for (const seed of [1, 2, 3]) {
      const { container, unmount } = render(
        <PlanScreen state={playedState(2, seed)} onOpen={noop} />,
      );
      for (const slider of container.querySelectorAll('input[type="range"]')) {
        const input = slider as HTMLInputElement;
        for (const value of [input.min, input.max]) {
          fireEvent.change(input, { target: { value } });
        }
      }
      const tryIt = [...container.querySelectorAll('button')].find((b) =>
        /Try it on yesterday/i.test(b.textContent ?? ''),
      );
      if (tryIt) await userEvent.click(tryIt);
      const text = container.textContent ?? '';
      for (const bad of POISON) expect(text, `seed ${seed} rendered "${bad}"`).not.toContain(bad);
      unmount();
    }
  });
});
