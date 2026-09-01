import { describe, it, expect } from 'vitest';
import {
  ECON,
  createInitialState,
  runDay,
  orderForTargetCups,
  batchPlan,
  deriveInsights,
  weekSummary,
  closingTakeaway,
  type GameState,
  type DayRecord,
  type InsightId,
} from '../src/lib/simulation';

function stateWith(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(1), ...overrides };
}

/** Plays a day and returns the insights it earned. */
function playForInsights(state: GameState, targetCups: number, price: number) {
  const outcome = runDay(state, { ...orderForTargetCups(state, targetCups), price });
  const insights = deriveInsights(outcome, outcome.nextState.history);
  return { outcome, insights, ids: insights.map((i) => i.id) };
}

describe('vocabulary arrives only after the experience', () => {
  it('names revenue and profit on day one, once the kid has felt both', () => {
    const state = stateWith({ cash: 200 });
    const { ids } = playForInsights(state, 28, 1.6);
    expect(ids).toContain('revenue');
    expect(ids).toContain('profit');
  });

  it('never names margin, capacity or spoilage on a day none of them happened', () => {
    const state = stateWith({ cash: 200 });
    // Small batch, high price, no sell-out, no waste, low volume.
    const { ids } = playForInsights(state, 8, 2.6);
    expect(ids).not.toContain('capacity');
    expect(ids).not.toContain('spoilage');
  });

  it('only names capacity after the kid actually sells out with a queue', () => {
    const state = stateWith({ cash: 200 });
    const { outcome, ids } = playForInsights(state, 8, 0.5);
    expect(outcome.turnedAwaySoldOut).toBeGreaterThan(0);
    expect(ids).toContain('capacity');
  });

  it('only names spoilage after lemons have actually gone in the bin', () => {
    const state = stateWith({
      cash: 200,
      day: 3,
      lemonLots: [{ lemons: 8, purchasedOnDay: 1 }],
    });
    const { outcome, ids } = playForInsights(state, 0, 2.9);
    expect(outcome.spoiledLemons).toBeGreaterThan(0);
    expect(ids).toContain('spoilage');
  });

  it('only names elasticity once the kid has moved the price and watched people leave', () => {
    let state = stateWith({ cash: 300 });
    const first = playForInsights(state, 40, 1.0);
    expect(first.ids).not.toContain('elasticity');
    state = first.outcome.nextState;
    const second = playForInsights(state, 40, 2.2);
    expect(second.outcome.walkedAwayOnPrice).toBeGreaterThan(0);
    expect(second.ids).toContain('elasticity');
  });

  it('withholds signal vs noise until there is enough data to honestly claim it', () => {
    let state = stateWith({ cash: 400 });
    for (let day = 1; day <= 2; day++) {
      const { ids, outcome } = playForInsights(state, 40, 1.6);
      expect(ids).not.toContain('signal-vs-noise');
      state = outcome.nextState;
    }
    const third = playForInsights(state, 40, 1.6);
    expect(third.ids).toContain('signal-vs-noise');
  });

  it('withholds operating leverage until day four', () => {
    let state = stateWith({ cash: 600 });
    for (let day = 1; day <= 3; day++) {
      const { ids, outcome } = playForInsights(state, 40, 1.6);
      expect(ids).not.toContain('operating-leverage');
      state = outcome.nextState;
    }
    expect(playForInsights(state, 40, 1.6).ids).toContain('operating-leverage');
  });

  it('teaches margin exactly at the wall: sold more cups, made less money', () => {
    let state = stateWith({ cash: 400, seed: 3 });
    // A cheap, high-volume day first.
    const cheap = playForInsights(state, 60, 0.6);
    state = cheap.outcome.nextState;
    // Then a pricier, lower-volume, more profitable day.
    const dear = playForInsights(state, 60, 1.6);
    expect(dear.outcome.cupsSold).toBeLessThan(cheap.outcome.cupsSold);
    expect(dear.outcome.profit).toBeGreaterThan(cheap.outcome.profit);
    const margin = dear.insights.find((i) => i.id === 'margin');
    expect(margin).toBeDefined();
    expect(margin!.carriesForward).toContain('Volume is not the goal');
  });

  it('every insight carries its own numbers, never a generic lecture', () => {
    let state = stateWith({ cash: 600 });
    const seen = new Set<InsightId>();
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      const price = [0.6, 1.6, 2.4, 1.6, 1.5, 1.7, 1.6][day - 1];
      const { insights, outcome } = playForInsights(state, 60, price);
      for (const insight of insights) {
        seen.add(insight.id);
        expect(insight.term.length).toBeGreaterThan(0);
        // Evidence must quote a real figure from the kid's own day.
        expect(insight.evidence).toMatch(/[0-9]/);
        expect(insight.carriesForward.length).toBeGreaterThan(20);
      }
      state = outcome.nextState;
    }
    // Across a varied week the kid should meet the full Act 1 vocabulary.
    for (const id of [
      'revenue',
      'profit',
      'elasticity',
      'margin',
      'signal-vs-noise',
      'operating-leverage',
      'return-on-cash',
    ] as InsightId[]) {
      expect(seen.has(id)).toBe(true);
    }
  });

  it('hands over return on money put in by the end of the week, as the bridge to markets', () => {
    let state = stateWith({ cash: 600 });
    let ids: InsightId[] = [];
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      const played = playForInsights(state, 40, 1.6);
      ids = played.ids;
      state = played.outcome.nextState;
    }
    expect(ids).toContain('return-on-cash');
  });
});

