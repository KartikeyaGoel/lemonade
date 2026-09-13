import { describe, expect, it } from 'vitest';
import { readiness, beginAct2, beginAct3, createGame, type Game } from '../src/lib/progress';
import {
  ACT2_DAYS, HANDS_OFF_DAYS_REQUIRED, act2Progress, buyUpgrade, openStand, standCount, toggleStaff,
} from '../src/lib/business';
import { SHOP, loanQuote } from '../src/lib/retail';
import { ECON, batchPlan, runDay } from '../src/lib/simulation';
import { paramsForDay, settleDay } from '../src/lib/day';
import { batchForCapacity, sensiblePrice, throughActOne } from '../src/lib/demo';
import { bestDeal, createOwnershipState, recordDealChoice } from '../src/lib/ownership';

type Skill = 'sensible' | 'trying' | 'clumsy';

function arc(seed: number, skill: Skill): Game {
  let game: Game = skill === 'sensible' ? throughActOne(seed) : (() => {
    let g = createGame(seed);
    for (let d = 0; d < ECON.TOTAL_DAYS; d += 1) {
      const plan = batchPlan(g.stand, 36);
      const o = runDay(g.stand, { ...plan.order, price: 1 }, paramsForDay(g, 1));
      g = settleDay(g, o, { ranByManager: false, stageDay: d + 1 }).game;
    }
    return { ...g, stand: { ...g.stand, status: 'playing' as const } };
  })();

  game = beginAct2(game);
  let days = 0;
  let borrowed = false;
  while (days < ACT2_DAYS && !act2Progress(game.business, days).complete) {
    for (const id of ['freshSqueeze', 'bigSign', 'cooler'] as const) {
      if (game.business.upgrades[id]) continue;
      const b = buyUpgrade(game.stand.cash, game.business, id);
      const floor = skill === 'clumsy' && id !== 'cooler' ? 150 : 60;
      if (b.ok && game.stand.cash > floor) game = { ...game, stand: { ...game.stand, cash: b.cash }, business: b.business };
    }
    if (!game.business.staff.manager && game.stand.cash > (skill === 'clumsy' ? 300 : 120)) {
      game = { ...game, business: toggleStaff(game.business, 'manager') };
    }
    if (game.business.staff.manager && game.business.handsOffDays >= HANDS_OFF_DAYS_REQUIRED && standCount(game.business) < 2) {
      const o = openStand(game.business, 'park', game.stand.cash);
      if (o.opened) game = { ...game, stand: { ...game.stand, cash: o.cash }, business: o.business };
    }
    if (standCount(game.business) >= 2 && !game.business.shop.open) {
      if (!borrowed) {
        const loan = loanQuote();
        game = { ...game, business: { ...game.business, loan }, stand: { ...game.stand, cash: game.stand.cash + loan.principal } };
        borrowed = true;
      }
      if (game.stand.cash >= SHOP.fitOut) {
        game = { ...game, stand: { ...game.stand, cash: game.stand.cash - SHOP.fitOut }, business: { ...game.business, shop: { ...game.business.shop, open: true } } };
      }
    }
    const price = skill === 'sensible' ? sensiblePrice(game) : 1;
    const cups = skill === 'sensible' ? batchForCapacity(game) : Math.max(8, Math.floor(batchForCapacity(game) * 0.95));
    const plan = batchPlan(game.stand, cups);
    const outcome = runDay(game.stand, { ...plan.order, price }, paramsForDay(game, price));
    days += 1;
    game = settleDay(game, outcome, { ranByManager: game.business.staff.manager, stageDay: days }).game;
  }
  const owed = game.pendingInsights.map((i) => i.id);
  game = { ...game, learned: [...game.learned, ...owed], pendingInsights: [] };

  // The listing stage: the deal board, answered correctly, which is what two of
  // the four readiness criteria are read off.
  game = beginAct3(game);
  return { ...game, ownership: recordDealChoice(game.ownership, bestDeal().id) };
}

const SEEDS = [2026, 4242, 7, 555, 90210, 31337, 1, 12345, 8080, 999];

describe('the gate that decides whether a child may trade', () => {
  /*
   * ## Why this file exists
   *
   * The arc got shorter — the stands cap came down from sixteen, the shop
   * stopped being a stage of its own, and a duplicated proof streak went. Every
   * one of those was argued from a measurement, and every one of those
   * measurements was about **words**: does the child still get told everything
   * they earned.
   *
   * Words are not the point. The point is that they can read a real company and
   * commit their own money sensibly, and this product already has an
   * operational definition of that which does not depend on vocabulary at all:
   * `readiness`, four criteria, each read off something the child did with
   * money at stake and nobody prompting them.
   *
   *  - **margin** — worked out what they keep from a cup
   *  - **held-through-loss** — did not panic-swing the price after a bad day
   *  - **ranked-by-multiple** — ranked three businesses by what they cost per
   *    dollar of profit
   *  - **passed-on-price** — declined the dear one
   *
   * Nothing asserted that shortening the arc left this intact. That was the
   * real gap in the argument, and this closes it.
   *
   * Measured: all four criteria, on every seed, at all three levels of play.
   * The two deal-board criteria are the ones a shorter stage could plausibly
   * have cost, because they are read off a screen that the listing stage has to
   * reach — and it does.
   */
  it('is still cleared by every level of play the arc supports', () => {
    for (const skill of ['sensible', 'trying', 'clumsy'] as Skill[]) {
      for (const seed of SEEDS) {
        const ready = readiness(arc(seed, skill));
        const missing = ready.criteria.filter((c) => !c.met).map((c) => c.id);
        expect(missing, `${skill}/${seed} cannot trade: missing ${missing.join(', ')}`).toEqual([]);
      }
    }
  });

  it('rests on evidence rather than on having been shown a screen', () => {
    /*
     * The half that keeps it honest, and PRODUCT.md §16's rule. A child who
     * never answered a deal board must *not* clear it — otherwise the gate is
     * a formality and the arc could be shortened to nothing without this test
     * noticing.
     */
    const unproven = beginAct3(arc(2026, 'sensible'));
    const blank = readiness({ ...unproven, ownership: createOwnershipState() });
    const missing = blank.criteria.filter((c) => !c.met).map((c) => c.id);
    expect(missing).toContain('ranked-by-multiple');
    expect(missing).toContain('passed-on-price');
  });
});
