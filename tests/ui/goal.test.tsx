/** @vitest-environment jsdom */
/**
 * Does the first stage tell a child what it is asking for?
 *
 * FRAMEWORK.md §14 found that it did not. The goal strip read "6 days left ·
 * $33.40 of $20.00 start" — a clock and a comparison — and `act1Complete` was
 * seven days elapsed. Nothing was aimed at, so nothing could be hit or missed,
 * and a child could not tell whether the day they just played was any good.
 *
 * Asserted through the real screen rather than by calling `act1Progress`,
 * because a goal that exists in the model and never renders is PRODUCT.md
 * §40's defect class — and that class has now been a badge counter, a glossary
 * word and a tour step.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlanScreen } from '@/components/PlanScreen';
import { PriceScreen } from '@/components/PriceScreen';
import { ShopScreen } from '@/components/ShopScreen';
import { MorningScreen } from '@/components/MorningScreen';
import { CloseScreen } from '@/components/CloseScreen';
import { nextStop } from '@/lib/journey';
import { cheapestUpgrade } from '@/lib/business';
import { act1Progress, createGame } from '@/lib/progress';
import { money } from '@/components/ui';
import {
  DEFAULT_DAY_PARAMS,
  ECON,
  batchPlan,
  runDay,
  type GameState,
  type LemonGrade,
} from '@/lib/simulation';

const params = { ...DEFAULT_DAY_PARAMS, lastDay: null };

/** Plays real days at one strategy, so the history is the simulation's own. */
function after(days: number, price: number, grade: LemonGrade = 'regular'): GameState {
  let state: GameState = createGame(7).stand;
  for (let day = 0; day < days; day++) {
    const plan = batchPlan(state, 40, grade);
    state = runDay(state, { ...plan.order, price, grade }, params).nextState;
  }
  return state;
}

/**
 * Rendered the way `page.tsx` renders it.
 *
 * The stage line is computed by the app and handed down — `PlanScreen` is
 * presentational about it — so the goal has to be passed in for this to be a
 * test of the screen rather than of a default. `act1Progress` supplies it here
 * exactly as `page.tsx` does; that function's own answers are asserted in
 * `tests/stage1.test.ts`, and TypeScript is what guarantees the app passes it.
 */
function plan(state: GameState) {
  const progress = act1Progress(state);
  render(
    <PlanScreen
      state={state}
      /*
       * `day` is the day about to be played, which is what `page.tsx` passes.
       *
       * This helper first passed `history.length` — replicating the exact
       * off-by-one it was written to catch, so the test failed for the right
       * reason and then had to be corrected too. That is the hazard of a
       * fixture that re-derives what the app derives: the strongest version of
       * this test would render `<Page />`, and `tests/ui/journey.test.tsx` is
       * where that machinery lives.
       */
      stage={{ goal: progress.goal, day: state.history.length + 1, total: ECON.TOTAL_DAYS }}
      onOpen={() => {}}
      onInvest={() => {}}
    />,
  );
}