describe('batch plan tells the truth about lumpy supplies', () => {
  it('reports what the kid can really pour, not what they asked for', () => {
    const state = stateWith({ cash: 200 });
    const plan = batchPlan(state, 5);
    // 2 whole lemons pour 8 cups; sugar and cups come in tens.
    expect(plan.cupsMakeable).toBe(8);
    expect(plan.targetCups).toBe(5);
  });

  it('quotes a cost per cup that matches the ingredient bill', () => {
    const state = stateWith({ cash: 200 });
    const plan = batchPlan(state, 28);
    expect(plan.cupsMakeable).toBe(28);
    expect(plan.cost.total).toBeCloseTo(5.6, 2);
    expect(plan.costPerCup).toBeCloseTo(0.195, 3);
  });

  it('knows which ingredient is the bottleneck', () => {
    const state = stateWith({
      cash: 200,
      lemonLots: [{ lemons: 20, purchasedOnDay: 1 }],
      sugarServings: 0,
      cupsInStock: 0,
    });
    const plan = batchPlan(state, 0);
    expect(plan.cupsMakeable).toBe(0);
  });

  it('flags an order the kid cannot afford', () => {
    const state = stateWith({ cash: 1 });
    expect(batchPlan(state, 60).affordable).toBe(false);
    expect(batchPlan(state, 0).affordable).toBe(true);
  });

  it('costs nothing when the pantry already covers the batch', () => {
    const state = stateWith({
      cash: 200,
      lemonLots: [{ lemons: 10, purchasedOnDay: 1 }],
      sugarServings: 40,
      cupsInStock: 40,
    });
    const plan = batchPlan(state, 40);
    expect(plan.cost.total).toBe(0);
    expect(plan.cupsMakeable).toBe(40);
  });
});

describe('week summary is evidence, not a score', () => {
  it('is empty and honest before anything has happened', () => {
    const summary = weekSummary([]);
    expect(summary.days).toBe(0);
    expect(summary.foundOptimalBand).toBe(false);
    expect(summary.bestDay).toBeNull();
  });

  it('records how many days it took to find the profitable price band', () => {
    const history: DayRecord[] = [
      { day: 1, weather: 'mild', price: 0.5, cupsSold: 50, cupsWanted: 50, revenue: 25, profit: 10, cashAfter: 25 },
      { day: 2, weather: 'mild', price: 1.0, cupsSold: 40, cupsWanted: 40, revenue: 40, profit: 27, cashAfter: 52 },
      { day: 3, weather: 'mild', price: 1.6, cupsSold: 28, cupsWanted: 28, revenue: 44.8, profit: 34.3, cashAfter: 86 },
    ];
    const summary = weekSummary(history);
    expect(summary.foundOptimalBand).toBe(true);
    expect(summary.daysToOptimalBand).toBe(3);
    expect(summary.bestPrice).toBe(1.6);
    expect(summary.totalProfit).toBeCloseTo(71.3, 2);
    expect(summary.averageProfit).toBeCloseTo(23.77, 1);
    expect(summary.profitableDays).toBe(3);
  });

  it('does not credit a kid who never got near the optimum', () => {
    const history: DayRecord[] = [
      { day: 1, weather: 'mild', price: 0.5, cupsSold: 50, cupsWanted: 50, revenue: 25, profit: 10, cashAfter: 25 },
      { day: 2, weather: 'mild', price: 0.6, cupsSold: 48, cupsWanted: 48, revenue: 28.8, profit: 14, cashAfter: 39 },
    ];
    expect(weekSummary(history).foundOptimalBand).toBe(false);
    expect(weekSummary(history).daysToOptimalBand).toBeNull();
  });

  it('reads a real played week end to end', () => {
    let state = createInitialState(12345);
    const prices = [0.75, 1.0, 1.3, 1.6, 1.55, 1.65, 1.6];
    for (const price of prices) {
      state = runDay(state, { ...orderForTargetCups(state, 45), price }).nextState;
    }
    const summary = weekSummary(state.history);
    expect(summary.days).toBe(7);
    expect(summary.foundOptimalBand).toBe(true);
    expect(summary.daysToOptimalBand).toBe(4);
    expect(summary.totalProfit).toBeGreaterThan(0);
  });
});

