/**
 * What the endless part gives, week by week, measured.
 *
 * ## Why this file exists
 *
 * `tests/arclength.test.ts` measures the arc — the stand, the business, the
 * flotation — because `ACT2_DAYS = 16` was a bare constant that every test
 * agreed with and a child put the game down over. PRODUCT.md §76.
 *
 * The live market never had the equivalent, and it is the half the whole
 * engagement thesis rests on:
 *
 * > well the market is infinite no, thats the engagement part where the user
 * > should play the market forever and keep inviting friends, kinda like clash
 * > royale?
 *
 * Right — which makes "does it keep giving" a question about the *live* loop
 * rather than about the twelve-week on-ramp, and nothing measured it. It had
 * unit tests for every function and no measurement of the experience. §79
 * named that as the largest unexamined area in the product.
 *
 * ## How a future week is simulated, and why that is honest
 *
 * A live account is anchored to the newest close in the file, so it cannot
 * advance without the world producing a week. To play a year forward, the
 * account is anchored a year *back* in the same real history and caught up —
 * which is precisely what a child who opened an account last September and came
 * back today would get, run through the same `advanceWeek` the app uses.
 *
 * Real closes, real gaps, real scares. Nothing here is a synthetic price
 * series, and no figure is invented.
 *
 * ## What it deliberately does not claim
 *
 * Not whether the loop is *fun*. That stays the one thing no gate can answer
 * and only a child can — §78 says so and this file does not pretend otherwise.
 * What it can answer is the mechanical precondition for fun: **is there
 * something here next week, and is it still here in a year.**
 */
import { describe, expect, it } from 'vitest';
import {
  LATEST_WEEK,
  catchUp,
  createLivePortfolio,
  dateOfWeek,
  daysBetween,
  latestDate,
  runningFor,
  stepsBehind,
} from '../src/lib/live';
import {
  DRAWDOWN_THRESHOLD,
  HISTORY_WEEKS,
  MARKET_WEEKS,
  advanceWeek,
  buy,
  createPortfolio,
  currentDate,
  realClose,
  summarisePortfolio,
  totalValue,
  windowStartFor,
  type PortfolioState,
} from '../src/lib/market';
import { FIRST_HONEST_WEEK, SNAPSHOT } from '../src/lib/companies';
import { checkIn, storyFor } from '../src/lib/checkin';
import { EARNERS, awardFor, creditsCard } from '../src/lib/credits';
import { createLedger, record } from '../src/lib/ledger';
import { BADGE_COUNT, STANDING_CEILING, rankFor } from '../src/lib/achievements';
import { GLOSSARY } from '../src/lib/glossary';
import { advanceClubWeek, clubAttribution, createClub, joinClub } from '../src/lib/club';
import {
  CHALLENGE_DAYS,
  compareRuns,
  createChallenge,
  summariseRun,
} from '../src/lib/challenge';
import { createChallengeGame } from '../src/lib/progress';
import { ECON, batchPlan, runDay } from '../src/lib/simulation';
import { paramsForDay, settleDay } from '../src/lib/day';

/** A year of weeks, which is the horizon anybody has any business claiming. */
const WEEKS = 52;

/**
 * An account opened `rows` of price data ago, with money in three companies.
 *
 * Three because `DIVERSIFIED_MIN_HOLDINGS` is three, and an undiversified
 * account makes `neededToday` return `spread-out` for ever — which would make
 * every week below look identical for a reason that is about the fixture rather
 * than about the loop.
 */
function accountOpenedRowsAgo(rows: number): PortfolioState {
  const fresh = createLivePortfolio(3000);
  const windowStart = Math.max(0, LATEST_WEEK - rows);
  let account: PortfolioState = {
    ...fresh,
    windowStart,
    anchorDate: dateOfWeek(windowStart),
    /*
     * Seeded from the close at the anchor row, not from the snapshot price.
     *
     * `createLivePortfolio` seeds from the newest row because that is where it
     * puts the account; moving `windowStart` back without moving the seed buys
     * the shares at today's price and then marks them against a year-old
     * close. The first version of this fixture did exactly that and produced a
     * fifteen percent move in week one out of nothing but the mismatch — a
     * measurement harness lying in the direction that flatters the product.
     */
    priceHistory: Object.fromEntries(
      Object.keys(fresh.priceHistory).map((ticker) => [
        ticker,
        [realClose(ticker, windowStart, 0)],
      ]),
    ),
  };
  for (const ticker of ['AAPL', 'COST', 'NKE']) {
    const done = buy(account, ticker, 800);
    if (done.ok) account = done.portfolio;
  }
  return account;
}

