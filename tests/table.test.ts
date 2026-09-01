import { describe, it, expect } from 'vitest';
import { createPlaybook } from '../src/lib/playbook';
import {
  cardFor,
  decodeCard,
  encodeCard,
  honours,
  tableLine,
  type TableCard,
} from '../src/lib/table';

const card = (over: Partial<TableCard> = {}): TableCard => ({
  who: 'SAM',
  standing: 20,
  bestWeek: 120.5,
  goodCalls: 2,
  callsMade: 4,
  playbookWinRate: 61,
  returnPct: 4.25,
  ...over,
});

describe('the table refuses to crown a winner', () => {
  it('has no overall ranking at all', () => {
    const list = honours([card(), card({ who: 'ADA' })]);
    expect(list.map((h) => h.id)).toEqual([
      'operator',
      'thinking',
      'playbook',
      'collection',
      'returns',
    ]);
    expect(list.some((h) => h.id === ('overall' as never))).toBe(false);
  });

  it('says out loud that the money one is luck, and only that one', () => {
    const list = honours([card()]);
    expect(list.filter((h) => h.mostlyLuck).map((h) => h.id)).toEqual(['returns']);
    expect(list.find((h) => h.id === 'returns')!.measures).toMatch(/not long enough|luck|better weeks/i);
  });

  it('puts the money honour last, where it belongs', () => {
    expect(honours([card()]).at(-1)!.id).toBe('returns');
  });

  it('ranks each honour on its own figure', () => {
    const cards = [
      card({ who: 'SAM', bestWeek: 90, standing: 40, playbookWinRate: 50, returnPct: 30 }),
      card({ who: 'ADA', bestWeek: 200, standing: 10, playbookWinRate: 70, returnPct: -5 }),
    ];
    const list = honours(cards);
    expect(list.find((h) => h.id === 'operator')!.standings[0].who).toBe('ADA');
    expect(list.find((h) => h.id === 'collection')!.standings[0].who).toBe('SAM');
    expect(list.find((h) => h.id === 'playbook')!.standings[0].who).toBe('ADA');
    expect(list.find((h) => h.id === 'returns')!.standings[0].who).toBe('SAM');
  });

  it('notices when the honours are shared out, and when they are not', () => {
    const spread = [
      card({ who: 'SAM', bestWeek: 200, standing: 5, goodCalls: 0, playbookWinRate: 10 }),
      card({ who: 'ADA', bestWeek: 5, standing: 90, goodCalls: 1, playbookWinRate: 20 }),
      card({ who: 'LEE', bestWeek: 6, standing: 6, goodCalls: 9, playbookWinRate: 30 }),
      card({ who: 'JOE', bestWeek: 7, standing: 7, goodCalls: 2, playbookWinRate: 99 }),
    ];
    expect(tableLine(spread)).toContain('four different people');

    const sweep = [
      card({ who: 'SAM', bestWeek: 200, standing: 90, goodCalls: 9, playbookWinRate: 99 }),
      card({ who: 'ADA', bestWeek: 5, standing: 5, goodCalls: 0, playbookWinRate: 10 }),
    ];
    expect(tableLine(sweep)).toContain('every honour');
  });

  it('asks for a friend before it says anything', () => {
    expect(tableLine([card()])).toMatch(/add a friend/i);
  });
});

describe('a card travels as a code', () => {
  it('round-trips, including a loss', () => {
    for (const returnPct of [0, 4.25, -18.5, 120.75, -99.99]) {
      const original = card({ returnPct });
      const back = decodeCard(encodeCard(original));
      expect(back?.who).toBe('SAM');
      expect(back?.returnPct).toBeCloseTo(returnPct, 2);
      expect(back?.bestWeek).toBeCloseTo(original.bestWeek, 2);
      expect(back?.standing).toBe(original.standing);
      expect(back?.playbookWinRate).toBe(original.playbookWinRate);
    }
  });

  it('catches a single mistyped character', () => {
    const code = encodeCard(card());
    let caught = 0;
    let tried = 0;
    for (let i = code.indexOf('-') + 1; i < code.length; i++) {
      if (code[i] === '-') continue;
      const swap = code[i] === 'A' ? 'B' : 'A';
      tried++;
      if (decodeCard(code.slice(0, i) + swap + code.slice(i + 1)) === null) caught++;
    }
    expect(tried).toBeGreaterThan(10);
    expect(caught / tried).toBeGreaterThan(0.95);
  });

  it('refuses a card claiming more good calls than calls', () => {
    const bad = encodeCard(card({ goodCalls: 9, callsMade: 2 }));
    expect(decodeCard(bad)).toBeNull();
  });

  it('refuses somebody else’s prefix', () => {
    expect(decodeCard('SKY-2000-0000')).toBeNull();
  });

  it('builds a card from a real playbook without inventing a win rate', () => {
    const empty = cardFor('Sam', 10, 50, 1, 2, createPlaybook(), 3);
    expect(empty.playbookWinRate).toBe(0);

    const real = cardFor('Sam', 10, 50, 1, 2, createPlaybook('x', ['i-use-it']), 3);
    expect(real.playbookWinRate).toBeGreaterThan(0);
    expect(real.playbookWinRate).toBeLessThan(100);
  });
});
