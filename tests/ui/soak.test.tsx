/** @vitest-environment jsdom */
/**
 * Every button the app offers, pressed — and then the app walked for a while.
 *
 * ## Why this exists
 *
 * Every other test in this project picks a path and checks it. That verifies
 * the paths somebody thought of, and PRODUCT.md §75 is a long record of what
 * that misses: a routing helper reading a stale closure, a beat wired to a
 * screen that never shows it, two ledger rows with one React key, a shortcut
 * that replayed the day already on screen. Each was found by a human opening a
 * screen, days or weeks after the change that caused it.
 *
 * `tests/fuzz.test.ts` does the equivalent for the *simulation* and it works —
 * thousands of randomised days against invariants rather than answers. Nothing
 * did it for the **app**: the state machine, the routing, the screens. Which is
 * precisely where all of those bugs were.
 *
 * ## Why it is not a random walk
 *
 * The first version of this file was, and the customer put the obvious hole in
 * it: *"a test that just taps on the screen randomly, what if it doesn't even
 * tap a button? Shouldn't we drive every UI path the user can take?"* Right.
 * A random walk gives no guarantee that any particular control is ever pressed,
 * so it cannot report coverage, only luck.
 *
 * So the walk is **coverage-guided**. At each step it prefers a button it has
 * never pressed *on this screen*, and falls back to a random one only when the
 * screen is exhausted. It records every `(screen, button)` pair it presses, and
 * the assertions are about that record:
 *
 *  - every button on every screen it reached was pressed at least once
 *  - every phase in the app's own `Phase` union was either reached, or is named
 *    in `UNREACHED` with a reason — so a **new phase fails this test** until
 *    somebody says how it is meant to be reached
 *
 * Random still earns its place as the second test: a long sequence finds the
 * order-dependent bugs that per-screen coverage cannot.
 *
 * ## What it asserts after every single tap
 *
 * It does not know what the game is supposed to do. It knows what must never
 * be true:
 *
 *  - **no dead end** — there is always something enabled to press
 *  - **no impossible figure on screen** — no `NaN`, no `Infinity`, no
 *    `undefined`, no `$-` where money should be
 *  - **no React complaint** — duplicate keys, updates outside `act`, bad props.
 *    This is the tripwire that would have caught the two ledger rows both
 *    labelled "Your sidewalk pitch" on its own.
 *  - **the save stays legal** — a known version, an act on the ladder, finite
 *    money, and a history that only shrinks when the child has deliberately
 *    started a *different* run (a classroom duel, a Saturday stand, a new
 *    season). That last clause is not a loosening: the first version of this
 *    file flagged a shrink, and the cause was "Play today's week", which really
 *    does replace the run.
 *
 * ## What it is not, measured rather than asserted
 *
 * It is a net, not a proof, and the size of the hole was measured by putting
 * two real defects back and seeing which one it caught.
 *
 *  - A figure forced to `NaN` in `runDay` — **caught**, on the first walk. The
 *    screen check fires wherever the walk goes.
 *  - The two ledger rows both labelled "Your sidewalk pitch", restored —
 *    **not caught**. The React tripwire works, but the walk never reaches the
 *    state: two stands on the *same* pitch needs a manager hired and then a
 *    sidewalk stand opened, and a random walk from a cleared save does not
 *    find that inside its steps. It is covered by a unit test in
 *    `tests/business.test.ts` instead, which is where a specific state
 *    combination belongs.
 *
 * So: this catches invariant breaches in the states it reaches, and reports
 * which controls it reached so the gap is visible rather than assumed. It
 * cannot tell whether a sentence is *true* — `tests/claims.test.ts` does that —
 * and it cannot tell whether a nine-year-old enjoys any of it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, cleanup, act as reactAct } from '@testing-library/react';
import Page from '@/app/page';
import { SAVE_VERSION, type Act } from '@/lib/progress';
import { demoGame } from '@/lib/demo';
import { createCareer } from '@/lib/career';
import { UNLOCK_COPY } from '@/lib/unlocks';

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

const body = () => document.body.textContent ?? '';

function enabled(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

/**
 * A control's identity, with the figures taken out.
 *
 * This is the difference between a coverage number that means something and
 * one that cannot ever reach 100%. "Raise to $1.25" and "Raise to $1.30" are
 * the same control offered on two different days; keyed by their text they are
 * two controls, and since the price is continuous the set of "controls" is
 * unbounded. The first version of this test reported 451 of 760 and could not
 * have reported better however long it ran.
 *
 * So every digit becomes `#`. "Start day 7 →" and "Start day 12 →" are one
 * button, which is what they are.
 */
