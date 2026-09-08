/**
 * Today's Investor Check-in.
 *
 * The customer's Level 2 note specified it as six steps: what happened, why it
 * happened, does it affect anything I own, does my portfolio need action
 * (*sometimes yes, often no*), discover something new, earn today's credits.
 * That is a genuinely good investing habit and it is built here as specified.
 *
 * Two things about it had to be squared with the product first, and both are
 * resolved in the design rather than argued about in a comment.
 *
 * **§26 asks for one thing at a time.** "One card a day. One word a day. One
 * finger." Six steps handed over at once is the exact failure §26 records
 * having already fixed — day one used to deliver three new words in three
 * stacked panels of italic explanation. So the ritual is a *sequence*: one
 * question on screen, answered, then the next. `stepOf` is the whole
 * mechanism, and the six steps are never all visible together.
 *
 * **§15 says nothing is given for showing up.** Step four of the ritual is
 * "sometimes yes, often no", which turns out to be the resolution rather than
 * the problem: the credit is for *answering correctly*, and "nothing to do
 * today" is the correct answer most days. Opening the check-in and closing it
 * again pays nothing. See `credits.ts`.
 *
 * The market story is built from the replayed week the child is actually in —
 * real prices, real filed accounts — so nothing here invents news. A duck that
 * makes up a reason a price moved would be teaching the single worst habit in
 * the subject.
 *
 * Pure module. No React, no I/O.
 */

import { SNAPSHOT, type Company } from './companies';
import { currentDate, currentPrice, summarisePortfolio, type PortfolioState } from './market';
import type { Ledger } from './ledger';
import { checkedInToday } from './credits';
import { plural } from './copy';

/**
 * Why a price moved, in the four kinds a child has to be able to tell apart.
 *
 * This is the taxonomy the note asked for — company news, industry news,
 * economy and rates, general market movement — and the order is deliberate:
 * it runs from the most specific to the most diffuse, which is also the order
 * from "this is about the thing you own" to "this is about everything".
 */
export type Mover = 'company' | 'industry' | 'economy' | 'market';

export const MOVERS: Record<Mover, { label: string; kidLine: string }> = {
  company: {
    label: 'Something about this company',
    kidLine: 'News about this one business, and nobody else.',
  },
  industry: {
    label: 'Something about this kind of business',
    kidLine: 'News about all the shops like it, not just this one.',
  },
  economy: {
    label: 'Something about money everywhere',
    kidLine: 'Borrowing got dearer or cheaper, so everything got dearer or cheaper.',
  },
  market: {
    label: 'The whole market wobbled',
    kidLine: 'No news at all. Prices move about on their own some days.',
  },
};

/** The six steps, in the order the note gave them. */
export type Step =
  | 'what-happened'
  | 'why'
  | 'does-it-touch-me'
  | 'do-i-act'
  | 'discover'
  | 'credits';

export const STEPS: readonly Step[] = [
  'what-happened',
  'why',
  'does-it-touch-me',
  'do-i-act',
  'discover',
  'credits',
];

export interface StepCopy {
  step: Step;
  /** The heading. One question. */
  question: string;
  /** Pip's line under it, at most two sentences. */
  said: string;
}

export function stepOf(index: number, steps: readonly Step[] = STEPS): Step {
  return steps[Math.max(0, Math.min(steps.length - 1, index))];
}

/**
 * The steps that make sense today.
 *
 * Found in a browser on the first check-in a child can reach. With no story —
 * a fresh portfolio has one price per company and so no week to compare — the
 * ritual still asked "why did it happen?" and "does it touch anything you
 * own?", about nothing. Worse, it *marked* them: a child holding Apple picked
 * "yes, I own some of that" and was told they did not, because with no story
 * the owned-flag defaults to false.
 *
 * Two questions with no subject, one of them scoring a right answer as wrong.
 * So the two that are *about the story* are dropped when there is no story,
 * and the counter shrinks with them — a ritual that says "1 of 6" and means
 * four is its own small lie.
 */
