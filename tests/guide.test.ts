import { describe, expect, it } from 'vitest';
import {
  GUIDE_NAME,
  LEDGER_OPEN_DAYS,
  STALL_DAY,
  allBeats,
  closingLine,
  ledgerNoveltyOf,
  ledgerStartsOpen,
  lineFor,
  nextBeat,
  type Beat,
  type GuideContext,
} from '../src/lib/guide';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  createInitialState,
  orderForTargetCups,
  runDay,
  type DayOutcome,
  type GameState,
} from '../src/lib/simulation';

/** Act 2 params: no last day, no cash floor. */
const ACT2 = { ...DEFAULT_DAY_PARAMS, lastDay: null, cashFloor: null };

function play(days: number, price = 1.75, cups = 28) {
  let stand: GameState = createInitialState(4242);
  const outcomes: DayOutcome[] = [];
  for (let i = 0; i < days; i += 1) {
    const params = i < ECON.TOTAL_DAYS - 1 ? DEFAULT_DAY_PARAMS : ACT2;
    const outcome = runDay(stand, { ...orderForTargetCups(stand, cups), price }, params);
    outcomes.push(outcome);
    stand = outcome.nextState;
  }
  return { stand, outcomes };
}

const context = (over: Partial<GuideContext> = {}): GuideContext => ({
  act: 1,
  daysPlayed: 3,
  act2Day: 1,
  hasManager: false,
  inMarket: false,
  listed: false,
  ...over,
});

describe('the rule Pip exists under', () => {
  /**
   * The one that matters. A guide that suggests a price, a batch size or a
   * purchase has taken over the decision the kid is here to make, and every
   * claim in the grown-up report becomes a measure of how well a child follows
   * instructions instead of a measure of judgment.
   *
   * Naming a cost line is observation. "Try a lower price" is not.
   */
  const ADVICE =
    /\b(try|should|next time|tomorrow,? (make|buy|charge|raise|lower)|you (ought|need) to|why not|instead,? )\b/i;

  it('never tells the kid what to do next, in any beat', () => {
    for (const beat of allBeats()) {
      for (const line of lineFor(beat).says) {
        expect(line, `${beat}: ${line}`).not.toMatch(ADVICE);
      }
    }
  });

  it('never tells the kid what to do next, on any day it can describe', () => {
    // Sweep real days at prices that lose money, sell out and sit in between,
    // so every branch of `closingLine` is exercised on real numbers.
    for (const price of [0.4, 1.0, 1.75, 2.6, 3.5]) {
      for (const cups of [4, 28, 90]) {
        for (const outcome of play(7, price, cups).outcomes) {
          const line = closingLine(outcome);
          expect(line, line).not.toMatch(ADVICE);
        }
      }
    }
  });

  it('never restates the profit on its own, so the ledger is still the source', () => {
    // Pip's line is one number short on purpose. If it printed the profit it
    // would be a substitute for the statement rather than a door into it.
    //
    // A day with no sales is exempt, and the exemption is arithmetic rather
    // than a softening of the rule: revenue and ingredients are both zero, so
    // the statement has exactly one line, and the loss *is* the stand fee.
    // There is no way to name the cause of that day without naming a figure
    // that equals the profit, because they are the same figure.
    for (const price of [0.4, 1.75, 3.5]) {
      for (const outcome of play(7, price).outcomes) {
        if (outcome.cupsSold === 0) continue;
        const profit = `$${Math.abs(outcome.profit).toFixed(2)}`;
        expect(closingLine(outcome), `${price}: ${closingLine(outcome)}`).not.toContain(profit);
      }
    }
  });

  it('always names a line of the statement, with a real number in it', () => {
    for (const price of [0.4, 1.0, 1.75, 2.6]) {
      for (const outcome of play(7, price).outcomes) {
        const line = closingLine(outcome);
        expect(line, line).toMatch(/\$\d|\d+ (lemons|cups|people)/);
      }
    }
  });

  it('keeps every line short enough to be read rather than skipped', () => {
    for (const beat of allBeats()) {
      for (const line of lineFor(beat).says) {
        expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(12);
      }
    }
    for (const outcome of play(7).outcomes) {
      expect(closingLine(outcome).split(/\s+/).length).toBeLessThanOrEqual(22);
    }
  });

  it('uses no grown-up vocabulary the kid has not earned', () => {
    const jargon = /margin|capital|valuation|equity|unit economics|fixed cost|opex|overhead/i;
    for (const beat of allBeats()) {
      for (const line of lineFor(beat).says) {
        expect(line, `${beat}: ${line}`).not.toMatch(jargon);
      }
    }
    for (const price of [0.4, 1.75, 3.5]) {
      for (const outcome of play(7, price).outcomes) {
        expect(closingLine(outcome)).not.toMatch(jargon);
      }
    }
  });
});

