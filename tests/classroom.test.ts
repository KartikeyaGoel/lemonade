import { describe, expect, it } from 'vitest';
import { encodeChallenge, decodeChallenge } from '../src/lib/challenge';
import {
  BIN_CENTS,
  ENOUGH_FOR_A_CURVE,
  bestOnCurve,
  bins,
  classWeek,
  entry,
  findings,
  howClose,
  trueCurve,
} from '../src/lib/classroom';

const CLASS = classWeek(2026);

describe('the class code', () => {
  it('is an ordinary week, so a child can type it into the game they already have', () => {
    const code = encodeChallenge(CLASS);
    expect(decodeChallenge(code)).toEqual(CLASS);
  });
});

describe('what the class measured', () => {
  it('groups prices so thirty children make a curve rather than a cloud', () => {
    const grouped = bins([
      entry('ADA', 152, 30),
      entry('LEE', 148, 34),
      entry('SAM', 250, 12),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].priceCents).toBe(150);
    expect(grouped[0].tried).toBe(2);
    expect(grouped[0].averageProfit).toBe(32);
    expect(grouped[0].best).toBe(34);
    expect(grouped[0].worst).toBe(30);
  });

  it('bins to ten cents, which is coarse enough to group and fine enough to keep the hump', () => {
    expect(bins([entry('A', 144, 1), entry('B', 155, 1)]).map((b) => b.priceCents)).toEqual([
      140,
      160,
    ]);
    expect(BIN_CENTS).toBe(10);
  });

  it('says nothing about the shape until there is a shape', () => {
    const early = findings([entry('ADA', 150, 30), entry('LEE', 200, 20)]);
    expect(early.lines[0]).toContain(`${ENOUGH_FOR_A_CURVE}`);
    expect(early.classBestCents).toBe(150);
  });

  it('never names a child', () => {
    // The board is a shared measurement, not a scoreboard. Same argument as
    // src/lib/table.ts.
    const board = findings([
      entry('ADA', 100, 5),
      entry('LEE', 150, 40),
      entry('SAM', 175, 38),
      entry('KIT', 200, 25),
      entry('JO', 250, 10),
      entry('MO', 350, -6),
    ]);
    for (const line of board.lines) {
      for (const name of ['ADA', 'LEE', 'SAM', 'KIT', 'JO', 'MO']) {
        expect(line).not.toContain(name);
      }
    }
  });

  it('reports a loss as a fact and puts it on the same week as everyone else', () => {
    const board = findings([
      entry('A', 100, 5),
      entry('B', 150, 40),
      entry('C', 175, 38),
      entry('D', 200, 25),
      entry('E', 250, 10),
      entry('F', 380, -6),
    ]);
    expect(board.lostMoney).toBe(1);
    expect(board.lines.join(' ')).toContain('same weather');
  });

  it('finds the peak of the class’s own data', () => {
    const board = findings([
      entry('A', 100, 5),
      entry('B', 150, 40),
      entry('C', 150, 44),
      entry('D', 200, 25),
      entry('E', 250, 10),
      entry('F', 300, -2),
    ]);
    expect(board.classBestCents).toBe(150);
    expect(board.pricesTried).toBe(5);
  });
});

describe('the answer, for afterwards', () => {
  const curve = trueCurve(CLASS);

  it('covers the whole range a child can actually charge', () => {
    expect(curve[0].priceCents).toBe(50);
    expect(curve[curve.length - 1].priceCents).toBe(400);
    expect(curve.every((point, i) => i === 0 || point.priceCents > curve[i - 1].priceCents)).toBe(
      true,
    );
  });

  it('has a hump: cheap sells plenty and earns little, dear sells nothing', () => {
    // This is the shape the whole lesson depends on. If the simulation did not
    // produce it, thirty children plotting their results would learn something
    // false, and no amount of good teaching would fix that.
    const peak = bestOnCurve(curve)!;
    expect(peak.priceCents).toBeGreaterThan(50);
    expect(peak.priceCents).toBeLessThan(400);
    expect(curve[0].profit).toBeLessThan(peak.profit);
    expect(curve[curve.length - 1].profit).toBeLessThan(peak.profit);
  });

  it('sells more cups the cheaper it is', () => {
    const cheap = curve.find((p) => p.priceCents === 80)!;
    const dear = curve.find((p) => p.priceCents === 300)!;
    expect(cheap.cupsSold).toBeGreaterThan(dear.cupsSold);
  });

  it('is the same curve every time, because the week does not depend on decisions', () => {
    expect(trueCurve(CLASS)).toEqual(curve);
  });

  it('is a different curve for a different code', () => {
    expect(trueCurve(classWeek(99))).not.toEqual(curve);
  });

  it('tells a class that found it that they found it', () => {
    const peak = bestOnCurve(curve)!;
    const spot = [
      entry('A', peak.priceCents, 60),
      entry('B', peak.priceCents, 58),
      entry('C', peak.priceCents - 100, 20),
    ];
    expect(howClose(spot, curve)).toContain('found it');
  });

  it('asks a question rather than giving a mark when they did not', () => {
    const peak = bestOnCurve(curve)!;
    const timid = [entry('A', Math.max(50, peak.priceCents - 100), 60)];
    const said = howClose(timid, curve);
    expect(said).toContain('?');
    expect(said).not.toMatch(/wrong|%|score/i);
  });

  it('says nothing at all when there is nothing to compare', () => {
    expect(howClose([], curve)).toBe('');
  });
});