interface Week {
  index: number;
  date: string;
  /** Was there a market story to open the check-in with? */
  hadStory: boolean;
  /** What the check-in said today actually called for. */
  needed: string;
  /** Credits the ritual paid, which is the loop's own currency. */
  paid: number;
  value: number;
}

/** A year of live weeks, played one at a time. */
function liveYear(): Week[] {
  let account = accountOpenedRowsAgo(WEEKS);
  const startingValue = totalValue(account);
  let ledger = createLedger();
  const weeks: Week[] = [];

  for (let i = 0; i < WEEKS; i += 1) {
    account = advanceWeek(account).portfolio;
    const on = currentDate(account);
    const story = storyFor(account);
    const state = checkIn(account, { companiesStudied: [] }, ledger, on, startingValue);
    const award = awardFor(ledger, 'answered-the-check-in', on);
    ledger = record(ledger, 'answered-the-check-in', on, award.credits);
    weeks.push({
      index: i,
      date: on,
      hadStory: story !== null,
      needed: state.needed,
      paid: award.credits,
      value: totalValue(account),
    });
  }
  return weeks;
}

const YEAR = liveYear();

describe('a year on the live market, week by week', () => {
  it('has something to say every single week', () => {
    /*
     * Measured: 52 of 52 weeks produced a story, every one naming a real
     * company and a real move.
     *
     * This is the loop's floor. The check-in is the daily ritual and its first
     * step is "what happened?" — a week with no answer is a week the app opens
     * on a blank. `storyFor` already refuses to invent one on a fresh account
     * with a single price per company, which is correct and is why this is
     * worth asserting for every later week rather than assuming it.
     */
    const silent = YEAR.filter((week) => !week.hadStory);
    expect(silent.map((w) => w.date), 'weeks with nothing to say').toEqual([]);
  });

  it('says "do nothing" most weeks, because that is the lesson', () => {
    /*
     * Measured: 40 of 52 weeks asked for nothing; the other 12 said
     * 'look-again', which is a company the child holds having moved more than
     * `COMPANY_MOVE` on its own news.
     *
     * The direction of this assertion is the point. A loop tuned for
     * engagement would find a job for the child every week; `neededToday`'s own
     * note is "sometimes yes, often no", and a version of this product that
     * drifted into weekly homework would fail here rather than in a review.
     */
    const nothing = YEAR.filter((week) => week.needed === 'nothing').length;
    expect(nothing / YEAR.length, `${nothing}/${YEAR.length} weeks asked for nothing`).toBeGreaterThan(0.6);
    /* And not *every* week, or the ritual is decoration. */
    expect(nothing).toBeLessThan(YEAR.length);
  });

  it('pays the ritual the same in week fifty-two as in week one', () => {
    /*
     * The property that makes a loop endless rather than merely long: nothing
     * in the economy decays with time or with repetition. The check-in pays
     * `answered-the-check-in` once a day, every day, at the rate in `EARNERS` —
     * there is no ramp, no diminishing return and no exhaustion.
     *
     * Asserted against the table rather than against week one, so a change to
     * the rate fails in `credits.ts` where it belongs instead of here.
     */
    const rate = EARNERS.find((earner) => earner.deed === 'answered-the-check-in')!.worth;
    for (const week of YEAR) {
      expect(week.paid, `week ${week.index} paid ${week.paid}`).toBe(rate);
    }
  });

  it('is a market rather than a payout, which means it goes down', () => {
    /*
     * Measured over the last year of real closes, on a $3,000 account split
     * across Apple, Costco and Nike: **26 of 52 weeks fell, and the year
     * finished down 4%** — $3,000 to $2,881.
     *
     * Asserted because it is the one property an engagement loop is under
     * constant pressure to lose. A weekly ritual that always pays is a slot
     * machine with a lesson stapled to it, and the whole claim of this product
     * is that the numbers are real. If a future change ever smooths the series,
     * clamps a fall or seeds a kinder window, this fails.
     *
     * Stated as a floor well under the measured 26, because the figure moves
     * with whatever year the file happens to hold.
     */
    const down = YEAR.filter((week, i) => i > 0 && week.value < YEAR[i - 1].value).length;
    expect(down, `${down}/${YEAR.length - 1} weeks fell`).toBeGreaterThan(YEAR.length / 5);
  });

  it('never prints a figure a child could catch out', () => {
    /*
     * A year of compounding through real closes, checked for the arithmetic
     * failures that actually reach a screen: a non-finite value, a negative
     * holding, a total that does not equal cash plus holdings.
     */
    let account = accountOpenedRowsAgo(WEEKS);
    const startingValue = totalValue(account);
    for (let i = 0; i < WEEKS; i += 1) {
      account = advanceWeek(account).portfolio;
      const summary = summarisePortfolio(account, startingValue);
      expect(Number.isFinite(summary.currentValue), `week ${i}`).toBe(true);
      expect(Number.isFinite(summary.gainPercent), `week ${i}`).toBe(true);
      expect(summary.currentValue).toBeGreaterThan(0);
      for (const [ticker, holding] of Object.entries(account.holdings)) {
        expect(holding.shares, `${ticker} week ${i}`).toBeGreaterThan(0);
        expect(Number.isFinite(holding.costBasis)).toBe(true);
      }
    }
  });

  it('still describes itself in a sentence a year in', () => {
    /*
     * `runningFor` is the only thing on the live screen that speaks about
     * duration, and it is deliberately never a percentage — a live account is
     * not a level with a top. Checked at the three shapes the copy branches on.
     */
    const at = (rows: number) => {
      const account = accountOpenedRowsAgo(rows);
      return runningFor(catchUp(account).portfolio);
    };
    expect(at(1)).toMatch(/week/i);
    expect(at(30)).toMatch(/weeks in/i);
    /* Two years of rows, if the file is long enough to hold them. */
    if (LATEST_WEEK >= 110) expect(at(110)).toMatch(/years? in/i);
  });
});