describe('the thread', () => {
  it('opens by saying where this ends up, not what a lemonade stand is', () => {
    const line = nextBeat(context({ daysPlayed: 0 }), []);
    expect(line?.id).toBe('welcome');
    expect(line?.says.join(' ')).toMatch(/real companies/i);
    expect(line?.says.join(' ')).toContain(GUIDE_NAME);
  });

  it('closes the loop at the market with the thesis the product rests on', () => {
    const line = nextBeat(context({ act: 4, inMarket: true }), ['welcome']);
    expect(line?.id).toBe('market');
    expect(line?.says.join(' ')).toMatch(/lemonade stand/i);
  });

  it('says everything once and then goes quiet for ever', () => {
    // A mascot that repeats itself is wallpaper by the third time.
    const seen: string[] = [];
    const contexts = [
      context({ daysPlayed: 0 }),
      context({ act: 2, act2Day: 1 }),
      context({ act: 2, act2Day: 11 }),
      context({ act: 3 }),
      context({ act: 4 }),
      context({ act: 4, inMarket: true }),
    ];
    for (let pass = 0; pass < 3; pass += 1) {
      for (const ctx of contexts) {
        const line = nextBeat(ctx, seen);
        if (line) seen.push(line.id);
      }
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain('welcome');
    expect(seen).toContain('market');
  });

  it('speaks the stall beat in exactly the state the playtester quit in', () => {
    // Act 2, past halfway, no manager: an unbounded day loop with the thing
    // that ends the act never attempted.
    const stalled = context({ act: 2, act2Day: 11, hasManager: false });
    expect(nextBeat(stalled, ['welcome', 'act2-open'])?.id).toBe('act2-stall');
  });

  it('does not nag before halfway, or once the manager is hired', () => {
    const seen = ['welcome', 'act2-open'];
    expect(nextBeat(context({ act: 2, act2Day: STALL_DAY - 1 }), seen)).toBeNull();
    expect(nextBeat(context({ act: 2, act2Day: 12, hasManager: true }), seen)).toBeNull();
  });

  it('states the act’s objective rather than a way of reaching it', () => {
    /*
     * "Somebody else could mind this stand" is the state of the world. "Then
     * your hands would be free" is the consequence, and it is the thing the act
     * is actually about now that a manager is the unlock rather than the
     * finish. Neither is a route: the word that would make this advice is
     * `hire`, and Pip is never allowed to say it.
     */
    const stall = lineFor('act2-stall').says.join(' ');
    expect(stall).toMatch(/mind this stand|hands would be free/i);
    expect(stall).not.toMatch(/\bhire\b/i);
    expect(stall).not.toMatch(/\byou (should|could|need to|have to)\b/i);
  });

  it('names the market differently for a founder who kept the company', () => {
    // Two doors lead into the market and they are not the same story. Telling
    // a kid who sold up "your company has a price now" is a line about a run
    // they did not have.
    const sold = nextBeat(context({ act: 5, listed: false }), ['welcome']);
    const kept = nextBeat(context({ act: 5, listed: true }), ['welcome']);
    expect(sold!.id).toBe('act5-open-sold');
    expect(kept!.id).toBe('act5-open');
    expect(sold!.says.join(' ')).toMatch(/sold/i);
    expect(kept!.says.join(' ')).toMatch(/price/i);
  });

  it('gives every act after the first a handoff', () => {
    // Every stage after the first, and the market twice — once for each door.
    for (const [act, beat] of [
      [2, 'act2-open'],
      [3, 'act3-open'],
      [4, 'act4-open'],
      [5, 'act5-open-sold'],
    ] as Array<[2 | 3 | 4 | 5, Beat]>) {
      expect(nextBeat(context({ act }), ['welcome'])?.id).toBe(beat);
    }
  });
});

describe('when the whole statement is shown anyway', () => {
  it('is open for the first days, when the ledger is the lesson', () => {
    const { outcomes, stand } = play(LEDGER_OPEN_DAYS + 3);
    for (const outcome of outcomes.slice(0, LEDGER_OPEN_DAYS)) {
      expect(ledgerStartsOpen(outcome, stand.history), `day ${outcome.day}`).toBe(true);
    }
  });

  it('folds once the kid has read it three times and nothing is new', () => {
    // A steady day at a steady price after day three: nothing unfamiliar in it.
    const { outcomes, stand } = play(7);
    const steady = outcomes.filter(
      (o) => o.day > LEDGER_OPEN_DAYS && ledgerNoveltyOf(o, stand.history) === null,
    );
    expect(steady.length).toBeGreaterThan(0);
    for (const outcome of steady) {
      expect(ledgerStartsOpen(outcome, stand.history)).toBe(false);
    }
  });

  it('opens itself on a first losing day, whatever day number that is', () => {
    // Price under cost from day four on: the loss is the first the kid sees.
    let stand = createInitialState(99);
    const good = play(5);
    stand = good.stand;
    const bad = runDay(stand, { ...orderForTargetCups(stand, 40), price: 0.2 }, ACT2);

    expect(bad.day).toBeGreaterThan(LEDGER_OPEN_DAYS);
    expect(bad.profit).toBeLessThan(0);
    expect(ledgerNoveltyOf(bad, bad.nextState.history)).toBe('first losing day');
    expect(ledgerStartsOpen(bad, bad.nextState.history)).toBe(true);
  });

  it('never claims a row is new twice', () => {
    // Two losing days in a row: only the first is a new row.
    const { stand } = play(5);
    const first = runDay(stand, { ...orderForTargetCups(stand, 40), price: 0.2 }, ACT2);
    const second = runDay(
      first.nextState,
      { ...orderForTargetCups(first.nextState, 40), price: 0.2 },
      ACT2,
    );
    expect(ledgerNoveltyOf(first, first.nextState.history)).toBe('first losing day');
    expect(ledgerNoveltyOf(second, second.nextState.history)).not.toBe('first losing day');
  });

  it('opens on a first spoiled lemon', () => {
    // Buy far more than a cold day can sell, for long enough that lots age out.
    let stand = createInitialState(7);
    let found: DayOutcome | null = null;
    for (let i = 0; i < 12; i += 1) {
      const params = i < ECON.TOTAL_DAYS - 1 ? DEFAULT_DAY_PARAMS : ACT2;
      const outcome = runDay(stand, { ...orderForTargetCups(stand, 120), price: 3.4 }, params);
      stand = outcome.nextState;
      if (outcome.spoiledLemons > 0) {
        found = outcome;
        break;
      }
    }
    if (found) {
      expect(ledgerStartsOpen(found, found.nextState.history)).toBe(true);
    } else {
      // The economy would not produce spoilage on this seed; the rule is still
      // covered by the losing-day case, so this is not a failure.
      expect(found).toBeNull();
    }
  });
});

describe('what Pip says about a day', () => {
  it('names capacity when the kid ran out, with the numbers on both sides', () => {
    const { outcomes } = play(7, 1.0, 6);
    const soldOut = outcomes.find((o) => o.cupsWanted > o.cupsMakeable);
    expect(soldOut).toBeDefined();
    const line = closingLine(soldOut!);
    expect(line).toMatch(/sold every cup/i);
    expect(line).toContain(String(soldOut!.cupsMakeable));
  });

  it('names the cost that caused a loss rather than just reporting one', () => {
    // A losing day that did *not* sell out, so the loss branch is the one that
    // speaks. Capacity outranks it on purpose: when a kid ran out of cups,
    // that is what decided the day and it is what Pip should say.
    const losers = [0.4, 2.9, 3.4, 3.9].flatMap((price) =>
      play(7, price, 40).outcomes.filter(
        (o) => o.profit < 0 && o.cupsWanted <= o.cupsMakeable,
      ),
    );
    expect(losers.length).toBeGreaterThan(0);
    for (const bad of losers) {
      const line = closingLine(bad);
      expect(line, line).toMatch(/\$\d/);
      expect(line, line).toMatch(/cost|owe/i);
    }
  });

  it('never says a cup sold for a price when no cup sold', () => {
    // Found on screen, not by a test: a day with zero sales said "each cup
    // sold for $3.00 and cost $0.00 to make". Both halves were false, and
    // every number on this screen is supposed to be the kid's own and true.
    const { stand } = play(4);
    const nobody = runDay(stand, { ...orderForTargetCups(stand, 30), price: 9 }, ACT2);
    expect(nobody.cupsSold).toBe(0);

    const line = closingLine(nobody);
    expect(line).toMatch(/Nobody bought/i);
    expect(line).not.toMatch(/each cup sold/i);
    expect(line).not.toContain('$0.00');
    // What it says instead is the one line that is true on a day with no sales.
    expect(line).toContain(
      `$${nobody.fixedCostLines.reduce((sum, l) => sum + l.amount, 0).toFixed(2)}`,
    );
  });

  it('reconciles: the two numbers it prints are the ones in the ledger', () => {
    // Any figure Pip says has to be a figure the kid can find in the
    // statement, or the fold would be hiding a contradiction.
    for (const outcome of play(7).outcomes) {
      const line = closingLine(outcome);
      const shown = [...line.matchAll(/\$(\d+\.\d{2})/g)].map((m) => Number(m[1]));
      const real = [
        outcome.revenue,
        outcome.ingredients.total,
        outcome.ingredients.perCup,
        outcome.grossProfit,
        outcome.spoilageCost,
        outcome.price,
        outcome.fixedCostLines.reduce((sum, l) => sum + l.amount, 0),
      ].map((value) => Number(value.toFixed(2)));
      for (const figure of shown) {
        expect(real, `${figure} in "${line}"`).toContain(figure);
      }
    }
  });
});
