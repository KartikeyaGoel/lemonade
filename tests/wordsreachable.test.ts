/**
 * Can every word in the glossary actually be handed to a child?
 *
 * `reachable.test.ts` asks this of badges and of mastery skills, and it exists
 * because PRODUCT.md §40 records the project losing months to a badge whose
 * counter nothing moved. It does not ask it of **words**, and words are the
 * other reward currency — thirty-four of them, paced one a day by §26, and the
 * thing the glossary tab and the whole vocabulary claim rest on.
 *
 * That gap showed up while measuring something else. Playing the ladder ten
 * times over, at two levels of skill, delivered about sixteen of the twenty-two
 * words the stand stages own — and four of them arrived in **none** of the
 * twenty runs: `competition`, `differentiation`, `recurring-revenue`,
 * `marketing`.
 *
 * None of those turned out to be broken. Each needs an action the arc player
 * never took — a rival on the street, a big sign, fresh-squeezed lemonade,
 * neighbours on a round. Which is precisely why this file has to exist: "it
 * was not delivered in twenty runs" and "it cannot be delivered" look
 * identical from the outside, and only one of them is acceptable.
 *
 * So this asserts the property rather than the instance. Every word has a
 * state that produces it, built from the real constructors.
 */
import { describe, it, expect } from 'vitest';
import { GLOSSARY, recurringRevenueInsight, unrecorded } from '../src/lib/glossary';
import {
  buyUpgrade,
  createBusinessState,
  deriveAct2Insights,
  deriveAct3Insights,
  deriveDayParams,
  openStand,
  signUpRegulars,
  toggleStaff,
  type BusinessState,
} from '../src/lib/business';
import { loanQuote } from '../src/lib/retail';
import { DEFAULT_DAY_PARAMS, batchPlan, deriveInsights, runDay, ECON } from '../src/lib/simulation';
import { createGame } from '../src/lib/progress';
import type { DayOutcome, DayRecord, GameState } from '../src/lib/simulation';

/** A week of ordinary trading, so the derivers have a history to read. */
function seedWeek(): GameState {
  let state = createGame(2026).stand;
  for (let day = 0; day < ECON.TOTAL_DAYS; day++) {
    const plan = batchPlan(state, 30);
    state = runDay(state, { ...plan.order, price: 1.5 }, DEFAULT_DAY_PARAMS).nextState;
  }
  return { ...state, status: 'playing' };
}

/**
 * A business with everything a child could have bought by the end of the arc.
 *
 * Deliberately maximal rather than plausible: the question is whether a state
 * exists that produces each word, not whether one run reaches all of them.
 */
function loadedBusiness(cash = 5000): BusinessState {
  let business = createBusinessState();

  for (const upgrade of ['cooler', 'bigSign', 'freshSqueeze'] as const) {
    const bought = buyUpgrade(cash, business, upgrade);
    expect(bought.ok, `fixture could not buy ${upgrade}: ${'reason' in bought ? bought.reason : ''}`).toBe(true);
    if (bought.ok) {
      business = bought.business;
      cash = bought.cash;
    }
  }

  business = toggleStaff(business, 'manager');
  business = toggleStaff(business, 'helper');

  const second = openStand(business, 'park', cash);
  expect(second.opened, 'fixture could not open a second stand').toBe(true);
  if (second.opened) business = second.business;

  // A rival, on the same street, which two words need.
  business = {
    ...business,
    rival: { active: true, price: 1.1, location: business.location, daysActive: 4 },
  };

  // Neighbours on a round, which `recurring-revenue` needs.
  const drive = signUpRegulars(business, seedWeek().history);
  business = drive.business;
  expect(business.regulars, 'fixture signed nobody up for the round').toBeGreaterThan(0);

  // A shop, open, on a loan — for the Act 3 words.
  business = {
    ...business,
    loan: loanQuote(),
    shop: { ...business.shop, open: true, staff: 1 },
  };

  return business;
}

