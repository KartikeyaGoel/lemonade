/**
 * How long the arc is, measured — and what shortening it costs.
 *
 * ## Why this file exists
 *
 * PRODUCT.md §75 records a bug class that no gate can catch: **a number that is
 * right everywhere in the code and wrong in the world.** `ACT2_DAYS = 16` was
 * that. Every test agreed with it, every screen printed it consistently, and it
 * was set from a measurement taken in a game with the competitor switched off.
 * It took a second pilot and a child putting the game down.
 *
 * The only defence is to keep the measurement *next to* the number and make the
 * suite take it. So every tunable that costs a child a day is listed here with
 * the run that justifies it.
 *
 * ## Why this does not count words
 *
 * The obvious metric for "did shortening hurt the learning" is how many
 * vocabulary cards get handed over, and that metric is weak. It counts
 * *delivery*, not understanding; several of the words overlap heavily
 * (`revenue`/`profit`/`margin`, `capex-vs-opex`/`operating-leverage`); and a
 * child can tap through a card having read none of it. Asked about it directly,
 * the customer was right: *"you're measuring the goal of being educational by
 * words... I feel like that's a very semantic take."*
 *
 * So this file asserts the two things the product already derives from
 * behaviour instead:
 *
 *  - **`readiness`** — four criteria, each read off something the child did
 *    with money at stake and nobody prompting them. It is the gate on
 *    committing money in the market, so it is the closest thing to "can they
 *    trade properly".
 *  - **`mastery`** — fifteen skills, each detected from sightings in the
 *    child's own history rather than from a word being shown.
 *
 * Words are still counted, at the bott, as a *floor* rather than a target: if
 * the arc ever stops delivering most of them, something is wrong even if the
 * behaviour metrics hold.
 */
import { describe, expect, it } from 'vitest';
import {
  act1Complete,
  act2Complete,
  beginAct2,
  beginAct3,
  createGame,
  readiness,
  type Game,
} from '../src/lib/progress';
import {
  ACT2_DAYS,
  HANDS_OFF_DAYS_REQUIRED,
  buyUpgrade,
  openStand,
  standCount,
  toggleStaff,
  trailingWeeklyProfit,
} from '../src/lib/business';
import { SHOP, SHOP_DAYS_REQUIRED, loanQuote } from '../src/lib/retail';
import { ECON, batchPlan, runDay } from '../src/lib/simulation';
import { WEEKLY_EVERY, paramsForDay, settleDay } from '../src/lib/day';
import { batchForCapacity, sensiblePrice } from '../src/lib/demo';
import { bestDeal, recordDealChoice } from '../src/lib/ownership';
import {
  floatPlan,
  listCompany,
  listingComplete,
  listingOffer,
  markListedWeek,
} from '../src/lib/listing';
import { mastery, reachable } from '../src/lib/mastery';

/** Ten seeds, because the weather drives everything downstream of it. */
const SEEDS = [2026, 4242, 7, 555, 90210, 31337, 1, 12345, 8080, 999];

interface Run {
  stage1: number;
  stage2: number;
  stage3: number;
  total: number;
  game: Game;
}

function day(game: Game, price: number, cups: number, byManager: boolean, stageDay: number): Game {
  const plan = batchPlan(game.stand, cups);
  const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));
  return settleDay(game, outcome, { ranByManager: byManager, stageDay }).game;
}

/**
 * A careful child, played all the way to the market.
 *
 * Reads the sky, buys the kit that answers the rival, follows the goal strip
 * rung by rung, takes the best deal on the board and floats 30%. This is the
 * run every promise in this file is made to; careless play is measured in
 * `tests/wordbudget.test.ts`, where the promise is different.
 */
