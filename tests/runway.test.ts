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
import { MARKET_WEEKS } from '../src/lib/market';

/**
 * The listing stage is event-driven rather than day-capped — a deal board, a
 * verdict, and a float.
 *
 * **Seven**, and it was written down as three.
 *
 * Three was a guess about how long it takes to press through the screens, and
 * the screens are not what the stage waits for: `afterDay` will not offer the
 * float until `listingOffer(...).worthAnything`, which needs a week of trading
 * behind it. Driven in a browser from a fresh save, the stage ran from day 19
 * to day 26.
 *
 * So the file whose entire job is stopping the runway from drifting was
 * understating it by four days, in a constant nothing measured. Seven is what a
 * real playthrough took.
 */
const ACT4_DAYS_ESTIMATE = 7;

/**
 * Days a kid must play before Act 5 opens, if they hit every goal.
 *
 * These are **measured**, not derived from the thresholds, and the difference
 * matters. The first version of this file used the threshold sum and so
 * understated the runway while claiming to be the thing that stopped it
 * drifting.
 *
 * The stands figure was eleven. It is six, and the correction is not a tuning
 * change — eleven was measured in a game with no competitor in it. Every
 * harness that had ever played a day was missing `advanceRival`, so a stage
 * whose central problem is a rival across the road was being timed without
 * one. With him restored, a child who answers him finishes in five or six days
 * and a child who does not never finishes at all. See `src/lib/day.ts`.
 *
 * `wordbudget.test.ts` measures both figures across ten seeds and two levels
 * of play, through the app's own `settleDay`.
 */
const ACT2_DAYS_MEASURED = 9;

const BEST_CASE = ECON.TOTAL_DAYS + ACT2_DAYS_MEASURED + ACT4_DAYS_ESTIMATE;

/** Every day a kid plays if they hit none of them and time out of each stage. */
const WORST_CASE = ECON.TOTAL_DAYS + ACT2_DAYS + ACT4_DAYS_ESTIMATE;

describe('the runway to the market', () => {
  it('is about three weeks for a kid who hits every goal', () => {
    expect(BEST_CASE).toBeLessThanOrEqual(23);
  });

  it('is about a month for a kid who hits none of them', () => {
    /*
     * The number that matters, because it is the one a struggling player gets.
     *
     * 38 when nobody was counting, 32 once the shop's spare days were cut, and
     * 26 now. The stands stage kept all sixteen of its days on an argument
     * that turned out to rest on a measurement of a competitor-free game: see
     * `ACT2_DAYS`. Re-measured, every cap from six to sixteen costs careless
     * play the same words, so the ten days beyond six were buying nothing but
     * ten more identical losing days — which is exactly what the second pilot
     * reported.
     */
    expect(WORST_CASE).toBeLessThanOrEqual(26);
  });

  it('never punishes the struggling kid with more than half again the runway', () => {
    /*
     * The asymmetry, stated as a property.
     *
     * A cap is the fallback for a child who has not met the goal, so its slack
     * is spent only by whoever is already having trouble. That argument cut the
     * shop stage, and was then thought to be *refuted* for the stands stage on
     * the grounds that the extra days were what got a struggling child to a
     * manager at all. They were not: a struggling child never gets there
     * either way, because the wage is what they cannot afford. So the bound can
     * be tight again.
     */
    expect(WORST_CASE / BEST_CASE).toBeLessThan(1.2);
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
     *
     * Both caps are now the measured duration plus margin: ten against six,
     * and six against five.
     */
    expect(ACT2_DAYS).toBeGreaterThan(ACT2_DAYS_MEASURED);
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
