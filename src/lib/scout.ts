/**
 * Stock Scout: learn the framework, then use it on real companies.
 *
 * The customer's Level 2 stage 1, built to the shape they specified — "Duck
 * explains → child evaluates a few examples → child gives them ratings → Duck
 * explains where their reasoning was strong or weak" — and to the framework
 * they wrote out, which has two sides that must not be allowed to blur:
 *
 *   **Is this a good business?** Does it make money or have a path to it. Is
 *   it growing. Do customers want what it sells. Has it an advantage. Is
 *   management using money well.
 *
 *   **Is this an attractive stock?** What am I paying. What expectations are
 *   already in the price. What could go wrong.
 *
 * FRAMEWORK.md §16's audit found this was the real gap in Level 2 — stages 2
 * and 3 were substantially built and stage 1 did not exist at all, which is
 * the inverse of the intuition that the later stages need the work.
 *
 * ## The two sides are the entire lesson
 *
 * A great business at a silly price is a bad investment, and that sentence is
 * the single most valuable thing in this product. It is also the thing a child
 * cannot learn while the two questions are mixed together, so every question
 * below is tagged with which side it belongs to, the screen asks them in
 * order, and the verdict reports the two scores **separately**. A child who
 * scores 5/5 on the business and 0/3 on the stock has learned something
 * precise about themselves; one told "5 out of 8" has learned nothing.
 *
 * ## Every answer is checked against a filing
 *
 * Nothing here is an opinion the game holds. Each question computes its answer
 * from the same SEC fundamentals and the same replayed price the rest of the
 * market uses, and hands back the arithmetic. A quiz whose answers came from a
 * hand-written key would be teaching a child to guess what an adult wants.
 *
 * Pure module. No React, no I/O.
 */

import { formatMillions, metricsFor, type Company } from './companies';

export type Side = 'business' | 'stock';

export interface ScoutQuestion {
  id: string;
  side: Side;
  /** The question, in the child's words. Answerable yes or no. */
  ask: string;
  /** What the question is getting at. Shown before they answer. */
  kidLine: string;
  /** The true answer, from the company's own figures at this price. */
  holds: (company: Company, price: number, asOf?: string) => boolean;
  /** The arithmetic behind it, whichever way they answered. */
  evidence: (company: Company, price: number, asOf?: string) => string;
}

/** Revenue growth this fast counts as growing, on the three-year compound basis. */
const GROWING = 0.05;

/** Keeping this much of every dollar is the mark of a business with an edge. */
const GOOD_MARGIN = 0.15;

/** Paying more than this many years of profit is paying for a lot of hope. */
const DEAR_PE = 30;

/** A business this big has customers who have already voted with their money. */
const BIG_REVENUE_M = 5_000;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The framework, one question at a time.
 *
 * Business side first and in the customer's order, because that order is an
 * argument: you find out whether it is a good business *before* you look at
 * what it costs, so that the price cannot talk you into liking the business.
 */
