'use client';

import { ChunkyButton, Ground, Sky } from './ui';
import { Stand } from './Stand';
import { Road } from './Road';
import type { Stop } from '@/lib/journey';

/**
 * Cold open. One button, no explanation, no tutorial — the kid should be
 * making their first real decision within about five seconds.
 *
 * `extras` is how the meta-game reaches this screen, and it is empty on a first
 * run by design. A trophy case, a challenge and a club are four buttons, and
 * four buttons is a menu — a decision the kid has to make before they have any
 * way of making it. Each one appears only once the thing that gives it meaning
 * has happened; the gates live in `src/lib/unlocks.ts`.
 *
 * The road is the exception, and it is there from the first launch. It is not a
 * menu — nothing on it is somewhere you can go — it is the only thing on this
 * screen that says a stock market is coming. Without it a kid interested in
 * finance opens the app, sees a lemonade stand, and closes it. See
 * `src/lib/journey.ts`.
 */
export function TitleScreen({
  onStart,
  hasSave,
  onParent,
  extras = [],
  road,
  rank,
}: {
  onStart: () => void;
  hasSave: boolean;
  /** Deliberately small and low-contrast: this screen belongs to the kid. */
  onParent?: () => void;
  extras?: Array<{ emoji: string; label: string; onClick: () => void }>;
  /** The four acts, with the market visible and locked from day one. */
  road?: { stops: Stop[]; line: string };
  /** Shown only once there is a rank to show. */
  rank?: { avatar: string; name: string; rank: string } | null;
}) {
  return (
    <Sky mood="probably-hot">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6">
        <div className="rotate-[-3deg] text-center">
          {/* One word, one line. It was split across two out of a vague idea
              that it looked like a hand-painted sign, and it just reads as a
              typo — the game is not called "Lemon Ade". Sized in vw so the
              whole word fits any phone without wrapping. */}
          <h1
            className="whitespace-nowrap font-sign leading-[0.9] text-ink"
            style={{
              fontSize: 'clamp(3rem, 17vw, 5rem)',
              textShadow: '0 5px 0 #FFF, 0 10px 0 rgba(154,85,38,0.5)',
            }}
          >
            LEMONADE
          </h1>
          <div className="mt-2 inline-block rotate-[2deg] rounded-lg border-[3px] border-wood-dark bg-white/85 px-3 py-1 font-sign text-xl text-wood-deep">
            $20 and a folding table
          </div>
        </div>

        <div className="my-6 animate-bob">
          <Stand price={1.5} fill={0.4} />
        </div>

        <ChunkyButton variant="mint" full onClick={onStart} className="!text-3xl">
          {hasSave ? 'Keep going' : 'Start selling'}
        </ChunkyButton>

        {road && (
          <div className="mt-4 w-full">
            <Road stops={road.stops} line={road.line} />
          </div>
        )}

        {rank && (
          <div className="mt-3 flex items-center gap-2 rounded-full border-[3px] border-white/60 bg-white/60 px-3 py-1.5">
            <span aria-hidden className="text-lg leading-none">
              {rank.avatar}
            </span>
            <span className="font-body text-xs font-extrabold text-ink/70">
              {rank.name} · {rank.rank}
            </span>
          </div>
        )}

        {extras.length > 0 && (
          <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
            {extras.map((extra) => (
              <button
                key={extra.label}
                type="button"
                onClick={extra.onClick}
                className="flex items-center gap-1.5 rounded-full border-[3px] border-white/70 bg-white/75 px-3.5 py-2 font-body text-xs font-extrabold text-ink/75"
              >
                <span aria-hidden>{extra.emoji}</span>
                {extra.label}
              </button>
            ))}
          </div>
        )}

        {/* Gated on `onParent` alone, not on there being a save. A parent
            checking in after their kid started a new season had no way to
            reach this at all. */}
        {onParent && (
          <button
            type="button"
            onClick={onParent}
            className="mt-4 rounded-full bg-white/45 px-4 py-1.5 font-body text-xs font-extrabold text-ink/60"
          >
            For a grown-up
          </button>
        )}
      </div>
      <Ground height="h-28" />
    </Sky>
  );
}
