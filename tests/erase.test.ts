/**
 * @vitest-environment jsdom
 */
/**
 * A parent deleting their child's data.
 *
 * `PRIVACY.md` tells a parent their child's progress lives in this browser and
 * nowhere else, and that they can delete it. There are two ways to break that
 * promise and both are easy: miss a key, or leave a key behind that the game's
 * own save effects will quietly re-create a moment later.
 *
 * So these tests are about the promise rather than the function. Every key the
 * storage module writes is enumerated here by hand — deliberately not imported
 * from the module under test, because a list that comes from the same place as
 * the code cannot catch the case where somebody adds a seventh slot and forgets
 * the deletion.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearGame,
  eraseEverything,
  loadCareer,
  loadGame,
  saveBoard,
  saveCareer,
  saveGame,
  saveGuideSeen,
  saveInbox,
  saveLedger,
  saveLive,
} from '../src/lib/storage';
import { createGame } from '../src/lib/progress';
import { setMuted } from '../src/lib/sound';
import { createLedger, record } from '../src/lib/ledger';
import { createInbox, openThread, send } from '../src/lib/messages';

const SRC = join(import.meta.dirname, '..', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}
import { createCareer } from '../src/lib/career';
import { createPortfolio } from '../src/lib/market';

/**
 * Every key this product writes, listed independently of the code that writes
 * them. If a slot is added and this list is not, the last test in the file
 * fails — which is the point of writing it out twice.
 */
const EVERY_KEY = [
  'lemonade.save.v2',
  'lemonade.act1.v1',
  'lemonade.career.v1',
  'lemonade.class.v1',
  'lemonade.live.v1',
  'lemonade.guide.v1',
  'lemonade.muted.v1',
  'lemonade.ledger.v1',
  'lemonade.inbox.v1',
];

/** A device with something in every slot, including the legacy one. */
function fillEverySlot() {
  saveGame(createGame(7));
  saveCareer({ ...createCareer(), name: 'Ada', badges: ['first-sale'], seasons: 3 });
  saveBoard({ seed: 1234, entries: [] });
  saveLive({ ...createPortfolio(0, 100), live: true });
  saveGuideSeen(['welcome']);
  window.localStorage.setItem('lemonade.act1.v1', '{"state":{"day":1}}');
  // Through the real setter, not a hand-written string: the point of this
  // fixture is that every slot is filled the way the game fills it.
  setMuted(true);
  saveLedger(record(createLedger(), 'ran-a-day', '2026-09-07', 2));
  saveInbox(
    send(openThread(createInbox(), 'grown-up', 'Mum'), 'grown-up-mum', 'child', 'hello', '2026-09-07')
      .inbox,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('deleting a child’s data', () => {
  it('leaves nothing in any slot', () => {
    fillEverySlot();
    for (const key of EVERY_KEY) expect(window.localStorage.getItem(key)).not.toBeNull();

    eraseEverything();

    for (const key of EVERY_KEY) expect(window.localStorage.getItem(key)).toBeNull();
    expect(loadGame()).toBeNull();
    expect(loadCareer()).toBeNull();
  });

  it('reports what it removed, so the screen does not have to guess', () => {
    saveGame(createGame(1));
    saveCareer(createCareer());
    expect(eraseEverything().sort()).toEqual(
      ['lemonade.career.v1', 'lemonade.save.v2'].sort(),
    );
  });

  it('claims nothing on a device with nothing on it', () => {
    expect(eraseEverything()).toEqual([]);
  });

  /*
   * The distinction the whole file exists to protect. Starting a new season
   * has to be safe to press or nobody presses it, and the replay is where the
   * learning sticks — so the game's own reset must never take the trophy case
   * with it. Only the parent's one does.
   */
  it('is the only thing that touches the trophy case', () => {
    fillEverySlot();
    clearGame();
    expect(loadCareer()?.badges).toEqual(['first-sale']);
    expect(loadCareer()?.seasons).toBe(3);
    expect(loadGame()).toBeNull();

    eraseEverything();
    expect(loadCareer()).toBeNull();
  });

  /*
   * The hazard that makes this a promise about the whole app rather than about
   * one function, pinned as a fact rather than as a hope.
   *
   * `page.tsx` writes each slot on every change, so a deletion which hands the
   * game fresh objects afterwards re-creates exactly the keys it just removed
   * and the confirmation screen becomes a lie. This is that mistake, made on
   * purpose, so that the reason `eraseAll` nulls its slots instead is written
   * down somewhere a refactor will read it.
   */
  it('is undone by saving fresh objects, which is why the app nulls them', () => {
    fillEverySlot();
    eraseEverything();
    saveGame(createGame());
    saveCareer(createCareer());
    expect(window.localStorage.getItem('lemonade.save.v2')).not.toBeNull();
    expect(window.localStorage.getItem('lemonade.career.v1')).not.toBeNull();
  });

  /*
   * The hand-written list above could not have caught this one, and said so.
   *
   * Its own reasoning was right — a list imported from the module under test
   * cannot catch a forgotten key — and its scope was one module too narrow.
   * It enumerates "every key the storage module writes", and the seventh key
   * was written by `sound.ts`. So `ALL_KEYS` missed it, this file missed it,
   * and PRIVACY.md counted six.
   *
   * This reads the source instead. No hand-list to keep up to date and no
   * import from the module under test: any `'lemonade.…'` literal anywhere in
   * `src` has to be a key the erase knows how to remove.
   */
  it('deletes every key literal that exists anywhere in the source', () => {
    const found = new Set<string>();
    for (const file of walk(SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/'(lemonade\.[a-z0-9.]+)'/g)) {
        found.add(m[1]);
      }
    }

    // Sanity: the scan has to actually be finding things, or it proves nothing.
    expect(found.size).toBeGreaterThanOrEqual(6);
    expect([...found].sort()).toEqual([...EVERY_KEY].sort());
  });

  it('knows about every key the module writes', () => {
    fillEverySlot();
    const before = Object.keys(window.localStorage).filter((k) => k.startsWith('lemonade.'));
    expect(before.sort()).toEqual([...EVERY_KEY].sort());
    eraseEverything();
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith('lemonade.'))).toEqual([]);
  });
});
