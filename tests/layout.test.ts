/**
 * Two layout rules, held as source facts rather than as screenshots.
 *
 * Both of these were real defects found by measuring a running browser, and
 * both are invisible to every other test in this suite: the components render,
 * the numbers are right, and a person looking at a screenshot sees a gradient
 * doing what gradients do. What they cannot see is that the last row of the
 * week's prices was 47 pixels under the bar with 2 pixels of scroll to reach
 * it.
 *
 * A grep is a blunt instrument for a layout rule. It is also the only one that
 * runs on every commit, and the alternative — finding this again by hand on
 * the twelfth screen somebody adds — is what already happened twice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
  });
}

/*
 * `src` rather than `src/components`, because the screen that mattered most
 * was not in `components` at all: `app/error.tsx` is the crash screen, and its
 * "or go back to the start" was the smallest tap target in the product — the
 * escape hatch on the one screen a child reaches when everything else has
 * already failed.
 */
const files = walk(SRC).map((path) => ({
  path: path.slice(path.indexOf('src')),
  src: readFileSync(path, 'utf8'),
}));

describe('a screen with a bar pinned to the bottom', () => {
  /*
   * `PinnedBar` measures itself and publishes the height. Anything hand-rolled
   * cannot, so its content has to be padded by a guess — and the guess was
   * wrong on eleven screens at once, because a bar with two stacked buttons is
   * 182 pixels and `pb-28` is 112.
   */
  it('uses PinnedBar rather than pinning a div itself', () => {
    const offenders = files
      .filter(({ src, path }) => src.includes('fixed inset-x-0 bottom-0') && !path.endsWith('ui.tsx'))
      // The badge toast is a genuine exception: it is not a bar, it must not
      // publish a height, and it deliberately does not capture pointer events.
      .filter(({ path }) => !path.endsWith('BadgeToast.tsx'))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  /*
   * And having measured it, the content has to actually use the measurement.
   * A screen that renders a `PinnedBar` and still pads itself with a `pb-2x`
   * has the bug back.
   */
  it('pads its content by the measured height, not a number somebody picked', () => {
    const offenders = files
      .filter(({ src }) => src.includes('<PinnedBar'))
      .filter(({ src }) => !src.includes('clearsBar'))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it('has no leftover guessed bottom padding on those screens', () => {
    const offenders = files
      .filter(({ src }) => src.includes('<PinnedBar'))
      .flatMap(({ src, path }) => {
        // Only real classes, not the words in the comments explaining this.
        const classes = [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
        const guessed = classes.filter((c) => /\bpb-(2[0-9]|3[0-9])\b/.test(c));
        return guessed.map((c) => `${path}: ${c.match(/\bpb-\d+\b/)?.[0]}`);
      });
    expect(offenders).toEqual([]);
  });
});

describe('tap targets', () => {
  /*
   * Not a blanket 44-pixel rule: a row of five navigation chips is legitimately
   * 38, and WCAG 2.5.8 asks for 24. This catches the band where a control stops
   * being pressable by a nine-year-old — a `py-0.5` chip is 24 tall and the two
   * worst offenders were the escape hatch on the crash screen and the way out
   * of a decision about money.
   *
   * A button with an explicit height is exempt: that is the fix.
   */
  it('never sets a button to less than about 30 pixels tall', () => {
    const offenders: string[] = [];
    for (const { src, path } of files) {
      for (const m of src.matchAll(/<button\b[\s\S]{0,700}?>/g)) {
        const tag = m[0];
        const cls = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
        if (!cls) continue;
        const c = cls[1] ?? cls[2] ?? '';
        if (/\bh-(?:1[01]|1[2-9]|2[0-9]|full)\b/.test(c)) continue;
        const vertical = [...c.matchAll(/\b(?:py|p)-([\d.]+)\b/g)].map((x) => Number(x[1]));
        if (vertical.length === 0) continue;
        // Tailwind's scale is 4px per unit; a 12px label plus 2 x py-1 is 28.
        if (Math.min(...vertical) <= 1) offenders.push(`${path}: py-${Math.min(...vertical)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
