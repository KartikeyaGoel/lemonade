'use client';

import { ACT_TITLES, type Act } from '@/lib/progress';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * The gap between acts. One screen, one sentence, one button.
 *
 * Its job is to name the new wall the kid is about to hit, in their language,
 * without explaining how to get over it.
 */
export function ActIntroScreen({
  act,
  wall,
  cash,
  onBegin,
}: {
  act: Act;
  /** The problem the kid is about to run into, in one line. */
  wall: string;
  cash: number;
  onBegin: () => void;
}) {
  const title = ACT_TITLES[act];

  return (
    <Sky mood={act === 4 ? 'night' : 'dawn'}>
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="font-body text-xs font-extrabold uppercase tracking-[0.3em] text-ink/50">
          Act {act}
        </div>
        {/* The question, above the name.
            This is the child's half of a stage that the grown-up report names
            after its economics. A kid reading "what is a cup worth to them?"
            has been given something to find out; the same stage labelled
            "Price, cost and margin" would have handed them homework. Same
            stage, and only the register changes. */}
        <p
          className={`mt-2 font-body text-sm font-extrabold ${
            act === 4 ? 'text-lemon-light' : 'text-wood-deep'
          }`}
        >
          {title.question}
        </p>
        <SignHeading
          className={`mt-1 text-6xl leading-[0.9] ${act === 4 ? '!text-lemon-light' : ''}`}
        >
          {title.name}
        </SignHeading>

        <p
          className={`mt-4 font-body text-base font-extrabold ${
            act === 4 ? 'text-white/85' : 'text-ink/75'
          }`}
        >
          {title.promise}
        </p>

        <div
          className={`mt-6 rounded-2xl border-[3px] px-4 py-3 ${
            act === 4 ? 'border-white/30 bg-white/10' : 'border-wood-dark bg-lemon-light'
          }`}
        >
          <div
            className={`font-body text-[11px] font-extrabold uppercase tracking-[0.16em] ${
              act === 4 ? 'text-lemon-light' : 'text-wood-deep'
            }`}
          >
            The problem
          </div>
          <p
            className={`mt-1 font-body text-sm font-extrabold ${
              act === 4 ? 'text-white' : 'text-ink'
            }`}
          >
            {wall}
          </p>
        </div>

        <div className="mt-6 flex gap-2">
          <span className="stat-chip">💵 {money(cash)}</span>
        </div>

        <div className="mt-8 w-full">
          <ChunkyButton variant={act === 4 ? 'mint' : 'lemon'} full onClick={onBegin}>
            Let&apos;s go →
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}
