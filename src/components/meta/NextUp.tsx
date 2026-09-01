'use client';

import type { NextThing } from '@/lib/progress';

/**
 * Three things worth trying next.
 *
 * This is the smallest, cheapest retention mechanic in the product and probably
 * the most effective one: a kid who closes the tab with nothing outstanding does
 * not come back. Every line is a locked badge that is reachable from where they
 * are standing right now — never a goal from an act they have not opened, which
 * would be a tease rather than a target.
 */
export function NextUp({
  things,
  onOpenTrophies,
}: {
  things: NextThing[];
  onOpenTrophies?: () => void;
}) {
  if (things.length === 0) return null;

  return (
    <div className="rounded-2xl border-[3px] border-ink/15 bg-white/85 p-3">
      <div className="flex items-baseline justify-between">
        <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink/45">
          Next up
        </div>
        {onOpenTrophies && (
          <button
            type="button"
            onClick={onOpenTrophies}
            className="font-body text-[11px] font-extrabold text-ink/50 underline"
          >
            trophy case
          </button>
        )}
      </div>
      <div className="mt-1.5 space-y-1.5">
        {things.map((thing) => (
          <div key={thing.title} className="flex items-start gap-2">
            <span aria-hidden className="text-base leading-tight">
              {thing.emoji}
            </span>
            <div>
              <div className="font-body text-[13px] font-extrabold leading-tight text-ink">
                {thing.title}
              </div>
              <div className="font-body text-[11px] font-bold leading-tight text-ink/55">
                {thing.how}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
