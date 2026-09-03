/**
 * Can every word Acts 4 and 5 own actually be handed to a child?
 *
 * `wordsreachable.test.ts` asks this of Acts 1 to 3 and says plainly why it
 * stops there: "Acts 4 and 5 earn their words from the listing, the buyout,
 * the thesis and the market — none of which run a day — and those are covered
 * where they happen."
 *
 * They were not, in the sense that matters. FRAMEWORK.md's whole argument is
 * that **shares** and **stock price** are "the two that the whole product is
 * pointing at", and its §10 claims all twelve concepts now have a mechanic.
 * Checking that claim found `going-public` and `market-cap` produced in
 * `listing.ts` and named by no test at all — the same signature as the
 * `unit-cost` defect in PRODUCT.md §53: in the glossary, in the type union,
 * counted in the total a child is shown, and never asserted to fire.
 *
 * None of them turned out to be broken. That is the point: "nothing asserts
 * it" and "it does not work" look identical from the outside, and only one of
 * them is acceptable in the twelve concepts the product is built to teach.
 */
import { describe, it, expect } from 'vitest';
import { GLOSSARY } from '../src/lib/glossary';
import {
  businessModelInsight,
  diversificationInsight,
  drawdownInsight,
  luckInsight,
  multipleInsight,
  peRatioInsight,
  thesisInsight,
} from '../src/lib/glossary';
import {
  buyoutOffer,
  createOwnershipState,
} from '../src/lib/ownership';
import {
  createListing,
  deriveListingInsights,
  floatPlan,
  listCompany,
  listingOffer,
  markListedWeek,
} from '../src/lib/listing';
import { DEFAULT_DAY_PARAMS, batchPlan, runDay, type DayRecord } from '../src/lib/simulation';
import { createGame } from '../src/lib/progress';

/** A profitable fortnight, built by the simulation rather than by hand. */
function tradedHistory(price = 2): DayRecord[] {
  let state = createGame(2026).stand;
  for (let day = 0; day < 14; day++) {
    const plan = batchPlan(state, 40);
    state = runDay(state, { ...plan.order, price }, { ...DEFAULT_DAY_PARAMS, lastDay: null })
      .nextState;
  }
  return state.history;
}

/** A company actually taken public, through the real constructors. */
function listedCompany() {
  const history = tradedHistory();
  const offer = listingOffer(history, createOwnershipState());
  const plan = floatPlan(offer, 0.2, createOwnershipState());
  return { history, offer, listing: listCompany(offer, plan) };
}

describe('the words Act 4 hands over at the listing', () => {
  it('produces all four, from a company really taken public', () => {
    /*
     * `shares` and `share-price` are the two FRAMEWORK.md §2 calls the seam
     * the framework exists to close — a kid used to meet a share price for the
     * first time on Apple, in Act 5, having never had one of their own.
     * `market-cap` and `going-public` had no test naming them at all.
     */
    const { listing } = listedCompany();
    const produced = deriveListingInsights(listing, null).map((insight) => insight.id);

    for (const id of ['shares', 'share-price', 'market-cap', 'going-public']) {
      expect(produced, `${id} is not produced by a company that listed`).toContain(id);
    }
  });

  it('hands over none of them before the company is listed', () => {
    /*
     * The other half of the property. A word that arrives early is as wrong as
     * one that never arrives: §26 paces these one a day, and the listing words
     * are the payoff for a decision the kid has not made yet.
     */
    expect(deriveListingInsights(createListing(), null)).toEqual([]);
  });

  it('still produces them after the first week of being re-rated', () => {
    /*
     * `markListedWeek` is what moves the kid's own share price, and the
     * Level 1 endpoint in FRAMEWORK.md §5 requires exactly that: "seen their
     * own share price move at least once". So the words have to survive the
     * event that satisfies the endpoint, not just the moment of listing.
     */
    const { listing, history } = listedCompany();
    const weekly = history.slice(-7).reduce((sum, day) => sum + day.profit, 0);
    const after = markListedWeek(listing, weekly * 1.4);

    const produced = deriveListingInsights(after.listing, after.move).map((i) => i.id);
    for (const id of ['shares', 'share-price', 'market-cap', 'going-public']) {
      expect(produced, `${id} vanished once the price moved`).toContain(id);
    }
    expect(after.move, 'the share price did not move at all').not.toBeNull();
  });
});