/**
 * Every word any deriver produces, across a spread of days and states.
 *
 * Two phases, and the first one is the fix for this file's first failure.
 * Starting from a week-old stand reported `revenue`, `profit`, `unit-cost`,
 * `fixed-cost` and `spoilage` as unreachable — because those are the words
 * Act 1 teaches on its *opening* days and the fixture had already spent them.
 * A maximal late-game state is the wrong place to look for the first thing a
 * child is told. Fifth fixture mistake of this kind; see PRODUCT.md §49.
 */
function everyWordTheGameCanHandOver(): Set<string> {
  const found = new Set<string>();

  const collect = (outcome: DayOutcome, business: BusinessState) => {
    const history: DayRecord[] = outcome.nextState.history;
    for (const insight of [
      ...deriveInsights(outcome, history),
      ...deriveAct2Insights(outcome, business, history),
      ...deriveAct3Insights(outcome, business),
    ]) {
      found.add(insight.id);
    }
    if (outcome.subscriberCups > 0) {
      found.add(
        recurringRevenueInsight(outcome.subscriberCups, outcome.subscriberPrice, outcome.weather)
          .id,
      );
    }
  };

  /*
   * Phase one: a brand new stand, from day one, on a folding table. This is
   * where the vocabulary of a business actually starts.
   *
   * A spread of prices and batches, because most words are conditional on what
   * the day *did* — a sell-out, a day with waste, a loss — and one day is one
   * shape of day.
   */
  const plain = createBusinessState();
  for (const price of [0.4, 1, 1.6, 2.4, 3]) {
    for (const cups of [8, 30, 90]) {
      let state = createGame(2026).stand;
      for (let day = 0; day < 4; day++) {
        const params = { ...DEFAULT_DAY_PARAMS, lastDay: null };
        const plan = batchPlan(state, cups);
        const outcome = runDay(state, { ...plan.order, price }, params);
        collect(outcome, plain);
        state = outcome.nextState;
      }
    }
  }

  /*
   * Phase one-and-a-half: a business that got better.
   *
   * `compounding` fires on `ownsCapex && history.length >= 8` and only when the
   * last four days average 30% more profit than the first four. A fixture that
   * trades at one price all week never produces that shape, however many days
   * it runs — so this one deliberately starts badly and improves, which is also
   * the story the word is trying to tell.
   */
  {
    /*
     * Capex but no payroll. `compounding` also needs `early > 0`, and the fully
     * loaded business pays a manager, a helper and shop rent — which turns the
     * deliberately cheap opening days into losses and disqualifies them. The
     * word needs a business that invested, not one that spends.
     */
    const bought = buyUpgrade(2000, createBusinessState(), 'cooler');
    expect(bought.ok).toBe(true);
    const invested = bought.ok ? bought.business : createBusinessState();
    let state = createGame(2026).stand;
    for (let day = 0; day < 5; day++) {
      const params = { ...deriveDayParams(invested, 0.9), lastDay: null };
      const plan = batchPlan(state, 20);
      const outcome = runDay(state, { ...plan.order, price: 0.9 }, params);
      collect(outcome, invested);
      state = outcome.nextState;
    }
    for (let day = 0; day < 6; day++) {
      const params = { ...deriveDayParams(invested, 2), lastDay: null };
      const plan = batchPlan(state, 60);
      const outcome = runDay(state, { ...plan.order, price: 2 }, params);
      collect(outcome, invested);
      state = outcome.nextState;
    }
  }

  /* Phase two: everything a child could own by the end of the arc. */
  const business = loadedBusiness();
  let state = seedWeek();
  for (const price of [0.5, 1, 1.5, 2, 2.5, 3]) {
    for (const cups of [8, 30, 90]) {
      const params = { ...deriveDayParams(business, price), lastDay: null };
      const plan = batchPlan(state, cups);
      const outcome: DayOutcome = runDay(state, { ...plan.order, price }, params);
      collect(outcome, business);
      state = outcome.nextState;
      if (state.status === 'finished') state = { ...state, status: 'playing' };
    }
  }

  return found;
}

