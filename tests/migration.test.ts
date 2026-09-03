/**
 * @vitest-environment jsdom
 */
/**
 * A save made before the five-stage arc has to land somewhere sensible.
 *
 * There is exactly one hard rule and it is the one PRODUCT.md §4 states about
 * progression: a child never goes backwards. The shop is a whole stage inserted
 * after the stands, so a save that was already past it — in the old ownership
 * act or the old market — is shifted up rather than dropped into a stage it
 * never played and asked to do it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadGame, saveGame } from '../src/lib/storage';
import { SAVE_VERSION, createGame, type Game } from '../src/lib/progress';
import { createListing } from '../src/lib/listing';
import { createShopState } from '../src/lib/retail';
import { ECON } from '../src/lib/simulation';

const KEY = 'lemonade.save.v2';

/** A v3 save, with the fields the five-stage arc added stripped back out. */
function v3Save(act: 1 | 2 | 3 | 4, extra: Record<string, unknown> = {}) {
  const game = createGame(4242) as unknown as Record<string, unknown>;
  const business = { ...(game.business as Record<string, unknown>) };
  delete business.stands;
  delete business.twoStandDays;
  delete business.shop;
  delete business.loan;
  const stand = game.stand as { history: unknown[] };
  const save: Record<string, unknown> = {
    ...game,
    version: 3,
    act,
    business,
    stand: {
      ...stand,
      history: Array.from({ length: act > 1 ? ECON.TOTAL_DAYS + 3 : 2 }, () => ({
        day: 1,
        weather: 'mild',
        price: 1.6,
        cupsSold: 30,
        cupsWanted: 30,
        revenue: 48,
        profit: 20,
        cashAfter: 100,
      })),
    },
    ...extra,
  };
  delete save.listing;
  delete save.stageStartDay;
  return save;
}

function load(save: Record<string, unknown>): Game {
  window.localStorage.setItem(KEY, JSON.stringify(save));
  const loaded = loadGame();
  expect(loaded).not.toBeNull();
  return loaded!;
}

describe('a save from the four-stage arc', () => {
  beforeEach(() => window.localStorage.clear());

  it('leaves the stand and the stands stage exactly where they were', () => {
    // Splitting the stands in half happens *inside* the old Act 2, so nothing
    // about a save in Act 1 or Act 2 needs moving.
    expect(load(v3Save(1)).act).toBe(1);
    expect(load(v3Save(2)).act).toBe(2);
  });

  it('moves the ownership act up rather than sending a kid back to the shop', () => {
    const loaded = load(v3Save(3));
    expect(loaded.act).toBe(4);
    expect(loaded.business.shop.open).toBe(false);
  });

  it('moves a save already in the market up to the market', () => {
    expect(load(v3Save(4)).act).toBe(5);
  });

  it('never sends anybody past the last stage', () => {
    expect(load({ ...v3Save(4), act: 5 }).act).toBe(5);
  });

  it('fills in every field the new stages need, at "has not done that yet"', () => {
    const loaded = load(v3Save(3));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.business.stands).toEqual([]);
    expect(loaded.business.twoStandDays).toBe(0);
    expect(loaded.business.shop).toEqual(createShopState());
    expect(loaded.business.loan).toBeNull();
    expect(loaded.listing).toEqual(createListing());
  });

  it('keeps the money, the history and the ownership it was saved with', () => {
    const save = v3Save(3, {});
    const before = save.stand as { history: unknown[] };
    const loaded = load(save);
    expect(loaded.stand.history).toHaveLength(before.history.length);
    expect(loaded.seed).toBe(4242);
  });

  it('infers a stage clock rather than reporting day minus two', () => {
    // The old code timed a stage by subtracting Act 1's length. A save with no
    // marker gets exactly that, which is right for Act 2 and harmless later.
    expect(load(v3Save(2)).stageStartDay).toBe(ECON.TOTAL_DAYS);
    expect(load(v3Save(1)).stageStartDay).toBe(0);
  });

  it('leaves a save already on the new version alone', () => {
    const current = createGame(7);
    const listed: Game = { ...current, act: 4, stageStartDay: 19 };
    saveGame(listed);
    const loaded = loadGame()!;
    expect(loaded.act).toBe(4);
    expect(loaded.stageStartDay).toBe(19);
  });

  it('derives the float multiple for a listing saved without one', () => {
    /*
     * Not a guess. At the float, price x shares was weeklyProfit x multiple,
     * and the first listed week records the expectation it was struck on — so
     * the number comes back exactly. Without this, a listing from a build that
     * predates the field printed "valued at $5130 — 0.0 times weekly profit"
     * in the parent report, and a nonsense figure there is worse than none.
     */
    const save = {
      ...v3Save(4),
      version: 4,
      act: 4,
      listing: {
        listed: true,
        shares: 1000,
        floated: 0.3,
        ipoPrice: 5.13,
        price: 3.97,
        expected: 312.33,
        multiple: 12.7,
        founderShare: 0.7,
        raised: 1539,
        weeks: [
          {
            week: 1,
            actual: 230.72,
            expected: 366.73,
            multipleBefore: 14,
            multipleAfter: 12.7,
            priceBefore: 5.13,
            priceAfter: 3.97,
            change: -0.23,
            reason: 'short',
          },
        ],
      },
    };
    const loaded = load(save);
    expect(loaded.listing.ipoMultiple).toBeCloseTo(14, 1);
  });

  it('falls back to the live multiple when there is no week to derive from', () => {
    const save = {
      ...v3Save(4),
      version: 4,
      act: 4,
      listing: { ...createListing(), listed: true, multiple: 11, expected: 0, ipoPrice: 4 },
    };
    expect(load(save).listing.ipoMultiple).toBe(11);
  });

  it('round-trips a listed company through storage without losing a week', () => {
    const current = createGame(7);
    const listed: Game = {
      ...current,
      act: 4,
      listing: {
        ...createListing(),
        listed: true,
        floated: 0.3,
        ipoPrice: 4.2,
        ipoMultiple: 11,
        price: 4.55,
        expected: 380,
        multiple: 12,
        founderShare: 0.7,
        raised: 1260,
        weeks: [
          {
            week: 1,
            actual: 410,
            expected: 380,
            multipleBefore: 11,
            multipleAfter: 12,
            priceBefore: 4.2,
            priceAfter: 4.55,
            change: 0.08,
            reason: 'You made $410.00 where they expected $380.00.',
          },
        ],
      },
    };
    saveGame(listed);
    const loaded = loadGame()!;
    expect(loaded.listing.weeks).toHaveLength(1);
    expect(loaded.listing.price).toBe(4.55);
    expect(loaded.listing.founderShare).toBe(0.7);
  });
});
