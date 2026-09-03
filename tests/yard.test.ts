import { describe, expect, it } from 'vitest';
import { createBusinessState, serviceCapacity, STAFF, UPGRADES } from '../src/lib/business';
import {
  capacityAdded,
  cupsToCoverWage,
  dailyBurn,
  idleCapacity,
  plots,
  roomGoingSpare,
} from '../src/lib/yard';

const bare = createBusinessState();

describe('the plot of land', () => {
  it('offers every decision in the act, once each', () => {
    const ids = plots(bare, 1000).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...Object.keys(UPGRADES), ...Object.keys(STAFF), 'sidewalk', 'park']) {
      expect(ids).toContain(id);
    }
  });

  it('keeps the capex/opex distinction in the data, not in a heading', () => {
    // This is the whole lesson of Act 2, so it has to be a property of the
    // thing rather than a caption above a list that nobody reads.
    const byId = Object.fromEntries(plots(bare, 1000).map((p) => [p.id, p]));
    expect(byId.cooler.kind).toBe('kit');
    expect(byId.cooler.costLabel).toBe('once');
    expect(byId.helper.kind).toBe('crew');
    expect(byId.helper.costLabel).toBe('a day');
    expect(byId.park.kind).toBe('pitch');
    expect(byId.park.costLabel).toBe('a day');
  });

  it('never offers to sell something already owned', () => {
    const owned = { ...bare, upgrades: { ...bare.upgrades, cooler: true } };
    const cooler = plots(owned, 1000).find((p) => p.id === 'cooler');
    expect(cooler?.owned).toBe(true);
    expect(cooler?.affordable).toBe(false);
    expect(cooler?.doing).not.toBeNull();
  });

  it('says what an owned thing is doing right now', () => {
    // A list of rows can show a price. Only this can answer "was that worth
    // it", which is the question the kid should be asking.
    const managed = { ...bare, staff: { ...bare.staff, manager: true }, handsOffDays: 2 };
    const manager = plots(managed, 0).find((p) => p.id === 'manager');
    expect(manager?.doing).toContain('2 profitable days');
  });

  it('marks the pitch you are standing on as owned and the other as a move', () => {
    const here = plots(bare, 1000);
    expect(here.find((p) => p.id === 'sidewalk')?.owned).toBe(true);
    expect(here.find((p) => p.id === 'park')?.owned).toBe(false);
  });

  it('will not let a kid buy what they cannot pay for', () => {
    /*
     * The shop is the exception, deliberately. Every other plot is a purchase,
     * so `affordable` means "is the money there". The shop costs more than the
     * business has by design, and tapping it opens the screen that answers *how*
     * to pay for it — borrow, sell a slice, or wait. Gating that tap on having
     * the cash made the one screen a broke kid needs unreachable by them.
     */
    const broke = plots(bare, 5).filter((p) => p.id !== 'shop');
    expect(broke.every((p) => !p.affordable)).toBe(true);
    expect(plots(bare, 5).find((p) => p.id === 'shop')?.affordable).toBe(true);
    // And a wage they can cover for exactly one day still counts as affordable:
    // the game does not get to refuse a decision, only to show its cost.
    expect(plots(bare, STAFF.helper.wage).find((p) => p.id === 'helper')?.affordable).toBe(true);
  });
});

describe('what a day costs before it opens', () => {
  it('adds the pitch and both wages', () => {
    const loaded = { ...bare, location: 'park' as const, staff: { helper: true, manager: true } };
    expect(dailyBurn(loaded)).toBe(14 + STAFF.helper.wage + STAFF.manager.wage);
  });

  it('turns a wage into a number of cups', () => {
    expect(cupsToCoverWage(12, 1.5)).toBe(8);
    // Rounds up: seven and a half cups does not cover it.
    expect(cupsToCoverWage(12, 1.6)).toBe(8);
  });

  it('refuses to give a cup count when every cup loses money', () => {
    // Dividing by a margin of zero would print Infinity cups; saying nothing
    // and letting the screen explain is the honest answer.
    expect(cupsToCoverWage(12, 0)).toBeNull();
    expect(cupsToCoverWage(12, -0.2)).toBeNull();
  });
});

describe('the capacity trap', () => {
  it('warns whenever the queue is shorter than the stand, whatever is being bought', () => {
    // The bug this replaces tested "does this add more room than I am already
    // wasting", which meant the warning went quiet on the biggest purchases —
    // exactly the ones worth warning about.
    expect(serviceCapacity(bare)).toBe(30);
    expect(roomGoingSpare(bare, 15)).toBe(true);
    expect(idleCapacity(bare, 15)).toBe(15);
    expect(capacityAdded('cooler')).toBe(40);
  });

  it('stays quiet when the stand is genuinely full', () => {
    expect(roomGoingSpare(bare, 30)).toBe(false);
    expect(roomGoingSpare(bare, 29)).toBe(false);
  });

  it('stays quiet before there is any history to judge', () => {
    expect(roomGoingSpare(bare, 0)).toBe(false);
  });

  it('counts a cooler already owned as room going spare', () => {
    const cooled = { ...bare, upgrades: { ...bare.upgrades, cooler: true } };
    expect(serviceCapacity(cooled)).toBe(70);
    expect(idleCapacity(cooled, 38)).toBe(32);
    expect(roomGoingSpare(cooled, 38)).toBe(true);
  });

  it('says nothing about capacity for things that do not add any', () => {
    expect(capacityAdded('bigSign')).toBe(0);
    expect(capacityAdded('freshSqueeze')).toBe(0);
  });
});
