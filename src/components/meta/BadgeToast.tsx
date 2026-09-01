'use client';

import { useEffect } from 'react';
import type { Badge } from '@/lib/achievements';

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
 * How it goes away needs to be obvious, so it does all three: it slides out on
 * its own after five seconds, it says "tap to close", and tapping anywhere on it
 * closes it. Without the label the only two ways out were waiting and guessing.
 */
export function BadgeToast({
  badges,
  onDismiss,
}: {
  badges: Badge[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (badges.length === 0) return;
    const timer = window.setTimeout(onDismiss, DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [badges, onDismiss]);

  if (badges.length === 0) return null;

  const shown = badges.slice(0, 3);
  const hidden = badges.length - shown.length;

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-3 pb-3 text-left"
    >
      <div className="space-y-2">
        {shown.map((badge) => (
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
        ))}
        {hidden > 0 && (
          <div className="rounded-2xl border-[3px] border-ink/20 bg-white/90 px-3 py-2 font-body text-[11px] font-extrabold text-ink/60">
            And {hidden} more in your trophy case.
          </div>
        )}
        <div className="text-center font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
          Tap to close
        </div>
      </div>
    </button>
  );
}
