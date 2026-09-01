import { describe, it, expect } from 'vitest';
import {
  ECON,
  createInitialState,
  projectDay,
  profitIfSold,
  runDay,
  orderForTargetCups,
  cupsWantedAt,
  type GameState,
} from '../src/lib/simulation';

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(1), ...overrides };
}

describe('the planning projection only reveals what the kid could work out', () => {
  it('never predicts how many cups will sell', () => {
    const projection = projectDay(stateWith({ cash: 200 }), 28, 1.6);
    // It offers scenarios the kid chooses between, not a forecast of demand.
    expect(projection.bestCase.cupsSold).toBe(28);
    expect(projection.halfCase.cupsSold).toBe(14);
    expect(projection.worstCase.cupsSold).toBe(0);
    expect(Object.keys(projection)).not.toContain('expectedCupsSold');
    expect(Object.keys(projection)).not.toContain('cupsWanted');
  });

  it('does not let a kid read the optimum off the dial', () => {
    // Sweeping the price and taking the best projected number must NOT land on
    // the true optimum, or the whole discovery loop is short-circuited.
    const state = stateWith({ cash: 400 });
    let bestByProjection = { price: 0, profit: -Infinity };
    for (let cents = 5; cents <= 300; cents += 5) {
      const price = cents / 100;
      const projection = projectDay(state, 28, price);
      if (projection.bestCase.profit > bestByProjection.profit) {
        bestByProjection = { price, profit: projection.bestCase.profit };
      }
    }
    // Best-case profit rises forever with price, so the dial points at $3.00 —
    // which actually sells nothing. The kid must still discover elasticity.
    expect(bestByProjection.price).toBe(3);
    expect(cupsWantedAt(3, 'mild')).toBe(0);
    expect(bestByProjection.price).not.toBe(1.6);
  });

  it('quotes a break-even that is real arithmetic', () => {
    const projection = projectDay(stateWith({ cash: 200 }), 28, 1.6);
    // Margin is about $1.405 a cup, so the $5 fee needs 4 cups.
    expect(projection.marginPerCup).toBeCloseTo(1.4, 2);
    expect(projection.breakEvenCups).toBe(4);
    expect(profitIfSold(projection.breakEvenCups!, 1.6)).toBeGreaterThanOrEqual(0);
    expect(profitIfSold(projection.breakEvenCups! - 1, 1.6)).toBeLessThan(0);
  });

  it('says plainly when a price loses money on every cup', () => {
    const projection = projectDay(stateWith({ cash: 200 }), 28, 0.1);
    expect(projection.losesMoneyPerCup).toBe(true);
    expect(projection.breakEvenCups).toBeNull();
    expect(projection.bestCase.profit).toBeLessThan(0);
  });

  it('shows that ordering more and selling half is worse than ordering less', () => {
    // This is the "my profit dropped because I over-ordered" lesson, made
    // visible before the kid commits rather than only after.
    const state = stateWith({ cash: 200 });
    const big = projectDay(state, 60, 1.6);
    const small = projectDay(state, 28, 1.6);
    expect(big.costToBuy).toBeGreaterThan(small.costToBuy);
    // Selling only half a big batch beats nothing, but the unsold cups are
    // money already spent, which the close screen then charges as spoilage.
    expect(big.halfCase.cupsSold).toBeGreaterThan(0);
    expect(big.bestCase.profit).toBeGreaterThan(big.halfCase.profit);
  });

  it('matches the real day when the whole batch happens to sell', () => {
    const state = stateWith({ cash: 400, forecast: 'probably-hot', seed: 11 });
    const projection = projectDay(state, 20, 1.2);
    const outcome = runDay(state, { ...orderForTargetCups(state, 20), price: 1.2 });
    if (outcome.cupsSold === projection.cupsMakeable) {
      expect(outcome.profit).toBeCloseTo(projection.bestCase.profit, 2);
    }
    // And in general the real result is one of the scenarios' arithmetic.
    expect(outcome.profit).toBeCloseTo(profitIfSold(outcome.cupsSold, 1.2) - outcome.spoilageCost, 2);
  });

  it('agrees with the P&L for every batch size and price', () => {
    const state = stateWith({ cash: 500 });
    for (const cups of [8, 20, 28, 44]) {
      for (const price of [0.5, 1.2, 1.6, 2.4]) {
        const projection = projectDay(state, cups, price);
        expect(projection.bestCase.profit).toBeCloseTo(
          profitIfSold(projection.cupsMakeable, price),
          2,
        );
        expect(projection.marginPerCup).toBeCloseTo(price - projection.costPerCup, 2);
      }
    }
  });

  it('reports the real cost of the batch the kid is about to buy', () => {
    const state = stateWith({ cash: 200 });
    expect(projectDay(state, 28, 1.6).costToBuy).toBeCloseTo(5.6, 2);
    expect(projectDay(state, 0, 1.6).costToBuy).toBe(0);
  });

  it('a zero-cup batch still owes the stand fee', () => {
    const projection = projectDay(stateWith({ cash: 200 }), 0, 1.6);
    expect(projection.cupsMakeable).toBe(0);
    expect(projection.bestCase.profit).toBe(-ECON.STAND_FEE);
  });
});
