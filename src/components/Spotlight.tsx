'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CoachStep } from '@/lib/coach';
import { PipSays } from './Pip';

/**
 * Everything dims except the one thing being talked about.
 *
 * Built as **four panels around the target** rather than one overlay with a
 * hole in it. That is not a styling preference:
 *
 * - The target is never covered, so it stays tappable with no
 *   `pointer-events` trickery. PRODUCT.md §50 records 1,887 false positives
 *   from an auditor that could not tell a pointer-transparent overlay from a
 *   real one, and the badge toast that swallowed taps on the button
 *   underneath it (§44) was exactly this bug shipped.
 * - A child who ignores the words and taps the highlighted thing gets what
 *   they expected. The tour is then over, because they have learned the only
 *   thing it was trying to teach.
 *
 * `Pip.tsx` is explicit that a mascot must never stand between a kid and the
 * button they were reaching for. A spotlight is the one shape that obeys that
 * while still insisting: it does not cover the button, it removes everything
 * that is not the button.
 */
export function Spotlight({
  step,
  stepNumber,
  total,
  onNext,
  onSkip,
}: {
  step: CoachStep;
  stepNumber: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [box, setBox] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    const element = document.querySelector(`[data-coach="${step.target}"]`);
    setBox(element ? element.getBoundingClientRect() : null);
  }, [step.target]);

  useEffect(() => {
    /*
     * Measured after paint, not during. The plan screen sizes its scene from
     * flex and viewport units, so a rect read in the same frame as the mount
     * is a rect from before layout settled.
     */
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [measure]);

  /*
   * No target, no spotlight.
   *
   * A tour step that points at something which is not on screen must show
   * nothing at all rather than dim the whole screen with a bubble floating on
   * it. `tests/ui/coach.test.tsx` asserts every step has a target so this is
   * a guard rather than a normal path — but it is the difference between a
   * missing hint and an unplayable screen.
   */
  if (!box || box.width === 0) return null;

  const pad = 8;
  const top = Math.max(0, box.top - pad);
  const left = Math.max(0, box.left - pad);
  const right = box.right + pad;
  const bottom = box.bottom + pad;

  const dim = 'fixed bg-ink/75 transition-opacity';
  /* Below the target's own ring, above the screen it is dimming. */
  const layer = { zIndex: 60 } as const;

  /** Enough room under the target for a two-line bubble, or go above it. */
  const below = window.innerHeight - bottom > 132;

  return (
    <>
      {/* The four panels. Together they cover everything but the target. */}
      <button
        type="button"
        aria-label="Skip the tour"
        onClick={onSkip}
        className={`${dim} inset-x-0 top-0`}
        style={{ ...layer, height: top }}
      />
      <button
        type="button"
        aria-label="Skip the tour"
        onClick={onSkip}
        className={`${dim} inset-x-0 bottom-0`}
        style={{ ...layer, top: bottom }}
      />
      <button
        type="button"
        aria-label="Skip the tour"
        onClick={onSkip}
        className={`${dim} left-0`}
        style={{ ...layer, top, height: bottom - top, width: left }}
      />
      <button
        type="button"
        aria-label="Skip the tour"
        onClick={onSkip}
        className={`${dim} right-0`}
        style={{ ...layer, top, height: bottom - top, left: right }}
      />

      {/* The ring. Pointer-transparent, so it cannot eat the tap it is
          drawing attention to — the §44 mistake, not repeated. */}
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-2xl border-[3px] border-lemon ring-4 ring-lemon/40"
        style={{
          zIndex: 61,
          top,
          left,
          width: right - left,
          height: bottom - top,
        }}
      />

      {/* Pip, beside the thing rather than over it. */}
      <div
        className="fixed px-4"
        style={{
          zIndex: 62,
          left: 0,
          right: 0,
          ...(below ? { top: bottom + 10 } : { top: Math.max(8, top - 118) }),
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <PipSays lines={step.lines} point={below ? 'up' : 'down'} onDismiss={onNext} />
          <div className="mt-1 flex items-center justify-between px-1">
            <span className="font-body text-[11px] font-extrabold text-white/70">
              {stepNumber} of {total}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="flex min-h-11 items-center font-body text-[11px] font-extrabold text-white/70 underline"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
