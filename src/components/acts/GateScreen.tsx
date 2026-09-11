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
 *
 * ## Two things the pilot found on this exact screen
 *
 * A grown-up photographed it and wrote: *"I get this but don't know how to
 * unlock the better deal workflow."*
 *
 * 1. **There was nowhere to go.** Three of the four criteria are satisfied by
 *    playing the stand, so for those the honest answer really is "keep
 *    playing". The fourth was a single screen in stage four with one attempt
 *    and no way back, which made this card a diagnosis with no treatment. It
 *    now carries a button when — and only when — there is somewhere to press
 *    it to. See `Criterion.retry`.
 * 2. **The satisfied cards could not be read.** `text-ink/65` on `bg-mint/15`
 *    over the night sky measures **1.35:1** at the top of the gradient and
 *    2.62:1 at the bottom, against a 4.5:1 bar — and even the bold label was
 *    1.52:1. The met card is the *reward* card, and it was the least legible
 *    thing in the game.
 *
 *    The cause is a light-surface idiom used on a dark screen: `bg-mint/15`
 *    reads as pale mint over white and composites to dark teal over a night
 *    sky, so dark ink on it has nothing to sit against. Fixed by putting the
 *    met card on the solid panel the night screens already have for figures
 *    (`night-panel`) and tinting the border and the tick rather than the fill.
 *    `scripts/check-contrast.mjs` now composites translucent fills over the
 *    sky's three stops, so the next one of these fails the build.
 */
export function GateScreen({
  readiness,
  onBack,
  onRetry,
}: {
  readiness: Readiness;
  onBack: () => void;
  /**
   * Have another go at a criterion that has somewhere to go.
   *
   * Optional so the screen still renders in a test or a story with no router
   * behind it, and the button simply does not appear.
   */
  onRetry?: (where: 'deals') => void;
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
          <p className="mt-2 font-body text-sm font-bold text-white/85">
            {readiness.canTrade
              ? 'You have shown all four. Real money is never involved, but the thinking is.'
              : 'Look at real companies all you like. Putting money in comes after these four.'}
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          {readiness.criteria.map((criterion) => (
            <div
              key={criterion.id}
              /*
               * A solid panel either way, and the state carried by the border,
               * the tick and a word — never by a tint the text has to sit on.
               * `bg-night-panel` is the one surface on this screen measured
               * against both white and lemon-light text.
               */
              className={`rounded-2xl border-[3px] bg-night-panel p-3.5 ${
                criterion.met ? 'border-mint' : 'border-white/25'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="text-lg leading-none">
                  {criterion.met ? '✅' : '⬜️'}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-body text-sm font-extrabold ${
                      criterion.met ? 'text-lemon-light' : 'text-white'
                    }`}
                  >
                    {criterion.label}
                  </div>
                  <div className="mt-0.5 font-body text-[12px] font-bold text-white/85">
                    {criterion.detail}
                  </div>

                  {/*
                    The way out, next to the thing it is a way out of.

                    Not in the footer: a child reading the one card that is
                    still grey needs the button under that card, and a second
                    primary button at the bottom of the screen would compete
                    with "back to the market" for the same thumb.
                  */}
                  {!criterion.met && criterion.retry && onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(criterion.retry!)}
                      className="mt-2 inline-flex min-h-11 items-center rounded-full border-[3px] border-lemon bg-lemon px-4 font-body text-[13px] font-extrabold text-ink"
                    >
                      Have another go →
                    </button>
                  )}
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
