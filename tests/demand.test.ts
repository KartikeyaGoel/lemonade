import { describe, it, expect } from 'vitest';
import {
  ECON,
  WEATHER_MULTIPLIER,
  cupsWantedAt,
  counterfactualProfit,
  ingredientCostOf,
  type Weather,
} from '../src/lib/simulation';

describe('demand curve', () => {
  it('matches the spec formula exactly', () => {
    const weathers: Weather[] = ['cold', 'mild', 'hot'];
    for (const weather of weathers) {
      for (let cents = 0; cents <= 500; cents += 5) {
        const price = cents / 100;
        const expected =
          Math.max(0, ECON.DEMAND_INTERCEPT - ECON.DEMAND_SLOPE * price) * WEATHER_MULTIPLIER[weather];
        expect(cupsWantedAt(price, weather)).toBeCloseTo(expected, 10);
      }
    }
  });

  it('gives away 60 cups at a price of zero on a mild day', () => {
    expect(cupsWantedAt(0, 'mild')).toBe(60);
  });

  it('scales with weather: cold 0.6, mild 1.0, hot 1.5', () => {
    expect(cupsWantedAt(1, 'cold')).toBeCloseTo(24, 10);
    expect(cupsWantedAt(1, 'mild')).toBeCloseTo(40, 10);
    expect(cupsWantedAt(1, 'hot')).toBeCloseTo(60, 10);
  });

  it('is monotonically decreasing in price', () => {
    let previous = Infinity;
    for (let cents = 0; cents <= 400; cents += 10) {
      const wanted = cupsWantedAt(cents / 100, 'mild');
      expect(wanted).toBeLessThanOrEqual(previous);
      previous = wanted;
    }
  });

  it('never goes negative, and hits zero at $3', () => {
    expect(cupsWantedAt(3, 'mild')).toBe(0);
    expect(cupsWantedAt(4.5, 'hot')).toBe(0);
    expect(cupsWantedAt(99, 'hot')).toBe(0);
  });
});

describe('the discoverable optimum (the whole point of Act 1)', () => {
  const UNLIMITED = 1000;

  it('peaks at $1.60 on a mild day, at 28 cups and about $34 profit', () => {
    let best = { price: 0, profit: -Infinity };
    for (let cents = 0; cents <= 300; cents += 5) {
      const price = cents / 100;
      const profit = counterfactualProfit(price, 'mild', UNLIMITED);
      if (profit > best.profit) best = { price, profit };
    }
    expect(best.price).toBe(1.6);
    expect(Math.round(cupsWantedAt(1.6, 'mild'))).toBe(28);
    expect(best.profit).toBeGreaterThan(33);
    expect(best.profit).toBeLessThan(35);
  });

  it('rewards the kid who raises the price: $0.75 sells more cups for less money', () => {
    const cheap = counterfactualProfit(0.75, 'mild', UNLIMITED);
    const optimal = counterfactualProfit(1.6, 'mild', UNLIMITED);
    expect(cupsWantedAt(0.75, 'mild')).toBeGreaterThan(cupsWantedAt(1.6, 'mild'));
    expect(cheap).toBeLessThan(optimal);
    expect(cheap).toBeCloseTo(19.6, 2);
  });

  it('punishes greed too, so there is a real peak to find and not a ramp', () => {
    expect(counterfactualProfit(2.5, 'mild', UNLIMITED)).toBeLessThan(
      counterfactualProfit(1.6, 'mild', UNLIMITED),
    );
    expect(counterfactualProfit(2.95, 'mild', UNLIMITED)).toBeLessThan(0);
  });

  it('rises without a single dip all the way to the peak, so trial and error always works', () => {
    // A kid hill-climbs by nudging the price and watching profit. If the curve
    // dipped anywhere below $1.60 they could conclude they had already peaked
    // and stop early, which would break the core lesson.
    let previous = -Infinity;
    for (let cents = 0; cents <= 160; cents += 5) {
      const profit = counterfactualProfit(cents / 100, 'mild', UNLIMITED);
      expect(profit).toBeGreaterThan(previous);
      previous = profit;
    }
  });

  it('has no local maximum past the peak that beats the peak', () => {
    const peak = counterfactualProfit(1.6, 'mild', UNLIMITED);
    for (let cents = 165; cents <= 300; cents += 5) {
      expect(counterfactualProfit(cents / 100, 'mild', UNLIMITED)).toBeLessThan(peak);
    }
  });

  it('keeps a profitable price band on a cold day, so a bad forecast is not hopeless', () => {
    const best = Array.from({ length: 61 }, (_, i) => counterfactualProfit(i / 20, 'cold', UNLIMITED)).reduce(
      (a, b) => Math.max(a, b),
      -Infinity,
    );
    expect(best).toBeGreaterThan(0);
  });

  it('per-cup ingredient cost lands on the spec figure of about $0.20', () => {
    expect(ingredientCostOf(28).perCup).toBeCloseTo(0.195, 3);
    expect(ingredientCostOf(40).perCup).toBeCloseTo(0.195, 3);
  });
});
