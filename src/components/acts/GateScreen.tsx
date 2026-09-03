'use client';

import type { Readiness } from '@/lib/progress';
import { ActionFooter, ChunkyButton, SignHeading, Sky } from '../ui';

/**
 * The readiness gate, shown as a checklist of things the kid has actually
 * done — never as a test they failed.
 *
 * The lock is the point. It is what makes committing money feel earned, and it
 * means we never hand a kid a portfolio because they clicked through four
 * acts.
 */
export function GateScreen({
  readiness,
  onBack,
}: {
  readiness: Readiness;
  onBack: () => void;
}) {
  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            {readiness.canTrade ? '🔓' : '🔒'}
          </div>
          <SignHeading className="mt-2 !text-lemon-light text-4xl">
            {readiness.canTrade ? 'You are ready' : 'Nearly ready'}
          </SignHeading>
          <p className="mt-2 font-body text-sm font-bold text-white/75">
            {readiness.canTrade
              ? 'You have shown all four. Real money is never involved, but the thinking is.'
              : 'Look at real companies all you like. Putting money in comes after these four.'}
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          {readiness.criteria.map((criterion) => (
            <div
              key={criterion.id}
              className={`rounded-2xl border-[3px] p-3.5 ${
                criterion.met ? 'border-mint/70 bg-mint/15' : 'border-white/25 bg-white/10'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="text-lg leading-none">
                  {criterion.met ? '✅' : '⬜️'}
                </span>
                <div>
                  <div
                    className={`font-body text-sm font-extrabold ${
                      criterion.met ? 'text-ink' : 'text-white'
                    }`}
                  >
                    {criterion.label}
                  </div>
                  <div
                    className={`mt-0.5 font-body text-[12px] font-bold ${
                      criterion.met ? 'text-ink/65' : 'text-white/65'
                    }`}
                  >
                    {criterion.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <ActionFooter className="mt-auto pt-6">
          <ChunkyButton variant="lemon" full onClick={onBack}>
            Back to the market →
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}