function careful(seed: number): Run {
  let game = createGame(seed);

  /* Stage 1 ends on two good days, or the seven-day clock. */
  let a1 = 0;
  while (a1 < ECON.TOTAL_DAYS && !act1Complete(game.stand)) {
    a1 += 1;
    game = day(game, 1.6, 36, false, a1);
  }
  game = { ...game, stand: { ...game.stand, status: 'playing' } };

  /* Stage 2: a cooler, a manager, a second table, a door. */
  game = beginAct2(game);
  let a2 = 0;
  let borrowed = false;
  while (a2 < ACT2_DAYS && !act2Complete(game.business, a2)) {
    for (const id of ['freshSqueeze', 'bigSign', 'cooler'] as const) {
      if (game.business.upgrades[id]) continue;
      const bought = buyUpgrade(game.stand.cash, game.business, id);
      if (bought.ok && game.stand.cash > 60) {
        game = { ...game, stand: { ...game.stand, cash: bought.cash }, business: bought.business };
      }
    }
    if (!game.business.staff.manager && game.stand.cash > 120) {
      game = { ...game, business: toggleStaff(game.business, 'manager') };
    }
    if (
      game.business.staff.manager &&
      game.business.handsOffDays >= HANDS_OFF_DAYS_REQUIRED &&
      standCount(game.business) < 2
    ) {
      const opened = openStand(game.business, 'park', game.stand.cash);
      if (opened.opened) {
        game = { ...game, stand: { ...game.stand, cash: opened.cash }, business: opened.business };
      }
    }
    if (standCount(game.business) >= 2 && !game.business.shop.open) {
      if (!borrowed) {
        const loan = loanQuote();
        game = {
          ...game,
          business: { ...game.business, loan },
          stand: { ...game.stand, cash: game.stand.cash + loan.principal },
        };
        borrowed = true;
      }
      if (game.stand.cash >= SHOP.fitOut) {
        game = {
          ...game,
          stand: { ...game.stand, cash: game.stand.cash - SHOP.fitOut },
          business: { ...game.business, shop: { ...game.business.shop, open: true } },
        };
      }
    }
    a2 += 1;
    game = day(game, sensiblePrice(game), batchForCapacity(game), game.business.staff.manager, a2);
  }
  /* The boundary hands over whatever the ration still owes. See `afterDay`. */
  const owed = game.pendingInsights.map((insight) => insight.id);
  game = { ...game, learned: [...game.learned, ...owed], pendingInsights: [] };

  /* Stage 3: rank a board, float, then live a week as a public company. */
  game = beginAct3(game);
  game = { ...game, ownership: recordDealChoice(game.ownership, bestDeal().id) };
  let a3 = 0;
  let listed = false;
  while (a3 < 40 && !listingComplete(game.listing)) {
    const offer = listingOffer(game.stand.history, game.ownership);
    if (!listed && offer.worthAnything) {
      game = { ...game, listing: listCompany(offer, floatPlan(offer, 0.3, game.ownership)) };
      listed = true;
      continue;
    }
    a3 += 1;
    game = day(game, sensiblePrice(game), batchForCapacity(game), true, a3);
    if (listed && a3 % WEEKLY_EVERY === 0) {
      game = {
        ...game,
        listing: markListedWeek(game.listing, trailingWeeklyProfit(game.stand.history)).listing,
      };
    }
  }

  return { stage1: a1, stage2: a2, stage3: a3, total: a1 + a2 + a3, game };
}

const RUNS = SEEDS.map(careful);
const worst = (pick: (run: Run) => number) => Math.max(...RUNS.map(pick));
const mean = (pick: (run: Run) => number) =>
  RUNS.reduce((sum, run) => sum + pick(run), 0) / RUNS.length;

describe('how long the arc is, for a child who plays it well', () => {
  it('reaches the market inside three weeks, on every seed', () => {
    /*
     * Measured: 18 to 22 days, mean 20.
     *
     * Stated as a bound rather than a figure, because the figure moves with the
     * weather. The bound is what stops it drifting back — it was 42 when nobody
     * was counting, then 36, then 32, and the cuts since were each argued from
     * a measurement rather than a feel. See PRODUCT.md §75 and §76.
     *
     * The previous version of this claim said 23 and was wrong in the direction
     * that flatters us *and* the direction that matters: it was assembled from
     * the stage *caps* rather than from a run, which is the same mistake as
     * `ACT2_DAYS = 16`. A number about how long the game takes has to come
     * from playing it.
     */
    expect(worst((r) => r.total), `worst run took ${worst((r) => r.total)} days`).toBeLessThanOrEqual(22);
    expect(mean((r) => r.total)).toBeLessThanOrEqual(21);
  });

  it('says where the days go, so a cut is aimed rather than guessed', () => {
    /*
     * | stage | measured | what holds it |
     * |---|---|---|
     * | one stand | 4-7, mean 4.5 | two days exploring, then two days over target — already its floor |
     * | a real business | 7-11, mean 8.5 | four rungs, two of which are three-day streaks |
     * | go public | **exactly 7** | one marked week, on `stageDay % WEEKLY_EVERY` |
     *
     * The third row is the single biggest block in the arc and it is one line
     * of routing. It is deliberately not cut: the stage's stated lesson is that
     * *living* a week as a public company is what teaches what a share price
     * is, a week is a real unit, and marking it after three days while still
     * calling it a week would be a lie on the screen.
     */
    expect(worst((r) => r.stage1)).toBeLessThanOrEqual(ECON.TOTAL_DAYS);
    expect(mean((r) => r.stage1)).toBeLessThan(6);
    expect(worst((r) => r.stage2)).toBeLessThan(ACT2_DAYS);
    /* Every seed, exactly a week — if this ever varies, the routing changed. */
    for (const run of RUNS) {
      expect(run.stage3, 'the listed week stopped being a week').toBe(WEEKLY_EVERY);
    }
  });

  it('keeps every cap above the run it has to carry', () => {
    /*
     * The property `ACT2_DAYS = 16` violated in spirit: a cap is only honest if
     * it is above the slowest run that is *promised* to finish. Below that it
     * times children out of work they did; far above it, it is the number a
     * struggling child actually plays.
     */
    expect(ACT2_DAYS, `slowest careful business stage is ${worst((r) => r.stage2)}`).toBeGreaterThan(
      worst((r) => r.stage2),
    );
    expect(ECON.TOTAL_DAYS).toBeGreaterThanOrEqual(worst((r) => r.stage1));
  });
});

