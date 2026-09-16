/** @vitest-environment jsdom */
/**
 * Which screens give a child only one thing to press.
 *
 * ## What this is, and what it is honestly not
 *
 * PRODUCT.md §78's last item: **nothing here measures whether it is any good.**
 * That is still true, and two attempts at measuring a neighbour of it failed
 * before this one worked, which is worth recording because both failures are
 * the same mistake in different clothes.
 *
 *  - *Taps to the first decision, and words read before it.* Both came out at
 *    **zero** — the title screen offers five things, so the first screen is
 *    already a choice. A metric that is zero on every run is not a bound, it is
 *    a decoration.
 *  - *The share of screens offering a choice.* 95% to 100%, because "choice"
 *    was read off the DOM as "two or more enabled buttons" and the day screen's
 *    customer faces count. Measuring the fingerprint rather than the app, which
 *    is the same error the soak's coverage number made twice.
 *
 * What survived is narrower and does not depend on guessing what a decision is:
 * **a screen with exactly one thing to press is an interstitial.** It might be
 * a good one — a word card, a badge — but it is a page of a book rather than a
 * move in a game, and a run of them is where a child puts the phone down. §71
 * found exactly that by hand: four unlock cards between a child and their
 * second day, each with one "Got it", three of which got cut.
 *
 * So this is an **allowlist over screen kinds**, the same discipline as
 * `check-one-day.mjs`: every screen that only ever offers one control has to be
 * named below with the reason it is allowed to. A new one fails until somebody
 * says why — which is the check §71's opening never had.
 *
 * ## What it measured
 *
 * Five walks — a cleared save twice, then each of the three later stages — 750
 * taps across **36 screen kinds**. Five of those kinds only ever offer one
 * thing to press, every one of them a card: two verdicts on a choice already
 * made, and the live screen's two honest "nothing has happened" states. Word
 * cards are read off `GLOSSARY` rather than listed, so a new word needs no
 * entry and a new *screen* does. **13% of taps** land on a one-control screen,
 * and the opening from a cleared save reaches a decision before the fourth.
 *
 * It cannot tell whether a game that is fluent and varied is dull. Nothing can.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act as reactAct } from '@testing-library/react';
import Page from '@/app/page';
import { demoGame } from '@/lib/demo';
import { createCareer } from '@/lib/career';
import { UNLOCK_COPY } from '@/lib/unlocks';
import type { Act } from '@/lib/progress';
import { GLOSSARY } from '@/lib/glossary';
import { enabled, FURNITURE, nameOf } from './screen';

/**
 * Controls that are on screen whatever is happening.
 *
 * They are not what a child came for, so a screen offering nothing but these
 * is still an interstitial — and a screen offering one real control plus the
 * sound toggle is not a choice between them.
 */

/**
 * Everything on this screen a child can act on.
 *
 * Buttons **and sliders and pickers**, which the first version missed — the
 * lemon-buying screen sets the batch with an `<input type="range">`, so
 * "How much can you make?" looked like a screen with one control on it and was
 * about to be written into an allowlist as a card. Counting only `<button>`
 * measures the markup rather than the decision.
 */
function realControls(): Element[] {
  const pressable = enabled().filter((b) => !FURNITURE.test((b.textContent ?? '').trim()));
  const dials = [...document.querySelectorAll('input[type="range"], select')].filter(
    (el) => !(el as HTMLInputElement).disabled,
  );
  return [...pressable, ...dials];
}

/** The same screen fingerprint the soak uses, for the same reason. */

/**
 * Screens that legitimately offer one thing, and why.
 *
 * Each is a card whose whole content is the thing being said: a word earned, a
 * trophy, a feature arriving. One button is correct for those — the alternative
 * is a fake choice — and the check that matters is not "are there any" but "is
 * there a **run** of them", which is the second assertion below.
 */
const WEEK_REPORT =
  'the week of the market that just passed — `WeekReportScreen` takes only `onContinue`, and the buying and selling it is about happens on the market screen next. Its own note: "we name what happened and ask the only useful question, without telling them what to do about it"';

const ALLOWED_INTERSTITIALS: Record<string, string> = {
  'That was the best deal': 'the verdict on a decision already made; the choosing happened on the screen before',
  'Your money grew': WEEK_REPORT,
  'Your money dipped': WEEK_REPORT,
  /*
   * Both of these became reachable when the demo shortcut moved onto the title
   * screen (§86) — a walk that can reset to any stage meets screens a walk
   * that passes through each stage once does not. Neither is new and neither
   * is a defect; they had simply never been caught in a one-control state.
   */
  Friends:
    "the unlock card announcing the Friends feature — `unlocks.ts` titles it 'Friends' and its only control is `Got it →`. A feature arriving is the second kind of card named in the note above",
  'How are we doing':
    'the club\'s two leaderboards. A readout, and deliberately two of them: money made and reasoning that held up are different things and the gap between them is the lesson. The deciding happens in proposing and voting, on the screens before',
};

