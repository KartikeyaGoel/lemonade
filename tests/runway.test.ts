/**
 * How long before a kid reaches the market?
 *
 * The product's own answer to "why should a nine-year-old care what a share
 * price is" is that they ran a business first — so the stand stages are not a
 * tutorial to be skipped, they are the reason the market means anything. But
 * that argument has a price, and until now nobody was counting it: the arc was
 * assembled stage by stage, each length defended on its own, and the total was
 * whatever it happened to add up to.
 *
 * It added up to about thirty-eight days in the worst case. Nothing asserted
 * that, nothing noticed it, and it was spotted by reading "Start day 41" off a
 * browser sweep of an unrelated bug.
 *
 * So the total is a number this file owns. Not to freeze it — a product is
 * allowed to change its mind about pacing — but so that changing it is a
 * decision somebody makes rather than a thing that drifts one stage at a time.
 */
import { describe, it, expect } from 'vitest';
import { ECON } from '../src/lib/simulation';
import { ACT2_DAYS } from '../src/lib/business';
import { ACT3_DAYS } from '../src/lib/progress';
import { MARKET_WEEKS } from '../src/lib/market';

/**
 * The listing stage is event-driven rather than day-capped — a deal board, a
 * verdict, and a float. Counted as the few days it takes to press through.
 */
const ACT4_DAYS_ESTIMATE = 3;

/**
 * Days a kid must play before Act 5 opens, if they hit every goal.
 *
 * These are **measured**, not derived from the thresholds, and the difference
 * matters. Adding the gates up gives 7 + (1+3+1+2) + (1+5) + 3 = 23, and 23 is
 * not reachable: a cold day with a manager on twenty dollars is a loss almost
 * whatever you charge, the hands-off streak ticks down when that happens, and
 * so the stands stage takes eleven days rather than seven. `wordbudget.test.ts`
 * measures eleven and five across ten seeds; those are the numbers here.
 *
 * The first version of this file used the threshold sum and so quietly
 * understated the runway by three days while claiming to be the thing that
 * stopped it drifting.
 */
const ACT2_DAYS_MEASURED = 11;
const ACT3_DAYS_MEASURED = 5;

const BEST_CASE =
  ECON.TOTAL_DAYS + ACT2_DAYS_MEASURED + ACT3_DAYS_MEASURED + ACT4_DAYS_ESTIMATE;

/** Every day a kid plays if they hit none of them and time out of each stage. */
const WORST_CASE = ECON.TOTAL_DAYS + ACT2_DAYS + ACT3_DAYS + ACT4_DAYS_ESTIMATE;

describe('the runway to the market', () => {
  it('is under four weeks for a kid who hits every goal', () => {
    expect(BEST_CASE).toBeLessThanOrEqual(26);
  });

  it('is about a month for a kid who hits none of them', () => {
    /*
     * The number that matters, because it is the one a struggling player gets.
     * It was 38 when nobody was counting, and is 32 now — the whole reduction
     * coming from the shop stage, whose spare days were measured to be spare.
     *
     * The stands stage kept all sixteen of its days on purpose: see
     * `ACT2_DAYS`, where cutting them was measured to cost careless children
     * the word `delegation`.
     */
    expect(WORST_CASE).toBeLessThanOrEqual(32);
  });

  it('never punishes the struggling kid with more than half again the runway', () => {
    /*
     * The asymmetry, stated as a property.
     *
     * A cap is the fallback for a child who has *not* met the goal, so its
     * slack is spent only by whoever is already having trouble. That argument
     * justified cutting the shop stage and was *refuted* for the stands stage
     * by measurement — the extra days there are what get a struggling child to
     * a manager at all. So this bound is deliberately loose enough to permit
     * the sixteen: it catches drift, not design.
     */
    expect(WORST_CASE / BEST_CASE).toBeLessThan(1.35);
  });

  it('leaves every stage cap above the goal it is a fallback for', () => {
    /*
     * A cap at or below its objective is worse than a long one: the stage ends
     * by timeout at the moment the goal completes, so the kid does the work and
     * the game takes the credit away. Act 2 at ten days did exactly this.
     *
     * Compared against the *measured* durations rather than the sum of the
     * thresholds, because the thresholds are wrong in both directions. They
     * understate the stands stage — 1+3+1+2 = 7 against a measured 11, since a
     * loss ticks the hands-off streak back down — and they overstate the shop,
     * where "a day to fit out, then five good days" is six but the fit-out
     * happens on a trading day, so it is five.
     *
     * Using them here would have passed a cap of six for the stands stage and
     * failed the shipped cap of six for the shop. Both backwards.
     */
    expect(ACT2_DAYS).toBeGreaterThan(ACT2_DAYS_MEASURED);
    expect(ACT3_DAYS).toBeGreaterThan(ACT3_DAYS_MEASURED);
  });

  it('still spends most of the game in the market, not on the way to it', () => {
    /*
     * The check that keeps the argument honest. If the stand stages ever
     * outgrow the market they exist to explain, the ladder has stopped being
     * a ladder and become the product.
     */
    const marketDays = MARKET_WEEKS * 7;
    expect(marketDays).toBeGreaterThan(WORST_CASE);
  });
});
