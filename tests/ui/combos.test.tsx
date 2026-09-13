/** @vitest-environment jsdom */
/**
 * The app booted on every *pair* of state choices a child can produce.
 *
 * ## The hole this closes
 *
 * PRODUCT.md §78 named it, and named it honestly because it had been measured:
 *
 * > **A bug in a state the walk cannot reach ships.** Measured: the
 * > duplicate-key defect was not caught. Depth beyond the walk needs a
 * > fixture, and a fixture needs somebody to think of the state.
 *
 * That last clause is the whole problem. `tests/ui/states.test.tsx` renders
 * every screen across the branches its own code takes, `tests/ui/deep.test.tsx`
 * reaches the sheets and the second code boxes, and `tests/ui/soak.test.tsx`
 * walks the real app from four cleared saves and four demo saves. Between them
 * they cover a great deal — and every state in all three was *chosen by
 * somebody*. The defect that got through was two stands on the **same** pitch,
 * which nobody chose because nobody thought of it.
 *
 * ## What this does instead
 *
 * Nine dimensions of state, each with two to four values, all of them things a
 * child does: open another stand (including on the pitch they are already
 * trading), hire, buy kit, borrow for the door, meet the competitor, sell a
 * slice, run the Saturday stand, arrive with words still owed.
 *
 * The full cross product is 10,368 saves, which is not a test. **Every pair of
 * values is**, and it fits in about thirty: a greedy covering array, so for any
 * two choices a child could make together, some case in here makes them
 * together. Pairwise is the level where combination bugs actually live — a
 * duplicate React key needs two stands *and* the same pitch, and nothing more.
 *
 * Each case is built by the **real constructors** — `openStand`, `toggleStaff`,
 * `buyUpgrade`, `loanQuote`, `acceptEquity`, `beginWeekend` — on top of a save
 * `demo.ts` played forward. §49's rule: a fixture assembled by hand is a
 * fixture that can describe a state the game cannot produce, and then the bug
 * it finds is imaginary and the one it hides is real.
 *
 * Then it boots the whole app on each and asks the same three questions the
 * soak asks after every tap: nothing impossible on screen, no dead end, no
 * complaint from React. The last one is the tripwire that would have caught the
 * duplicate key on its own — the soak proved the tripwire works and could not
 * get to the state.
 *
 * ## It was measured against the defect it exists for
 *
 * The grouping in `dailyFixedCosts` was reverted and this file was run: it goes
 * **red**, on the React tripwire, at tap 8 of the case with three tables and
 * two of them on the sidewalk. No fixture was written for that state — the
 * covering array produced it, which is the whole point. The soak was measured
 * against the same defect and could not reach it.
 *
 * That run is also what set `TAPS`. At six taps the array reached the state and
 * the walk never rendered the profit and loss that breaks on it, so the sweep
 * passed on a live bug. A net whose size has not been measured is a net nobody
 * should trust, including this one.
 *
 * ## What it still misses, stated
 *
 * Four-way, not exhaustive. A defect needing **five** particular choices at
 * once gets through, and the honest note is that the fifth-order case is a
 * measured 21 seconds away rather than an unreachable one — see the table above
 * `WAYS`. Thirty taps is also shallow; going deep from a few starts is what the
 * soak is for. Between the two, the soak goes deep from eight states and this
 * goes shallow from 197.
 *
 * It cannot see a state the dimensions do not describe. Nine were chosen
 * because each is a decision a child makes and each changes what a screen
 * renders; a tenth that nobody thinks of is still a tenth that nobody thinks
 * of. **That is the residue, and it is a different kind of gap from the one
 * this file closed:** "somebody has to think of the state" became "somebody has
 * to think of the *dimension*", and there are nine of those rather than
 * thousands of states.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act as reactAct } from '@testing-library/react';
import Page from '@/app/page';
import { demoGame } from '@/lib/demo';
import { createCareer } from '@/lib/career';
import { UNLOCK_COPY } from '@/lib/unlocks';
import { SAVE_VERSION, beginWeekend, type Act, type Game } from '@/lib/progress';
import { buyUpgrade, dailyFixedCosts, openStand, toggleStaff } from '@/lib/business';
import { LOAN, SHOP, loanQuote } from '@/lib/retail';
import { EQUITY_SLICES, acceptEquity, canSellSlice, equityOffer } from '@/lib/ownership';
import { deriveInsights } from '@/lib/simulation';
import { runDay, orderForTargetCups } from '@/lib/simulation';

/* ------------------------------------------------------------------ *
 * The dimensions
 * ------------------------------------------------------------------ */