describe('the words the rest of Acts 4 and 5 hand over', () => {
  /**
   * Every remaining Act 4/5 word, with the real producer and arguments a real
   * run would pass it.
   *
   * Called through the actual helpers rather than asserted as string literals,
   * because the failure this guards against is a glossary id drifting away
   * from the producer that awards it — which orphans the word silently and is
   * exactly how `unit-cost` went unnoticed.
   */
  const produced: Record<string, () => { id: string }> = {
    multiple: () => multipleInsight('Ada’s Lemonade', 11, 6),
    'pe-ratio': () => peRatioInsight(buyoutOffer(tradedHistory(), createOwnershipState())),
    'business-model': () => businessModelInsight(0.35, 3),
    diversification: () => diversificationInsight(['AAPL', 'NKE', 'RBLX']),
    drawdown: () => drawdownInsight(0.22, 'RBLX'),
    thesis: () => thesisInsight('NKE', 'A P/E of 24, so 24 years of earnings.', 'People buy shoes again.'),
    'luck-vs-skill': () => luckInsight('DUOL', 0.31),
  };

  it('produces a word whose id is really in the glossary', () => {
    const known = new Set<string>(GLOSSARY.map((word) => word.id));
    for (const [expected, make] of Object.entries(produced)) {
      const insight = make();
      expect(insight.id, `${expected}'s producer returned id "${insight.id}"`).toBe(expected);
      expect(known.has(insight.id), `${insight.id} is not a glossary entry`).toBe(true);
    }
  });

  it('leaves no Act 4 or 5 word without a producer', () => {
    /*
     * The inventory assertion, and the reason this file is not just eight
     * spot-checks. A thirteenth concept added to the glossary with no way to
     * earn it fails here immediately, rather than being counted in the "N of
     * 34 still to earn" line a child reads and can never finish.
     */
    const listingWords = ['shares', 'share-price', 'market-cap', 'going-public'];
    const covered = new Set([...listingWords, ...Object.keys(produced)]);

    const owed = GLOSSARY.filter((word) => word.act >= 4).map((word) => word.id);
    const orphaned = owed.filter((id) => !covered.has(id));

    expect(orphaned, `Act 4/5 words with no producer: ${orphaned.join(', ')}`).toEqual([]);
  });
});

describe('the stage a word says it belongs to', () => {
  it('files the funding screen’s two words under the same stage', () => {
    /*
     * `FundingScreen` is one decision with three branches: pay cash, borrow,
     * or sell the investor a slice. Borrowing teaches `interest`; the slice
     * teaches `equity`. Same screen, same choice, same stage — so they cannot
     * disagree about which stage that is.
     *
     * They did. `interest` said 3 and `equity` said 4, and because the trophy
     * case prints `Act {word.act}` against every word, a child who funded
     * their shop with a slice saw it filed under a stage they had not reached.
     * FRAMEWORK.md §10 had described it correctly in prose the whole time —
     * "the investor's slice in Act 3 and the float in Act 4" — which is the
     * point of this test: the document made a checkable claim and nothing
     * checked it. See PRODUCT.md §56.
     */
    const words = GLOSSARY.filter((word) => word.id === 'equity' || word.id === 'interest');
    expect(words, 'the funding screen’s words are no longer both in the glossary').toHaveLength(2);

    const [first, second] = words;
    expect(
      first.act,
      `${first.id} is act ${first.act} and ${second.id} is act ${second.act}, ` +
        'but they are taught by the same decision',
    ).toBe(second.act);
    expect(first.act, 'the shop, and its funding, is Act 3').toBe(3);
  });

  it('keeps the listing’s four words in Act 4, where the float happens', () => {
    /*
     * The other half of §10's sentence. The investor's slice is Act 3 and the
     * float is Act 4, so retagging `equity` must not have dragged the listing
     * words down with it.
     */
    for (const id of ['shares', 'share-price', 'market-cap', 'going-public']) {
      const word = GLOSSARY.find((entry) => entry.id === id);
      expect(word, `${id} left the glossary`).toBeDefined();
      expect(word?.act, `${id} should be taught at the listing`).toBe(4);
    }
  });
});

describe('FRAMEWORK.md’s twelve concepts', () => {
  it('each have a glossary word behind them', () => {
    /*
     * The framework names twelve concepts and §2 recorded four of them as
     * missing or partial: shares, stock price, marketing, ownership. This is
     * the assertion that they stayed built — the mapping is explicit because
     * five of the twelve are taught under a name a nine-year-old can use
     * rather than the framework's own term.
     */
    const concepts: Record<string, string[]> = {
      revenue: ['revenue'],
      marketing: ['marketing'],
      capital: ['capex-vs-opex', 'return-on-cash'],
      value: ['market-cap', 'multiple'],
      cost: ['unit-cost', 'fixed-cost'],
      margin: ['margin'],
      ownership: ['equity', 'going-public'],
      shares: ['shares'],
      profit: ['profit'],
      competition: ['competition'],
      growth: ['compounding', 'operating-leverage'],
      'stock price': ['share-price'],
    };

    expect(Object.keys(concepts)).toHaveLength(12);

    const known = new Set<string>(GLOSSARY.map((word) => word.id));
    for (const [concept, ids] of Object.entries(concepts)) {
      const present = ids.filter((id) => known.has(id));
      expect(
        present.length,
        `the framework concept "${concept}" has no glossary word left: expected one of ${ids.join(', ')}`,
      ).toBeGreaterThan(0);
    }
  });
});
