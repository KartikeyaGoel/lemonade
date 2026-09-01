'use client';

import type { Desk } from '@/lib/friends';
import { ChunkyButton, SignHeading, Sky } from '../ui';

/**
 * The friends desk.
 *
 * One place for everything involving somebody else, replacing three separate
 * pills on the title screen. See `src/lib/friends.ts` for why they belong
 * together rather than merely why five pills is too many.
 *
 * Each card leads with what is happening rather than what it is, because a
 * status is a reason to open something and a description is not. A club with a
 * vote waiting on the kid is the only thing in the game that is genuinely
 * urgent, so it is the only thing allowed to shout.
 */
export function FriendsScreen({
  desks,
  onOpen,
  onBack,
}: {
  desks: Desk[];
  onOpen: (id: Desk['id']) => void;
  onBack: () => void;
}) {
  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-10 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="self-start font-body text-sm font-extrabold text-ink/70"
        >
          ← Back
        </button>

        <SignHeading className="mt-2 text-4xl">Friends</SignHeading>
        <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/70">
          Race them, argue with them, then see where everyone stands.
        </p>

        <div className="mt-4 space-y-3">
          {desks.map((desk) => (
            <button
              key={desk.id}
              type="button"
              disabled={desk.locked}
              onClick={() => onOpen(desk.id)}
              className={`w-full rounded-2xl border-[3px] p-3 text-left transition-transform active:translate-y-[2px] ${
                desk.locked
                  ? 'border-dashed border-ink/25 bg-white/35'
                  : desk.waiting
                    ? 'animate-bob border-lemon-deep bg-lemon-light shadow-[0_5px_0_0_rgba(0,0,0,0.2)]'
                    : 'border-ink/20 bg-white/85'
              }`}
            >
              <div className="flex items-center gap-3">
                <span aria-hidden className={`text-3xl leading-none ${desk.locked ? 'opacity-40 grayscale' : ''}`}>
                  {desk.locked ? '🔒' : desk.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-sign text-xl leading-tight text-ink">{desk.name}</span>
                    {desk.waiting && (
                      <span className="rounded-full bg-berry px-2 py-px font-body text-[10px] font-extrabold uppercase tracking-wide text-white">
                        Your turn
                      </span>
                    )}
                  </div>
                  {/* The status is the headline once there is one. Until then
                      the card has to sell itself, so it says what it is for. */}
                  <div
                    className={`font-body text-[12px] font-extrabold leading-tight ${
                      desk.locked ? 'text-ink/40' : 'text-ink/60'
                    }`}
                  >
                    {desk.locked ? desk.opensWhen : (desk.status ?? desk.what)}
                  </div>
                </div>
                {!desk.locked && (
                  <span aria-hidden className="font-sign text-2xl text-ink/30">
                    ›
                  </span>
                )}
              </div>

              {/* Once a card has news, the explanation moves underneath it in
                  small type rather than disappearing — a kid who has not opened
                  the club in a month still needs to know what it was. */}
              {desk.status && (
                <div className="mt-1.5 border-t-2 border-dashed border-ink/12 pt-1.5 font-body text-[11px] font-bold leading-snug text-ink/45">
                  {desk.what}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Back to the stand
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}
