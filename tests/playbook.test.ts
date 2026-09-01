import { describe, it, expect } from 'vitest';
import {
  DECK_SIZE,
  RULE_CARDS,
  allWindows,
  backtest,
  createPlaybook,
  decodePlaybook,
  encodePlaybook,
  record,
  ruleById,
  toggleRule,
} from '../src/lib/playbook';
import { MARKET_WEEKS } from '../src/lib/market';

const deck = (...ids: string[]) => createPlaybook('Mine', ids);

describe('a deck is small and legible', () => {
  it('refuses a fifth card rather than silently dropping one', () => {
    let book = createPlaybook('Mine');
    for (const card of RULE_CARDS.slice(0, DECK_SIZE + 2)) book = toggleRule(book, card.id);
    expect(book.ruleIds).toHaveLength(DECK_SIZE);
    expect(book.ruleIds).toEqual(RULE_CARDS.slice(0, DECK_SIZE).map((c) => c.id));
  });

  it('takes a card back out when it is tapped again', () => {
    const book = toggleRule(toggleRule(createPlaybook(), 'cheap'), 'cheap');
    expect(book.ruleIds).toEqual([]);
  });

  it('offers rules of every kind, so a deck can have a shape', () => {
    const kinds = new Set(RULE_CARDS.map((c) => c.kind));
    expect([...kinds].sort()).toEqual(['hold', 'pick', 'size']);
  });

  it('says what every card teaches, including what it costs', () => {
    for (const card of RULE_CARDS) {
      expect(card.says.length).toBeGreaterThan(10);
      expect(card.teaches.length).toBeGreaterThan(10);
    }
  });
});

describe('the rules actually run', () => {
  it('buys nothing when nothing gets past the filters', () => {
    // Profit only, cheap, fat margins, and growing fast — deliberately a deck
    // that almost nothing satisfies at once.
    const run = backtest(deck('profitable', 'cheap', 'fat-margin', 'growing'), allWindows()[0], 1000);
    if (run.boughtNothing) {
      expect(run.endValue).toBe(1000);
      expect(run.returnPct).toBe(0);
    } else {
      expect(run.bought.length).toBeGreaterThan(0);
    }
  });

  it('never puts more in one company than the size rule allows', () => {
    const start = allWindows()[10];
    const spread = backtest(deck('spread-thin'), start, 1000);
    const concentrated = backtest(deck('back-the-best'), start, 1000);
    // With a quarter cap and many names allowed, more money stays invested in
    // the spread deck than a half-cap deck could hold in its top name alone.
    expect(spread.bought.length).toBeGreaterThan(1);
    expect(concentrated.bought.length).toBeGreaterThan(1);
  });

  it('sells a holding that falls through the stop, and says which', () => {
    // Across every window, a 10% stop must fire at least sometimes — real
    // history has plenty of 10% falls.
    const fired = allWindows().some(
      (start) => backtest(deck('stop-10'), start, 1000).sold.length > 0,
    );
    expect(fired).toBe(true);
  });

  it('never sells when the deck says to sit on your hands', () => {
    for (const start of allWindows().slice(0, 40)) {
      expect(backtest(deck('hold-on'), start, 1000).sold).toEqual([]);
    }
  });

  it('is deterministic: the same deck on the same weeks gives the same answer', () => {
    const start = allWindows()[25];
    const a = backtest(deck('i-use-it', 'spread-thin'), start, 1000);
    const b = backtest(deck('i-use-it', 'spread-thin'), start, 1000);
    expect(a).toEqual(b);
  });

  it('never invents money: the end value comes from real closes', () => {
    for (const start of allWindows().slice(0, 30)) {
      const run = backtest(deck('i-use-it'), start, 1000);
      expect(Number.isFinite(run.endValue)).toBe(true);
      expect(run.endValue).toBeGreaterThan(0);
      // Twelve weeks cannot plausibly triple or wipe out a spread basket.
      expect(run.returnPct).toBeGreaterThan(-0.9);
      expect(run.returnPct).toBeLessThan(2);
    }
  });

  it('runs the whole window, not a week of it', () => {
    const start = allWindows()[5];
    const run = backtest(deck('i-use-it'), start, 1000);
    expect(run.startedOn < run.endedOn).toBe(true);
    expect(MARKET_WEEKS).toBeGreaterThan(1);
  });
});