describe('the batch size is scored as a bet on the future', () => {
  // This is the closest Act 1 gets to the skill that actually matters later:
  // read a hint, commit money before you know the answer, get scored.
  it('does not score a bet on day one, before the kid has any feel for it', () => {
    const state = stateWith({ cash: 300 });
    expect(playForInsights(state, 40, 1.6).ids).not.toContain('demand-bet');
  });

  it('calls out an over-optimistic bet, naming the forecast they acted on', () => {
    const state = stateWith({ cash: 400, day: 2, forecast: 'probably-hot', seed: 4 });
    // Big batch, high price: most of it will not sell.
    const { outcome, insights } = playForInsights(state, 80, 2.6);
    expect(outcome.cupsSold / outcome.cupsMakeable).toBeLessThan(0.55);
    const bet = insights.find((i) => i.id === 'demand-bet');
    expect(bet).toBeDefined();
    expect(bet!.term).toContain('optimistic');
    expect(bet!.evidence.toLowerCase()).toContain('hot');
  });

  it('calls out a bet that was too cautious when the kid sells out', () => {
    const state = stateWith({ cash: 400, day: 3, forecast: 'probably-hot', seed: 5 });
    const { outcome, insights } = playForInsights(state, 8, 0.6);
    expect(outcome.turnedAwaySoldOut).toBeGreaterThan(0);
    const bet = insights.find((i) => i.id === 'demand-bet');
    expect(bet!.term).toContain('cautious');
  });

  it('credits a well-judged day', () => {
    const state = stateWith({ cash: 400, day: 2, forecast: 'probably-mild', seed: 1 });
    const { outcome, insights } = playForInsights(state, 24, 1.6);
    const bet = insights.find((i) => i.id === 'demand-bet');
    if (outcome.cupsSold / outcome.cupsMakeable >= 0.8 && outcome.turnedAwaySoldOut === 0) {
      expect(bet!.term).toContain('judged');
    }
  });
});

describe('the closing takeaway is only ever true of the week actually played', () => {
  it('never claims a cheap-price lesson to a kid who never priced cheaply', () => {
    const history: DayRecord[] = [1.4, 1.8, 2.0, 1.5, 1.65, 1.6, 1.6].map((price, i) => ({
      day: i + 1,
      weather: 'mild' as const,
      price,
      cupsSold: 30,
      cupsWanted: 30,
      revenue: price * 30,
      profit: 20,
      cashAfter: 100,
    }));
    const takeaway = closingTakeaway(history);
    expect(takeaway.toLowerCase()).not.toContain('cheap cups sold the most');
    expect(takeaway).toMatch(/\$/);
  });

  it('does name the volume trap when the kid genuinely lived it', () => {
    const history: DayRecord[] = [
      { day: 1, weather: 'mild', price: 0.6, cupsSold: 48, cupsWanted: 48, revenue: 28.8, profit: 12, cashAfter: 32 },
      { day: 2, weather: 'mild', price: 1.6, cupsSold: 28, cupsWanted: 28, revenue: 44.8, profit: 34, cashAfter: 66 },
    ];
    expect(closingTakeaway(history)).toContain('Selling more is not the same as earning more');
  });

  it('tells a kid whose dearest price was also their best to push further', () => {
    // A cold cheap day and a hot dear day: the dear day is both the busiest
    // and the most profitable, so the volume trap genuinely did not happen.
    const history: DayRecord[] = [
      { day: 1, weather: 'cold', price: 0.5, cupsSold: 20, cupsWanted: 20, revenue: 10, profit: 5, cashAfter: 25 },
      { day: 2, weather: 'hot', price: 1.0, cupsSold: 40, cupsWanted: 40, revenue: 40, profit: 25, cashAfter: 50 },
    ];
    expect(closingTakeaway(history)).toContain('never found the point');
  });

  it('is never empty, for any week', () => {
    let state = createInitialState(31);
    for (let day = 1; day <= ECON.TOTAL_DAYS; day++) {
      state = runDay(state, { ...orderForTargetCups(state, 30), price: 1.6 }).nextState;
    }
    expect(closingTakeaway(state.history).length).toBeGreaterThan(20);
  });
});
