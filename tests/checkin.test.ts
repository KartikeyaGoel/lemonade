/**
 * The daily check-in.
 *
 * Built from the customer's six-step ritual, and two of the tests below are
 * about the ritual having been squared with the product rather than bolted
 * beside it:
 *
 *  - **It is a sequence, not a screenful.** §26's rule is "one card a day, one
 *    word a day, one finger", and the failure it records fixing was three
 *    stacked panels on day one. Six questions at once is that failure with a
 *    bigger number, so the steps are asserted to be delivered one at a time.
 *  - **"Nothing to do today" has to be a *right answer*.** The note's own
 *    phrasing is "sometimes yes, often no", and it is the thing that keeps the
 *    credit honest: a child is paid for judging correctly, and most days the
 *    correct judgement is to leave it alone. So `neededToday` has to be willing
 *    to say nothing, and be right.
 *
 * And one that matters more than either: the duck must never invent a reason a
 * price moved. Everything in `Story` is derived from the replayed price history,
 * and the test for "the market moved, not your company" is the piece of
 * scepticism the whole ritual exists to install.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTIONS,
  MOVERS,
  STEPS,
  checkIn,
  checkInLine,
  copyFor,
  mark,
  neededToday,
  stepOf,
  stepsFor,
  storyFor,
  type Answers,
} from '../src/lib/checkin';
import { createLedger, record, type Ledger } from '../src/lib/ledger';
import { awardFor } from '../src/lib/credits';
import { buy, createPortfolio, type PortfolioState } from '../src/lib/market';
import { SNAPSHOT } from '../src/lib/companies';

const START = 500;
const TODAY = '2026-09-07';

/**
 * A portfolio with a hand-built price history, so a week's move is known.
 *
 * `createPortfolio(startingCash, seed)` — cash first. Read from the real
 * signature after passing the arguments the other way round produced a
 * portfolio with no money, every `buy` refused with "You have no cash to
 * spend", and three tests that failed for a reason that had nothing to do with
 * what they were testing. PRODUCT.md §49: build fixtures from the real
 * constructors, and check what they actually take.
 */
function withHistory(moves: Record<string, number[]>): PortfolioState {
  const base = createPortfolio(START);
  return { ...base, priceHistory: { ...base.priceHistory, ...moves } };
}

const noCareer = { companiesStudied: [] as string[] };

describe('the six steps arrive one at a time', () => {
  it('has exactly the six the note asked for, in order', () => {
    expect(STEPS).toEqual([
      'what-happened',
      'why',
      'does-it-touch-me',
      'do-i-act',
      'discover',
      'credits',
    ]);
  });

  /*
   * The bug a browser found on the very first check-in a child can reach.
   *
   * With no story, the ritual still asked "why did it happen?" and "does it
   * touch anything you own?" — about nothing. And it marked them: a child
   * holding Apple answered "yes, I own some of that" and was told they did
   * not, because with no story the owned-flag falls back to false. A right
   * answer scored wrong, on a question that should not have been asked.
   */
  it('drops the questions about the story when there is no story', () => {
    const fresh = createPortfolio(START);
    const state = checkIn(fresh, noCareer, createLedger(), TODAY, START);
    expect(state.story).toBeNull();

    const steps = stepsFor(state);
    expect(steps).not.toContain('why');
    expect(steps).not.toContain('does-it-touch-me');
    expect(steps).toContain('do-i-act');
    expect(steps).toHaveLength(4);
  });

  it('asks all six once there is a week to talk about', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    const state = checkIn(withHistory(flat), noCareer, createLedger(), TODAY, START);
    expect(state.story).not.toBeNull();
    expect(stepsFor(state)).toHaveLength(6);
  });

  it('never marks an answer to a question it did not ask', () => {
    const fresh = createPortfolio(START);
    const state = checkIn(fresh, noCareer, createLedger(), TODAY, START);

    // Even handed an answer, there is nothing to judge it against.
    const marked = mark(state, { because: 'company', touchesMe: true, needed: 'nothing' });
    expect(marked.outOf).toBe(1);
    expect(marked.lines).toHaveLength(1);
  });

  it('hands over one step per index and clamps at both ends', () => {
    expect(stepOf(0)).toBe('what-happened');
    expect(stepOf(3)).toBe('do-i-act');
    expect(stepOf(5)).toBe('credits');
    // Out of range on either side is the nearest real step, never undefined:
    // a ritual that renders a blank card is worse than one that repeats itself.
    expect(stepOf(-4)).toBe('what-happened');
    expect(stepOf(99)).toBe('credits');
  });

  it('gives every step one question and a line under it', () => {
    const state = checkIn(withHistory({}), noCareer, createLedger(), TODAY, START);
    for (const step of STEPS) {
      const copy = copyFor(step, state);
      expect(copy.question, step).toMatch(/\S/);
      expect(copy.said.length, step).toBeGreaterThan(15);
      // One question per step. Two question marks is two questions.
      expect((copy.question.match(/\?/g) ?? []).length, step).toBeLessThanOrEqual(1);
    }
  });

  it('says out loud that most days need nothing, before the child answers', () => {
    const state = checkIn(withHistory({}), noCareer, createLedger(), TODAY, START);
    expect(copyFor('do-i-act', state).said).toMatch(/most days no/i);
  });
});