/**
 * Each entry is a choice a child makes, applied to a save by the same function
 * the app calls when they make it.
 *
 * Additive only. Nothing here *removes* state a later stage implies, because a
 * save with act 4 and no shop is not a state the game can reach — a crash on
 * one would be a bug in the fixture rather than in the app, and chasing it
 * would be worse than not looking.
 */
const DIMENSIONS = {
  stage: {
    'the business': {},
    'going public': {},
    'the market': {},
  },
  hire: {
    nobody: { apply: (g: Game) => g },
    'a helper': { apply: (g: Game) => hired(g, 'helper'), holds: (g: Game) => g.business.staff.helper },
    'a manager': { apply: (g: Game) => hired(g, 'manager'), holds: (g: Game) => g.business.staff.manager },
    both: {
      apply: (g: Game) => hired(hired(g, 'helper'), 'manager'),
      holds: (g: Game) => g.business.staff.helper && g.business.staff.manager,
    },
  },
  stand: {
    'as played': { apply: (g: Game) => g },
    /* The state the duplicate-key defect needed, and the reason this file
       exists: two tables on the pavement they are already trading on. */
    'a second on the same pitch': {
      apply: (g: Game) => opened(g, 'sidewalk'),
      holds: (g: Game) =>
        g.business.stands.some((stand) => stand.location === g.business.location),
    },
    'one more, wherever there is room': {
      apply: (g: Game) => opened(opened(g, 'park'), 'sidewalk'),
      holds: (g: Game) => g.business.stands.length >= 1,
    },
  },
  kit: {
    'as played': { apply: (g: Game) => g },
    'a cooler': { apply: (g: Game) => bought(g, 'cooler'), holds: (g: Game) => g.business.upgrades.cooler },
    everything: {
      apply: (g: Game) => (['cooler', 'bigSign', 'freshSqueeze'] as const).reduce(bought, g),
      holds: (g: Game) => Object.values(g.business.upgrades).every(Boolean),
    },
  },
  door: {
    'as played': { apply: (g: Game) => g },
    'borrowed for': { apply: withALoan, holds: (g: Game) => g.business.loan !== null },
  },
  rival: {
    away: { apply: (g: Game) => g },
    'on your pitch': {
      apply: (g: Game) => withRival(g, 'sidewalk'),
      holds: (g: Game) => g.business.rival.active,
    },
    'on the other one': {
      apply: (g: Game) => withRival(g, 'park'),
      holds: (g: Game) => g.business.rival.active,
    },
  },
  slice: {
    none: { apply: (g: Game) => g },
    'a small one': {
      apply: (g: Game) => sold(g, EQUITY_SLICES[0]),
      holds: (g: Game) => g.ownership.equitySoldPct > 0,
    },
    'the biggest allowed': {
      apply: (g: Game) => sold(g, EQUITY_SLICES[EQUITY_SLICES.length - 1]),
      holds: (g: Game) => g.ownership.equitySoldPct > 0,
    },
  },
  saturday: {
    no: { apply: (g: Game) => g },
    yes: { apply: (g: Game) => beginWeekend(g), holds: (g: Game) => g.weekend },
  },
  owed: {
    nothing: { apply: (g: Game) => g },
    'two words waiting': {
      apply: (g: Game) => ({ ...g, pendingInsights: twoWords(g) }),
      holds: (g: Game) => g.pendingInsights.length > 0,
    },
  },
} as const;

