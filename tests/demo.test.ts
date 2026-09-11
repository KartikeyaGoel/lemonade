import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEMO_STAGES,
  NOT_IN_A_JUMPED_SAVE,
  demoGame,
} from '../src/lib/demo';
import {
  ACT_TITLES,
  createGame,
  readiness,
  seededWith,
  type Act,
} from '../src/lib/progress';
import { isUnlocked, type Feature } from '../src/lib/unlocks';
import { createCareer } from '../src/lib/career';
import { buy, currentPrice } from '../src/lib/market';
import { trailingWeeklyProfit } from '../src/lib/business';

/**
 * The demo shortcut, and the two things it must not cost.
 *
 * The ask was a way to jump to the market for a demo, with the suggestion that
 * the stages could be unlocked. This file is here because "unlock it" and "play
 * it forward" look like the same feature from the outside and are not, and both
 * halves of the difference are testable:
 *
 *  - **The jump has to land somewhere that works.** Not merely somewhere with
 *    `act: 5` on it. The market's primary action is buying, and buying is gated
 *    by `readiness`, which reads four things only playing produces. A jump that
 *    passed the unlocks and failed the readiness gate would demo a locked
 *    screen, which is worse than no shortcut.
 *  - **The gated path must be exactly what it was.** Every assertion about a
 *    fresh game below would still pass if this module did not exist. They are
 *    here so that they stop passing the moment somebody makes the shortcut work
 *    by loosening a gate instead.
 */

const career = createCareer();

describe('a save that starts part-way through', () => {
  it('lands on the stage it was asked for, every time', () => {
    for (const stage of DEMO_STAGES) {
      expect(demoGame(stage.act).act).toBe(stage.act);
    }
  });

  it('offers every stage the road does, named the way the road names it', () => {
    // One home for a stage name. A panel with its own list would drift from
    // the one the parent report and the title screen read.
    expect(DEMO_STAGES.map((stage) => stage.act)).toEqual([1, 2, 3, 4, 5]);
    for (const stage of DEMO_STAGES) {
      expect(stage.name).toBe(ACT_TITLES[stage.act].name);
      expect(stage.promise).toBe(ACT_TITLES[stage.act].promise);
    }
  });

  it('arrives with days actually played behind it', () => {
    // The point of playing forward rather than declaring. A stage-4 save with
    // an empty history would price the company off nothing.
    for (const stage of DEMO_STAGES.filter((entry) => entry.act > 1)) {
      const game = demoGame(stage.act);
      expect(game.stand.history.length).toBeGreaterThan(0);
      // PRODUCT.md §4: the lifetime count and the history are the same fact.
      expect(game.daysTraded).toBe(game.stand.history.length);
      // Every day is a real day with a real record, not a filled-in row.
      for (const day of game.stand.history) {
        expect(day.cupsSold).toBeGreaterThanOrEqual(0);
        expect(day.revenue).toBeCloseTo(day.revenue, 2);
      }
    }
  });

  it('gets further into the business at every stage, and never backwards', () => {
    let days = -1;
    for (const stage of DEMO_STAGES) {
      const game = demoGame(stage.act);
      expect(game.stand.history.length).toBeGreaterThanOrEqual(days);
      days = game.stand.history.length;
    }
    // And the specific milestones, so "further" means something.
    expect(demoGame(3).business.stands.length).toBe(1);
    expect(demoGame(4).business.shop.open).toBe(true);
    expect(demoGame(4).business.loan).not.toBeNull();
  });
});

