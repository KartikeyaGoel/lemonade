import { describe, expect, it } from 'vitest';
import { SNAPSHOT, TIERS } from '../src/lib/companies';
import { collectionLine, progress, shelves, suggestNext } from '../src/lib/collection';

const ALL_TICKERS = SNAPSHOT.map((company) => company.ticker);
const tier1 = SNAPSHOT.filter((company) => company.tier === 1).map((c) => c.ticker);

describe('the collection', () => {
  it('shows every company in the game, always', () => {
    // Locked shelves are shown, not hidden — the hole in the set is the point.
    const list = shelves([], 0);
    const shown = list.flatMap((shelf) => shelf.slots.map((slot) => slot.ticker));
    expect(shown.sort()).toEqual([...ALL_TICKERS].sort());
    expect(list.filter((shelf) => !shelf.open).length).toBeGreaterThan(0);
  });

  it('never marks a slot on a locked shelf as reachable', () => {
    for (const shelf of shelves([], 0)) {
      for (const slot of shelf.slots) {
        expect(slot.reachable).toBe(shelf.open);
      }
    }
  });

  it('opens shelves on badges, exactly where the tiers say', () => {
    const at = (badges: number) => shelves([], badges).filter((shelf) => shelf.open).length;
    expect(at(0)).toBe(1);
    expect(at(TIERS[2].opensAt)).toBe(2);
    expect(at(TIERS[3].opensAt)).toBe(3);
  });

  it('counts only companies actually read', () => {
    // Reading is the only way to fill a slot, and there is no way to fill one
    // by accident — the ticker has to be in the career record.
    const read = progress(tier1.slice(0, 3), 0);
    expect(read.read).toBe(3);
    expect(read.total).toBe(SNAPSHOT.length);
    expect(read.reachable).toBe(tier1.length);
  });

  it('ignores a ticker that is not in the game', () => {
    expect(progress(['NOTREAL'], 99).read).toBe(0);
  });

  it('names the next thing to do rather than a score', () => {
    expect(collectionLine([], 0)).toContain('read its accounts');
    expect(collectionLine(tier1.slice(0, 2), 0)).toBe(
      `${tier1.length - 2} you can reach and have not read yet.`,
    );
  });

  it('points at the next shelf once this one is finished', () => {
    const line = collectionLine(tier1, 0);
    expect(line).toContain('Every company you can reach');
    expect(line).toContain(`⭐ ${TIERS[2].opensAt}`);
  });

  it('has something to say when the whole set is done', () => {
    expect(collectionLine(ALL_TICKERS, 99)).toContain('nothing left');
  });

  it('suggests something unread that the kid can actually afford', () => {
    const rich = suggestNext([], 0, 10_000);
    expect(rich).not.toBeNull();
    expect(rich?.tier).toBe(1);

    // Already read, so it is not suggested again.
    const next = suggestNext([rich!.ticker], 0, 10_000);
    expect(next?.ticker).not.toBe(rich?.ticker);
  });

  it('suggests nothing rather than something unaffordable', () => {
    expect(suggestNext([], 0, 0)).toBeNull();
  });

  it('never suggests a company behind a locked shelf', () => {
    const suggestion = suggestNext([], 0, 1_000_000);
    expect(suggestion?.tier).toBe(1);
  });
});