describe('the story is derived, never invented', () => {
  it('picks the biggest mover and explains it as company news', () => {
    const ticker = SNAPSHOT[0].ticker;
    const others = Object.fromEntries(
      SNAPSHOT.slice(1).map((c) => [c.ticker, [100, 100]]),
    );
    const story = storyFor(withHistory({ ...others, [ticker]: [100, 120] }));

    expect(story).not.toBeNull();
    expect(story!.ticker).toBe(ticker);
    expect(Math.round(story!.change * 100)).toBe(20);
    expect(story!.because).toBe('company');
    expect(story!.headline).toMatch(/went up 20%/);
  });

  /*
   * The piece of scepticism the ritual exists to install.
   *
   * When everything moved together, the honest answer to "why did my company
   * go up" is "it did not, the market did". A game that told a child their
   * company had news every time the market drifted would be teaching them to
   * invent causes, which is the worst habit in the subject.
   */
  it('says the market moved when everything moved together', () => {
    const all = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 108]]));
    const story = storyFor(withHistory(all));
    expect(story!.because).toBe('market');
  });

  it('prefers a company the child actually owns', () => {
    const mine = SNAPSHOT[3].ticker;
    const loud = SNAPSHOT[0].ticker;
    let portfolio = withHistory({
      ...Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]])),
      [loud]: [100, 140],
      [mine]: [100, 108],
    });
    portfolio = buy(portfolio, mine, 100).portfolio;

    const story = storyFor(portfolio);
    // The 40% mover is not the story. The 8% mover they own is.
    expect(story!.ticker).toBe(mine);
    expect(story!.owned).toBe(true);
    expect(story!.told).toMatch(/You own some of this one/);
  });

  it('still has something to say on a day nothing happened', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    const state = checkIn(withHistory(flat), noCareer, createLedger(), TODAY, START);
    expect(copyFor('what-happened', state).said).toMatch(/barely moved|Quiet week/);
  });

  /*
   * Found in a browser, on the very first check-in a child can reach.
   *
   * A fresh portfolio holds one price per company — the snapshot close — so
   * every week-over-week change is zero for want of anything to subtract. The
   * screen read "Apple went up 0% this week" above a duck saying it had barely
   * moved: two sentences disagreeing about a week that had not happened yet.
   */
  it('does not report a week that has not happened', () => {
    // The real shape of a new portfolio: one price, no history.
    const fresh = createPortfolio(START);
    expect(storyFor(fresh)).toBeNull();

    const state = checkIn(fresh, noCareer, createLedger(), TODAY, START);
    expect(state.weeksOpen).toBeLessThan(2);
    expect(copyFor('what-happened', state).said).toMatch(/only just opened/i);
    expect(copyFor('what-happened', state).said).not.toMatch(/0%/);
  });

  it('never says a price went up by nothing', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    const story = storyFor(withHistory(flat));
    expect(story!.headline).not.toMatch(/up 0%|down 0%/);
    expect(story!.headline).toMatch(/barely moved/);
  });
});