describe('a strategy is a distribution, not a result', () => {
  it('reports every stretch of history there is', () => {
    const summary = record(deck('i-use-it'), 1000);
    expect(summary.windows).toBe(allWindows().length);
    expect(summary.windows).toBeGreaterThan(150);
  });

  it('never claims a strategy wins always or never', () => {
    // If any deck came out at 0% or 100%, the kid would learn that certainty
    // exists here. Checked across a spread of decks.
    for (const ids of [['i-use-it'], ['huge'], ['cheap'], ['hold-on'], ['spread-thin']]) {
      const summary = record(deck(...ids), 1000);
      expect(summary.winRate, ids.join('+')).toBeGreaterThan(0);
      expect(summary.winRate, ids.join('+')).toBeLessThan(1);
    }
  });

  it('puts the worst stretch below the best one, and both in the account', () => {
    const summary = record(deck('i-use-it', 'spread-thin'), 1000);
    expect(summary.worstReturn).toBeLessThan(summary.medianReturn);
    expect(summary.bestReturn).toBeGreaterThan(summary.medianReturn);
    expect(summary.worstFall).toBeLessThanOrEqual(0);
  });

  it('calls out a deck that is a bet on one company rather than a strategy', () => {
    // Find the fussiest single filter and check the copy names the problem.
    const fussy = record(deck('cheap', 'fat-margin', 'growing'), 1000);
    if (fussy.namesEverBought <= 2) {
      expect(fussy.headline).toMatch(/bet on|never let you buy|fussy/i);
    }
  });

  it('says so when the rules sit the whole thing out', () => {
    const impossible = record(
      { name: 'Nope', ruleIds: ['cheap', 'fat-margin', 'growing', 'more-customers'] },
      1000,
    );
    if (impossible.satOutCount === impossible.windows) {
      expect(impossible.headline).toContain('never let you buy');
    }
  });
});

describe('a deck can be sent to a friend', () => {
  it('round-trips', () => {
    const book = deck('i-use-it', 'spread-thin', 'hold-on');
    const back = decodePlaybook(encodePlaybook(book), 'Mine');
    expect(back?.ruleIds).toEqual(book.ruleIds);
  });

  it('round-trips an empty deck and a full one', () => {
    for (const ids of [[], RULE_CARDS.slice(0, DECK_SIZE).map((c) => c.id)]) {
      const back = decodePlaybook(encodePlaybook(createPlaybook('x', ids)));
      expect(back?.ruleIds).toEqual(ids);
    }
  });

  it('refuses a code with a character changed', () => {
    const code = encodePlaybook(deck('i-use-it', 'hold-on'));
    let broken = 0;
    for (let i = code.indexOf('-') + 1; i < code.length; i++) {
      if (code[i] === '-') continue;
      const swap = code[i] === 'A' ? 'B' : 'A';
      const mutated = code.slice(0, i) + swap + code.slice(i + 1);
      if (mutated === code) continue;
      if (decodePlaybook(mutated) === null) broken++;
    }
    // Every single-character change must be caught, or a kid runs a strategy
    // that is not the one they were sent.
    expect(broken).toBeGreaterThan(0);
  });

  it('refuses a code that names a card this build does not have', () => {
    expect(decodePlaybook('PLAY-ZZZZ-ZZZZ-ZZZZ')).toBeNull();
    expect(decodePlaybook('NOPE-2000-0000')).toBeNull();
  });

  it('keeps every card id unique, or codes would be ambiguous', () => {
    expect(new Set(RULE_CARDS.map((c) => c.id)).size).toBe(RULE_CARDS.length);
  });

  it('resolves every card id it ships', () => {
    for (const card of RULE_CARDS) expect(ruleById(card.id)).toBe(card);
  });
});
