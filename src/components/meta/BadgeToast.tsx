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
export function BadgeToast({ badges, onDismiss }: { badges: Badge[]; onDismiss: () => void }) {
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
      /*
       * `pointer-events-none` on the frame, `auto` on the card, and this is the
       * half of the fix that actually mattered.
       *
       * The toast is a full-width fixed button whose bottom padding lifts the
       * card clear of the pinned action bar. Visually that worked. But the
       * padding is still part of the button, so it went on *swallowing taps* on
       * the bar underneath it — a child aiming at "Open the stand!" dismissed a
       * rosette instead and nothing happened. A reward that eats the primary
       * button is worse than one that merely sits on it, and it is invisible in
       * a screenshot: only hit-testing finds it.
       */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-3 text-left"
      /*
       * Clears whatever is pinned, read from the bar itself.
       *
       * The fallback is what this used to be: a flat 128 pixels, right for a
       * bar with one button in it and wrong the moment the planning screen
       * grew a second. `PinnedBar` publishes its real height, so a third
       * button changes the number without changing any code here.
       */
      /*
       * Clears whatever the screen has at the bottom of it, read from the
       * screen itself.
       *
       * This was a flag the caller passed — true for two named phases — and it
       * was wrong twice for the same reason: a list of screens kept somewhere
       * else has to be remembered, and it was not. It missed the yard, where a
       * rosette for opening a second stand landed on "Open up today", and it
       * missed the listing, where "Rang the bell" landed on "Trade a week as a
       * public company".
       *
       * `PinnedBar` and `ActionFooter` publish their own height, so a screen
       * with a bottom action is cleared whether or not anybody remembered it,
       * and a screen without one gets the low resting position from the
       * fallback. Nothing left to keep in sync.
       */
      style={{ paddingBottom: 'calc(var(--pinned-bar, 0.25rem) + 0.5rem)' }}
    >
      <div className="pointer-events-auto space-y-1.5">
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
