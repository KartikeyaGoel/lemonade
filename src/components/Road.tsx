'use client';

import { useState } from 'react';
import type { Stop } from '@/lib/journey';

/**
 * Four stops, one line, on the title screen from the very first launch.
 *
 * See `src/lib/journey.ts` for why this is a picture rather than a tab bar.
 * The short version: a kid who opens this app sees a lemonade stand and has no
 * idea a stock market is in it, and that is a motivation problem, not a
 * navigation problem. Clash of Clans solves the same problem with a padlock on
 * a building you can see and cannot use — not with a menu.
 *
 * So nothing here is a destination. Tapping a stop tells you what it is; it
 * never takes you anywhere, which is what keeps the first run at exactly one
 * button.
 */
export function Road({ stops, line }: { stops: Stop[]; line: string }) {
  const [open, setOpen] = useState<Stop | null>(null);

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-1">
        {stops.map((stop, index) => (
          <div key={stop.id} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => setOpen(open?.id === stop.id ? null : stop)}
              aria-label={`${stop.name}${stop.state === 'locked' ? ', locked' : ''}`}
              className={`flex w-full flex-col items-center gap-0.5 rounded-xl border-[3px] px-1 py-1.5 transition-transform active:translate-y-[1px] ${
                stop.state === 'here'
                  ? 'border-mint bg-white shadow-[0_3px_0_0_rgba(0,0,0,0.18)]'
                  : stop.state === 'done'
                    ? 'border-white/70 bg-white/70'
                    : 'border-white/40 bg-white/25'
              }`}
            >
              <span
                aria-hidden
                className={`text-lg leading-none ${stop.state === 'locked' ? 'opacity-40 grayscale' : ''}`}
              >
                {stop.state === 'locked' ? '🔒' : stop.emoji}
              </span>
              <span
                className={`text-center font-body text-[9px] font-extrabold uppercase leading-tight tracking-tight ${
                  stop.state === 'locked' ? 'text-ink/40' : 'text-ink/75'
                }`}
              >
                {stop.name}
              </span>
            </button>
            {index < stops.length - 1 && (
              <span aria-hidden className="px-0.5 font-body text-[10px] font-black text-ink/25">
                ›
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-1.5 text-center font-body text-[11px] font-extrabold text-ink/55">{line}</p>

      {open && (
        <div className="mt-2 rounded-xl border-[3px] border-ink/15 bg-white/85 px-3 py-2 animate-riseFade">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-sign text-lg leading-tight text-ink">
              {open.emoji} {open.name}
            </span>
            {open.state === 'locked' && (
              <span className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                locked
              </span>
            )}
          </div>
          <p className="mt-0.5 font-body text-[12px] font-bold leading-snug text-ink/70">
            {open.what}
          </p>
          {open.state === 'locked' && open.opensWhen && (
            <p className="mt-1 font-body text-[11px] font-extrabold text-wood-deep">
              {open.opensWhen}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
