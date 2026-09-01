'use client';

import { useEffect } from 'react';

/**
 * What a child sees when something breaks.
 *
 * Without this, a thrown component in production is a blank white page — no
 * explanation, no way out, and a save sitting in `localStorage` that the kid
 * has no reason to believe is still there. They close the tab and that is the
 * end of it.
 *
 * So: say what happened in one sentence, promise the thing they will actually
 * be worried about, and give them a button. The reassurance is not a
 * platitude — the entire game state is on the device and a reload genuinely
 * does recover it.
 *
 * Deliberately not styled like the game. This is the one screen that should
 * look like the machinery showing through, because pretending otherwise while
 * something is visibly wrong is worse.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is sent anywhere — there is no backend and no analytics. This is
    // for whoever has the console open, which on a bad day is a parent.
    console.error('Lemonade hit a problem:', error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#FFF8E4] px-6 text-center">
      <div aria-hidden className="text-6xl">
        🍋
      </div>
      <h1 className="font-sign text-3xl text-ink">Something spilled.</h1>
      <p className="max-w-xs font-body text-sm font-bold leading-snug text-ink/70">
        The game hit a problem and stopped. Your stand, your badges and your
        words are all still saved on this device.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-2xl border-[3px] border-wood-dark bg-lemon px-6 py-3 font-sign text-2xl text-ink shadow-[0_5px_0_0_#9A5526]"
      >
        Try again
      </button>
      {/* A hard reload rather than a client-side link: the React tree has
          already thrown, so the thing most likely to recover is a fresh one. */}
      <button
        type="button"
        onClick={() => window.location.assign('/')}
        className="font-body text-xs font-extrabold text-ink/50 underline"
      >
        or go back to the start
      </button>
    </main>
  );
}