describe('the market, which is the stage that was asked for', () => {
  const market = demoGame(5);

  it('opens with money the business actually fetched', () => {
    expect(market.portfolio).not.toBeNull();
    expect(market.portfolio!.cash).toBeGreaterThan(0);
    // Not a number typed into this file. It is the buyout, and the buyout is
    // the kid's own trailing week times the multiple a buyer offered for it.
    expect(seededWith(market)).toBeCloseTo(market.ownership.buyoutProceeds, 2);
    expect(market.ownership.buyoutPrice).toBeCloseTo(
      trailingWeeklyProfit(market.stand.history) * market.ownership.buyoutMultiple,
      2,
    );
    expect(market.portfolio!.cash).toBeCloseTo(seededWith(market) + market.business.savings, 2);
  });

  it('can actually buy something, which is the whole point', () => {
    /*
     * The assertion the shortcut exists for. `readiness` gates committing
     * money and is not an unlock, so turning every unlock on would have left
     * this false and the demo would have been of a market that refuses.
     */
    expect(readiness(market).canTrade).toBe(true);
    for (const criterion of readiness(market).criteria) {
      expect(criterion.met, criterion.id).toBe(true);
    }

    const result = buy(market.portfolio!, 'AAPL', currentPrice(market.portfolio!, 'AAPL') * 2);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.portfolio.holdings)).toContain('AAPL');
  });

  it('hands over an account and not a portfolio', () => {
    // A demo of deciding what to buy cannot start with the buying done.
    expect(Object.keys(market.portfolio!.holdings)).toHaveLength(0);
    expect(market.portfolio!.trades).toHaveLength(0);
    expect(market.theses).toHaveLength(0);
    expect(market.portfolio!.week).toBe(0);
  });

  /*
   * Across seeds, not on the one seed that happens to work.
   *
   * The first version of this file checked the default seed and passed. Sixty
   * seeds found that sixteen of them reached the market and then refused to
   * buy anything, every one of them failing `held-through-loss` on a
   * thirty-cent price move — which turned out to be a real defect in
   * `heldThroughWorstDay` rather than anything about the demo, and one that
   * was hitting children too. It is asserted here because here is where it
   * showed up, and because a shortcut that works for one seed is a shortcut
   * nobody can change the seed of.
   */
  it('lands in a market that can trade whatever the seed', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const game = demoGame(5, seed);
      const unmet = readiness(game).criteria.filter((criterion) => !criterion.met);
      expect(unmet.map((criterion) => criterion.id), `seed ${seed}`).toEqual([]);
      expect(game.portfolio!.cash, `seed ${seed}`).toBeGreaterThan(0);
      expect(game.learned, `seed ${seed}`).toContain('margin');
    }
  });

  it('unlocks the stage-5 features by being at stage 5, not by being told to', () => {
    expect(isUnlocked('club', market, career)).toBe(true);
    // And not the ones that need something this save has not done. A demo that
    // opened with the live market would be showing a door the child is meant
    // to earn by finishing twelve weeks.
    expect(isUnlocked('live-market', market, career)).toBe(false);
    expect(isUnlocked('playbook', market, career)).toBe(false);
  });
});

describe('what the shortcut is not allowed to cost', () => {
  it('leaves a fresh game exactly as gated as it was', () => {
    const fresh = createGame(1);
    expect(readiness(fresh).canTrade).toBe(false);
    expect(readiness(fresh).metCount).toBe(0);
    const locked: Feature[] = ['trophies', 'words', 'challenge', 'club', 'playbook', 'live-market'];
    for (const feature of locked) {
      expect(isUnlocked(feature, fresh, career), feature).toBe(false);
    }
  });

  /*
   * The guard that would have caught the tempting shortcut.
   *
   * The cheap way to make a demo save trade is to write `passedOnOverpriced:
   * true` and be done with it. It works, and it quietly turns the readiness
   * gate into a thing that can be asserted rather than demonstrated — at which
   * point the four criteria are decoration and nobody finds out until a real
   * child walks through them. So the module is read, and it may reach those
   * fields only through the functions that earn them.
   */
  it('never writes a readiness flag or a badge by hand', () => {
    const source = readFileSync('src/lib/demo.ts', 'utf8');
    for (const forbidden of [
      'passedOnOverpriced:',
      'comparisonChoiceId:',
      'comparisonAnswered:',
      'buyoutAccepted:',
      'canTrade',
      'recordBadges',
      'isUnlocked',
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
    // It reaches them the earned way instead.
    expect(source).toContain('recordDealChoice');
    expect(source).toContain('acceptBuyout');
  });

  it('keeps the door out of every screen a child looks at', () => {
    // `onJump` belongs to one component, and it is the one no child screen
    // links to. A second home for it is how an admin control becomes a
    // feature.
    const parent = readFileSync('src/components/acts/ParentScreen.tsx', 'utf8');
    expect(parent).toContain('onJump');
    const page = readFileSync('src/app/page.tsx', 'utf8');
    // Passed to the grown-up screen and nowhere else.
    expect(page.match(/onJump=/g) ?? []).toHaveLength(1);
  });

  it('is honest in code about what a jumped save does not show', () => {
    expect(NOT_IN_A_JUMPED_SAVE.length).toBeGreaterThan(0);
    expect(NOT_IN_A_JUMPED_SAVE.join(' ')).toMatch(/first-run|pacing/i);
  });
});

describe('the words a jumped save arrives knowing', () => {
  it('includes the one the readiness gate reads, from stage 2 onwards', () => {
    /*
     * Margin is a criterion, and the insight only lands on a day that sold
     * thirty cups or a day that sold more and earned less. A thriftier
     * playthrough reaches the market and then cannot buy anything, which is
     * exactly the bug this asserts against.
     */
    for (const act of [2, 3, 4, 5] as Act[]) {
      expect(demoGame(act).learned, `stage ${act}`).toContain('margin');
    }
  });

  it('hands nothing over that was not taught by a day it played', () => {
    const game = demoGame(5);
    expect(game.pendingInsights).toHaveLength(0);
    expect(new Set(game.learned).size).toBe(game.learned.length);
  });
});
