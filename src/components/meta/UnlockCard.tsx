'use client';

import { useState } from 'react';
import { AVATARS, tidyPlayerName } from '@/lib/career';
import type { Unlock } from '@/lib/unlocks';
import { ChunkyButton, SignHeading, Sky } from '../ui';

/**
 * A system arriving.
 *
 * Shown once, full screen, one at a time, immediately after the thing that
 * earned it. The card always says *why now* — because a feature that appears in
 * the interface with no moment attached to it is a feature nobody finds, and a
 * kid who finds six of them at once finds none of them.
 *
 * The name is asked for on the same card rather than on one of its own, at the
 * only moment it is obviously worth answering: there is a trophy, and it has
 * nobody's name on it. Asking on a separate screen meant two cards where one
 * would do, and one is the budget.
 */
export function UnlockCard({
  unlock,
  askIdentity,
  onDone,
  onSetIdentity,
}: {
  unlock: Unlock;
  /** Fold the name and avatar into this card instead of asking later. */
  askIdentity?: boolean;
  onDone: () => void;
  onSetIdentity?: (name: string, avatar: string) => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const isIdentity = Boolean(askIdentity) || unlock.feature === 'identity';

  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 pb-10 pt-10 text-center">
        <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.22em] text-ink/50">
          New
        </div>
        <div aria-hidden className="mt-2 animate-bubble-pop text-7xl">
          {unlock.emoji}
        </div>
        <SignHeading className="mt-3 text-4xl">{unlock.title}</SignHeading>
        <p className="mt-2 max-w-xs font-body text-sm font-bold leading-snug text-ink/70">
          {unlock.because}
        </p>

        {isIdentity ? (
          <div className="mt-7 w-full">
            <input
              aria-label="Your name"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 12))}
              placeholder="Your name"
              className="w-full rounded-2xl border-[3px] border-ink/20 bg-white px-4 py-3 text-center font-sign text-2xl text-ink placeholder:font-body placeholder:text-base placeholder:font-bold placeholder:text-ink/30"
            />

            <div className="mt-4 grid grid-cols-5 gap-2">
              {AVATARS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatar(option)}
                  aria-label={`Pick ${option}`}
                  aria-pressed={avatar === option}
                  className={`rounded-2xl border-[3px] py-2 text-2xl ${
                    avatar === option
                      ? 'border-ink/50 bg-lemon'
                      : 'border-ink/15 bg-white/70'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <ChunkyButton
              variant="lemon"
              full
              className="mt-5"
              onClick={() => {
                onSetIdentity?.(tidyPlayerName(name), avatar);
                onDone();
              }}
            >
              {name.trim() ? `That's me →` : 'Skip for now →'}
            </ChunkyButton>
          </div>
        ) : (
          <ChunkyButton variant="lemon" className="mt-8 w-full" onClick={onDone}>
            Got it →
          </ChunkyButton>
        )}
      </div>
    </Sky>
  );
}