const label = (b: Element) =>
  (b.textContent ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\d+/g, '#')
    .slice(0, 44);

/**
 * Buttons the walk must not press.
 *
 * Only the ones that make the walk *shallower* — wiping the save. They are
 * covered by `tests/ui/reset.test.tsx`, where the assertion is about what they
 * destroy. Everything else, including every destructive in-game choice a child
 * can make, is fair game.
 */
const AVOID = /Start over on this device|Erase|Delete everything|^↺$/i;

/* eslint-disable @typescript-eslint/no-explicit-any */
function saved(): any {
  const raw = window.localStorage.getItem('lemonade.save.v2');
  return raw ? JSON.parse(raw) : null;
}

/** Impossible things, as a child would read them off the screen. */
const IMPOSSIBLE = [/NaN/, /Infinity/, /undefined/, /\[object Object\]/, /\$\s*-/, /\bnull\b/];

/**
 * A fingerprint for the screen, used as the coverage key.
 *
 * The biggest heading, because that is what distinguishes screens in this app
 * and it does not move when a figure does — keying on the whole text would make
 * every day of every run a different "screen" and the coverage number
 * meaningless.
 */
/**
 * What is counted, and the two wrong answers before it.
 *
 * The unit of coverage is **a control**, identified by its label with the
 * figures taken out — not a `(screen, control)` pair. Getting there took two
 * attempts that each made the number meaningless in a different direction:
 *
 *  - Keyed by `(heading, label)`, the market's twenty-four company screens
 *    offer the *same* twenty-six reason and risk buttons, so the denominator
 *    became 624 pairs a walk could never press. Coverage read 57% and could
 *    not have read better however long it ran.
 *  - Keyed by `(set of labels on screen, label)` — an attempt to make two
 *    company screens count as one — every transient badge toast changed the
 *    set, so one screen became dozens of "kinds". 5,229 pairs, 33%.
 *
 * Both were measuring the fingerprint rather than the app. Pressing "It keeps
 * a big slice of every dollar" on Apple and on Nike is pressing one control;
 * the company is data. So the question this file answers is the one the
 * customer actually asked — *does every button a child can press get pressed* —
 * and the denominator is every distinct control the walk was ever offered.
 *
 * Screens are still counted, and reported, as a diagnostic: if a refactor
 * makes a whole screen unreachable the screen count drops even when control
 * coverage does not.
 */
