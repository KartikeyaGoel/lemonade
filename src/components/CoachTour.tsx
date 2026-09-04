'use client';

import { useEffect, useState } from 'react';
import { stepAt, type Tour } from '@/lib/coach';
import { Spotlight } from './Spotlight';

/**
 * One first-run tour, start to finish.
 *
 * Extracted when the second stage needed one. The state is small — which step,
 * and whether it is over — but it has two subtleties that were each a bug
 * before they were a comment, and writing them out four times would be four
 * chances to get them wrong:
 *
 * 1. **Started by an effect, not by initial state.** `run` is false while a
 *    badge is still waiting to be tapped, and becomes true once the queue
 *    drains — after this component has mounted. Reading it once meant a child
 *    who earned a badge never saw the tour at all (PRODUCT.md §57).
 * 2. **`run` going false ends the tour for good, and reports it.** That is how
 *    a screen says "they just did the thing I was about to explain" — tapping
 *    the highlighted control *is* the lesson landing, and carrying on would be
 *    a mascot talking over a child who already understood.
 */
export function CoachTour({
  tour,
  run,
  onDone,
}: {
  tour: Tour;
  /** True while the tour should be showing. Going false ends it. */
  run: boolean;
  /** Called exactly once, whether it was completed or cut short. */
  onDone: () => void;
}) {
  const [step, setStep] = useState(-1);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (run && !over && step < 0) setStep(0);
  }, [run, over, step]);

  useEffect(() => {
    // Cut short: the child acted before the tour finished talking.
    if (step >= 0 && !run) {
      setOver(true);
      setStep(-1);
      onDone();
    }
  }, [run, step, onDone]);

  const current = stepAt(tour, step);
  if (step < 0 || !current) return null;

  const finish = () => {
    setOver(true);
    setStep(-1);
    onDone();
  };

  return (
    <Spotlight
      step={current}
      stepNumber={step + 1}
      total={tour.steps.length}
      onNext={() => {
        const next = step + 1;
        if (stepAt(tour, next)) setStep(next);
        else finish();
      }}
      onSkip={finish}
    />
  );
}