/**
 * Pairs the game cannot produce, each with the rule that forbids it.
 *
 * A covering array without constraints covers pairs *in name only*: the first
 * version of this file applied the stand mutator before anybody was hired, and
 * `openStand` correctly refused with "somebody has to mind this one first" —
 * so a third of the cases silently had no second stand and the file reported
 * full coverage of a thing it was not testing. The `holds` predicates above
 * turn that into a failure; this list is where a genuinely unreachable pair is
 * written down instead of being quietly tolerated.
 */
const UNREACHABLE: Array<{ when: (c: Choice) => boolean; why: string }> = [
  {
    when: (c) => c.stand !== 'as played' && c.hire !== 'a manager' && c.hire !== 'both',
    why: 'a second stand needs somebody minding the first — openStand refuses otherwise',
  },
  {
    when: (c) => c.saturday === 'yes' && c.stage !== 'the market',
    why: 'the Saturday stand runs out of the investing account, which only exists in the market stage',
  },
];

const forbidden = (choice: Choice) => UNREACHABLE.find((rule) => rule.when(choice));

type Choice = { [K in keyof typeof DIMENSIONS]: keyof (typeof DIMENSIONS)[K] };

/**
 * Order matters, and it is the game's order.
 *
 * `hire` before `stand` because a second stand needs a minder; `kit` and
 * `door` after, because both cost money the earlier steps may have spent; and
 * `saturday` last, because the weekend takes a float out of the account.
 */
const NAMES = Object.keys(DIMENSIONS) as Array<keyof typeof DIMENSIONS>;
const valuesOf = <K extends keyof typeof DIMENSIONS>(name: K) =>
  Object.keys(DIMENSIONS[name]) as Array<keyof (typeof DIMENSIONS)[K]>;

/* eslint-disable @typescript-eslint/no-explicit-any */
const stepFor = (name: keyof typeof DIMENSIONS, value: string) =>
  (DIMENSIONS[name] as any)[value] as
    | { apply?: (g: Game) => Game; holds?: (g: Game) => boolean }
    | undefined;
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---- the mutators, each through the function the app uses ---- */

function opened(game: Game, where: 'park' | 'sidewalk'): Game {
  /* Cash forced up first: this file is about state combinations, and "could
     not afford it" is a different test (`tests/yard.test.ts`). */
  const rich = { ...game, stand: { ...game.stand, cash: game.stand.cash + 500 } };
  const result = openStand(rich.business, where, rich.stand.cash);
  if (!result.opened) return game;
  return { ...rich, business: result.business, stand: { ...rich.stand, cash: result.cash } };
}

function hired(game: Game, who: 'helper' | 'manager'): Game {
  if (game.business.staff[who]) return game;
  return { ...game, business: toggleStaff(game.business, who) };
}

function bought(game: Game, id: 'cooler' | 'bigSign' | 'freshSqueeze'): Game {
  if (game.business.upgrades[id]) return game;
  const result = buyUpgrade(game.stand.cash + 500, game.business, id);
  if (!result.ok) return game;
  return { ...game, business: result.business, stand: { ...game.stand, cash: result.cash } };
}

function withRival(game: Game, location: 'park' | 'sidewalk'): Game {
  return {
    ...game,
    business: {
      ...game.business,
      rival: { active: true, price: 1.2, location, daysActive: 4 },
    },
  };
}

function sold(game: Game, slice: number): Game {
  /*
   * `canSellSlice` and a positive offer, not `offer.worthAnything`.
   *
   * The first version guarded on a field `EquityOffer` does not have, so it was
   * always falsy and this dimension silently never applied — which is exactly
   * what the `holds` predicates were added to catch, and the first thing they
   * caught.
   */
  const offer = equityOffer(game.stand.history, slice);
  if (offer.cash <= 0 || !canSellSlice(game.ownership, offer.slice)) return game;
  return {
    ...game,
    ownership: acceptEquity(game.ownership, offer),
    stand: { ...game.stand, cash: game.stand.cash + offer.cash },
  };
}