export const SCOUT_QUESTIONS: readonly ScoutQuestion[] = [
  {
    id: 'makes-money',
    side: 'business',
    ask: 'Does it make money?',
    kidLine: 'Takings minus costs, over a whole year. Some big companies still do not.',
    holds: (company, _price, asOf) => metricsFor(company, undefined, asOf).profitable,
    evidence: (company, _price, asOf) => {
      const m = metricsFor(company, undefined, asOf);
      return m.profitable
        ? `${company.name} kept ${formatMillions(m.year.netIncomeM)} of profit last year.`
        : `${company.name} lost ${formatMillions(Math.abs(m.year.netIncomeM))} last year. It has a path to profit, not a profit.`;
    },
  },
  {
    id: 'growing',
    side: 'business',
    ask: 'Is it growing?',
    kidLine: 'Selling more than it did three years ago, not just more than last month.',
    holds: (company) => company.revenueGrowth >= GROWING,
    evidence: (company) =>
      company.revenueGrowth >= GROWING
        ? `Its takings have grown ${pct(company.revenueGrowth)} a year for three years.`
        : `Its takings have moved ${pct(company.revenueGrowth)} a year for three years. That is not growing.`,
  },
  {
    id: 'people-want-it',
    side: 'business',
    ask: 'Do lots of people want what it sells?',
    kidLine: 'Not whether you like it. Whether enough people already pay for it.',
    holds: (company, _price, asOf) => metricsFor(company, undefined, asOf).year.revenueM >= BIG_REVENUE_M,
    evidence: (company, _price, asOf) => {
      const m = metricsFor(company, undefined, asOf);
      return `People handed ${company.name} ${formatMillions(m.year.revenueM)} last year. ${
        m.year.revenueM >= BIG_REVENUE_M ? 'That is a lot of people.' : 'That is a real business, but a small one.'
      }`;
    },
  },
  {
    id: 'has-an-edge',
    side: 'business',
    ask: 'Can it do something rivals cannot?',
    kidLine:
      'The test is what it keeps. A business anyone could copy gets undercut until it keeps almost nothing.',
    holds: (company, _price, asOf) => metricsFor(company, undefined, asOf).netMargin >= GOOD_MARGIN,
    evidence: (company, _price, asOf) => {
      const m = metricsFor(company, undefined, asOf);
      return m.netMargin >= GOOD_MARGIN
        ? `It keeps ${Math.round(m.netMargin * 100)}c of every dollar. Rivals would have taken that away by now if they could.`
        : `It keeps ${Math.round(m.netMargin * 100)}c of every dollar, which is thin. Somebody is keeping it honest.`;
    },
  },
  {
    id: 'money-well-used',
    side: 'business',
    ask: 'Is it using its money well?',
    kidLine: 'Growing *and* keeping a decent slice. Doing one without the other is easy.',
    holds: (company, _price, asOf) =>
      company.revenueGrowth >= GROWING && metricsFor(company, undefined, asOf).netMargin >= 0.1,
    evidence: (company, _price, asOf) => {
      const m = metricsFor(company, undefined, asOf);
      const grows = company.revenueGrowth >= GROWING;
      const keeps = m.netMargin >= 0.1;
      if (grows && keeps) {
        return `Growing ${pct(company.revenueGrowth)} a year and still keeping ${Math.round(m.netMargin * 100)}c in the dollar. Both at once is the hard part.`;
      }
      if (grows) return `It is growing ${pct(company.revenueGrowth)} a year, but only keeping ${Math.round(m.netMargin * 100)}c in the dollar.`;
      if (keeps) return `It keeps ${Math.round(m.netMargin * 100)}c in the dollar but is barely growing.`;
      // Both figures, same as the other three branches. This branch read "it
      // is neither growing much nor keeping much of what it takes in", which
      // is a verdict with no arithmetic — the thing the exhaustive test over
      // every company and every question exists to catch.
      return `Growing ${pct(company.revenueGrowth)} a year and keeping ${Math.round(m.netMargin * 100)}c in the dollar. Neither is much.`;
    },
  },

  /* ---- And only now, the price ---- */

  {
    id: 'what-am-i-paying',
    side: 'stock',
    ask: 'Is the price sensible for what you get?',
    kidLine: 'How many years of its profit you are handing over for one share.',
    holds: (company, price, asOf) => {
      const pe = metricsFor(company, price, asOf).pe;
      return pe !== null && pe <= DEAR_PE;
    },
    evidence: (company, price, asOf) => {
      const pe = metricsFor(company, price, asOf).pe;
      if (pe === null) {
        // The price still goes in. "No profit to divide by" without saying
        // what is being asked for it leaves out the only number a child can
        // reason from — and it is the number that makes the point.
        return `You would pay $${price.toFixed(2)} a share for a company that made no profit at all last year. There is no sensible price for that, only a guess.`;
      }
      return `At $${price.toFixed(2)} you are paying ${pe.toFixed(0)} years of profit. Over ${DEAR_PE} is dear.`;
    },
  },
  {
    id: 'expectations-in-the-price',
    side: 'stock',
    ask: 'Is the price already expecting it to do brilliantly?',
    kidLine:
      'A high price is a promise somebody has already made on the company’s behalf. It has to keep it.',
    holds: (company, price, asOf) => {
      const pe = metricsFor(company, price, asOf).pe;
      // "Yes, a lot is expected" is the honest answer when there is no profit
      // at all, because then the entire price is expectation.
      return pe === null || pe > DEAR_PE;
    },
    evidence: (company, price, asOf) => {
      const pe = metricsFor(company, price, asOf).pe;
      if (pe === null) {
        return `There is no profit yet, so every cent of the $${price.toFixed(2)} is somebody expecting one. That is the most expectation a price can carry.`;
      }
      return pe > DEAR_PE
        ? `${pe.toFixed(0)} years of profit is a lot to hand over. The price needs it to grow into that.`
        : `${pe.toFixed(0)} years of profit is not much of a promise. It does not have to be brilliant to be worth this.`;
    },
  },
  {
    id: 'what-could-go-wrong',
    side: 'stock',
    ask: 'Could this one drop a long way?',
    kidLine: 'A jumpy price and a lot of hope in it are the two things that fall furthest.',
    holds: (company, price, asOf) => {
      const pe = metricsFor(company, price, asOf).pe;
      return company.volatility > 0.05 || pe === null || pe > DEAR_PE;
    },
    evidence: (company, price, asOf) => {
      const pe = metricsFor(company, price, asOf).pe;
      const jumpy = company.volatility > 0.05;
      const hopeful = pe === null || pe > DEAR_PE;
      if (jumpy && hopeful) {
        return `It moves about ${pct(company.volatility)} in a normal week *and* the price is full of hope. Both, together, is how something halves.`;
      }
      if (jumpy) return `It moves about ${pct(company.volatility)} in a normal week, which is jumpy.`;
      if (hopeful) {
        /*
         * Carries the figure, like every other line here.
         *
         * This branch said "there is a lot of hope in the price, and hope is
         * the part that falls first" — true, and an assertion rather than
         * evidence. Caught by the test that runs every question over every
         * company and insists each answer contains a number, because a verdict
         * with no arithmetic in it is the game holding an opinion.
         */
        return `${pe === null ? 'It makes no profit at all' : `${pe.toFixed(0)} years of profit is a lot to pay`}, and it only moves about ${pct(company.volatility)} in a week. The hope is the part that falls first.`;
      }
      return `It moves about ${pct(company.volatility)} in a week and the price is not asking much. That is as steady as this list gets.`;
    },
  },
];

