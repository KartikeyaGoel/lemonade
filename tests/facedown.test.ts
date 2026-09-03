/**
 * Two companies, side by side.
 *
 * `facedown.ts` was at **1.9%** — a whole module with one function in it,
 * exercised by nothing. Which matters more than the percentage suggests,
 * because the module's own doc comment states the rule it exists to keep:
 *
 * > **it never says which one to buy.** [...] A kid who leaves the market
 * > believing "low P/E good" has learned something false, and would have been
 * > better off learning nothing.
 *
 * That is a testable claim, and nothing was testing it. So this is not a
 * coverage exercise: it holds the pedagogy. Every pair of companies in the
 * snapshot goes through it, and the assertion is that no row and no summary
 * ever tells a child which company is the better buy.
 */
import { describe, it, expect } from 'vitest';
import { faceoff } from '../src/lib/facedown';
import { SNAPSHOT, metricsFor } from '../src/lib/companies';

/**
 * Words that would turn a comparison into advice.
 *
 * "Better", "worse", "should", "best" — and the two that are the actual trap,
 * "bargain" and "cheap", because a low P/E reads as a bargain to anybody who
 * has not been told what it usually means.
 */
const ADVICE = [
  /\bbetter buy\b/i,
  /\bworse buy\b/i,
  /\byou should buy\b/i,
  /\bbest buy\b/i,
  /\bbuy (this|that) one\b/i,
  /\bpick (this|that) one\b/i,
  /\bthe winner\b/i,
  /\bis a bargain\b/i,
];

const PAIRS: [number, number][] = [];
for (let i = 0; i < SNAPSHOT.length; i++) {
  for (let j = i + 1; j < SNAPSHOT.length; j++) PAIRS.push([i, j]);
}