/** The door, paid for with the loan the funding screen offers. */
function withALoan(game: Game): Game {
  if (game.business.loan) return game;
  const withMoney = {
    ...game,
    stand: { ...game.stand, cash: game.stand.cash + LOAN.amount },
    business: { ...game.business, loan: loanQuote() },
  };
  if (withMoney.business.shop.open) return withMoney;
  return {
    ...withMoney,
    stand: { ...withMoney.stand, cash: withMoney.stand.cash - SHOP.fitOut },
    business: { ...withMoney.business, shop: { ...withMoney.business.shop, open: true } },
  };
}

/** Two real earned words, left in the queue rather than handed over. */
function twoWords(game: Game): Game['pendingInsights'] {
  const order = orderForTargetCups(game.stand, 24);
  const outcome = runDay(game.stand, { ...order, price: 1.5 });
  return deriveInsights(outcome, outcome.nextState.history).slice(0, 2);
}

/* ------------------------------------------------------------------ *
 * The covering array
 * ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many choices have to line up before this stops looking.
 *
 * **Four**, and the number was measured rather than argued. §78's residue after
 * the pairwise version was "a defect needing three specific choices at once
 * still gets through", so the obvious move was three — and once the array was
 * general in `WAYS` the whole curve was one line to measure:
 *
 * | | combinations covered | saves booted | wall time |
 * |---|---|---|---|
 * | 2-way | 268 | 21 | 0.3s |
 * | 3-way | 1,628 | 66 | 2.7s |
 * | **4-way** | **6,199** | **197** | **8.2s** |
 * | 5-way | 15,367 | 527 | 21.5s |
 *
 * Four is where the cost stops being free and is still inside the noise of the
 * soak next door, which takes thirteen seconds. Five nearly doubles the whole
 * vitest run for combinations that essentially no reported defect needs — the
 * literature on combinatorial testing puts the overwhelming majority of
 * interaction faults at two or three parameters, and this is already past that.
 *
 * The exhaustive answer is 7,776 whole states and about five minutes, which is
 * the right thing to run by hand when something smells and the wrong thing to
 * put in front of every commit.
 *
 * It is one constant. Moving it is an experiment, not a rewrite.
 */
const WAYS = 4;

/** Every way of choosing `WAYS` distinct dimensions. */
function dimensionSets(k: number, from = 0): Array<Array<keyof typeof DIMENSIONS>> {
  if (k === 0) return [[]];
  const out: Array<Array<keyof typeof DIMENSIONS>> = [];
  for (let i = from; i <= NAMES.length - k; i += 1) {
    for (const rest of dimensionSets(k - 1, i + 1)) out.push([NAMES[i], ...rest]);
  }
  return out;
}

const DIMENSION_SETS = dimensionSets(WAYS);

/** The cross product of one set of dimensions' values, as combination keys. */
function keysFor(dims: Array<keyof typeof DIMENSIONS>): Array<{ key: string; pick: Partial<Choice> }> {
  let rows: Array<Partial<Choice>> = [{}];
  for (const dim of dims) {
    const next: Array<Partial<Choice>> = [];
    for (const row of rows) {
      for (const value of valuesOf(dim)) next.push({ ...row, [dim]: value } as Partial<Choice>);
    }
    rows = next;
  }
  return rows.map((pick) => ({
    key: dims.map((dim) => `${dim}=${String(pick[dim])}`).join(' & '),
    pick,
  }));
}

/**
 * Every combination of `WAYS` choices, minus the ones the game cannot produce.
 *
 * The excluded count is reported rather than swallowed: a constraint list that
 * grows silently is how a covering array stops covering anything.
 *
 * A combination counts as unreachable only when **every** way of filling in the
 * remaining dimensions is forbidden, checked against the real rules rather than
 * assumed — so a rule about one dimension cannot quietly delete combinations
 * that have nothing to do with it.
 */