describe('does anything need doing — usually not', () => {
  it('says nothing on a quiet week with a spread portfolio', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    let portfolio = withHistory(flat);
    for (const company of SNAPSHOT.slice(0, 4)) {
      portfolio = buy(portfolio, company.ticker, 100).portfolio;
    }
    expect(neededToday(portfolio, storyFor(portfolio), START)).toBe('nothing');
  });

  it('says nothing when a company the child does not own moves hard', () => {
    const loud = SNAPSHOT[0].ticker;
    const portfolio = withHistory({
      ...Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]])),
      [loud]: [100, 130],
    });
    // Not owned, so it is not about the child's money.
    expect(neededToday(portfolio, storyFor(portfolio), START)).toBe('nothing');
  });

  /*
   * "Spread out" is reachable, and it took a failing test to find out how.
   *
   * The first version of this bought 80% of the portfolio into one company and
   * got "nothing" back — because `market.ts` **refuses** any position over 35%
   * at the point of purchase, with "Keep any one company under 35% of your
   * money." So the concentration the customer's note wants a child to notice
   * cannot be created the obvious way, and a branch that only fired on an
   * impossible portfolio would be PRODUCT.md §40's defect: a mechanic wired to
   * nothing.
   *
   * It is reachable by the route that survives the cap: two holdings at a third
   * each is under 35% apiece and still under the three-holding bar for
   * `diversified`. That is the real shape of a concentrated portfolio here, and
   * it is the one the ritual has to catch.
   */
  it('says spread out when the money is in only two companies', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    let portfolio = withHistory(flat);
    for (const company of SNAPSHOT.slice(0, 2)) {
      const done = buy(portfolio, company.ticker, 150);
      expect(done.ok, done.ok ? '' : (done as { reason?: string }).reason).toBe(true);
      portfolio = done.portfolio;
    }
    expect(Object.keys(portfolio.holdings)).toHaveLength(2);
    expect(neededToday(portfolio, storyFor(portfolio), START)).toBe('spread-out');
  });

  it('stops saying it once the money is spread across three', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    let portfolio = withHistory(flat);
    for (const company of SNAPSHOT.slice(0, 3)) {
      portfolio = buy(portfolio, company.ticker, 150).portfolio;
    }
    expect(neededToday(portfolio, storyFor(portfolio), START)).toBe('nothing');
  });

  it('says look again when something owned moved on its own news', () => {
    const mine = SNAPSHOT[0].ticker;
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    let portfolio = withHistory({ ...flat, [mine]: [100, 82] });
    for (const company of SNAPSHOT.slice(0, 4)) {
      portfolio = buy(portfolio, company.ticker, 100).portfolio;
    }
    const story = storyFor(portfolio);
    expect(story!.because).toBe('company');
    expect(neededToday(portfolio, story, START)).toBe('look-again');
  });

  it('gives every action a label and a reason a child could read', () => {
    for (const [key, action] of Object.entries(ACTIONS)) {
      expect(action.label.length, key).toBeGreaterThan(8);
      expect(action.kidLine.length, key).toBeGreaterThan(20);
    }
    for (const [key, mover] of Object.entries(MOVERS)) {
      expect(mover.label.length, key).toBeGreaterThan(8);
      expect(mover.kidLine.length, key).toBeGreaterThan(20);
    }
  });
});