/**
 * Headings that are one screen, so the "no unused entry" check below is
 * satisfied by seeing either of them.
 *
 * `WeekReportScreen`'s heading is `up ? 'Your money grew' : 'Your money dipped'`
 * — two strings, one component, one `onContinue`. Screens are keyed here by
 * their heading, which is the right granularity nearly everywhere and the wrong
 * one here: a walk that happens to meet only the falling week would otherwise
 * be told it has a stale allowlist entry, and the honest fix is to say the two
 * headings are the same screen rather than to justify each separately.
 */
const SAME_SCREEN: string[][] = [['Your money grew', 'Your money dipped']];

/**
 * Allowed, and outside the reach of these walks, with where each is asserted.
 *
 * Kept separate from the list above so the "no unused entry" check can hold the
 * walkable ones to account without excusing the rest. A screen nobody can reach
 * from here needs a home, and saying which is the difference between an
 * exemption and a shrug.
 */
const ALLOWED_ELSEWHERE: Record<string, string> = {
  'Look at the numbers':
    "the deal board's other verdict, shown when the child picks the wrong stand — tests/ui/states.test.tsx renders both",
  'Nothing has happened yet':
    'the live account with no new prices, which needs an account these walks never open — tests/ui/live.test.tsx',
  'The prices are stuck':
    'the same screen with a dead data feed, which needs the clock moved — tests/ui/live.test.tsx',
};

/**
 * A word card is named after its word, so it needs no entry of its own.
 *
 * Read off `GLOSSARY` rather than listed, or every new word would need a line
 * in the allowlist above and the allowlist would stop being read. A word card
 * genuinely has one thing to press: the word is the content, and a second
 * button would be a fake choice about it.
 */
const WORDS = new Set(GLOSSARY.map((entry) => entry.word));

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

const AVOID = /Start over on this device|Erase|Delete everything|^↺$/i;

interface Seen {
  /**
   * The **most** real controls this screen kind ever offered.
   *
   * Most, not fewest, and the difference is the whole metric. Keyed on the
   * fewest, the lemon-buying screen counted as an interstitial — its steppers
   * disable when there is no money, so it *can* show one control without ever
   * being a card. "Only ever offers one thing" is a statement about the
   * maximum.
   */
  most: Map<string, number>;
  interstitialTaps: number;
  taps: number;
}