function allCombinations(): { wanted: Set<string>; excluded: string[] } {
  const wanted = new Set<string>();
  const excluded: string[] = [];
  const others = (dims: Array<keyof typeof DIMENSIONS>) => NAMES.filter((n) => !dims.includes(n));

  for (const dims of DIMENSION_SETS) {
    const free = others(dims);
    for (const { key, pick } of keysFor(dims)) {
      /* Walk the free dimensions one at a time rather than their whole cross
         product: every rule names a single dimension, so if some value of some
         free dimension makes the combination legal, it is legal. */
      let reachable = false;
      const base = Object.fromEntries(
        NAMES.map((name) => [name, pick[name] ?? valuesOf(name)[0]]),
      ) as unknown as Choice;
      if (!forbidden(base)) reachable = true;
      for (const other of free) {
        if (reachable) break;
        for (const value of valuesOf(other)) {
          if (!forbidden({ ...base, [other]: value } as Choice)) {
            reachable = true;
            break;
          }
        }
      }
      if (reachable) wanted.add(key);
      else excluded.push(key);
    }
  }
  return { wanted, excluded };
}

/** The combinations one case covers. */
function combinationsOf(choice: Choice): string[] {
  return DIMENSION_SETS.map((dims) =>
    dims.map((dim) => `${dim}=${String(choice[dim])}`).join(' & '),
  );
}

/**
 * A legal whole case containing the given choices, or null if there is none.
 *
 * Tries each free dimension's values in turn rather than their cross product,
 * which is sufficient because every rule in `UNREACHABLE` names one dimension.
 * If a rule ever spans two, this needs to become a real search and the comment
 * above `allCombinations` needs the same treatment.
 */
function fillOut(pinned: Partial<Choice>): Choice | null {
  let candidate = Object.fromEntries(
    NAMES.map((name) => [name, pinned[name] ?? valuesOf(name)[0]]),
  ) as unknown as Choice;
  if (!forbidden(candidate)) return candidate;
  for (const name of NAMES) {
    if (pinned[name] !== undefined) continue;
    for (const value of valuesOf(name)) {
      const next = { ...candidate, [name]: value } as Choice;
      if (!forbidden(next)) return next;
      candidate = next;
    }
  }
  return forbidden(candidate) ? null : candidate;
}

/**
 * A greedy covering array: keep the candidate that covers the most pairs
 * nobody has covered yet, until none are left.
 *
 * Greedy rather than IPOG because the array is generated once, in a test, and
 * thirty-odd cases against a theoretical minimum in the twenties is not worth
 * an algorithm nobody in this repo will read again.
 */
function coveringArray(seed: number): { cases: Choice[]; wanted: number; excluded: string[] } {
  const r = rng(seed);
  const { wanted, excluded } = allCombinations();
  const remaining = new Set(wanted);
  const cases: Choice[] = [];

  const candidate = (): Choice => {
    for (let tries = 0; tries < 200; tries += 1) {
      const next = Object.fromEntries(
        NAMES.map((name) => {
          const values = valuesOf(name);
          return [name, values[Math.floor(r() * values.length)]];
        }),
      ) as unknown as Choice;
      if (!forbidden(next)) return next;
    }
    /* Every dimension's first value is reachable together by construction. */
    return Object.fromEntries(
      NAMES.map((name) => [name, valuesOf(name)[0]]),
    ) as unknown as Choice;
  };

  while (remaining.size > 0 && cases.length < 600) {
    let best: Choice | null = null;
    let bestNew = -1;
    for (let tries = 0; tries < 120; tries += 1) {
      const next = candidate();
      const gained = combinationsOf(next).filter((key) => remaining.has(key)).length;
      if (gained > bestNew) {
        bestNew = gained;
        best = next;
      }
    }
    if (!best || bestNew <= 0) break;
    for (const key of combinationsOf(best)) remaining.delete(key);
    cases.push(best);
  }

  /*
   * Then finish by construction, rather than hoping.
   *
   * Greedy random search gets the last few per cent slowly and the very last
   * one sometimes not at all: at four-way it left exactly one of 6,199
   * uncovered, because the generator never happened to roll it. So anything
   * still missing is built *from* the combination — pin those values, fill the
   * rest with a legal assignment — which makes the array exact at any `WAYS`
   * instead of almost exact at the one that was tried.
   */
  for (const key of [...remaining]) {
    if (!remaining.has(key)) continue;
    const pinned = Object.fromEntries(
      key.split(' & ').map((part) => {
        const [dim, value] = part.split('=');
        return [dim, value];
      }),
    );
    const built = fillOut(pinned as Partial<Choice>);
    if (!built) continue;
    for (const covered of combinationsOf(built)) remaining.delete(covered);
    cases.push(built);
  }

  expect(
    [...remaining].slice(0, 5),
    `${remaining.size} of ${wanted.size} reachable ${WAYS}-way combinations never got covered`,
  ).toEqual([]);
  return { cases, wanted: wanted.size, excluded };
}

