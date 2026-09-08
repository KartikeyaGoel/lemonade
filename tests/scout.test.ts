/**
 * Stock Scout: the framework, checked against filings.
 *
 * FRAMEWORK.md §16's audit found this was the real gap in Level 2 — stages 2
 * and 3 were substantially built and stage 1 did not exist, which is the
 * inverse of the worry that the later stages need the work.
 *
 * Two properties get tested harder than the rest.
 *
 * **The two sides never blur.** "A great business at a silly price is a bad
 * investment" is the single most valuable sentence in this product, and a child
 * cannot learn it from one combined score. So the sides are tallied apart, and
 * the verdict for "good business, bad price" has to name the mistake rather
 * than average it away.
 *
 * **No answer is an opinion the game holds.** Every question computes its
 * answer from the same SEC fundamentals and the same replayed price the market
 * uses, and hands back the arithmetic. A quiz with a hand-written key teaches
 * a child to guess what an adult wants.
 */
import { describe, it, expect } from 'vitest';
import {
  BUSINESS_QUESTIONS,
  SCOUT_QUESTIONS,
  STOCK_QUESTIONS,
  rate,
  scoutQuestion,
  scoutable,
  verdictOf,
  type Answers,
} from '../src/lib/scout';
import { SNAPSHOT, findCompany, metricsFor } from '../src/lib/companies';

const apple = findCompany('AAPL')!;

describe('the framework', () => {
  it('has both sides, and the business side comes first', () => {
    /*
     * The order is an argument: you decide whether it is a good business
     * *before* you look at what it costs, so the price cannot talk you into
     * liking the business.
     */
    const sides = SCOUT_QUESTIONS.map((q) => q.side);
    expect(sides.indexOf('stock')).toBeGreaterThan(sides.lastIndexOf('business'));
    expect(BUSINESS_QUESTIONS.length).toBeGreaterThanOrEqual(5);
    expect(STOCK_QUESTIONS.length).toBeGreaterThanOrEqual(3);
  });

  it('covers the five business questions the customer wrote out', () => {
    const ids = BUSINESS_QUESTIONS.map((q) => q.id);
    expect(ids).toContain('makes-money');
    expect(ids).toContain('growing');
    expect(ids).toContain('people-want-it');
    expect(ids).toContain('has-an-edge');
    expect(ids).toContain('money-well-used');
  });

  it('covers the three stock questions', () => {
    const ids = STOCK_QUESTIONS.map((q) => q.id);
    expect(ids).toContain('what-am-i-paying');
    expect(ids).toContain('expectations-in-the-price');
    expect(ids).toContain('what-could-go-wrong');
  });

  it('asks one thing per question, answerable yes or no', () => {
    for (const question of SCOUT_QUESTIONS) {
      expect((question.ask.match(/\?/g) ?? []).length, question.id).toBe(1);
      expect(question.kidLine.length, question.id).toBeGreaterThan(20);
      expect(question.ask, question.id).not.toMatch(/ and | or /);
    }
  });

  it('answers every question from the figures, for every company', () => {
    /*
     * Exhaustive rather than sampled, because the failure mode is one company
     * whose accounts make one question throw — a company with no profit
     * dividing by zero, say — and that would present as a blank screen in the
     * middle of the exercise.
     */
    for (const company of SNAPSHOT) {
      for (const question of SCOUT_QUESTIONS) {
        expect(() => question.holds(company, company.price), `${company.ticker}/${question.id}`)
          .not.toThrow();
        const evidence = question.evidence(company, company.price);
        expect(typeof evidence, `${company.ticker}/${question.id}`).toBe('string');
        expect(evidence.length, `${company.ticker}/${question.id}`).toBeGreaterThan(20);
        // Every evidence line has to carry a figure. A verdict with no
        // arithmetic in it is the game holding an opinion.
        expect(evidence, `${company.ticker}/${question.id}`).toMatch(/\d/);
      }
    }
  });

  /*
   * Found in a browser: the chips read "Takings $$416B".
   *
   * `formatMillions` already carries the dollar sign, so every caller that
   * writes `$${formatMillions(...)}` prints two. It appeared four times across
   * the module and the screen in one sitting, which makes it a class rather
   * than a typo — the same shape as §62's "a fact with more than one home",
   * where the fact is "who is responsible for the currency symbol".
   */
  it('never prints two currency symbols', () => {
    for (const company of SNAPSHOT) {
      for (const question of SCOUT_QUESTIONS) {
        const evidence = question.evidence(company, company.price);
        expect(evidence, `${company.ticker}/${question.id}`).not.toMatch(/\$\$/);
      }
    }
  });

  it('finds a question by id, and nothing by a made-up one', () => {
    expect(scoutQuestion('growing')?.side).toBe('business');
    expect(scoutQuestion('nope')).toBeUndefined();
  });
});