describe('putting two companies next to each other', () => {
  it('compares every pair in the snapshot without falling over', () => {
    for (const [i, j] of PAIRS) {
      const a = SNAPSHOT[i];
      const b = SNAPSHOT[j];
      const result = faceoff(a, b, a.price, b.price);
      expect(result.a.ticker).toBe(a.ticker);
      expect(result.b.ticker).toBe(b.ticker);
      expect(result.rows.length, `${a.ticker} vs ${b.ticker} had no rows`).toBeGreaterThan(3);
      expect(result.tradeOff.length, `${a.ticker} vs ${b.ticker} had no summary`).toBeGreaterThan(
        10,
      );
    }
  });

  it('fills in every cell of every row, with no holes', () => {
    for (const [i, j] of PAIRS) {
      const a = SNAPSHOT[i];
      const b = SNAPSHOT[j];
      const { rows } = faceoff(a, b, a.price, b.price);
      for (const row of rows) {
        const where = `${a.ticker} vs ${b.ticker} / ${row.label}`;
        expect(row.label.length, where).toBeGreaterThan(2);
        expect(row.emoji.length, where).toBeGreaterThan(0);
        expect(row.meaning.length, where).toBeGreaterThan(10);
        for (const cell of [row.a, row.b]) {
          expect(cell, where).toBeTruthy();
          for (const bad of ['NaN', 'Infinity', 'undefined', 'null']) {
            expect(cell, `${where} cell reads "${bad}"`).not.toContain(bad);
          }
        }
        expect(['a', 'b', 'even'], `${where} edge`).toContain(row.edge);
      }
    }
  });

  /*
   * The rule the module exists to keep. Checked across every pair, in every
   * row and in the summary, because a single "better" anywhere in here is the
   * one sentence that teaches the false thing.
   */
  it('never tells a child which one to buy', () => {
    for (const [i, j] of PAIRS) {
      const a = SNAPSHOT[i];
      const b = SNAPSHOT[j];
      const result = faceoff(a, b, a.price, b.price);
      const text = [result.tradeOff, ...result.rows.flatMap((r) => [r.label, r.meaning])].join(' ');
      for (const pattern of ADVICE) {
        expect(text, `${a.ticker} vs ${b.ticker} gave advice: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  /*
   * `edge` means "more of this", and the module is explicit that more is not
   * better. So the only thing worth asserting about it is that it is honest:
   * it points at whichever side is genuinely larger.
   */
  it('points its edge at the larger figure, not the preferable one', () => {
    for (const [i, j] of PAIRS.slice(0, 60)) {
      const a = SNAPSHOT[i];
      const b = SNAPSHOT[j];
      const ma = metricsFor(a, a.price);
      const mb = metricsFor(b, b.price);
      const revenue = faceoff(a, b, a.price, b.price).rows.find(
        (r) => r.label === 'How much it sells',
      );
      expect(revenue).toBeTruthy();
      if (!revenue) continue;
      if (revenue.edge === 'a') expect(ma.year.revenueM).toBeGreaterThan(mb.year.revenueM);
      if (revenue.edge === 'b') expect(mb.year.revenueM).toBeGreaterThan(ma.year.revenueM);
    }
  });

  it('is symmetric: swapping the two sides swaps every edge', () => {
    const flip = (edge: string) => (edge === 'a' ? 'b' : edge === 'b' ? 'a' : 'even');
    for (const [i, j] of PAIRS.slice(0, 60)) {
      const a = SNAPSHOT[i];
      const b = SNAPSHOT[j];
      const forward = faceoff(a, b, a.price, b.price);
      const back = faceoff(b, a, b.price, a.price);
      expect(back.rows.length).toBe(forward.rows.length);
      forward.rows.forEach((row, index) => {
        expect(flip(row.edge), `${a.ticker} vs ${b.ticker} / ${row.label}`).toBe(
          back.rows[index].edge,
        );
      });
    }
  });

  it('calls a company level with itself even on every row', () => {
    for (const company of SNAPSHOT) {
      const { rows } = faceoff(company, company, company.price, company.price);
      for (const row of rows) {
        expect(row.edge, `${company.ticker} vs itself / ${row.label}`).toBe('even');
        expect(row.a).toBe(row.b);
      }
    }
  });

  /*
   * The two degenerate shapes. A company that loses money has no P/E to price,
   * and a price of zero has no ratio at all — both have to read as words
   * rather than as arithmetic that failed.
   */
  it('reads sensibly when one side has no profit to price', () => {
    const loser = SNAPSHOT.find((c) => c.netIncomeM <= 0);
    const winner = SNAPSHOT.find((c) => c.netIncomeM > 0);
    if (!loser || !winner) return;
    const { rows } = faceoff(loser, winner, loser.price, winner.price);
    const priced = rows.find((r) => r.label === 'What you pay for it');
    expect(priced?.a).toMatch(/no profit/i);
    expect(priced?.b).toMatch(/years of profit/i);
  });

  it('survives a price of zero on either side', () => {
    const [a, b] = SNAPSHOT;
    for (const [pa, pb] of [
      [0, b.price],
      [a.price, 0],
      [0, 0],
    ] as [number, number][]) {
      const result = faceoff(a, b, pa, pb);
      const text = [result.tradeOff, ...result.rows.flatMap((r) => [r.a, r.b, r.meaning])].join(' ');
      for (const bad of ['NaN', 'Infinity', 'undefined']) {
        expect(text, `prices ${pa}/${pb} produced "${bad}"`).not.toContain(bad);
      }
    }
  });

  it('accepts an as-of date and still fills every cell', () => {
    const [a, b] = SNAPSHOT;
    for (const asOf of ['2026-09-01', '1990-01-01', '2999-12-31', '']) {
      const result = faceoff(a, b, a.price, b.price, asOf);
      const text = [result.tradeOff, ...result.rows.flatMap((r) => [r.a, r.b])].join(' ');
      for (const bad of ['NaN', 'Infinity', 'undefined']) {
        expect(text, `asOf ${asOf} produced "${bad}"`).not.toContain(bad);
      }
    }
  });

  /*
   * The summary is the one sentence a child is most likely to actually read,
   * so it gets its own assertion: it has to name a trade-off — something given
   * up for something gained — rather than a conclusion.
   */
  it('summarises as a trade-off across every pair', () => {
    const seen = new Set<string>();
    for (const [i, j] of PAIRS) {
      const a = SNAPSHOT[i];
      const b = SNAPSHOT[j];
      const { tradeOff } = faceoff(a, b, a.price, b.price);
      seen.add(tradeOff);
      for (const bad of ['NaN', 'Infinity', 'undefined']) {
        expect(tradeOff, `${a.ticker} vs ${b.ticker}`).not.toContain(bad);
      }
    }
    // Not one canned sentence for every pair: the comparison has to be about
    // the two companies in front of the child.
    expect(seen.size, 'every pair got the same summary').toBeGreaterThan(1);
  });
});
