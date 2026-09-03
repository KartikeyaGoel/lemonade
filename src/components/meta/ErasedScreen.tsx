'use client';

import { ChunkyButton, SignHeading, Sky } from '../ui';

/**
 * What a parent sees after deleting everything.
 *
 * A screen rather than a toast, for two reasons. The first is that after this
 * action there is genuinely nothing left to go back to — a toast over a report
 * still showing badges that no longer exist would be a lie held on screen. The
 * second is that a deletion a person cannot verify is a deletion they have to
 * take on faith, and `PRIVACY.md` is written on the premise that they should
 * never have to.
 *
 * So it lists what actually went, by name, from the keys the storage layer
 * reported removing rather than from what we intended to remove.
 */
export function ErasedScreen({ removed, onStart }: { removed: string[]; onStart: () => void }) {
  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="rounded-3xl border-[3px] border-ink/20 bg-white/90 p-5">
          <div className="font-body text-xs font-extrabold uppercase tracking-[0.2em] text-ink/50">
            For a grown-up
          </div>
          <SignHeading className="mt-1 text-3xl">It is all gone</SignHeading>
          <p className="mt-2 font-body text-[13px] font-bold leading-snug text-ink/70">
            {removed.length === 0
              ? 'There was nothing stored on this device to delete.'
              : `${removed.length} ${removed.length === 1 ? 'record' : 'records'} removed from this browser. Nothing was sent anywhere, because there is nowhere for it to be sent.`}
          </p>

          {removed.length > 0 && (
            <ul className="mt-3 space-y-1 border-t-2 border-dashed border-ink/15 pt-3">
              {removed.map((key) => (
                <li
                  key={key}
                  className="font-ledger text-[12px] font-bold leading-snug text-ink/60"
                >
                  {key}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 font-body text-[12px] font-bold leading-snug text-ink/55">
            Starting again begins a first day with no name, no badges and no history — the same
            state as a browser that has never opened this page.
          </p>

          <div className="mt-5">
            <ChunkyButton full onClick={onStart}>
              Start again
            </ChunkyButton>
          </div>
        </div>
      </div>
    </Sky>
  );
}
