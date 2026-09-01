'use client';

import type { Insight } from '@/lib/simulation';
import { ChunkyButton, SignHeading, Sky } from '../ui';

/**
 * A word being handed over.
 *
 * This is the moment the first build was missing. The kid had already done the
 * arithmetic — price divided by weekly profit, weeks until you have your money
 * back — and was never told that the thing they had just worked out is called a
 * P/E ratio. So they could do it and could not say it, which means they could
 * not discuss it, defend it, or be corrected on it.
 *
 * The evidence line is always their own numbers, so the word arrives attached
 * to something that actually happened to them rather than to a definition.
 */
export function WordCard({
  insight,
  remaining,
  onDone,
}: {
  insight: Insight;
  /** How many more are queued, so the button can say what it does. */
  remaining: number;
  onDone: () => void;
}) {
  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink/50">
          New word
        </div>
        <div aria-hidden className="mt-1 animate-bubble-pop text-5xl">
          📚
        </div>
        <SignHeading className="mt-2 text-4xl">{insight.term}</SignHeading>

        <div className="mt-5 w-full rounded-2xl border-[3px] border-ink/20 bg-white p-4 text-left shadow-lg">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
            What you just did
          </div>
          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/80">
            {insight.evidence}
          </p>
          <div className="mt-3 border-t-2 border-dashed border-ink/15 pt-2">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
              Why it matters
            </div>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/70">
              {insight.carriesForward}
            </p>
          </div>
        </div>

        <ChunkyButton variant="lemon" full className="mt-6" onClick={onDone}>
          {remaining > 0 ? `Next word (${remaining} more) →` : 'Got it →'}
        </ChunkyButton>
      </div>
    </Sky>
  );
}