describe('what a child can do by the time they reach the market', () => {
  it('clears every readiness criterion, on every seed', () => {
    /*
     * The gate on committing money in the market, and the closest thing this
     * product has to "can they trade properly". Four criteria, each read off
     * something they did rather than something they were shown.
     */
    for (const run of RUNS) {
      const missing = readiness(run.game)
        .criteria.filter((c) => !c.met)
        .map((c) => c.id);
      expect(missing, `${run.total} days and still missing ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('holds almost every skill that is detectable by then', () => {
    /*
     * `mastery` finds skills by looking for *sightings* in the child's own
     * history — a day they bought capacity when it bound, a day they held a
     * price under attack — so it cannot be satisfied by a word card.
     *
     * Measured: 10 or 11 of the 12 reachable skills held, on every seed. The
     * one that stays unseen is `judges-on-a-run`, which needs two occasions of
     * *not* swinging the price after a bad day, and a careful policy with a
     * fixed price does not produce the bad days to not swing after. That is a
     * limitation of the harness rather than of the arc.
     */
    for (const run of RUNS) {
      const skills = reachable(mastery(run.game), run.game.act);
      const held = skills.filter((s) => s.level === 'held');
      const unseen = skills.filter((s) => s.level === 'unseen');
      expect(
        held.length,
        `${run.total} days · held ${held.length}/${skills.length} · unseen ${unseen.map((s) => s.id).join(', ')}`,
      ).toBeGreaterThanOrEqual(skills.length - 2);
    }
  });

  it('still delivers most of the glossary, as a floor rather than a target', () => {
    /*
     * Words last, and deliberately as a floor. They are a weak proxy — delivery
     * is not understanding, and several of them overlap — but a run that
     * suddenly stops delivering them has changed in a way worth looking at,
     * even if the two behaviour metrics above still hold.
     */
    for (const run of RUNS) {
      expect(run.game.learned.length, `${run.total} days delivered ${run.game.learned.length} words`).toBeGreaterThanOrEqual(18);
      expect(run.game.pendingInsights, 'words earned and never handed over').toEqual([]);
    }
  });
});

describe('what each day-costing constant is worth', () => {
  /*
   * Every tunable that costs a child a day, with the measurement that justifies
   * it. Swept by hand rather than in the test — a sweep that re-plays the arc
   * at four settings is thirty seconds — and recorded so the next person to
   * look at these numbers starts from data:
   *
   * | | days, mean | readiness | skills held |
   * |---|---|---|---|
   * | as shipped: hands-off 3, shop 3 | **20.0** | 4/4 | 10-11 |
   * | hands-off 2 | 18.4 | 4/4 | 10, and one seed loses one |
   * | shop days 2 | 19.0 | 4/4 | 10-11 |
   * | both 2 | 17.4 | 4/4 | 10, and one seed loses one |
   *
   * So the honest reading: **the streaks are worth about two and a half days
   * between them, and cutting the hands-off one costs a skill.** Dropping the
   * shop streak to two looks free on both behaviour metrics and is not taken,
   * for a reason the metrics cannot see: two consecutive profitable days can be
   * a warm Tuesday and a warm Wednesday, and the rung exists to show the rent
   * covered on a day that was not a gift.
   *
   * What this test holds is the shape of that argument, not the numbers: each
   * streak is at least two, because one is an anecdote.
   */
  it('keeps each proof streak long enough to rule out a fluke', () => {
    expect(HANDS_OFF_DAYS_REQUIRED).toBeGreaterThanOrEqual(2);
    expect(SHOP_DAYS_REQUIRED).toBeGreaterThanOrEqual(2);
    expect(ECON.ACT1_TARGET_HITS).toBeGreaterThanOrEqual(2);
  });

  it('spends most of its days on the two stages that have four rungs between them', () => {
    /*
     * A sanity check on where the time goes, so a future change that quietly
     * moves the weight shows up here. The listed week is a seventh of the arc
     * and the business stage is about two fifths of it.
     */
    const total = mean((r) => r.total);
    expect(mean((r) => r.stage2) / total).toBeGreaterThan(0.3);
    expect(mean((r) => r.stage3) / total).toBeLessThan(0.45);
  });
});
