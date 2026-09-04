'use client';

import { useState } from 'react';
import { ChunkyButton, Sheet } from './ui';

/**
 * Wipe this device and start again, from anywhere.
 *
 * There is no sign-in, which is deliberate — `PRIVACY.md` promises a parent
 * that nothing leaves the device, and the cheapest way to keep that promise is
 * to have no account to leak. The cost is that a browser holds exactly one
 * child's progress, and during beta testing several people share one link: the
 * second tester opens the site and is offered somebody else's half-finished
 * shop.
 *
 * A reset already existed, behind the grown-up screen, with a confirmation
 * naming everything that goes. That is the right home for it when the product
 * is in a family's hands — a child should not be two taps from deleting their
 * own trophies. It is the wrong home when the person who needs it is the next
 * tester in a queue, who has no reason to look behind a door marked "for a
 * grown-up".
 *
 * So this is the same erase, reachable everywhere, behind the same
 * confirmation. **It is a beta affordance and should move back behind the
 * grown-up screen before real families use it** — see PRODUCT.md §61.
 */
export function ResetButton({ onReset }: { onReset: () => void }) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      {/*
        The bottom-right corner, and nothing cleverer than that.

        The first attempt rode above `--pinned-bar`, the height each screen
        publishes for its own footer, on the theory that a floating button must
        never cover a primary one. But the morning screen pins 342px — the
        stand, Pip and the button together — so the reset ended up hovering in
        the middle of the sky next to the lemonade stand. Correct by the rule
        and obviously wrong on the screen.

        The corner is measured instead: on every screen checked, the reset
        covers no other button's centre and is itself hit-testable, which is
        the property that actually matters. `tests/ui/layout.test.tsx` cannot
        check it — jsdom has no layout — so it is checked in a browser and
        recorded in PRODUCT.md §61.

        Right, not left, because bottom-left is where Next's dev-mode indicator
        puts its own portal: the button was reachable in production and
        unreachable under `next dev`, which is exactly where beta testing gets
        rehearsed. Hit-testing found that; a screenshot could not have.
      */}
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label="Start over on this device"
        className="fixed bottom-2 right-2 z-30 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink/15 bg-white/70 text-base shadow-sm backdrop-blur-sm transition active:translate-y-[1px]"
      >
        <span aria-hidden>↺</span>
      </button>

      {asking && (
        <Sheet title="Start over?" onClose={() => setAsking(false)}>
          <p className="font-body text-[13px] font-extrabold leading-snug text-ink">
            This is for testing, so somebody else can play from the beginning.
          </p>
          <p className="mt-2 font-body text-[13px] font-bold leading-snug text-ink/75">
            It removes everything on this device: the run, the trophies, the words and the
            name. There is no copy anywhere, so it cannot be brought back.
          </p>

          <div className="mt-4 space-y-2">
            {/*
              The safe option first and styled as the obvious one. The
              destructive tap is the ghost, which is the reverse of how a
              primary action is normally styled and is the point.
            */}
            <ChunkyButton variant="mint" full onClick={() => setAsking(false)}>
              Keep playing
            </ChunkyButton>
            <ChunkyButton variant="ghost" full onClick={onReset}>
              Wipe it and start fresh
            </ChunkyButton>
          </div>
        </Sheet>
      )}
    </>
  );
}
