'use client';

import { useState } from 'react';
import { DEMO_STAGES } from '@/lib/demo';
import type { Act } from '@/lib/progress';
import { ChunkyButton, clearsBar, PinnedBar, SignHeading, Sky } from './ui';

/**
 * Start somewhere other than the beginning.
 *
 * ## Why this is a base feature and not an admin door
 *
 * It was behind the grown-up screen, on the reasoning that the gated path is
 * the product and a stage-skip is a landmine for a child. The first half of
 * that is still true and nothing here changes it — `demoGame` *plays* the
 * stage forward with the same functions the app uses, so `unlocks.ts` and
 * `readiness` are untouched and nothing is waved through. §57.
 *
 * The second half did not survive contact with the deployment:
 *
 * > why cant you just add the skip ahead as a base feature, the entire vercel
 * > app is a demo so there arent any avccounts with the grown up ansd kid
 *
 * Which is right. There are no accounts. "For a grown-up" is a label on a
 * button a child can press, one tap from the title screen, so hiding a control
 * behind it protects nobody — it only makes the control hard to find for the
 * people this build currently exists for. And §85 had just shown what that
 * costs: the shortcut had been quietly broken for who knows how long, and the
 * person who noticed was trying to show somebody the game.
 *
 * ## What is preserved
 *
 * The first screen still has exactly **one thing that looks like an action**.
 * `journey.ts` has the argument for why a menu there would undo the entry, and
 * that argument is about the primary button, not about button count. So this
 * arrives as a second quiet pill next to the grown-up one — small, low
 * contrast, findable, and not competing with "Start selling".
 *
 * ## One panel, two doors
 *
 * `SkipAheadPanel` is the whole control, and it is rendered both here, as a
 * screen the title pill opens, and inside `ParentScreen`'s disclosure, where
 * it already was. Two entrances to one implementation rather than two
 * implementations — `scripts/check-duplicates.mjs` is the gate that would
 * notice if that stopped being true.
 */
export function SkipAheadPanel({
  at,
  onJump,
  onCancel,
  cancelLabel,
}: {
  /** The stage the save is currently in, so its row can say so. */
  at: number;
  onJump: (act: Act) => void;
  onCancel: () => void;
  cancelLabel: string;
}) {
  const [picked, setPicked] = useState<Act | null>(null);
  const chosen = picked === null ? null : DEMO_STAGES.find((stage) => stage.act === picked);

  if (chosen) {
    return (
      <>
        {/* Named, because "are you sure" is not a question. What goes is a
            run; what arrives is somebody else's week, and whoever is about to
            show a screen should know which of the two is on it. And when it is
            the stage they are standing on, the honest word is "again" — the
            save is fresh, theirs is not. §85. */}
        <p className="mt-1 font-body text-[13px] font-extrabold leading-snug text-ink">
          {chosen.act === at
            ? `Start ${chosen.name} again, from a save played fresh up to it?`
            : `Replace this run with a game that has been played up to ${chosen.name}?`}
        </p>
        <p className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/65">
          The days are real ones: every figure on screen is what those days actually made. The
          badges and words are whatever that week earned, so it is a played save rather than a
          finished one. Trophies and names already on this device are kept.
        </p>
        <div className="mt-3 space-y-2">
          <ChunkyButton variant="ghost" full onClick={() => setPicked(null)}>
            Pick a different one
          </ChunkyButton>
          <ChunkyButton variant="lemon" full onClick={() => onJump(chosen.act)}>
            {chosen.act === at ? `Start ${chosen.name} again` : `Start at ${chosen.name}`}
          </ChunkyButton>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/65">
        This replaces the run on this device with one that has been played that far. A child gets
        here by playing — every stage below was played by the game itself, so the figures are real.
      </p>
      <div className="mt-3 space-y-2">
        {DEMO_STAGES.map((stage) => (
          <button
            key={stage.act}
            type="button"
            onClick={() => setPicked(stage.act)}
            className="w-full rounded-xl border-[3px] border-ink/15 bg-white px-3 py-2 text-left"
          >
            <div className="font-sign text-lg leading-tight text-ink">
              {stage.act}. {stage.name}
              {stage.act === at && (
                <span className="ml-1.5 font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                  you are here
                </span>
              )}
            </div>
            <div className="font-body text-[11px] font-bold leading-tight text-ink/55">
              {stage.act === at ? 'Start this stage again, on a fresh save.' : stage.promise}
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 flex h-11 w-full items-center justify-center font-body text-[12px] font-extrabold uppercase tracking-wide text-ink/50"
      >
        {cancelLabel}
      </button>
    </>
  );
}

/** The panel as a screen of its own, which is what the title pill opens. */
export function SkipAheadScreen({
  at,
  onJump,
  onBack,
}: {
  at: number;
  onJump: (act: Act) => void;
  onBack: () => void;
}) {
  return (
    <Sky mood="dawn">
      {/* `clearsBar`, not a guessed `pb-`: the pinned bar's height is measured,
          and `tests/layout.test.ts` fails a screen that pins a bar without
          padding for it. It caught this one. */}
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-8"
        style={clearsBar()}
      >
        <SignHeading className="text-3xl">Skip ahead</SignHeading>
        <p className="mt-2 font-body text-[13px] font-bold leading-snug text-ink/70">
          Showing the game to somebody? A stage normally takes days to reach, because each one is
          unlocked by the thing that makes it make sense.
        </p>

        <div className="mt-4 rounded-2xl border-[3px] border-ink/25 bg-white/85 p-4">
          <SkipAheadPanel at={at} onJump={onJump} onCancel={onBack} cancelLabel="Never mind" />
        </div>

        <PinnedBar>
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Back
          </ChunkyButton>
        </PinnedBar>
      </div>
    </Sky>
  );
}
