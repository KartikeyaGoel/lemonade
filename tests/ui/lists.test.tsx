/** @vitest-environment jsdom */
/**
 * Every row of every long list, opened in the real app.
 *
 * ## Why a walk cannot do this
 *
 * `tests/ui/soak.test.tsx` reports the share of controls it pressed, and that
 * number sat at 93% and then 95% as the walk got more starts. Asked whether it
 * could be pushed to 100%, the answer is no — **not because the walk is bad but
 * because the denominator moves.** `offered` is every control the walk was ever
 * shown, so exploring further finds more controls to press and the ratio chases
 * its own tail. Three backtracking policies were measured (95.2%, 93.5%, 90.3%)
 * against 95.0% for none; the best of them beat doing nothing by two tenths of
 * a point.
 *
 * And the residue was never varied: it is **the twenty-four company rows on the
 * club's buy screen and the market's shelf.** One list, twenty-four doors, each
 * behind several taps of navigation, each leading somewhere that offers nothing
 * new. A random walk reaches a few and wanders off.
 *
 * So this is not a walk. It is a **sweep**: the route to each list is scripted,
 * and then every row is opened, one per boot, and checked. Twenty-four of
 * twenty-four, twice, every run. Where a walk gives a ratio, this gives a count.
 *
 * ## Why the rows are worth opening rather than counted as data
 *
 * The soak's own note argues that a company row is data — "pressing *It keeps a
 * big slice of every dollar* on Apple and on Nike is pressing one control; the
 * company is data" — and for the buttons *inside* a company screen that is
 * right. For the rows themselves it is not, and the reason is in PRODUCT.md:
 *
 * > Chipotle split 50:1 in June 2024, so a 2023 week showed a price-to-earnings
 * > ratio of 1. The game told a kid that Chipotle earned back its whole share
 * > price in a single year.
 *
 * That defect lived in **one company's** numbers and rendered fine for the other
 * twenty-three. Opening every row is how a screen meets every set of real
 * figures it will ever be given, and the figures come from a feed that changes
 * every week.
 *
 * ## Measured against that shape of defect
 *
 * `metricsFor` was made to return a `NaN` price-to-earnings ratio for Crocs and
 * Crocs alone. Both sweeps go **red**, naming the row: *"🐊Crocs … opened a
 * screen showing /NaN/"*. Nothing else in the suite noticed.
 *
 * A weaker mutation is worth recording too, because it says something about the
 * code rather than the test: setting one company's share count to zero changed
 * nothing, because `metricsFor` already guards every division — `eps` is null
 * without shares and `pe` is null without positive earnings. The first attempt
 * at a mutation test found correct code, which is the good outcome and not a
 * failed experiment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act as reactAct } from '@testing-library/react';
import Page from '@/app/page';
import { demoGame } from '@/lib/demo';
import { createCareer } from '@/lib/career';
import { UNLOCK_COPY } from '@/lib/unlocks';
import { SNAPSHOT } from '@/lib/companies';

function enabled(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

/*
 * `textContent`, not `innerText`.
 *
 * jsdom does not implement `innerText` — it is `undefined`, not empty — so every
 * check reading it silently passed on nothing. The soak has always used
 * `textContent` and this file copied the wrong one.
 */
const body = () => document.body.textContent ?? '';

/** The same set the soak checks for, so the two files agree on "impossible". */
const IMPOSSIBLE = [/NaN/, /Infinity/, /undefined/, /\[object Object\]/, /\$\s*-/, /\bnull\b/];

/**
 * The scripted routes, which is the only part of this that could rot.
 *
 * Each step is matched against the button text, so a renamed button fails here
 * with the step that could not be found rather than silently sweeping nothing —
 * and the row count is asserted afterwards, so a route that lands on the wrong
 * screen cannot pass either.
 */