export const BUSINESS_QUESTIONS = SCOUT_QUESTIONS.filter((q) => q.side === 'business');
export const STOCK_QUESTIONS = SCOUT_QUESTIONS.filter((q) => q.side === 'stock');

export function scoutQuestion(id: string): ScoutQuestion | undefined {
  return SCOUT_QUESTIONS.find((question) => question.id === id);
}

/* ------------------------------------------------------------------ *
 * Marking a rating
 * ------------------------------------------------------------------ */

export type Answers = Record<string, boolean>;

export interface Marked {
  id: string;
  side: Side;
  ask: string;
  answered: boolean;
  truth: boolean;
  right: boolean;
  evidence: string;
}

export interface Rating {
  ticker: string;
  marks: Marked[];
  /** Right answers per side, reported separately on purpose. */
  business: { right: number; outOf: number };
  stock: { right: number; outOf: number };
  /**
   * What the duck says about their reasoning, which is not the same as their
   * score. See `verdictOf`.
   */
  says: string;
}

/**
 * How many of each side a child got right, and what that means about them.
 *
 * The two sides are reported apart and the sentence is built from the *shape*
 * of the result rather than from the total. The four shapes are the four kinds
 * of investor a nine-year-old can be at this point, and three of them are
 * worth naming:
 *
 *  - Good on both: they can use the framework.
 *  - Good on the business, poor on the price: the commonest and most dangerous,
 *    because it feels like competence. It is how people buy wonderful
 *    companies at silly prices.
 *  - Poor on the business, good on the price: rarer, and a bargain-hunter's
 *    error — cheap things are usually cheap for a reason.
 *  - Poor on both: they have not got the framework yet, and the honest thing
 *    is to say so plainly rather than to find a compliment.
 */
export function rate(
  company: Company,
  answers: Answers,
  price = company.price,
  asOf?: string,
): Rating {
  const marks: Marked[] = SCOUT_QUESTIONS.map((question) => {
    const truth = question.holds(company, price, asOf);
    const answered = question.id in answers;
    return {
      id: question.id,
      side: question.side,
      ask: question.ask,
      answered,
      truth,
      right: answered && answers[question.id] === truth,
      evidence: question.evidence(company, price, asOf),
    };
  });

  const tally = (side: Side) => {
    const rows = marks.filter((mark) => mark.side === side && mark.answered);
    return { right: rows.filter((mark) => mark.right).length, outOf: rows.length };
  };

  const business = tally('business');
  const stock = tally('stock');

  return { ticker: company.ticker, marks, business, stock, says: verdictOf(business, stock) };
}

/** A side is "got it" at two thirds or better, which is 4 of 5 or 2 of 3. */
function solid(score: { right: number; outOf: number }): boolean {
  return score.outOf > 0 && score.right / score.outOf >= 0.66;
}

export function verdictOf(
  business: { right: number; outOf: number },
  stock: { right: number; outOf: number },
): string {
  const okBusiness = solid(business);
  const okStock = solid(stock);

  if (business.outOf === 0 && stock.outOf === 0) return 'You did not answer anything yet.';

  if (okBusiness && okStock) {
    return 'You read the business and you read the price. That is the whole framework, and most grown-ups only do the first half.';
  }
  if (okBusiness && !okStock) {
    return 'You know a good business when you see one. The price is the half you are missing — and a great business at a silly price is still a bad buy. That is the mistake that costs people the most money.';
  }
  if (!okBusiness && okStock) {
    return 'You can tell when something is dear. Now do the business first: cheap things are usually cheap for a reason, and the reason is in the accounts.';
  }
  return 'Not yet, and that is fine — nobody reads accounts right the first time. Go back through the evidence lines; every answer was sitting in the figures.';
}

/**
 * The whole exercise: which companies to scout, and in what order.
 *
 * Deliberately the ones the child has never opened, cheapest question first.
 * Rating a company whose accounts are already in the trophy case would let the
 * exercise be farmed by re-rating a familiar one, which is the same rule §16
 * applies to the collection.
 */
export function scoutable(
  companies: readonly Company[],
  alreadyRated: readonly string[],
): Company[] {
  return companies.filter((company) => !alreadyRated.includes(company.ticker));
}