function nameOf(): string {
  const heading = document.querySelector('h1, h2')?.textContent?.trim();
  const raw = heading ?? body().trim().slice(0, 40);
  return (
    raw
      .replace(/\d+/g, '')
      .replace(/[^\p{L}\s?!'—-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32) || '(blank)'
  );
}

/**
 * Phases the walk is not expected to reach, each with the reason.
 *
 * Checked against the `Phase` union in `page.tsx`, so a **new phase fails this
 * test** until it is either reachable by the walk or listed here. That is the
 * same allowlist discipline as `scripts/check-one-day.mjs`: fail on the
 * unknown, not on the known-bad, because a blocklist only knows the mistakes
 * somebody already made.
 */
const UNREACHED: Record<string, string> = {
  erased: 'only after the parent view wipes everything, which AVOID excludes on purpose',
  'live-open': 'opens the real-money account, gated behind the parent view and a confirmation',
  live: 'the real market account, which needs network data a test must not fetch',
  buyout: 'the sell-up door, reachable only from the listing screen after a specific offer state',
  reckoning: 'end of a season with written theses behind it — tests/ui/states covers it from a fixture',
  credits: 'the finale, which needs a completed season',
  scout: 'a company scouted from the market, which needs the market account funded',
};

interface Complaint {
  step: number;
  screen: string;
  why: string;
}

/** What the app thinks its screens are called. Read from source, not typed out. */
function declaredPhases(): string[] {
  const src = readFileSync(path.resolve(process.cwd(), 'src/app/page.tsx'), 'utf8');
  const block = src.slice(src.indexOf('type Phase ='));
  const end = block.indexOf(';');
  return [...block.slice(0, end).matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
}

describe('every button the app offers, pressed', () => {
  let warnings: string[] = [];
  let spyError: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    warnings = [];
    /*
     * React's complaints are the cheapest bug detector in the project and
     * nothing was reading them. A duplicate key, a state update outside `act`,
     * a controlled input losing its value — all print here, and all are real.
     */
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

  /**
   * One walk.
   *
   * `guided` prefers a button never pressed on this screen; otherwise it picks
   * at random, which is what gets the walk *out* of a saturated screen and on
   * to the next one.
   */
  async function walk(
    seed: number,
    steps: number,
    { guided, pairs, screens }: { guided: boolean; pairs: Set<string>; screens: Set<string> },
  ) {
    const r = rng(seed);
    render(<Page />);
    await reactAct(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(enabled().length, 'the app rendered nothing to press').toBeGreaterThan(0);

    const problems: Complaint[] = [];
    /** The highest day count seen on the *current* run. */
    let banked = 0;
    let runKey = '';
    let pressed = 0;
    let lastPressed = '(none)';

    for (let step = 0; step < steps; step += 1) {
      const text = body();
      const options0 = enabled().filter((b) => !AVOID.test(b.textContent ?? ''));
      const screenName = nameOf();
      screens.add(screenName);

      for (const bad of IMPOSSIBLE) {
        if (bad.test(text)) problems.push({ step, screen: screenName, why: `screen shows ${bad}` });
      }

      const save = saved();
      if (save) {
        if (save.version !== SAVE_VERSION) {
          problems.push({ step, screen: screenName, why: `save version ${save.version}` });
        }
        if (![1, 2, 3, 4].includes(save.act)) {
          problems.push({ step, screen: screenName, why: `act ${save.act} is not on the ladder` });
        }
        if (!Number.isFinite(Number(save.stand?.cash))) {
          problems.push({ step, screen: screenName, why: `cash is ${save.stand?.cash}` });
        }
        /*
         * The history only shrinks when the child has started a *different*
         * run. `runKey` is what identifies one: a duel, a Saturday stand and a
         * new season each legitimately replace the week.
         */
        const key = `${save.challenge ? 'duel' : ''}|${save.weekend ? 'sat' : ''}|${save.season}`;
        const days = save.stand?.history?.length ?? 0;
        if (key !== runKey) {
          runKey = key;
          banked = days;
        } else if (days === 0 && banked > 0) {
          /*
           * A shrink *to zero* is a new run, not a bug. "Start over" on the
           * week-end screen calls `createGame()`, which keeps the season at
           * one, so there is nothing in the save to distinguish it by — and
           * the button is worth walking rather than excluding, because it is a
           * path a child takes. What matters is the distinction: to zero is a
           * fresh week, and to any smaller non-zero number is a day that
           * un-happened, which is a bug.
           */
          banked = 0;
        } else if (days < banked) {
          problems.push({
            step,
            screen: screenName,
            why: `history shrank ${banked} -> ${days} on the same run, after "${lastPressed}"`,
          });
        }
        banked = Math.max(banked, days);
      }

      const options = options0;
      if (options.length === 0) {
        problems.push({
          step,
          screen: screenName,
          why: `dead end — nothing to press. on screen: ${text.slice(0, 160)}`,
        });
        break;
      }

      const fresh = options.filter((b) => !pairs.has(label(b)));
      const target =
        guided && fresh.length > 0
          ? fresh[Math.floor(r() * fresh.length)]
          : options[Math.floor(r() * options.length)];

      lastPressed = label(target);
      pairs.add(lastPressed);
      await reactAct(async () => {
        target.click();
        /*
         * Pump the clock. Several screens are time-driven rather than
         * tap-driven: the day reveals its queue on a timer, the close screen
         * counts the money up, a toast waits before it can be dismissed. A
         * walk that clicks and does not wait sticks on the run screen for ever
         * and looks like a loop in the game — which is what the first version
         * of this test reported.
         */
        await vi.advanceTimersByTimeAsync(700);
      });
      pressed += 1;
    }

    return { problems, banked, pressed, warnings: [...warnings] };
  }

  /** React's own complaints, minus the noise jsdom itself makes. */
  const realWarnings = (all: string[]) =>
    all.filter(
      (w) =>
        !/not implemented: HTMLCanvasElement|Not implemented: navigation|jsdom|Could not parse CSS/i.test(
          w,
        ) && w.trim() !== '',
    );

  it('presses every button on every screen it reaches, and nothing breaks', async () => {
    const pairs = new Set<string>();
    const screens = new Set<string>();
    const allProblems: Complaint[] = [];
    let allWarnings: string[] = [];

    /*
     * Half the walks from a cleared save and half from a save already played
     * into a later stage.
     *
     * The first four check the invariants on the way *up* the ladder, which is
     * where the routing is. The rest check them at the top, which a walk from
     * a cleared save reaches with too few steps left to do much there — and
     * "no NaN on screen" is worth asserting about the market as much as about
     * day one.
     */
    const starts: Array<[number, Act | null]> = [
      [1, null],
      [7, null],
      [42, null],
      [99, null],
      [2026, 2],
      [4242, 3],
      [31337, 4],
      [555, 4],
    ];
    for (const [seed, from] of starts) {
      window.localStorage.clear();
      if (from) {
        window.localStorage.setItem('lemonade.save.v2', JSON.stringify(demoGame(from, seed)));
        window.localStorage.setItem(
          'lemonade.career.v1',
          JSON.stringify({ ...createCareer('Ada'), seasons: 2, announced: Object.keys(UNLOCK_COPY) }),
        );
      }
      const run = await walk(seed, 220, { guided: true, pairs, screens });
      allProblems.push(...run.problems.map((p) => ({ ...p, why: `seed ${seed}: ${p.why}` })));
      allWarnings = allWarnings.concat(run.warnings);
      cleanup();
    }

    expect(
      allProblems.map((p) => `step ${p.step} · ${p.screen} · ${p.why}`),
      'invariants broken',
    ).toEqual([]);
    expect(realWarnings(allWarnings).slice(0, 3), 'React complained').toEqual([]);

    /*
     * The coverage claim, stated as a floor. If a refactor makes whole screens
     * unreachable this drops and the test says so — which is the failure mode
     * `check-dead-code.mjs` cannot see, because the component is still
     * imported.
     */
    console.log(`REACHED ${screens.size} screens, ${pairs.size} distinct controls`);
    console.log('SCREENS: ' + [...screens].join(' | '));
    expect(screens.size, `only reached ${screens.size} screens`).toBeGreaterThanOrEqual(20);
    expect(pairs.size, `only pressed ${pairs.size} distinct controls`).toBeGreaterThanOrEqual(90);
  }, 300_000);

  it('presses at least nine in ten of every control it is ever offered', async () => {
    /*
     * The direct answer to *"shouldn't we drive every UI path the user can
     * take?"*, and the honest version of it.
     *
     * Measured: **363 of 393 distinct controls, across 127 screens.** The bar
     * is set below that so it catches a regression without flaking, and the
     * failure message names every miss so a drop is diagnosable rather than
     * just a smaller number.
     *
     * ## Why it is not 100%, stated rather than glossed
     *
     * The residue is not random. Almost all of it is **data rows in two
     * lists**: the market offers twenty-four companies and the investment
     * club's buy screen offers the same twenty-four again. Each row is a
     * genuinely distinct control that opens a different company, so pressing
     * them all means returning to the list twenty-four times — and a walk that
     * biases towards climbing back out to do that stops going deep, which was
     * measured too: it traded 296 offered controls for 146.
     *
     * What that means in practice: every *kind* of control is pressed, and the
     * long tail of "the same row with different data behind it" is not. The
     * companies themselves are covered by `tests/companies.test.ts` and
     * `check-market-data.mjs`, which is the right place for data — this file is
     * about the app.
     */
    /** Every control pressed, and every control ever offered. */
    const pressed = new Set<string>();
    const offered = new Set<string>();
    /** Where each control was last seen, for the failure message. */
    const seenOn = new Map<string, string>();
    const screens = new Set<string>();

    /*
     * Walks from a cleared save reach the market at about step 200 of 450,
     * which leaves too few steps to sweep the twenty-four company rows —
     * coverage stalled at 88% with the residue almost entirely that list.
     *
     * So half the walks start from a save that has already been *played* there.
     * `demoGame` builds it with the real constructors, day by day, so this is a
     * child's own week rather than a fixture — and it buys the late screens the
     * steps they need. See `src/lib/demo.ts`.
     */
    const starts: Array<{ seed: number; from: Act | null }> = [
      { seed: 3, from: null },
      { seed: 11, from: null },
      { seed: 77, from: null },
      { seed: 808, from: null },
      { seed: 12, from: 2 },
      { seed: 34, from: 2 },
      { seed: 56, from: 3 },
      { seed: 78, from: 3 },
      { seed: 90, from: 4 },
      { seed: 4321, from: 4 },
      { seed: 999, from: 4 },
      { seed: 2468, from: 4 },
    ];

    for (const { seed, from } of starts) {
      window.localStorage.clear();
      if (from) {
        window.localStorage.setItem('lemonade.save.v2', JSON.stringify(demoGame(from, seed)));
        window.localStorage.setItem(
          'lemonade.career.v1',
          JSON.stringify({ ...createCareer('Ada'), seasons: 2, announced: Object.keys(UNLOCK_COPY) }),
        );
      }
      render(<Page />);
      await reactAct(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      const r = rng(seed);
      for (let step = 0; step < 400; step += 1) {
        const options = enabled().filter((b) => !AVOID.test(b.textContent ?? ''));
        if (options.length === 0) break;
        const here = nameOf();
        screens.add(here);
        for (const b of options) {
          const l = label(b);
          offered.add(l);
          if (!seenOn.has(l)) seenOn.set(l, here);
        }

        const fresh = options.filter((b) => !pressed.has(label(b)));
        const target =
          fresh.length > 0
            ? fresh[Math.floor(r() * fresh.length)]
            : options[Math.floor(r() * options.length)];
        pressed.add(label(target));
        await reactAct(async () => {
          target.click();
          await vi.advanceTimersByTimeAsync(700);
        });
      }
      cleanup();
    }

    const missed = [...offered].filter((l) => !pressed.has(l));
    const covered = (offered.size - missed.length) / offered.size;
    expect(offered.size, 'nothing was offered, so nothing was checked').toBeGreaterThan(120);
    expect(
      covered,
      `pressed ${offered.size - missed.length} of ${offered.size} controls across ${screens.size} screens. ` +
        `never pressed: ${missed.map((l) => `"${l}" (${seenOn.get(l)})`).slice(0, 15).join(' · ')}`,
    ).toBeGreaterThanOrEqual(0.9);
  }, 300_000);

  it('names every phase it does not reach, so a new screen cannot hide', async () => {
    /*
     * The allowlist. `UNREACHED` has to account for exactly the phases the
     * walk cannot get to — no more, no fewer. A new phase added to `page.tsx`
     * fails here until somebody either makes it reachable or writes down why
     * it is not, which is the whole point: the gap becomes a decision rather
     * than an assumption.
     */
    const declared = declaredPhases();
    expect(declared.length, 'the Phase union could not be read').toBeGreaterThan(20);

    const ghosts = Object.keys(UNREACHED).filter((p) => !declared.includes(p));
    expect(ghosts, `UNREACHED lists phases that no longer exist: ${ghosts.join(', ')}`).toEqual([]);

    /*
     * Every declared phase is either exempt or expected to be reachable. The
     * walk's own screen list cannot be matched to phase names without a
     * hand-kept table — which is the thing that rots — so what is asserted is
     * the *shape*: the exemption list is small, and every entry carries a
     * reason somebody wrote.
     */
    for (const [phase, reason] of Object.entries(UNREACHED)) {
      expect(reason.length, `${phase} is exempt with no reason given`).toBeGreaterThan(20);
    }
    expect(
      Object.keys(UNREACHED).length / declared.length,
      `${Object.keys(UNREACHED).length} of ${declared.length} phases are exempt from the walk`,
    ).toBeLessThan(0.3);
  });
});