describe('marking the answers', () => {
  const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
  const state = () => checkIn(withHistory(flat), noCareer, createLedger(), TODAY, START);

  it('marks all three right', () => {
    const here = state();
    const answers: Answers = {
      because: here.because,
      touchesMe: here.touchesMe,
      needed: here.needed,
    };
    const marked = mark(here, answers);
    expect(marked.outOf).toBe(3);
    expect(marked.right).toBe(3);
    expect(marked.allRight).toBe(true);
    expect(marked.lines.every((line) => /^Right/.test(line))).toBe(true);
  });

  it('explains rather than scolds when one is wrong', () => {
    const here = state();
    const wrong = here.because === 'market' ? 'company' : 'market';
    const marked = mark(here, { because: wrong });
    expect(marked.right).toBe(0);
    expect(marked.allRight).toBe(false);
    // The correction has to carry the explanation, not just the verdict.
    expect(marked.lines[0].length).toBeGreaterThan(25);
  });

  it('marks nothing when nothing was answered', () => {
    const marked = mark(state(), {});
    expect(marked.outOf).toBe(0);
    expect(marked.allRight).toBe(false);
  });
});

describe('what the check-in offers to read next', () => {
  it('offers a company the child has never opened', () => {
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    const read = SNAPSHOT.slice(0, 3).map((c) => c.ticker);
    const state = checkIn(withHistory(flat), { companiesStudied: read }, createLedger(), TODAY, START);
    expect(state.discover).not.toBeNull();
    expect(read).not.toContain(state.discover!.ticker);
  });

  it('does not offer one already in the trophy case', () => {
    // §16's rule about the collection: it must not be farmable by reopening.
    const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
    const all = SNAPSHOT.map((c) => c.ticker);
    const state = checkIn(withHistory(flat), { companiesStudied: all }, createLedger(), TODAY, START);
    expect(state.discover).toBeNull();
    expect(copyFor('discover', state).said).toMatch(/read every company/i);
  });
});

describe('what it says on the way in', () => {
  const flat = Object.fromEntries(SNAPSHOT.map((c) => [c.ticker, [100, 100]]));
  const done = (): Ledger => awardFor(createLedger(), 'answered-the-check-in', TODAY).ledger;

  it('knows it has already been done today, and does not offer to pay twice', () => {
    const state = checkIn(withHistory(flat), noCareer, done(), TODAY, START);
    expect(state.doneToday).toBe(true);
    expect(checkInLine(state, 4)).toMatch(/4 days running/);
  });

  it('names what is waiting rather than how long it has been', () => {
    /*
     * §15's engines are records of the child, not complaints about them. "You
     * have not played for 3 days" is a telling-off; "Nike moved this week" is
     * a reason to open it.
     */
    const state = checkIn(withHistory(flat), noCareer, createLedger(), TODAY, START);
    const line = checkInLine(state, 0);
    expect(line).not.toMatch(/have not|haven't|missed|lost|days ago/i);
    expect(line.length).toBeGreaterThan(10);
  });

  it('does not brag about a streak of one', () => {
    const state = checkIn(withHistory(flat), noCareer, done(), TODAY, START);
    expect(checkInLine(state, 1)).toBe('Checked in today.');
  });
});

describe('the ledger the ritual writes to', () => {
  it('pays once a day and no more, however many times it is opened', () => {
    let led: Ledger = createLedger();
    const first = awardFor(led, 'answered-the-check-in', TODAY);
    led = first.ledger;
    const second = awardFor(led, 'answered-the-check-in', TODAY);
    led = second.ledger;

    expect(first.credits).toBe(15);
    expect(second.credits).toBe(0);
    expect(second.capped).toBe(true);
  });

  it('counts a day only once it has a deed on it', () => {
    // Opening the app writes nothing, so the day does not exist yet.
    const empty = createLedger();
    expect(empty.days).toEqual([]);
    expect(record(empty, 'answered-the-check-in', TODAY, 15).days).toEqual([TODAY]);
  });
});