describe('the goal strip in the first stage', () => {
  afterEach(cleanup);

  it('asks for nothing while the child is still exploring, but says how long for', () => {
    const state = after(1, 1.5);
    expect(act1Progress(state).exploring).toBe(true);
    plan(state);
    /*
     * The old line was "Try things out. Nothing to hit yet.", and the
     * complaint about it was exact: the header counts seven days, so a child
     * reading that has no way to tell what these two are or when they end.
     * A practice day has to place itself in the week.
     */
    expect(screen.getByText(/Practice 2 of 2/i)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`goal starts on day ${ECON.ACT1_EXPLORE_DAYS + 1}`, 'i')),
    ).toBeInTheDocument();
    // And it still does not name a figure a child has not been set yet.
    expect(screen.queryByText(new RegExp(`\\$${ECON.ACT1_PROFIT_TARGET}`))).not.toBeInTheDocument();
  });

  /*
   * The morning and the plan screen are two screens a child sees inside one
   * day, and they were answering the same question differently: the morning
   * had "Two days to try things out" written into the component, with the
   * count spelled out as a word, while the plan screen said "Try things out.
   * Nothing to hit yet." Either could go stale on its own, and the pair could
   * disagree in front of a child who had done nothing wrong.
   */
  it('says the same thing on the morning as on the plan screen', () => {
    const fresh = after(0, 1.5);
    render(<MorningScreen state={fresh} onContinue={() => {}} />);
    expect(screen.getByText(act1Progress(fresh).goal)).toBeInTheDocument();
  });

  it('derives the practice count from the constant, not from a spelled-out word', () => {
    const line = act1Progress(after(0, 1.5)).goal;
    expect(line).toContain(String(ECON.ACT1_EXPLORE_DAYS));
    expect(line).toContain(String(ECON.ACT1_EXPLORE_DAYS + 1));
  });

  it('counts the practice days up as they are played', () => {
    expect(act1Progress(after(0, 1.5)).goal).toMatch(/Practice 1 of 2/);
    expect(act1Progress(after(1, 1.5)).goal).toMatch(/Practice 2 of 2/);
    expect(act1Progress(after(2, 1.5)).goal).not.toMatch(/Practice/);
  });

  it('names the target once exploration is over', () => {
    // Two poor days: past exploring, nothing banked.
    const state = after(ECON.ACT1_EXPLORE_DAYS, 4.5, 'value');
    const progress = act1Progress(state);
    expect(progress.exploring).toBe(false);
    expect(progress.hits).toBe(0);

    plan(state);
    const strip = screen.getByText(new RegExp(`Make \\$${ECON.ACT1_PROFIT_TARGET} in one day`, 'i'));
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).toMatch(/twice/i);
  });

  it('counts down the second good day once the first is banked', () => {
    let state = after(ECON.ACT1_EXPLORE_DAYS, 4.5, 'value');
    // One good day, deliberately after exploration.
    const good = batchPlan(state, 40, 'organic');
    state = runDay(state, { ...good.order, price: 2, grade: 'organic' }, params).nextState;

    const progress = act1Progress(state);
    expect(progress.hits, 'the good day did not clear the target').toBe(1);
    expect(progress.complete).toBe(false);

    plan(state);
    expect(screen.getByText(new RegExp(`Make \\$${ECON.ACT1_PROFIT_TARGET} again`, 'i'))).toBeInTheDocument();
  });

  it('agrees with itself about which day it is', () => {
    /*
     * The header and the title are two renderings of one fact, and they
     * disagreed: "Day 1 / 7" above a screen headed "Day 2".
     *
     * `PlanScreen` reads `stage?.day ?? state.history.length + 1`. Act 1 had
     * no stage entry until the goal was added, so it took the fallback and was
     * correct by accident; the new entry passed the count of days *banked*
     * rather than the day about to be played. Found in a browser, on the
     * second screen of a fresh install.
     */
    for (const days of [1, 2, 3]) {
      cleanup();
      const state = after(days, 1.5);
      plan(state);
      const seen = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      const expected = `Day ${days + 1}`;
      // Once for the header, once for the title, and no other day number.
      const others = [1, 2, 3, 4, 5, 6, 7]
        .filter((n) => n !== days + 1)
        .filter((n) => new RegExp(`Day ${n}\\b`).test(seen));
      expect(seen).toContain(expected);
      expect(others, `also claims to be Day ${others.join(', Day ')}`).toEqual([]);
    }
  });

  it('never shows the old day-countdown strip in the first stage', () => {
    /*
     * The specific regression. `PlanScreen` still has that fallback for the
     * weekend stand, which has no stage and no goal — so it has to be the
     * branch that is *not* taken here.
     */
    for (const days of [1, 2, 3, 4]) {
      cleanup();
      plan(after(days, 1.5));
      expect(screen.queryByText(/days left ·/i), `day ${days + 1} still shows a countdown`)
        .not.toBeInTheDocument();
    }
  });
});