export function stepsFor(state: Pick<CheckIn, 'story'>): readonly Step[] {
  if (state.story) return STEPS;
  return STEPS.filter((step) => step !== 'why' && step !== 'does-it-touch-me');
}

/* ------------------------------------------------------------------ *
 * The story
 * ------------------------------------------------------------------ */

export interface Story {
  ticker: string;
  name: string;
  /** The week being replayed, as a real date. */
  asOf: string;
  /** Move over the last week, as a fraction. */
  change: number;
  /** True when the child owns some of this one. */
  owned: boolean;
  /** The kid-facing 30-second version. */
  headline: string;
  told: string;
  /**
   * The honest answer to "why", derived rather than invented.
   *
   * A single company moving far more than the rest of the market is company
   * news; everything drifting together is the market. That is as far as public
   * price history can honestly take us, and it is deliberately as far as this
   * goes — the alternative is a duck inventing reasons, which would teach the
   * worst habit in the subject.
   */
  because: Mover;
}

/** How big a one-week move has to be before it is about the company at all. */
const COMPANY_MOVE = 0.05;

/** A move this size across the board is the market, not any one business. */
const MARKET_MOVE = 0.02;

function weekChange(portfolio: PortfolioState, ticker: string): number {
  const series = portfolio.priceHistory[ticker];
  if (!series || series.length < 2) return 0;
  const then = series[series.length - 2];
  const now = series[series.length - 1];
  return then > 0 ? (now - then) / then : 0;
}

/**
 * Today's story: the biggest mover among the companies that matter to the child.
 *
 * Held companies first, because a story about something they own is a story
 * about them. Falls back to the widest mover in the snapshot so the ritual
 * still has something to say on a day the portfolio is empty — which is every
 * day before the first purchase, and would otherwise be a check-in with a
 * blank first step.
 */
export function storyFor(portfolio: PortfolioState): Story | null {
  const asOf = currentDate(portfolio);
  const held = new Set(Object.keys(portfolio.holdings));

  const candidates = SNAPSHOT.map((company) => ({
    company,
    change: weekChange(portfolio, company.ticker),
    owned: held.has(company.ticker),
  })).filter((row) => Number.isFinite(row.change));

  if (candidates.length === 0) return null;

  /*
   * No second week, no story.
   *
   * A fresh portfolio has exactly one price per company — the snapshot close —
   * so every "change" is zero for want of anything to subtract, not because
   * the market was quiet. Reporting that as a story produced "Apple went up 0%
   * this week" under a duck saying it barely moved, which is two sentences
   * disagreeing about a week that had not happened yet.
   */
  const hasAWeek = SNAPSHOT.some(
    (company) => (portfolio.priceHistory[company.ticker]?.length ?? 0) >= 2,
  );
  if (!hasAWeek) return null;

  const pool = candidates.some((row) => row.owned)
    ? candidates.filter((row) => row.owned)
    : candidates;

  const biggest = pool.reduce((best, row) =>
    Math.abs(row.change) > Math.abs(best.change) ? row : best,
  );

  /*
   * Was it this company, or was it everything?
   *
   * Measured against the median move across the snapshot rather than asserted.
   * If most things moved about as much, the honest answer is "the market", and
   * a child who learns to check that before believing a story about one company
   * has learned the single most useful piece of scepticism in the subject.
   */
  const moves = candidates.map((row) => Math.abs(row.change)).sort((a, b) => a - b);
  const median = moves[Math.floor(moves.length / 2)] ?? 0;

  const size = Math.abs(biggest.change);
  let because: Mover;
  if (median >= MARKET_MOVE && size < median * 2) because = 'market';
  else if (size >= COMPANY_MOVE) because = 'company';
  else if (median >= MARKET_MOVE) because = 'market';
  else because = 'industry';

  const up = biggest.change >= 0;
  const pct = Math.abs(Math.round(biggest.change * 100));
  const price = currentPrice(portfolio, biggest.company.ticker);

  return {
    ticker: biggest.company.ticker,
    name: biggest.company.name,
    asOf,
    change: biggest.change,
    owned: biggest.owned,
    /*
     * "Went up 0%" is not a thing that happened. When the move rounds to
     * nothing the headline has to say so in the same words the duck does,
     * because PRODUCT.md §4's rule about two figures agreeing applies just as
     * hard to two sentences about the same figure.
     */
    headline:
      pct === 0
        ? `${biggest.company.name} barely moved this week.`
        : `${biggest.company.name} went ${up ? 'up' : 'down'} ${pct}% this week.`,
    told:
      pct === 0
        ? `${biggest.company.name} barely moved this week. A share is still $${price.toFixed(2)}.`
        : `A share of ${biggest.company.name} ${up ? 'costs more' : 'costs less'} than last week — $${price.toFixed(2)} now. ${
            biggest.owned ? 'You own some of this one.' : 'You do not own this one.'
          }`,
    because,
  };
}