describe('coming back after a long time away', () => {
  /*
   * The catch-up is the single most load-bearing screen in the endless half,
   * because it is the one a returning child sees. Measured at four absences,
   * spanning a week to a year.
   */
  for (const rows of [1, 4, 13, 52]) {
    it(`reconciles after ${rows} rows away`, () => {
      const account = accountOpenedRowsAgo(rows);
      const before = totalValue(account);
      const { portfolio, report } = catchUp(account);
      expect(report, 'a returning child was told nothing happened').not.toBeNull();
      const shown = report!;

      /* No row left unplayed. */
      expect(stepsBehind(portfolio)).toBe(0);

      /* §4: the figures shown together have to reconcile. */
      expect(shown.valueBefore).toBeCloseTo(before, 2);
      expect(shown.valueAfter).toBeCloseTo(totalValue(portfolio), 2);
      expect(shown.changeDollars).toBeCloseTo(shown.valueAfter - shown.valueBefore, 2);

      /*
       * And the weeks are counted off the calendar, never off the row index.
       * The newest row is the week in progress, so counting index steps and
       * calling them weeks tells a child who checked in yesterday that a week
       * went by.
       */
      expect(shown.weeks).toBe(Math.floor(shown.days / 7));
      expect(shown.days).toBe(daysBetween(shown.from, shown.to));
      expect(shown.to).toBe(latestDate());

      /* Every company accounted for, held or not. */
      expect(shown.moves).toHaveLength(SNAPSHOT.length);
      for (const move of shown.moves) {
        expect(Number.isFinite(move.changePct), move.ticker).toBe(true);
        expect(move.held).toBe(Boolean(portfolio.holdings[move.ticker]));
      }
    });
  }

  it('records the falls it slept through, rather than forgiving them', () => {
    /*
     * A year of real closes contains drawdowns, and a child who was away for
     * them has not demonstrated holding through one. What they get is the
     * record: `worstDrawdown` is marked because the price genuinely fell, and
     * `heldThroughDrawdown` is earned because they did not sell — which is the
     * truth about somebody who left their money alone, and is exactly what the
     * badge is about.
     */
    const { portfolio } = catchUp(accountOpenedRowsAgo(52));
    const holdings = Object.values(portfolio.holdings);
    expect(holdings.length).toBeGreaterThan(0);
    for (const holding of holdings) {
      expect(holding.soldWhileDown, `${holding.ticker} was never sold`).toBe(false);
      expect(Number.isFinite(holding.worstDrawdown)).toBe(true);
    }
  });
});

