/**
 * How a walk reads the screen it is standing on.
 *
 * ## Why this file exists
 *
 * `tests/ui/soak.test.tsx` and `tests/ui/engagement.test.tsx` each had their
 * own `body`, `enabled` and `nameOf`, character-identical, and the engagement
 * copy carried a comment saying *"the same screen fingerprint the soak uses,
 * for the same reason"* — which was true only because nobody had yet changed
 * one of them. That is §75 exactly, in the one layer
 * `scripts/check-duplicates.mjs` was not scanning. It scans `tests/` now.
 *
 * It matters more here than in most places, because these two files report
 * *numbers* that get written into PRODUCT.md and compared across sessions. Two
 * fingerprints that drift apart would make the soak's screen count and the
 * engagement screen count quietly incomparable, and nothing would say so.
 */

/** Everything on the screen, as text. Excludes nothing; callers slice it. */
export const body = () => document.body.textContent ?? '';

/** Every button a child could press right now. */
export function enabled(): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(
    (b) => !(b as HTMLButtonElement).disabled,
  ) as HTMLButtonElement[];
}

/**
 * Controls that are on every screen and are not a decision.
 *
 * **A labelled back arrow is missing from this list and should be on it.**
 * `← Market` and `← Pick two others` are the way out of a screen, not a
 * decision on it, and because they are counted the company screen reads as
 * offering two controls when it offers one — *Buy DUOL* and the exit. Adding
 * `←\s*.*` here unmasks several screens at once, which is a piece of work
 * about what those screens should offer rather than about this regex, so it
 * is deliberately not being done inside an unrelated change. The measurement
 * that it unmasks is written down in PRODUCT.md §86.
 *
 * `Skip to a stage` is on the list because it is the demo door, on every title
 * screen, and is furniture in exactly the way `For a grown-up` is.
 */
export const FURNITURE =
  /^(🔊|🔇|↺|Back|Back →|←|For a grown-up.*|Skip to a stage|Turn sound (on|off)|Hide static indicator|Start over on this device)$/i;

/**
 * The name of the screen, for counting distinct ones.
 *
 * The heading, when there is one. A screen with no `h1` or `h2` falls back to
 * the first forty characters of its body text, and that fallback is a known
 * weakness rather than a design: it names one screen several times, because
 * the text it lands on is usually *data*. The head-to-head screen produced
 * `Pick two othersMcDonald'sCrocsNo`, `Pick two othersDisneyNvidiaNobod` and
 * so on — one screen, a new name per pair of companies, each seen once, each
 * therefore looking like a screen that only ever offered one thing.
 *
 * The fix for that is a heading on the screen, which is also what a screen
 * reader needs: the head-to-head screen has one now, and seven fictional
 * screen kinds became one real one. There is **no gate** yet that fails a
 * reachable screen with neither an `h1` nor an `h2`, which is the thing that
 * would stop this coming back — see PRODUCT.md §86 for what is known and what
 * is not.
 */
export function nameOf(): string {
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