describe('the price questions move with the price', () => {
  it('calls a sensible price sensible and a silly one silly', () => {
    const paying = scoutQuestion('what-am-i-paying')!;
    const eps = metricsFor(apple).eps!;
    expect(paying.holds(apple, eps * 10)).toBe(true);
    expect(paying.holds(apple, eps * 60)).toBe(false);
  });

  it('knows a high price is a promise somebody has to keep', () => {
    const expectations = scoutQuestion('expectations-in-the-price')!;
    const eps = metricsFor(apple).eps!;
    expect(expectations.holds(apple, eps * 10)).toBe(false);
    expect(expectations.holds(apple, eps * 60)).toBe(true);
  });

  it('treats a company with no profit as pure expectation', () => {
    /*
     * The honest answer for a business that does not make money: every cent of
     * the price is somebody expecting a profit, which is the most expectation a
     * price can carry. Saying "no, not much is expected" because there is no
     * P/E to compare would be exactly backwards.
     */
    const lossMaking = SNAPSHOT.find((c) => c.netIncomeM <= 0);
    if (!lossMaking) return;
    const expectations = scoutQuestion('expectations-in-the-price')!;
    expect(expectations.holds(lossMaking, lossMaking.price)).toBe(true);
    expect(expectations.evidence(lossMaking, lossMaking.price)).toMatch(/no profit yet/);
  });
});

describe('marking a rating', () => {
  function allRight(company = apple, price = company.price): Answers {
    return Object.fromEntries(
      SCOUT_QUESTIONS.map((q) => [q.id, q.holds(company, price)]),
    );
  }

  it('marks a perfect rating perfect, and says so about both halves', () => {
    const rating = rate(apple, allRight());
    expect(rating.business.right).toBe(rating.business.outOf);
    expect(rating.stock.right).toBe(rating.stock.outOf);
    expect(rating.says).toMatch(/whole framework/i);
  });

  it('tallies the two sides apart', () => {
    const answers = allRight();
    // Wrong on every price question, right on every business one.
    for (const question of STOCK_QUESTIONS) answers[question.id] = !answers[question.id];

    const rating = rate(apple, answers);
    expect(rating.business.right).toBe(rating.business.outOf);
    expect(rating.stock.right).toBe(0);
  });

  /*
   * The commonest and most dangerous shape, and the reason the sides are
   * reported separately at all. It feels like competence: a child who can spot
   * a wonderful business and cannot spot a silly price will buy wonderful
   * businesses at silly prices, which is how most people lose most money.
   *
   * So the verdict has to *name* it rather than average it into "5 out of 8".
   */
  it('names the mistake when the business is read well and the price is not', () => {
    const said = verdictOf({ right: 5, outOf: 5 }, { right: 0, outOf: 3 });
    expect(said).toMatch(/great business at a silly price/i);
    expect(said).not.toMatch(/5 out of 8|well done/i);
  });

  it('names the other mistake too', () => {
    const said = verdictOf({ right: 1, outOf: 5 }, { right: 3, outOf: 3 });
    expect(said).toMatch(/cheap things are usually cheap for a reason/i);
  });

  it('says so plainly when neither side landed, without finding a compliment', () => {
    const said = verdictOf({ right: 1, outOf: 5 }, { right: 0, outOf: 3 });
    expect(said).toMatch(/not yet/i);
    expect(said).toMatch(/evidence/i);
    expect(said).not.toMatch(/good|well done|nice/i);
  });

  it('says nothing about a rating with no answers in it', () => {
    expect(verdictOf({ right: 0, outOf: 0 }, { right: 0, outOf: 0 })).toMatch(/did not answer/i);
    const rating = rate(apple, {});
    expect(rating.business.outOf).toBe(0);
    expect(rating.marks.every((mark) => !mark.answered)).toBe(true);
  });

  it('counts only what was answered, so a part-finished rating is honest', () => {
    const answers: Answers = { 'makes-money': true };
    const rating = rate(apple, answers);
    expect(rating.business.outOf).toBe(1);
    expect(rating.stock.outOf).toBe(0);
  });

  it('carries the evidence whichever way they answered', () => {
    const wrong = Object.fromEntries(
      SCOUT_QUESTIONS.map((q) => [q.id, !q.holds(apple, apple.price)]),
    );
    const rating = rate(apple, wrong);
    expect(rating.marks.every((mark) => mark.evidence.length > 20)).toBe(true);
    expect(rating.marks.every((mark) => !mark.right)).toBe(true);
  });
});

describe('which companies to scout', () => {
  it('offers ones the child has not rated', () => {
    const done = SNAPSHOT.slice(0, 3).map((c) => c.ticker);
    const left = scoutable(SNAPSHOT, done);
    expect(left).toHaveLength(SNAPSHOT.length - 3);
    expect(left.map((c) => c.ticker)).not.toContain(done[0]);
  });

  it('runs out rather than repeating', () => {
    // §16's rule about the collection: it must not be farmable by re-rating a
    // familiar company.
    expect(scoutable(SNAPSHOT, SNAPSHOT.map((c) => c.ticker))).toEqual([]);
  });
});