/* ------------------------------------------------------------------ *
 * Booting one
 * ------------------------------------------------------------------ */

const STAGE_ACT: Record<string, Act> = {
  'the business': 2,
  'going public': 3,
  'the market': 4,
};

/**
 * One save, built by the real constructors, with every choice verified to have
 * actually happened.
 *
 * The verification is the important half. A mutator that silently declines —
 * `openStand` with nobody minding the first stand, an equity offer guarded on a
 * field that does not exist — leaves a case that covers its pairs in name and
 * tests nothing, and the array goes on reporting full coverage. Two of the nine
 * dimensions were doing exactly that when the `holds` predicates were added.
 */
function saveFor(choice: Choice, seed: number): Game {
  let game = demoGame(STAGE_ACT[String(choice.stage)], seed);
  for (const name of NAMES) {
    if (name === 'stage') continue;
    const step = stepFor(name, String(choice[name]));
    if (!step?.apply) continue;
    game = step.apply(game);
    if (step.holds) {
      expect(
        step.holds(game),
        `${name}: ${String(choice[name])} did not take on a ${String(choice.stage)} save — ` +
          `the mutator declined, so this case would cover its pairs and test nothing`,
      ).toBe(true);
    }
  }
  return game;
}

const body = () => document.body.textContent ?? '';
const IMPOSSIBLE = [/NaN/, /Infinity/, /undefined/, /\[object Object\]/, /\$\s*-/, /\bnull\b/];
const AVOID = /Start over on this device|Erase|Delete everything|^↺$/i;

/**
 * Taps per case.
 *
 * Six was the first guess and it was too few to prove anything: with the
 * duplicate-key defect put back, the generated array reached the state and the
 * walk never rendered the profit and loss that breaks on it, so the sweep went
 * green on a live bug. Thirty reaches a close screen from every stage's
 * starting phase, which is where the keyed lists are, and the whole file still
 * runs in under a second.
 */
const TAPS = 30;

function enabled(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled && !AVOID.test(b.textContent ?? ''),
  ) as HTMLButtonElement[];
}

