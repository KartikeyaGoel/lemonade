/**
 * The qualitative case for a company, and the three ways it could lie.
 *
 * The pilot asked for strengths and risks on the compare screen, twice. The
 * danger in giving them is not that they will be wrong about a number — the
 * numbers come from filings — it is that a list of bullet points about a
 * company is the easiest place in this product to accidentally make a
 * **recommendation**. `facedown.ts` opens by promising never to, and
 * `scout.ts` is explicit that "nothing here is an opinion the game holds".
 *
 * So three things get held:
 *
 *  1. Every company gets at least one strength *and* at least one risk. A card
 *     with three strengths and no risks is a recommendation whatever the
 *     heading says.
 *  2. Every claim carries the figure it came from, so it can be checked against
 *     the filing rather than believed.
 *  3. The two sides stay apart — what you pay is never a mark against the
 *     business.
 *
 * And one thing that is not about honesty at all: the claims have to **differ
 * between companies**, because the defect they were built to fix was six
 * identical sentences on every comparison a child ever made.
 */
import { describe, expect, it } from 'vitest';
import { SNAPSHOT, metricsFor } from '../src/lib/companies';
import {
  DEAR_MULTIPLE,
  FAT_MARGIN,
  MOST_SHOWN,
  qualitiesOf,
  strengthsAndRisks,
} from '../src/lib/qualities';