const LISTS = [
  {
    what: "the club's buy screen",
    /* Friends → the club → start it → propose. A club has to exist before it
       can buy anything, and starting one is a real thing a child does. */
    route: [/Friends/i, /Investment club/i, /Start the club/i, /Propose a buy/i],
    heading: /What should we buy\?/i,
    /** Rows are the company cards: an emoji, a name, and figures. */
    isRow: (text: string) => /P\/E \d|loses money/.test(text),
  },
  {
    what: "the market's shelf",
    route: [/The market/i, /Keep going/i],
    heading: /Businesses you could own|The market/i,
    isRow: (text: string) => /\dx profit|loses money/.test(text),
  },
];

describe('every row of every long list', () => {
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

  /** Boots a save that has reached the market, then follows a route. */
  async function arriveAt(route: RegExp[]): Promise<string[]> {
    window.localStorage.clear();
    window.localStorage.setItem('lemonade.save.v2', JSON.stringify(demoGame(4, 90)));
    window.localStorage.setItem(
      'lemonade.career.v1',
      JSON.stringify({ ...createCareer('Ada'), seasons: 2, announced: Object.keys(UNLOCK_COPY) }),
    );
    render(<Page />);
    await reactAct(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    const missing: string[] = [];
    for (const step of route) {
      const button = enabled().find((b) => step.test((b.textContent ?? '').trim()));
      if (!button) {
        missing.push(String(step));
        continue;
      }
      await reactAct(async () => {
        button.click();
        await vi.advanceTimersByTimeAsync(700);
      });
    }
    return missing;
  }

  for (const list of LISTS) {
    it(`opens every row of ${list.what}`, async () => {
      const missing = await arriveAt(list.route);
      expect(missing, `could not follow the route to ${list.what}`).toEqual([]);
      expect(body(), `the route did not land on ${list.what}`).toMatch(list.heading);

      const rows = enabled()
        .map((b) => (b.textContent ?? '').trim().replace(/\s+/g, ' '))
        .filter((text) => list.isRow(text));

      /*
       * Every company, not a sample. The count is asserted against `SNAPSHOT`
       * so adding a company to the data adds a row to this sweep — and so a
       * list that quietly renders eight of twenty-four fails here.
       */
      expect(rows.length, `${list.what} offered ${rows.length} rows`).toBe(SNAPSHOT.length);
      cleanup();

      const problems: string[] = [];
      let opened = 0;

      for (const row of rows) {
        warnings = [];
        const stillMissing = await arriveAt(list.route);
        if (stillMissing.length > 0) {
          problems.push(`route broke on the way to open "${row}"`);
          cleanup();
          continue;
        }
        const button = enabled().find(
          (b) => (b.textContent ?? '').trim().replace(/\s+/g, ' ') === row,
        );
        if (!button) {
          problems.push(`"${row}" was on the list once and not the second time`);
          cleanup();
          continue;
        }
        await reactAct(async () => {
          button.click();
          await vi.advanceTimersByTimeAsync(700);
        });
        opened += 1;

        const text = body();
        for (const bad of IMPOSSIBLE) {
          if (bad.test(text)) problems.push(`"${row}" opened a screen showing ${bad}`);
        }
        for (const complaint of real(warnings)) {
          problems.push(`"${row}": React said ${complaint.slice(0, 120)}`);
        }
        if (enabled().length === 0) problems.push(`"${row}" opened a dead end`);
        cleanup();
      }

      console.log(`LISTS opened ${opened} of ${rows.length} rows on ${list.what}`);
      expect(problems.slice(0, 5), `opening a row broke something`).toEqual([]);
      expect(opened, 'a row was never opened').toBe(rows.length);
    }, 300_000);
  }

  it('meets every company the data has, by name', async () => {
    /*
     * The count above could be satisfied by twenty-four copies of one row. This
     * checks the rows are the companies — every ticker in the snapshot appears
     * by name on the shelf, so a list that silently repeats or drops one fails.
     */
    const missing = await arriveAt(LISTS[1].route);
    expect(missing).toEqual([]);
    const text = body();
    const absent = SNAPSHOT.filter((company) => !text.includes(company.name));
    expect(absent.map((c) => c.ticker), 'companies in the data and not on the shelf').toEqual([]);
  }, 120_000);
});