/* ------------------------------------------------------------------ *
 * Step four: does anything need doing?
 * ------------------------------------------------------------------ */

export type Action = 'nothing' | 'look-again' | 'spread-out';

export const ACTIONS: Record<Action, { label: string; kidLine: string }> = {
  nothing: {
    label: 'Nothing. Leave it alone.',
    kidLine: 'The reason you bought it has not changed, so neither has what to do.',
  },
  'look-again': {
    label: 'Go back over one of my reasons',
    kidLine: 'Something you wrote down might not be true any more.',
  },
  'spread-out': {
    label: 'Spread my money out more',
    kidLine: 'Too much of it is in one company.',
  },
}

/**
 * What today actually calls for, which is usually nothing.
 *
 * The note's own phrasing — "sometimes yes, often no" — is the teaching, so
 * this function has to be *willing to say no* and to be right about it. It
 * returns the honest answer and the ritual pays for matching it, which is what
 * makes the credit a reward for judgment rather than for arriving.
 */
export function neededToday(
  portfolio: PortfolioState,
  story: Story | null,
  startingValue: number,
): Action {
  const tickers = Object.keys(portfolio.holdings);
  const summary = summarisePortfolio(portfolio, startingValue);

  // Concentration first: it is the one that costs real money when ignored.
  if (tickers.length > 0 && !summary.diversified) return 'spread-out';

  // A big move in something owned is worth rereading the reason for. A big move
  // in something not owned is not about the child at all.
  if (story?.owned && Math.abs(story.change) >= COMPANY_MOVE && story.because === 'company') {
    return 'look-again';
  }

  return 'nothing';
}

/* ------------------------------------------------------------------ *
 * The check-in as a whole
 * ------------------------------------------------------------------ */

export interface CheckIn {
  /** Today, as the child's own calendar day. */
  on: string;
  story: Story | null;
  /** The right answer to step two. */
  because: Mover;
  /** Whether the child owns any of the company in the story. */
  touchesMe: boolean;
  /** The right answer to step four. */
  needed: Action;
  /** A company worth reading today, for step five. */
  discover: Company | null;
  /** Already done today, so the ritual should say so rather than pay twice. */
  doneToday: boolean;
  /** Weeks of market history behind this child. 0 or 1 means nothing to compare. */
  weeksOpen: number;
}

export function checkIn(
  portfolio: PortfolioState,
  career: { companiesStudied: string[] },
  ledger: Ledger,
  on: string,
  startingValue: number,
): CheckIn {
  const story = storyFor(portfolio);
  const unread = SNAPSHOT.filter((company) => !career.companiesStudied.includes(company.ticker));

  return {
    on,
    story,
    because: story?.because ?? 'market',
    touchesMe: story?.owned ?? false,
    needed: neededToday(portfolio, story, startingValue),
    /*
     * Something they have not read, and only something they have not read.
     * §16's rule about the company collection applies here too: offering a card
     * already in the trophy case would let "discover something new" be farmed
     * by reopening the same one.
     */
    discover: unread.length > 0 ? unread[0] : null,
    doneToday: checkedInToday(ledger, on),
    weeksOpen: Math.max(
      0,
      ...SNAPSHOT.map((company) => portfolio.priceHistory[company.ticker]?.length ?? 0),
    ),
  };
}