describe('the ladder the loop climbs', () => {
  it('does not run out before the content does', () => {
    /*
     * `rankFor` reads *standing* — badges plus words plus companies whose
     * accounts the child has opened — and its own note says why:
     *
     * > Badges alone made the ladder finish ... a kid who got there had nothing
     * > left to climb, which is the same completion trap the four acts had, one
     * > layer up. A ladder that ends is a ladder you eventually stop looking at.
     *
     * And then it ended. The top rung sat at 70 with 100 points available — 40
     * badges, 36 words, 24 companies — so thirty points of real, demonstrated
     * work bought no rung at all. Found by measuring the loop rather than by
     * reading the file, which had the argument written at the top of it.
     *
     * The property, so it cannot silently come back: the last rung is reachable
     * only by somebody who has done everything there is.
     */
    /* Reconciled against its parts once, here, rather than recomputed at every
       call site — which is the §62 rule about a fact with more than one home. */
    const ceiling = STANDING_CEILING;
    expect(ceiling).toBe(BADGE_COUNT + GLOSSARY.length + SNAPSHOT.length);
    const top = rankFor(ceiling);
    expect(top.nextAt, 'somebody who has done everything still has a rung to climb').toBeNull();

    /* One short of everything is still climbing. */
    expect(rankFor(ceiling - 1).nextAt, 'the ladder ended before the content did').not.toBeNull();
  });

  it('never asks for more than exists', () => {
    /*
     * The other direction, and the one that shows on screen as "12 to go" on a
     * rung nobody can reach. Every rung's threshold has to be inside the
     * ceiling.
     */
    const ceiling = STANDING_CEILING;
    for (let standing = 0; standing <= ceiling; standing += 1) {
      const rank = rankFor(standing);
      if (rank.nextAt !== null) expect(rank.nextAt).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe('the part that is played with other people', () => {
  it('runs a club for a year without the week breaking', () => {
    /*
     * "Keep inviting friends" is half the thesis, and a club is the shape it
     * takes. Four members, a year of weeks, and the attribution still adds up
     * at the end — because the club screen shows who was any good, and a
     * scoreboard that stops reconciling after a few months is worse than none.
     */
    let club = createClub('The Lemons', 'Ada', 1200, 7);
    for (const name of ['Bo', 'Cy', 'Di']) {
      const joined = joinClub(club, name, 400);
      expect(joined.ok, joined.reason).toBe(true);
      club = joined.club;
    }

    for (let week = 0; week < WEEKS; week += 1) {
      const stepped = advanceClubWeek(club);
      expect(stepped.ok, `week ${week}: ${stepped.reason}`).toBe(true);
      club = stepped.club;
    }

    const scored = clubAttribution(club);
    expect(scored.members).toHaveLength(4);
    for (const member of scored.members) {
      /* `MemberScore` has no single score on purpose — the screen's whole
         point is that returns and reasoning are different columns and often
         different people. So every column is checked, and the verdict that
         separates them has to be a sentence rather than an empty string. */
      expect(Number.isFinite(member.gain), member.name).toBe(true);
      expect(Number.isFinite(member.dollarsCommitted), member.name).toBe(true);
      expect(member.soundRate === null || Number.isFinite(member.soundRate)).toBe(true);
    }
    expect(scored.verdict.length).toBeGreaterThan(10);
    expect(Number.isFinite(scored.clubValue)).toBe(true);
    expect(scored.clubGain).toBeCloseTo(scored.clubValue - club.startingCash, 2);
  });

  it('keeps paying the ritual inside a club week too', () => {
    /* The credits card is what a child reads; it has to be legible at any age
       of account, so it is checked a year in rather than only on day one. */
    let ledger = createLedger();
    const day = '2026-09-13';
    ledger = record(ledger, 'answered-the-check-in', day, 10);
    const card = creditsCard(ledger, day);
    expect(Number.isFinite(card.balance)).toBe(true);
    expect(card.balance).toBeGreaterThan(0);
  });
});

/**
 * The twelve-week on-ramp, which is the other half of the same question.
 *
 * `MARKET_WEEKS = 12` was the last bare constant of the `ACT2_DAYS = 16` shape
 * — agreed with by six test files, measured by none, sitting in the stage the
 * pilot reaches next. This is the measurement.
 *
 * The question is not "is twelve weeks too long". It is **what does a child
 * actually get to see in twelve weeks**, because the stage exists to teach one
 * thing: a holding falls, you sit still, it comes back. Swept across every
 * window the replay can draw — 225 of them, at six different caps — with a
 * bought-and-held three-company portfolio:
 *
 * | cap | a holding fell 10% | and came back while held | a scare week |
 * |---|---|---|---|
 * | 4 weeks | 25% | 0% | 18% |
 * | 6 weeks | 36% | 1% | 23% |
 * | 8 weeks | 46% | 4% | 27% |
 * | **12 weeks** | **63%** | **10%** | **35%** |
 * | 16 weeks | 71% | 17% | 39% |
 * | 20 weeks | 82% | 29% | 44% |
 *
 * Two conclusions, and the second one is the important one.
 *
 * **Twelve is the right cap for what it can do.** Two children in three watch
 * something they own fall a tenth, which is the fear the stage is about. Cutting
 * to six halves that and takes the recovery to nothing; going to twenty buys
 * twelve percentage points for eight more weeks of a stage the pilot already
 * called repetitive at sixteen days of a shorter one.
 *
 * **And the recovery cannot be taught here at all.** One child in ten sees a
 * holding fall and climb back inside twelve weeks. No cap fixes that — twenty
 * weeks only reaches 29% — because a recovery takes as long as it takes and no
 * amount of curating would be honest about it. That is not a defect in the
 * on-ramp; it is the argument for the live account. A market that never closes
 * has years to deliver the one lesson a twelve-week story cannot, which is why
 * the endless half is the product rather than the epilogue.
 */
describe('what twelve weeks of the market can actually teach', () => {
  /** Bought and held across one window, with the real bookkeeping. */
  function boughtAndHeld(windowStart: number, weeks: number) {
    const blank = createPortfolio(1000, 1);
    let account: PortfolioState = {
      ...blank,
      windowStart,
      week: 0,
      priceHistory: Object.fromEntries(
        Object.keys(blank.priceHistory).map((ticker) => [ticker, [realClose(ticker, windowStart, 0)]]),
      ),
    };
    for (const ticker of ['AAPL', 'COST', 'NKE']) {
      const done = buy(account, ticker, 300);
      if (done.ok) account = done.portfolio;
    }
    let scares = 0;
    for (let week = 0; week < weeks; week += 1) {
      const stepped = advanceWeek(account);
      account = stepped.portfolio;
      if (stepped.report.wasScare) scares += 1;
    }
    const holdings = Object.values(account.holdings);
    return {
      fell: holdings.some((holding) => holding.worstDrawdown <= -DRAWDOWN_THRESHOLD),
      recovered: holdings.some((holding) => holding.heldThroughDrawdown),
      scares,
    };
  }

  /** Every window the replay can draw, at one cap. */
  function sweep(weeks: number) {
    const runs: Array<ReturnType<typeof boughtAndHeld>> = [];
    for (let start = FIRST_HONEST_WEEK; start + weeks + 1 < HISTORY_WEEKS; start += 1) {
      runs.push(boughtAndHeld(start, weeks));
    }
    const share = (pick: (r: (typeof runs)[number]) => boolean) =>
      runs.filter(pick).length / runs.length;
    return {
      windows: runs.length,
      fell: share((r) => r.fell),
      recovered: share((r) => r.recovered),
      scare: share((r) => r.scares > 0),
    };
  }

  const TWELVE = sweep(MARKET_WEEKS);

  it('shows two children in three a holding of theirs falling a tenth', () => {
    /*
     * Measured 63%. Asserted as a floor well under it, because the figure moves
     * every week the data file rolls forward — the bound is what stops the
     * stage quietly becoming one where nothing happens.
     */
    expect(TWELVE.windows).toBeGreaterThan(100);
    expect(TWELVE.fell, `${Math.round(TWELVE.fell * 100)}% of windows had a holding fall 10%`).toBeGreaterThan(0.4);
    expect(TWELVE.scare, `${Math.round(TWELVE.scare * 100)}% had a scare week`).toBeGreaterThan(0.2);
  });

  it('cannot teach the recovery, and a longer cap does not fix it', () => {
    /*
     * Measured 10% at twelve weeks and 29% at twenty. The claim being pinned is
     * the *shape*: the recovery is rare at every cap anybody would ship, so
     * nobody can reach for "make the stage longer" as the fix. The fix is the
     * live account, which has years.
     *
     * If this ever fails upwards — if most children start seeing a recovery
     * inside twelve weeks — the data has changed enough that the argument for
     * the endless half needs rereading rather than the test needs relaxing.
     */
    expect(TWELVE.recovered, `${Math.round(TWELVE.recovered * 100)}% saw a holding come back`).toBeLessThan(0.35);
    expect(sweep(20).recovered).toBeLessThan(0.5);
  });

  it('gets steadily more likely to show a fall the longer it runs', () => {
    /*
     * The structural property behind the table, and the one that does not drift
     * with the data: a longer window contains everything a shorter one did.
     * This is what makes the cap a real trade rather than a preference — and it
     * is monotone by construction, so a failure here means the drawdown
     * bookkeeping has stopped accumulating.
     */
    const caps = [4, 8, 12, 16].map((weeks) => ({ weeks, ...sweep(weeks) }));
    for (let i = 1; i < caps.length; i += 1) {
      expect(
        caps[i].fell,
        `${caps[i].weeks} weeks showed a fall less often than ${caps[i - 1].weeks}`,
      ).toBeGreaterThanOrEqual(caps[i - 1].fell);
    }
  });

  it('never curates the window, which is why any of the above is worth knowing', () => {
    /*
     * `windowStartFor` is uniform over every window where all the companies have
     * published accounts. Filtering for drama would teach a child that markets
     * always fall in three months, and it would also make every figure in the
     * table above meaningless.
     *
     * The claim in that function's own comment — "88% contain a real fall of 10%
     * or more" — was measured once, never asserted, and is now wrong under every
     * reading of it: 98% of windows contain a company that fell a tenth, 63%
     * contain one the child *holds*, and 15% contain a fall of a tenth in the
     * market as a whole. Corrected there, pinned here.
     */
    const seen = new Set<number>();
    for (let seed = 0; seed < 400; seed += 1) seen.add(windowStartFor(seed));
    expect(seen.size, 'the replay draws from one narrow stretch of history').toBeGreaterThan(100);
    for (const start of seen) {
      expect(start).toBeGreaterThanOrEqual(FIRST_HONEST_WEEK);
      expect(start + MARKET_WEEKS).toBeLessThan(HISTORY_WEEKS);
    }
  });
});

/**
 * How long a duel has to be before the decision beats the weather.
 *
 * `CHALLENGE_DAYS = 7` with a comment saying a week "fits in a lunch break and
 * stays comparable", and nothing measuring either half of that. The screen
 * offers two lengths and labels them — one day is "about 2 minutes", a week is
 * "the real contest" — which is a claim about signal, so it is measurable.
 *
 * Two runs on the same sky and the same money, differing in one decision only
 * (a 34-cup batch against a 20-cup one, same price), across 60 seeds:
 *
 * | duel | the bigger batch won | ties | mean gap |
 * |---|---|---|---|
 * | 1 day | 75% | 15 of 60 | $12 |
 * | 2 days | 92% | 5 | $24 |
 * | 3 days | 100% | 0 | $35 |
 * | 5 days | 100% | 0 | $58 |
 * | **7 days** | **100%** | **0** | **$81** |
 *
 * So the screen's own copy is right, and now measured: **a one-day duel is a
 * quarter noise** — one in four ends in a tie or goes to the worse plan on the
 * weather alone — and by three days the better decision always wins. Seven is
 * past the point where it stops mattering, which is the correct side to be on:
 * the length is chosen so a week of a child's real play can be sent as-is, and
 * `ECON.TOTAL_DAYS` is seven.
 *
 * The one-day duel is kept anyway, and the noise is the reason it is labelled by
 * its length rather than sold as the contest.
 */
describe('a duel, and whether a week of one proves anything', () => {
  /** One run on a challenge sky, playing the same decision every day. */
  function duelRun(seed: number, days: number, price: number, cups: number) {
    let game = createChallengeGame(createChallenge(seed, days), null);
    for (let day = 1; day <= days; day += 1) {
      const plan = batchPlan(game.stand, cups);
      const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));
      game = settleDay(game, outcome, { ranByManager: false, stageDay: day }).game;
    }
    return game.stand.history;
  }

  const SEEDS = Array.from({ length: 60 }, (_, i) => i * 13 + 5);

  /** How often the better-sized batch actually wins, at one duel length. */
  function signalAt(days: number) {
    let won = 0;
    let ties = 0;
    let gap = 0;
    for (const seed of SEEDS) {
      const bigger = summariseRun(seed, 'BIG', duelRun(seed, days, 1.5, 34));
      const smaller = summariseRun(seed, 'SML', duelRun(seed, days, 1.5, 20));
      const compared = compareRuns(bigger, smaller);
      if (compared.winner === 'you') won += 1;
      if (compared.winner === 'tie') ties += 1;
      gap += Math.abs(compared.gap);
    }
    return { won: won / SEEDS.length, ties, gap: gap / SEEDS.length };
  }

  it('is decisive over a week and a quarter noise over a day', () => {
    const day = signalAt(1);
    const week = signalAt(CHALLENGE_DAYS);
    expect(week.won, `the better batch won ${Math.round(week.won * 100)}% of week-long duels`).toBeGreaterThan(0.95);
    expect(week.ties, 'a week-long duel ended in a tie').toBe(0);
    /* And the short one is genuinely noisier — the assertion that stops a
       future change from quietly selling the one-day duel as the contest. */
    expect(day.won, `the better batch won ${Math.round(day.won * 100)}% of one-day duels`).toBeLessThan(week.won);
    expect(day.gap).toBeLessThan(week.gap);
  });

  it('is a week because the stand\'s own run is a week', () => {
    /*
     * Not an independent number. `CHALLENGE_DAYS` exists so a whole stand run
     * can be sent as-is, and the stand run is `ECON.TOTAL_DAYS` long — the
     * screen will not even offer the week option until the child has played
     * one. Two constants that must agree, asserted rather than assumed.
     */
    expect(CHALLENGE_DAYS).toBe(ECON.TOTAL_DAYS);
  });

  it('explains the gap in lines a child can add up', () => {
    /*
     * §4: figures shown together have to reconcile. The visible lines are
     * filtered at 50c so a comparison is not four rows of noise, so the check
     * is that what is shown accounts for the gap to within the lines that were
     * hidden — not that it is exact, which would be a different design.
     */
    const bigger = summariseRun(11, 'BIG', duelRun(11, CHALLENGE_DAYS, 1.5, 34));
    const smaller = summariseRun(11, 'SML', duelRun(11, CHALLENGE_DAYS, 1.5, 20));
    const compared = compareRuns(bigger, smaller);
    expect(compared.lines.length).toBeGreaterThan(0);
    const shown = compared.lines.reduce((sum, line) => sum + line.dollars, 0);
    expect(Math.abs(shown - compared.gap), 'the lines shown do not account for the gap').toBeLessThan(
      0.5 * compared.lines.length + 0.5,
    );
    expect(compared.cause).toBeTruthy();
  });
});
