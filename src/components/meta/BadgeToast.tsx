'use client';

import { useEffect } from 'react';
import type { Badge } from '@/lib/achievements';
import { play } from '@/lib/sound';

/** Long enough to read two lines, short enough not to be in the way. */
const DISMISS_AFTER_MS = 5000;

/**
 * A badge landing.
 *
 * Deliberately a toast rather than a full screen: badges are frequent, and a
 * modal for each would turn the day loop into a slideshow.
 *
 * It sits at the *bottom* for a reason found by playing it. Anchored to the top
 * it covered the day's headline profit — the reward hiding the result it was
 * given for, which is the same mistake as putting an unlock card in front of the
 * profit and loss. The reward goes underneath.
 *
 * One at a time, also found by playing it. Day one earns two badges and the day
 * loop earns a word at the same moment; showing all of them stacked buried the
 * profit and loss under three yellow cards, which is precisely the "too much at
 * once" failure the unlock gates exist to prevent. A queue of one, dismissed by
 * tapping, keeps the reward and drops the pile.
 *
 * How it goes away needs to be obvious, so it does all three: it slides out on
 * its own after five seconds, it says "tap to close", and tapping anywhere on it
 * closes it. Without the label the only two ways out were waiting and guessing.
 */
export function BadgeToast({
  badges,
  onDismiss,
  raised,
}: {
  badges: Badge[];
  onDismiss: () => void;
  /**
   * Lift it clear of a screen whose primary button is pinned to the bottom.
   * On the planning screen the toast landed squarely on "Open the stand!",
   * which turns a reward into an obstacle.
   */
  raised?: boolean;
}) {
  const badge = badges[0];

  useEffect(() => {
    if (!badge) return;
    play('badge');
    const timer = window.setTimeout(onDismiss, DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [badge, onDismiss]);

  if (!badge) return null;

  const waiting = badges.length - 1;

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-3 text-left ${
        raised ? 'pb-32' : 'pb-3'
      }`}
    >
      <div className="space-y-1.5">
        <div
          key={badge.id}
          className="animate-bubble-pop rounded-2xl border-[3px] border-ink/25 bg-lemon p-3 shadow-2xl"
        >
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-2xl leading-none">
              {badge.emoji}
            </span>
            <div className="min-w-0">
              <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
                Badge earned
              </div>
              <div className="font-sign text-xl leading-tight text-ink">{badge.name}</div>
              <div className="mt-0.5 font-body text-[11px] font-bold leading-tight text-ink/65">
                {badge.proves}
              </div>
            </div>
          </div>
        </div>
        <div className="text-center font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
          {waiting > 0 ? `Tap to close · ${waiting} more waiting` : 'Tap to close'}
        </div>
      </div>
    </button>
  );
}