/** The question and Pip's line, for one step of one check-in. */
export function copyFor(step: Step, state: CheckIn): StepCopy {
  switch (step) {
    case 'what-happened':
      return {
        step,
        question: 'What happened?',
        said: state.story
          ? state.story.told
          : state.weeksOpen < 2
            ? 'Your market has only just opened. Give it a week and there will be something to read.'
            : 'Quiet week. Nothing in the market did anything worth waking you up for.',
      };
    case 'why':
      return {
        step,
        question: 'Why did it happen?',
        said: 'Four kinds of reason. Only one of them is really about this business.',
      };
    case 'does-it-touch-me':
      return {
        step,
        question: 'Does it touch anything you own?',
        said: state.touchesMe
          ? 'You own some of this one, so this one is about you.'
          : 'Have a look at what you hold before you answer.',
      };
    case 'do-i-act':
      return {
        step,
        question: 'Does anything need doing?',
        // The line that makes the credit honest. Said before the child answers.
        said: 'Sometimes yes. Most days no, and noticing that is the skill.',
      };
    case 'discover':
      return {
        step,
        question: 'Find one new thing',
        said: state.discover
          ? `Read ${state.discover.name}'s real accounts. You have never opened that one.`
          : 'You have read every company in here. Pick one and read it again properly.',
      };
    case 'credits':
      return {
        step,
        question: "Today's credits",
        said: 'For working it out, not for turning up.',
      };
  }
}

/** Was each answer right? Used to decide what today's check-in pays. */
export interface Answers {
  because?: Mover;
  touchesMe?: boolean;
  needed?: Action;
}

export interface Marked {
  right: number;
  outOf: number;
  /** True when every answered question was right. */
  allRight: boolean;
  /** One line per question, for the last step. */
  lines: string[];
}

export function mark(state: CheckIn, answers: Answers): Marked {
  const checks: Array<{ ok: boolean; line: string }> = [];

  /*
   * Only what was actually asked. With no story there is no "why" and no "does
   * it touch you", so an answer to either cannot arrive — and if one somehow
   * did, judging it against a default would be the bug `stepsFor` exists to
   * fix, one layer down.
   */
  const asked = new Set(stepsFor(state));

  if (asked.has('why') && answers.because !== undefined) {
    const ok = answers.because === state.because;
    checks.push({
      ok,
      line: ok
        ? `Right — ${MOVERS[state.because].kidLine.toLowerCase()}`
        : `Not quite. ${MOVERS[state.because].kidLine}`,
    });
  }

  if (asked.has('does-it-touch-me') && answers.touchesMe !== undefined) {
    const ok = answers.touchesMe === state.touchesMe;
    checks.push({
      ok,
      line: ok
        ? state.touchesMe
          ? 'Right — you hold some of that one.'
          : 'Right — none of that one is yours.'
        : state.touchesMe
          ? 'You do hold some of that one. Worth knowing what you own.'
          : 'You do not hold any of that one, so it is not about your money.',
    });
  }

  if (answers.needed !== undefined) {
    const ok = answers.needed === state.needed;
    checks.push({
      ok,
      line: ok
        ? `Right — ${ACTIONS[state.needed].kidLine.toLowerCase()}`
        : `${ACTIONS[state.needed].label} ${ACTIONS[state.needed].kidLine}`,
    });
  }

  const right = checks.filter((check) => check.ok).length;
  return {
    right,
    outOf: checks.length,
    allRight: checks.length > 0 && right === checks.length,
    lines: checks.map((check) => check.line),
  };
}

/**
 * The one line the friends screen and the title screen show.
 *
 * Written to be a reason to open the app rather than a nag: it names what is
 * waiting, never how long it has been. "You have not played for 3 days" is a
 * telling-off, and §15's engines are all records of the child rather than
 * complaints about them.
 */
export function checkInLine(state: CheckIn, streakRunning: number): string {
  if (state.doneToday) {
    return streakRunning > 1
      ? `Checked in ${plural(streakRunning, 'day')} running.`
      : 'Checked in today.';
  }
  if (!state.story) return "Today's check-in is waiting.";
  return `${state.story.name} moved this week. Worth a look.`;
}