describe('every screen gives a child something to decide, or says why not', () => {
  let spyError: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    spyError.mockRestore();
    spyWarn.mockRestore();
    cleanup();
    vi.useRealTimers();
  });

  /**
   * A coverage-guided walk, like the soak's.
   *
   * Not a walk that always takes the first control: that was tried, and it
   * pressed the price screen's "−" forty times in a row and never finished a
   * day. A first-control walk is not a model of a child, it is a model of a
   * loop.
   */
  async function walk(seed: number, steps: number, from: Act | null, into: Seen) {
    window.localStorage.clear();
    if (from) {
      window.localStorage.setItem('lemonade.save.v2', JSON.stringify(demoGame(from, seed)));
      window.localStorage.setItem(
        'lemonade.career.v1',
        JSON.stringify({ ...createCareer('Ada'), seasons: 2, announced: Object.keys(UNLOCK_COPY) }),
      );
    }
    const r = rng(seed);
    render(<Page />);
    await reactAct(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const pressedHere = new Map<string, Set<string>>();

    for (let tap = 0; tap < steps; tap += 1) {
      const screen = nameOf();
      const options = realControls().filter((b) => !AVOID.test(b.textContent ?? ''));

      into.most.set(screen, Math.max(into.most.get(screen) ?? 0, options.length));
      into.taps += 1;
      if (options.length <= 1) into.interstitialTaps += 1;

      const all = enabled().filter((b) => !AVOID.test(b.textContent ?? ''));
      if (all.length === 0) break;
      const seenHere = pressedHere.get(screen) ?? new Set<string>();
      pressedHere.set(screen, seenHere);
      const key = (b: Element) => (b.textContent ?? '').trim().replace(/\d+/g, '#');
      const fresh = all.filter((b) => !seenHere.has(key(b)));
      const target = fresh.length > 0 ? fresh[Math.floor(r() * fresh.length)] : all[Math.floor(r() * all.length)];
      seenHere.add(key(target));
      await reactAct(async () => {
        target.click();
        await vi.advanceTimersByTimeAsync(700);
      });
    }
    cleanup();
  }

  async function walkEverything(): Promise<Seen> {
    const into: Seen = { most: new Map(), interstitialTaps: 0, taps: 0 };
    for (const [seed, from] of [
      [1, null],
      [7, null],
      [2026, 2],
      [4242, 3],
      [31337, 4],
    ] as Array<[number, Act | null]>) {
      await walk(seed, 150, from, into);
    }
    return into;
  }

  it('names every screen that only ever offers one thing', async () => {
    const seen = await walkEverything();
    const interstitials = [...seen.most]
      .filter(([, most]) => most <= 1)
      .map(([screen]) => screen)
      .filter(
        (screen) =>
          !(screen in ALLOWED_INTERSTITIALS) &&
          !(screen in ALLOWED_ELSEWHERE) &&
          !WORDS.has(screen),
      );

    console.log(
      `ENGAGEMENT ${seen.most.size} screen kinds, ${seen.taps} taps, ` +
        `${[...seen.most].filter(([, m]) => m <= 1).length} kinds that only ever offer one ` +
        `thing, ${Math.round((seen.interstitialTaps / seen.taps) * 100)}% of taps on one`,
    );
    console.log('ONE-CONTROL KINDS: ' + [...seen.most].filter(([, m]) => m <= 1).map(([k]) => k).join(' | '));
    expect(seen.most.size, 'the walk reached almost nothing').toBeGreaterThan(15);
    expect(
      interstitials,
      'these screens only ever gave a child one thing to press. Either give them a ' +
        'decision or add them to ALLOWED_INTERSTITIALS with the reason they are a card',
    ).toEqual([]);
  }, 300_000);

  it('does not open with a run of cards before the first decision', async () => {
    /*
     * The assertion §71's opening would have failed: four unlock cards between
     * a child and their second day, each with one "Got it", three of which were
     * cut by hand with nothing to stop them coming back.
     *
     * Measured on the **opening** rather than on the longest run anywhere,
     * because a random walk's longest run is a fact about the walk. Asked for
     * the longest run of one-button screens anywhere, the first version of this
     * answered thirteen — and the thirteen were the walk opening the projection
     * sheet, closing it, and opening it again. The opening from a cleared save
     * is a real path that every child takes exactly once.
     */
    window.localStorage.clear();
    render(<Page />);
    await reactAct(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const opening: string[] = [];
    for (let tap = 0; tap < 12; tap += 1) {
      const options = realControls().filter((b) => !AVOID.test(b.textContent ?? ''));
      if (options.length > 1) break;
      opening.push(nameOf());
      /*
       * A slider cannot be "pressed" onwards, so the opening walk takes the
       * button. There is no slider in the opening anyway — the first one is on
       * the lemon screen, which is past the first decision.
       */
      const target =
        (options.find((el) => el instanceof HTMLButtonElement) as HTMLButtonElement | undefined) ??
        enabled().find((b) => !AVOID.test(b.textContent ?? ''));
      if (!target) break;
      await reactAct(async () => {
        target.click();
        await vi.advanceTimersByTimeAsync(700);
      });
    }
    expect(
      opening.length,
      `${opening.length} screens before the first decision: ${opening.join(' → ')}`,
    ).toBeLessThan(4);
  }, 120_000);

  it('spends most of the taps on screens that offer a decision', async () => {
    /*
     * The share, stated as a ceiling on the interstitial half rather than as a
     * floor on "choices" — because a choice cannot be read off the DOM and
     * pretending otherwise is what made the first version of this file report
     * 100% and mean nothing.
     */
    const seen = await walkEverything();
    const share = seen.interstitialTaps / seen.taps;
    /*
     * Loosely bounded on purpose, and the looseness is the honest part: this
     * depends on where the walk goes, and a coverage-guided walk deliberately
     * revisits screens a child would pass through once. Measured at 14%; the
     * bound is a third, which is where the app would have to have turned into a
     * presentation for it to fail.
     */
    expect(share, `${Math.round(share * 100)}% of taps were on a one-button screen`).toBeLessThan(0.34);
  }, 300_000);

  it('has no allowlist entry it does not need', async () => {
    /*
     * The same discipline `tests/claims.test.ts` applies to its shape registry.
     * An entry for a screen that no longer offers one control — or no longer
     * exists — is a line nobody will read again, and a list of those is how the
     * next real one gets waved through.
     *
     * This found one immediately. `(blank)` was in the list, described as "the
     * first frame before hydration", and it was there because `nameOf` fell back
     * to `document.body.innerText` — which jsdom leaves `undefined`. So every
     * heading-less screen was named `(blank)` and excused by one entry. With
     * `textContent` the walk sees 49 screen kinds instead of 37, and `(blank)`
     * never appears.
     *
     * The two live-market entries are exempt from this check rather than
     * deleted: that screen needs either an empty account or a dead data feed,
     * and the walk reaches neither. They are asserted directly in
     * `tests/ui/live.test.tsx`.
     */
    const seen = await walkEverything();
    const oneControl = new Set(
      [...seen.most].filter(([, most]) => most <= 1).map(([screen]) => screen),
    );
    const sawScreen = (screen: string) =>
      (SAME_SCREEN.find((group) => group.includes(screen)) ?? [screen]).some((heading) =>
        oneControl.has(heading),
      );
    const unused = Object.keys(ALLOWED_INTERSTITIALS).filter((screen) => !sawScreen(screen));
    expect(unused, 'allowed as a card, but the walk never saw it offer one control').toEqual([]);

    /* And the out-of-reach ones have to say where they are asserted instead. */
    for (const [screen, why] of Object.entries(ALLOWED_ELSEWHERE)) {
      expect(why, `${screen} is exempt with no reason`).toMatch(/tests\//);
    }
  }, 300_000);
});