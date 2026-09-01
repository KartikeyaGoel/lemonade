'use client';

import { useState } from 'react';
import {
  decodeCard,
  encodeCard,
  honours,
  tableLine,
  type TableCard,
} from '@/lib/table';
import { ChunkyButton, CodeBox, CodeInput, SignHeading, Sky } from '../ui';

/**
 * Where friends stand next to each other.
 *
 * See `src/lib/table.ts` for the argument against a single leaderboard. The
 * layout follows it: four honours for things that are mostly skill, and then
 * the money one at the bottom with a dice on it, because a group of kids will
 * find the money one anyway and it is better to hand it to them labelled.
 */
export function TableScreen({
  mine,
  onBack,
}: {
  mine: TableCard;
  onBack: () => void;
}) {
  const [friends, setFriends] = useState<TableCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const everyone = [mine, ...friends];
  const list = honours(everyone);

  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-10 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="self-start font-body text-sm font-extrabold text-ink/70"
        >
          ← Back
        </button>

        <SignHeading className="mt-2 text-3xl">The table</SignHeading>
        <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/70">
          {tableLine(everyone)}
        </p>

        <div className="mt-4 space-y-2">
          {list.map((honour) => (
            <div
              key={honour.id}
              className={`rounded-2xl border-[3px] p-3 ${
                honour.mostlyLuck
                  ? 'border-ink/15 bg-white/50'
                  : 'border-ink/20 bg-white/85'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span aria-hidden className="text-lg">
                  {honour.emoji}
                </span>
                <span className="flex-1 font-sign text-lg leading-tight text-ink">
                  {honour.title}
                </span>
                {honour.mostlyLuck && (
                  <span className="rounded-full border-2 border-berry/50 bg-berry/10 px-2 py-0.5 font-body text-[9px] font-extrabold uppercase tracking-wide text-berry">
                    mostly luck
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-body text-[11px] font-bold leading-snug text-ink/50">
                {honour.measures}
              </p>

              <div className="mt-2 space-y-1">
                {honour.standings.map((row, place) => (
                  <div
                    key={row.who}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                      place === 0 && !honour.mostlyLuck ? 'bg-mint/20' : ''
                    }`}
                  >
                    <span className="w-4 font-body text-[11px] font-extrabold text-ink/40">
                      {place + 1}
                    </span>
                    <span className="flex-1 font-body text-[13px] font-extrabold text-ink">
                      {row.who}
                      {row.who === mine.who && (
                        <span className="ml-1 font-body text-[10px] font-bold text-ink/40">you</span>
                      )}
                    </span>
                    <span className="font-ledger text-[12px] font-bold tabular-nums text-ink/75">
                      {row.figure}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <CodeBox label="Send your card so they can add you" code={encodeCard(mine)} small />
          <div>
            <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
              Paste a friend&apos;s card
            </div>
            <div className="mt-1.5">
              <CodeInput
                placeholder="CARD-..."
                action="Add them"
                error={error}
                onSubmit={(value) => {
                  const decoded = decodeCard(value);
                  if (!decoded) {
                    setError('That card code is not right. Check for a missing character.');
                    return;
                  }
                  if (decoded.who === mine.who || friends.some((f) => f.who === decoded.who)) {
                    setError('Somebody with that name is already at the table.');
                    return;
                  }
                  setError(null);
                  setFriends((current) => [...current, decoded]);
                }}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 font-body text-[11px] font-bold leading-snug text-ink/45">
          Nobody wins the table. That is on purpose — over twelve weeks the money is mostly which
          weeks you got, and the four honours above are the parts that are actually you.
        </p>

        <div className="mt-5">
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Back
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}