describe('the qualitative case is derived, not asserted', () => {
  it('gives every company both sides of the story', () => {
    /*
     * The load-bearing one. Nothing in the product may present a company
     * without also presenting what could go wrong with it, because a child
     * reading two green ticks and no warnings has been told to buy.
     */
    for (const company of SNAPSHOT) {
      const { strengths, risks } = strengthsAndRisks(company);
      expect(strengths.length, `${company.ticker} had no strength`).toBeGreaterThan(0);
      expect(risks.length, `${company.ticker} had no risk`).toBeGreaterThan(0);
      expect(strengths.length, `${company.ticker} strengths`).toBeLessThanOrEqual(MOST_SHOWN);
      expect(risks.length, `${company.ticker} risks`).toBeLessThanOrEqual(MOST_SHOWN);
    }
  });

  it('cites a figure for every claim it makes', () => {
    /*
     * §16's rule about the parent report, applied to the market: a claim
     * nobody can audit is a claim nobody should believe. Every `because` has
     * to contain an actual quantity.
     */
    for (const company of SNAPSHOT) {
      for (const quality of qualitiesOf(company)) {
        const where = `${company.ticker} · ${quality.id}`;
        expect(quality.says.length, where).toBeGreaterThan(8);
        expect(quality.because.length, where).toBeGreaterThan(20);
        /*
         * A number, a percentage, a money figure or a count of years — with
         * one disclosed exception.
         *
         * `company.model` is authored by us in `market-data.json` rather than
         * read out of a filing, so a model-derived strength cites the
         * classification instead of a quantity. `qualities.ts` says so out
         * loud. It is permitted here by id rather than by a loose regex, so
         * adding a second un-cited claim fails this test rather than sliding
         * in behind the exception.
         */
        if (quality.id.startsWith('model-')) {
          expect(quality.because, `${where} did not name the model`).toMatch(
            /^(Brand|Subscription|Membership):/,
          );
          continue;
        }
        expect(quality.because, `${where} cites nothing`).toMatch(/\d/);
      }
    }
  });

  it('never says which one to buy', () => {
    /*
     * The sentence that would undo `facedown.ts`'s whole argument. Swept over
     * every company rather than reviewed, because copy drifts and a reviewer
     * reads twenty-four lists once.
     */
    const advice = /\b(buy|sell|should|better than|best|avoid|recommend|a bargain|good value)\b/i;
    for (const company of SNAPSHOT) {
      for (const quality of qualitiesOf(company)) {
        const text = `${quality.says} ${quality.because}`;
        expect(text, `${company.ticker} · ${quality.id}`).not.toMatch(advice);
      }
    }
  });

  it('keeps what you pay out of the business case', () => {
    /*
     * `scout.ts`'s two questions. A high price-to-profit is a fact about the
     * *stock* — it says what other people already expect — and filing it as a
     * weakness of the business is the single most common mistake a beginner
     * makes. A great business at a silly price is a bad investment, and that
     * sentence is only learnable while the two stay apart.
     */
    for (const company of SNAPSHOT) {
      for (const quality of qualitiesOf(company)) {
        if (/price|years of profit|expects/i.test(quality.says)) {
          expect(quality.side, `${company.ticker} · ${quality.id}`).toBe('stock');
        }
      }
    }
    // And at least one company actually exercises that: expensive, good.
    const dearAndFat = SNAPSHOT.filter((c) => {
      const m = metricsFor(c);
      return m.pe !== null && m.pe >= DEAR_MULTIPLE && m.netMargin >= FAT_MARGIN;
    });
    expect(dearAndFat.length, 'no company is both dear and high-margin').toBeGreaterThan(0);
    for (const company of dearAndFat) {
      const { strengths, risks } = strengthsAndRisks(company);
      expect(strengths.some((q) => q.side === 'business'), company.ticker).toBe(true);
      expect(risks.some((q) => q.side === 'stock'), company.ticker).toBe(true);
    }
  });

  it('says something different about different companies', () => {
    /*
     * The repetition defect, guarded. `FaceoffRow.meaning` is a constant per
     * row — the same six sentences for every pair, for ever — which is why the
     * pilot said "reading comparisons over and over again people just end up
     * scrolling over it". If these collapsed to one or two shapes across
     * twenty-four companies they would be the same defect wearing a new
     * heading.
     */
    const shapes = new Set<string>();
    for (const company of SNAPSHOT) {
      const { strengths, risks } = strengthsAndRisks(company);
      shapes.add([...strengths, ...risks].map((q) => q.id).join('+'));
    }
    expect(shapes.size, `only ${shapes.size} distinct cases across 24 companies`).toBeGreaterThan(
      12,
    );
  });

  it('does not report a loss twice', () => {
    /*
     * Found by printing all twenty-four and reading them: Crocs came back with
     * "Lost money in its last year" *and* "Profit went down last year", which
     * is one fact occupying both risk slots and crowding out the second thing
     * a child would have been shown.
     */
    for (const company of SNAPSHOT) {
      const { risks } = strengthsAndRisks(company);
      const aboutLosing = risks.filter((q) =>
        /never made a profit|lost money|profit went down/i.test(q.says),
      );
      expect(aboutLosing.length, `${company.ticker} said it twice`).toBeLessThanOrEqual(1);
    }
  });

  it('tells a one-bad-year business apart from one that has never worked', () => {
    /*
     * The two look identical if you read only the most recent filing, and the
     * difference is the whole judgement. Roblox has lost money in every year
     * on file. Crocs earned $950M and then lost $81M. Saying "does not make a
     * profit **yet**" about the second is false in the way that matters.
     */
    const everEarned = (t: string) => {
      const company = SNAPSHOT.find((c) => c.ticker === t)!;
      return company.annuals.some((y) => y.netIncomeM > 0);
    };
    const riskIds = (t: string) =>
      strengthsAndRisks(SNAPSHOT.find((c) => c.ticker === t)!).risks.map((q) => q.id);

    for (const company of SNAPSHOT) {
      const m = metricsFor(company);
      if (m.profitable) continue;
      const ids = riskIds(company.ticker);
      const expected = everEarned(company.ticker) ? 'lost-money-lately' : 'never-earned';
      expect(ids, `${company.ticker} was described wrongly`).toContain(expected);
    }
  });

  it('reads the price it is given, not the one baked into the data', () => {
    /*
     * The market replays real history, so a child is paying the price from the
     * week they are in. A "the price already expects a lot" risk computed off
     * today's price while they trade a price from 2022 would be a warning
     * about a company nobody is buying.
     */
    const company = SNAPSHOT.find((c) => metricsFor(c).pe !== null)!;
    const cheap = qualitiesOf(company, company.price * 0.2);
    const dear = qualitiesOf(company, company.price * 5);
    expect(dear.some((q) => q.id === 'dear'), `${company.ticker} at 5x`).toBe(true);
    expect(cheap.some((q) => q.id === 'dear'), `${company.ticker} at 0.2x`).toBe(false);
  });
});