describe('the number a price has to beat', () => {
  afterEach(cleanup);

  /**
   * The price screen must quote the cost of *today's* lemonade.
   *
   * It used to work this out itself with `ingredientCostOf(cupsMakeable)`,
   * which prices lemons flat. So a child who had just chosen posh lemons was
   * shown "a cup costs you $0.20 to make — charge more than that" when a cup
   * cost 29c, and 25c looked like a profit and was a loss on every cup.
   *
   * Found by playing it in a browser, not by any test, which is why this one
   * exists. The floor is now passed in by the caller, which is the only place
   * that knows both the grade and the order size — and the order size is what
   * decides the bulk discount.
   */
  it('quotes the cost of the recipe actually chosen', () => {
    /*
     * A fresh stand, because the sentence is behind `firstEver` — it is
     * day one's advice and day one only. Which is also exactly where the bug
     * lived: from day two the price is set on the plan screen, whose sheets
     * read `projectDay`, and that was given the grade.
     */
    const state = createGame(7).stand;
    const cups = 28;

    for (const grade of ['value', 'regular', 'organic'] as LemonGrade[]) {
      cleanup();
      const plan = batchPlan(state, cups, grade);
      render(
        <PriceScreen
          state={state}
          cupsMakeable={plan.cupsMakeable}
          perCupCost={plan.costPerCup}
          learned={[]}
          onConfirm={() => {}}
          onBack={() => {}}
        />,
      );
      /*
       * Compared against `money()`, the app's own rounding, not `toFixed`.
       * The two disagree on a half-cent and the screen is the thing under
       * test — asserting my own arithmetic would be asserting the wrong side.
       */
      /*
       * Read off the rendered text rather than with `getByText`.
       *
       * The sentence is `A cup costs you {money(perCup)} to make`, so React
       * splits it across text nodes and a regex spanning the interpolation
       * matches nothing — "the text is broken up by multiple elements". What
       * a child sees is the concatenation, so that is what is asserted.
       */
      const shown = money(plan.costPerCup);
      const seen = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      expect(seen, `${grade}: the screen did not quote ${shown}`).toContain(
        `A cup costs you ${shown} to make`,
      );
    }
  });

  it('moves with the recipe, so the floor is never the wrong one', () => {
    /*
     * The property, rather than the three instances: a dearer lemon must
     * produce a higher floor. That is what the bug got wrong — the floor was
     * frozen at the normal price whatever a child bought.
     *
     * Measured from a *fresh* stand deliberately. After a day of trading there
     * are leftover lemons in the pantry, so a plan buys fewer and the cost of
     * a cup is partly yesterday's price — true to life, and no use for
     * comparing grades against each other.
     */
    const fresh = createGame(7).stand;
    const cheap = batchPlan(fresh, 28, 'value').costPerCup;
    const normal = batchPlan(fresh, 28, 'regular').costPerCup;
    const posh = batchPlan(fresh, 28, 'organic').costPerCup;

    expect(cheap).toBeLessThan(normal);
    expect(posh).toBeGreaterThan(normal);
    expect(cheap).toBeGreaterThan(0);
  });
});