describe('the app, booted on every combination of things a child can have done', () => {
  let warnings: string[] = [];
  let spyError: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    warnings = [];
    spyError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
    spyWarn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    spyError.mockRestore();
    spyWarn.mockRestore();
    cleanup();
    vi.useRealTimers();
  });

  const real = (all: string[]) =>
    all.filter(
      (w) =>
        !/not implemented: HTMLCanvasElement|Not implemented: navigation|jsdom|Could not parse CSS/i.test(
          w,
        ) && w.trim() !== '',
    );

  it('never shows an impossible figure, a dead end, or a React complaint', async () => {
    const { cases, wanted, excluded } = coveringArray(20_260_913);
    const problems: string[] = [];
    let boots = 0;

    for (const [index, choice] of cases.entries()) {
      const describeCase = NAMES.map((name) => `${name}: ${String(choice[name])}`).join(', ');
      window.localStorage.clear();
      const save = saveFor(choice, 1000 + index * 7);
      expect(save.version, describeCase).toBe(SAVE_VERSION);
      window.localStorage.setItem('lemonade.save.v2', JSON.stringify(save));
      window.localStorage.setItem(
        'lemonade.career.v1',
        JSON.stringify({
          ...createCareer('Ada'),
          seasons: 2,
          announced: Object.keys(UNLOCK_COPY),
        }),
      );

      render(<Page />);
      await reactAct(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      boots += 1;

      /* A few taps, preferring what has not been pressed on this screen — deep
         walking is the soak's job, this is about the *starting* state. */
      const seen = new Set<string>();
      for (let tap = 0; tap <= TAPS; tap += 1) {
        for (const bad of IMPOSSIBLE) {
          if (bad.test(body())) problems.push(`${describeCase} · tap ${tap} · screen shows ${bad}`);
        }
        for (const complaint of real(warnings)) {
          problems.push(`${describeCase} · tap ${tap} · React said: ${complaint.slice(0, 160)}`);
        }
        warnings = [];

        const options = enabled();
        if (options.length === 0) {
          problems.push(`${describeCase} · tap ${tap} · dead end: ${body().slice(0, 120)}`);
          break;
        }
        if (tap === TAPS) break;
        const target =
          options.find((b) => !seen.has((b.textContent ?? '').replace(/\d+/g, '#'))) ?? options[0];
        seen.add((target.textContent ?? '').replace(/\d+/g, '#'));
        await reactAct(async () => {
          target.click();
          await vi.advanceTimersByTimeAsync(700);
        });
      }

      cleanup();
    }

    console.log(
      `COMBOS booted ${boots} saves covering every one of ${wanted} reachable ${WAYS}-way ` +
        `combinations from ${NAMES.length} dimensions (${excluded.length} the game cannot ` +
        `produce; full cross product: ${NAMES.reduce((n, name) => n * valuesOf(name).length, 1)})`,
    );
    expect(problems.slice(0, 5), 'booting a legal save broke something').toEqual([]);
    expect(boots).toBeGreaterThanOrEqual(20);
  }, 300_000);

  it('reaches the state the soak measured that it could not', async () => {
    /*
     * The specific one, asserted on its own so the reason this file exists
     * cannot quietly stop being covered by the generated array.
     *
     * Two stands on the same pitch is what produced two ledger rows both
     * labelled "Your sidewalk pitch" — one React key, on the one screen whose
     * whole job is adding costs up.
     */
    const twoOnOnePitch = saveFor(
      {
        stage: 'the business',
        stand: 'a second on the same pitch',
        hire: 'a manager',
        kit: 'as played',
        door: 'as played',
        rival: 'away',
        slice: 'none',
        saturday: 'no',
        owed: 'nothing',
      } as Choice,
      7,
    );
    /*
     * `standCount` is `1 + stands.length`: the pitch the child started on is
     * `business.location` and the extra tables are in `stands`. So two on one
     * pitch means the base pitch *and* an entry in `stands` for it.
     */
    const onTheSamePitch =
      twoOnOnePitch.business.stands.filter(
        (stand) => stand.location === twoOnOnePitch.business.location,
      ).length + 1;
    expect(onTheSamePitch, 'the fixture no longer has two tables on one pitch').toBeGreaterThanOrEqual(2);
    /* And that really does produce two cost lines about the same pavement,
       which is the state that had one React key for both. */
    const lines = dailyFixedCosts(twoOnOnePitch.business);
    expect(new Set(lines.map((line) => line.label)).size, 'two cost lines share a label').toBe(
      lines.length,
    );

    window.localStorage.setItem('lemonade.save.v2', JSON.stringify(twoOnOnePitch));
    render(<Page />);
    await reactAct(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(real(warnings), 'React complained on a save with two tables on one pitch').toEqual([]);
  }, 60_000);
});
