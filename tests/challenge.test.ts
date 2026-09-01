import { describe, it, expect } from 'vitest';
import {
  CHALLENGE_DAYS,
  compareRuns,
  createChallenge,
  decodeChallenge,
  decodeResult,
  encodeChallenge,
  encodeResult,
  runLedger,
  skyOfTheDay,
  summariseRun,
  tidyName,
} from '../src/lib/challenge';
import {
  createInitialState,
  orderForTargetCups,
  runDay,
  type GameState,
} from '../src/lib/simulation';

/** Plays a whole week at a fixed price and batch size. */
function playWeek(seed: number, price: number, cups: number) {
  let state: GameState = createInitialState(seed);
  for (let day = 0; day < CHALLENGE_DAYS; day++) {
    const order = orderForTargetCups(state, cups);
    const outcome = runDay(state, { ...order, price });
    state = outcome.nextState;
  }
  return state;
}

describe('the challenge code', () => {
  it('round-trips a spec', () => {
    const spec = createChallenge(123_456_789, 7);
    const back = decodeChallenge(encodeChallenge(spec));
    expect(back).toEqual(spec);
  });

  it('survives seeds at the top of the 32-bit range', () => {
    const spec = createChallenge(4_294_967_295, 14);
    expect(decodeChallenge(encodeChallenge(spec))).toEqual(spec);
  });

  it('rejects a code that has been mistyped', () => {
    const code = encodeChallenge(createChallenge(999));
    const broken = `${code.slice(0, code.length - 1)}${code.endsWith('Z') ? 'Y' : 'Z'}`;
    expect(decodeChallenge(broken)).toBeNull();
  });

  it('gives the whole world the same sky for a given date', () => {
    expect(skyOfTheDay('2026-09-01')).toEqual(skyOfTheDay('2026-09-01'));
    expect(skyOfTheDay('2026-09-01').seed).not.toBe(skyOfTheDay('2026-09-02').seed);
  });
});

describe('the same seed really is the same week', () => {
  it('two kids playing identically get identical weather', () => {
    const a = playWeek(4242, 1.6, 28);
    const b = playWeek(4242, 1.6, 28);
    expect(a.history.map((d) => d.weather)).toEqual(b.history.map((d) => d.weather));
    expect(runLedger(a.history).profit).toBe(runLedger(b.history).profit);
  });

  it('the same weather with a different price gives a different result', () => {
    const cheap = playWeek(4242, 0.75, 28);
    const dear = playWeek(4242, 1.6, 28);
    expect(cheap.history.map((d) => d.weather)).toEqual(dear.history.map((d) => d.weather));
    expect(runLedger(dear.history).profit).toBeGreaterThan(runLedger(cheap.history).profit);
  });
});

describe('the run ledger', () => {
  const state = playWeek(4242, 1.6, 28);
  const ledger = runLedger(state.history);

  it('reconciles: gross minus rent minus waste is the profit', () => {
    expect(ledger.profit).toBeCloseTo(
      ledger.grossProfit - ledger.fixedCost - ledger.spoilageCost,
      2,
    );
  });

  it('agrees with the sum of the daily profits the game reported', () => {
    const summed = state.history.reduce((sum, day) => sum + day.profit, 0);
    expect(ledger.profit).toBeCloseTo(summed, 2);
  });

  it('reports an average price a kid could check by hand', () => {
    expect(ledger.avgPrice).toBeCloseTo(ledger.revenue / ledger.cupsSold, 4);
  });
});

describe('the result code', () => {
  const state = playWeek(4242, 1.6, 28);

  it('round-trips a whole result', () => {
    const result = summariseRun(4242, 'Ada', state.history, 5);
    expect(decodeResult(encodeResult(result))).toEqual(result);
  });

  it('carries a losing week, because a losing week is a real result', () => {
    const bad = playWeek(4242, 2.95, 40);
    const result = summariseRun(4242, 'Kai', bad.history, 1);
    const back = decodeResult(encodeResult(result));
    expect(back).toEqual(result);
  });

  it('tidies a name down to something a code can hold', () => {
    expect(tidyName('Ada  Lovelace!')).toBe('ADALOVEL');
    expect(tidyName('   ')).toBe('FRIEND');
    expect(tidyName('🍋')).toBe('FRIEND');
  });

  it('keeps the name through the code', () => {
    const result = summariseRun(1, 'Yusuf', state.history);
    expect(decodeResult(encodeResult(result))!.who).toBe('YUSUF');
  });

  it('rejects a mistyped result code', () => {
    const code = encodeResult(summariseRun(4242, 'Ada', state.history));
    const broken = `${code.slice(0, 8)}${code[8] === 'Z' ? 'Y' : 'Z'}${code.slice(9)}`;
    expect(decodeResult(broken)).toBeNull();
  });
});

describe('the comparison', () => {
  const mine = summariseRun(4242, 'Ada', playWeek(4242, 1.6, 28).history);
  const theirs = summariseRun(4242, 'Kai', playWeek(4242, 0.75, 40).history);

  it('knows when the two runs were the same week', () => {
    expect(compareRuns(mine, theirs).sameSky).toBe(true);
  });

  it('says so when they were not, instead of pretending it is a race', () => {
    const other = summariseRun(99, 'Kai', playWeek(99, 1.6, 28).history);
    const comparison = compareRuns(mine, other);
    expect(comparison.sameSky).toBe(false);
    expect(comparison.headline).toContain('Different weeks');
    expect(comparison.cause).toContain('not a fair race');
  });

  it('explains the gap with lines that add up to the gap', () => {
    const comparison = compareRuns(mine, theirs);
    const all = [
      ...comparison.lines,
      // Filtered-out lines are below 50c each; rebuild the full set to check.
    ];
    const summed = all.reduce((sum, line) => sum + line.dollars, 0);
    expect(summed).toBeCloseTo(comparison.gap, 1);
  });

  it('names the biggest cause separately from the score', () => {
    const comparison = compareRuns(mine, theirs);
    expect(comparison.winner).toBe('you');
    expect(comparison.headline).toContain('ahead by');
    expect(comparison.headline).not.toContain('Most of it');
    expect(comparison.cause).toContain('Most of it was');
  });

  it('is symmetric: their view of the same pair is the mirror of mine', () => {
    const forward = compareRuns(mine, theirs);
    const backward = compareRuns(theirs, mine);
    expect(backward.gap).toBeCloseTo(-forward.gap, 2);
    expect(backward.winner).toBe('them');
  });

  it('calls a dead heat a dead heat', () => {
    const twin = summariseRun(4242, 'Twin', playWeek(4242, 1.6, 28).history);
    const comparison = compareRuns(mine, twin);
    expect(comparison.winner).toBe('tie');
    expect(comparison.gap).toBe(0);
    expect(comparison.lines).toEqual([]);
    expect(comparison.headline).toBe('Dead level');
  });
});