describe('the recipe is a standing decision', () => {
  afterEach(cleanup);

  it('is still the one they chose after a reload', () => {
    /*
     * Found on the second screen of a real session. A resumed Act 1 save goes
     * `morning → shop → price`, and the shop screen defaulted the recipe to
     * normal — so a reload switched a child off the posh lemons they had
     * bought, without asking and without saying.
     *
     * Worse than a reset, because `gradeDemandFactor` reads *yesterday's*
     * grade for word of mouth: demand would move for a decision they did not
     * make. ShopScreen's own comment claimed it "is only ever reached on a
     * run's first day", which resume disproves.
     */
    let state = createGame(7).stand;
    const plan = batchPlan(state, 28, 'organic');
    state = runDay(
      state,
      { ...plan.order, price: 1.5, grade: 'organic' },
      { ...DEFAULT_DAY_PARAMS, lastDay: null },
    ).nextState;

    render(<ShopScreen state={state} onConfirm={() => {}} onBack={() => {}} />);

    const posh = screen.getAllByRole('radio').find((el) =>
      /Posh/i.test(el.getAttribute('aria-label') ?? ''),
    );
    expect(posh, 'the posh option is gone').toBeDefined();
    expect(
      posh?.getAttribute('aria-checked'),
      'a reload put the child back on normal lemons',
    ).toBe('true');
  });

  it('does not offer a recipe on the first morning at all', () => {
    /*
     * The third lever no longer arrives on day one. §68's account of the
     * five-minute wall is that the stage front-loaded its whole decision set
     * and then had nothing new to give, and `src/lib/levers.ts` staggers them:
     * price and batch for the two exploratory days, the profit goal on day
     * three, the recipe on day four.
     *
     * So a brand new stand has no picker — and it still pours the normal lemon,
     * which is what the old version of this test was really guaranteeing.
     */
    const fresh = createGame(7).stand;
    render(<ShopScreen state={fresh} onConfirm={() => {}} onBack={() => {}} />);
    expect(screen.queryAllByRole('radio'), 'three recipes on the first morning').toHaveLength(0);
    expect(screen.queryByText(/Which lemons/i)).toBeNull();

    // And the day it does open with is the plain one.
    const plan = batchPlan(fresh, 28);
    expect(runDay(fresh, { ...plan.order, price: 1 }).grade).toBe('regular');
  });

  it('opens the recipe on the fourth day, and never shuts it again', () => {
    /*
     * The arrival, driven through the screen a child actually meets it on.
     * Swept across the rest of the arc rather than checked once, because the
     * failure mode that matters is a control that comes back and then goes
     * away again — a returning child finding a decision missing has no way to
     * tell that from a broken game.
     */
    let state = createGame(7).stand;
    for (let day = 1; day <= 8; day++) {
      cleanup();
      render(<ShopScreen state={state} onConfirm={() => {}} onBack={() => {}} />);
      const offered = screen.queryAllByRole('radio').length;
      if (day <= 3) {
        expect(offered, `day ${day} offered a recipe too early`).toBe(0);
      } else {
        expect(offered, `day ${day} lost the recipe`).toBe(3);
      }
      const plan = batchPlan(state, 28);
      state = runDay(
        state,
        { ...plan.order, price: 1.5 },
        { ...DEFAULT_DAY_PARAMS, lastDay: null },
      ).nextState;
    }
  });
});

/*
 * The close screen is where a child decides whether to play another day, and
 * until now it was the only screen in the run that said nothing about the run.
 * The pilot's wording: "I couldn't even tell how long I have to keep going to
 * exit this level."
 */
describe('the close screen says where this is going', () => {
  afterEach(cleanup);

  function dayOne() {
    const fresh = createGame(7).stand;
    const plan = batchPlan(fresh, 28);
    return runDay(fresh, { ...plan.order, price: 1.5 }, { ...DEFAULT_DAY_PARAMS, lastDay: null });
  }

  it('names the goal and the padlock behind it', () => {
    const game = createGame(7);
    const stop = nextStop(game)!;
    render(
      <CloseScreen
        outcome={dayOne()}
        insights={[]}
        whatsNext={{ goal: act1Progress(game.stand).goal, stop }}
        onNext={() => {}}
      />,
    );
    // What they are aiming at, from the one source the plan screen reads.
    expect(screen.getByText(act1Progress(game.stand).goal)).toBeDefined();
    // And what it opens, which is the money's reason for existing.
    expect(document.body.textContent).toContain(stop.name);
    expect(document.body.textContent).toContain('cooler');
  });

  it('agrees with the road about what opens the next stage', () => {
    /*
     * §62, on a fact that had drifted. The road said "Finish your first week"
     * long after the stage stopped ending on the clock, so the padlock on the
     * title screen was giving a different instruction from the goal strip
     * inside the game. Both are now built from the same two constants.
     */
    const stop = nextStop(createGame(7))!;
    expect(stop.opensWhen).toContain(`$${ECON.ACT1_PROFIT_TARGET}`);
    expect(stop.opensWhen).toMatch(/2 times/);
    expect(stop.opensWhen).not.toMatch(/week/i);
  });

  it('says nothing on the last day, when there is nothing to come back for', () => {
    /*
     * The strip is an argument for playing tomorrow. On the day the stage ends
     * there is no tomorrow to argue for, and the week's own summary is next.
     */
    let state = createGame(7).stand;
    let outcome = dayOne();
    for (let day = 1; day < ECON.TOTAL_DAYS; day++) {
      state = outcome.nextState;
      const plan = batchPlan(state, 28);
      outcome = runDay(state, { ...plan.order, price: 1.5 });
    }
    expect(outcome.nextState.status).toBe('finished');
    render(
      <CloseScreen
        outcome={outcome}
        insights={[]}
        whatsNext={{ goal: 'Make $25 in one day. Twice.', stop: nextStop(createGame(7)) }}
        onNext={() => {}}
      />,
    );
    expect(document.body.textContent).not.toContain('Make $25 in one day');
  });

  it('renders without it, because most screens in the tests pass nothing', () => {
    render(<CloseScreen outcome={dayOne()} insights={[]} onNext={() => {}} />);
    expect(document.body.textContent).toContain('Profit and loss');
  });
});