describe('every word has a state that produces it', () => {
  it('signs neighbours up, so the round is a real thing in the fixture', () => {
    expect(loadedBusiness().regulars).toBeGreaterThan(0);
  });

/**
 * Words no code path can award, as of writing.
 *
 * Empty, and it must stay that way. It held `unit-cost` until §53 wired it.
 *
 * The original note, kept because it is the reason this file exists: It is a full glossary
 * entry, so it counts in the `words.total` the trophy case, the parent report
 * and the "N of 34 still to earn" line all show — and nothing anywhere
 * constructs an insight with that id. Every other word in the glossary has a
 * producer; this one has a type-union member and a *reader*.
 *
 * Which means two things a child can see:
 *
 * - the words tab can never reach 34 of 34, however well they play;
 * - `PriceScreen`'s `learned.includes('margin') || learned.includes('unit-cost')`
 *   is half dead, and the margin row depends on `margin` alone.
 *
 * The intent is on record. `ShopScreen`'s own comment says "on day one the
 * receipt *is* the unit-cost lesson" — so it was meant to be handed over from
 * the receipt and never was. That is PRODUCT.md §40's defect class, third
 * instance, after `letManagerRun` and the kept-the-whole-thing badge.
 *
 * Listed rather than silently skipped, and asserted *exactly*, so that fixing
 * it fails this test too and whoever fixes it deletes the entry. A new word
 * joining the list fails immediately.
 */
const KNOWN_UNEARNABLE: string[] = [];

  it('leaves no Act 1, 2 or 3 word that no day can hand over', () => {
    /*
     * Acts 1 to 3 only. Acts 4 and 5 earn their words from the listing, the
     * buyout, the thesis and the market — none of which run a day — and those
     * are covered where they happen. A single test that pretended to span all
     * five would need every module in the product and would prove less about
     * each of them.
     */
    const produced = everyWordTheGameCanHandOver();
    const owed = GLOSSARY.filter((word) => word.act <= 3).map((word) => word.id);
    const unreachable = owed.filter((id) => !produced.has(id));

    expect(
      unreachable,
      `words with no producer: ${unreachable.join(', ')} — expected only ${KNOWN_UNEARNABLE.join(', ')}`,
    ).toEqual(KNOWN_UNEARNABLE);
  });

  it('awards unit-cost, which nothing used to', () => {
    /*
     * The defect this file was written to find, now fixed: awarded on the
     * first day anything sells, from the receipt, where `ShopScreen`'s comment
     * always said it belonged.
     *
     * Kept as its own named test rather than folded into the sweep above,
     * because a word that silently stops being awarded is exactly how it went
     * unnoticed the first time.
     */
    const produced = everyWordTheGameCanHandOver();
    expect(produced.has('unit-cost')).toBe(true);
    expect(GLOSSARY.map((w) => w.id)).toContain('unit-cost');
  });

  it('produces the four that twenty simulated runs never delivered', () => {
    /*
     * Named individually, because these are the ones that prompted the file
     * and a future tuning pass should be told loudly if it breaks one. Each
     * depends on a purchase or an action rather than on time:
     *
     * - `competition` — a rival trading on your street
     * - `differentiation` — that rival, plus fresh-squeezed
     * - `marketing` — the big sign
     * - `recurring-revenue` — neighbours on a round
     */
    const produced = everyWordTheGameCanHandOver();
    for (const id of ['competition', 'differentiation', 'marketing', 'recurring-revenue']) {
      expect(produced.has(id), `${id} is no longer produced by any day`).toBe(true);
    }
  });

  it('never hands over a word twice', () => {
    /*
     * `unrecorded` is the filter every deriver's output passes through, and it
     * is what stops a word arriving again tomorrow. Asserted here because this
     * file is the one place that runs every deriver at once.
     */
    const produced = [...everyWordTheGameCanHandOver()];
    expect(unrecorded(produced.map((id) => ({ id }) as never), produced)).toEqual([]);
  });
});