describe('the close screen only asks about the child’s own day', () => {
  afterEach(cleanup);

  function twoDays() {
    const fresh = createGame(7).stand;
    const one = runDay(fresh, { ...batchPlan(fresh, 28).order, price: 1.0 }, {
      ...DEFAULT_DAY_PARAMS,
      lastDay: null,
    });
    const two = runDay(one.nextState, { ...batchPlan(one.nextState, 44).order, price: 2.2 }, {
      ...DEFAULT_DAY_PARAMS,
      lastDay: null,
    });
    return two;
  }

  it('asks on an ordinary day', () => {
    render(<CloseScreen outcome={twoDays()} insights={[]} onNext={() => {}} />);
    expect(document.body.textContent).toMatch(/What made today different/i);
  });

  it('says nothing when the day is not comparable', () => {
    /*
     * Two real cases, one flag. A manager-run day was asking a child to
     * attribute dials the manager moved; the Saturday stand was holding a
     * folding table against the shop the child sold forty days ago — "you made
     * 84 cups yesterday and 24 today". Both found by opening the path.
     */
    render(
      <CloseScreen outcome={twoDays()} insights={[]} comparable={false} onNext={() => {}} />,
    );
    expect(document.body.textContent).not.toMatch(/What made today different/i);
    expect(document.body.textContent).not.toMatch(/Yesterday vs today/i);
    // And the rest of the screen is untouched.
    expect(document.body.textContent).toMatch(/Profit and loss/i);
  });
});

describe('what the money in stage one is for', () => {
  afterEach(cleanup);

  function aDay() {
    const fresh = createGame(7).stand;
    return runDay(fresh, { ...batchPlan(fresh, 28).order, price: 1.5 }, {
      ...DEFAULT_DAY_PARAMS,
      lastDay: null,
    });
  }

  it('names the cash and the first thing it buys', () => {
    /*
     * §68's cause B, measured: cash goes from $20 to about $195 across stage
     * one and never changes what a child can do, which makes it a score rather
     * than a currency. It carries into stage two untouched and buys the first
     * thing in the yard; the game never said so.
     */
    const outcome = aDay();
    const buys = cheapestUpgrade();
    render(
      <CloseScreen
        outcome={outcome}
        insights={[]}
        whatsNext={{
          stop: nextStop(createGame(7)),
          buys: { ...buys, cash: outcome.nextState.cash },
        }}
        onNext={() => {}}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain(money(outcome.nextState.cash));
    expect(text).toContain(buys.name);
    expect(text).toContain(money(buys.cost));
  });

  it('quotes a price a child can actually reach in stage one', () => {
    /*
     * The promise has to be keepable. A cheapest upgrade dearer than a decent
     * week would make the padlock a tease, so this pins the relationship
     * rather than the figure: whatever the yard's cheapest thing costs, a
     * child clearing the stage's own profit target twice can afford it.
     */
    const buys = cheapestUpgrade();
    expect(buys.cost).toBeLessThanOrEqual(ECON.ACT1_PROFIT_TARGET * ECON.ACT1_TARGET_HITS);
  });

  it('says nothing about it once the yard is open', () => {
    /* From stage two on, every dollar already has a use. */
    render(
      <CloseScreen
        outcome={aDay()}
        insights={[]}
        whatsNext={{ stop: nextStop(createGame(7)) }}
        onNext={() => {}}
      />,
    );
    expect(document.body.textContent).not.toContain(cheapestUpgrade().name);
  });
});
