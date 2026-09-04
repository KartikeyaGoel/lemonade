'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Forecast, Weather } from '@/lib/simulation';
import { isMuted, onMuteChange, play, setMuted, type Cue } from '@/lib/sound';

/* Re-exported so screens can reach it from the same place as `money`. */
export { plural } from '@/lib/copy';

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** The full-bleed sky behind every screen. Time of day and weather are the
 *  main way the game signals "a new day started". */
export function Sky({
  mood,
  children,
  className = '',
}: {
  mood: Forecast | Weather | 'night' | 'dawn' | 'dusk';
  children?: ReactNode;
  className?: string;
}) {
  const gradients: Record<string, string> = {
    'probably-cold': 'from-[#6E93B4] via-[#9DBBD2] to-[#CFE0E9]',
    cold: 'from-[#6E93B4] via-[#9DBBD2] to-[#CFE0E9]',
    'probably-mild': 'from-[#3FA9E8] via-[#8ED6F6] to-[#D6F0FB]',
    mild: 'from-[#3FA9E8] via-[#8ED6F6] to-[#D6F0FB]',
    'probably-hot': 'from-[#FF9E3D] via-[#FFC46B] to-[#FFE9B0]',
    hot: 'from-[#FF7A2F] via-[#FFB454] to-[#FFE9B0]',
    dawn: 'from-[#FF9AA2] via-[#FFD59E] to-[#FFF3C4]',
    dusk: 'from-[#7C6BA8] via-[#F0A7A0] to-[#FFE0A8]',
    night: 'from-[#1E2A4A] via-[#3B4A78] to-[#6B7BA8]',
  };
  const gradient = gradients[mood] ?? gradients.mild;
  return (
    <div className={`relative min-h-[100dvh] w-full overflow-hidden bg-gradient-to-b ${gradient} ${className}`}>
      {children}
    </div>
  );
}

/** Sun or cloud, sized to the weather. Pure decoration, but it is most of
 *  how the screen feels like a place rather than a form. */
export function WeatherArt({ mood }: { mood: Forecast | Weather }) {
  const hot = mood === 'hot' || mood === 'probably-hot';
  const cold = mood === 'cold' || mood === 'probably-cold';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-52">
      <div
        className={`absolute right-6 top-6 rounded-full animate-shimmer ${
          hot ? 'h-28 w-28 bg-[#FFF07A]' : cold ? 'h-16 w-16 bg-[#FFFBE0]/70' : 'h-20 w-20 bg-[#FFF3A0]'
        }`}
        style={{ boxShadow: hot ? '0 0 70px 30px rgba(255,220,80,0.55)' : '0 0 40px 16px rgba(255,255,200,0.4)' }}
      />
      {(cold || mood === 'mild' || mood === 'probably-mild') && (
        <>
          <Cloud className="left-4 top-10 h-10 w-28 opacity-90" />
          <Cloud className="left-40 top-24 h-8 w-20 opacity-70" />
          {cold && <Cloud className="right-24 top-20 h-9 w-24 opacity-80" />}
        </>
      )}
    </div>
  );
}

function Cloud({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute rounded-full bg-white/85 blur-[1px] animate-sway ${className}`} />
  );
}

/** Grass and sidewalk. Gives every screen a floor to stand on. */
export function Ground({ height = 'h-24' }: { height?: string }) {
  return (
    <div aria-hidden className={`absolute inset-x-0 bottom-0 ${height}`}>
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-grass-deep" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-grass" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-[#D9CDBA]" />
    </div>
  );
}

/**
 * Variant class names must be written out in full. Tailwind scans source
 * files for literal strings, so a dynamically built `btn-${variant}` would be
 * tree-shaken out of the stylesheet entirely.
 */
const BUTTON_VARIANTS = {
  lemon: 'btn-chunk btn-lemon',
  mint: 'btn-chunk btn-mint',
  wood: 'btn-chunk btn-wood',
  ghost: 'btn-chunk btn-ghost',
} as const;

export function ChunkyButton({
  children,
  onClick,
  variant = 'lemon',
  disabled,
  className = '',
  full,
  cue = 'tap',
  coach,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'lemon' | 'mint' | 'wood' | 'ghost';
  disabled?: boolean;
  className?: string;
  full?: boolean;
  /** Buttons that commit something can say so. Defaults to a plain blip. */
  cue?: Cue;
  /**
   * Marks this button as a target of the first-run tour (`src/lib/coach.ts`).
   *
   * An explicit prop because this component's props are a closed type and it
   * does not spread the rest — so `{...{ 'data-coach': 'try' }}` type-checks,
   * silently drops the attribute, and leaves a tour step pointing at nothing.
   */
  coach?: string;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick &&
        (() => {
          // Every button in the game is this button, so this one line is the
          // whole app's tap feedback. A disabled button stays silent, which is
          // itself information.
          play(cue);
          onClick();
        })
      }
      disabled={disabled}
      data-coach={coach}
      className={`${BUTTON_VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

/** Hand-painted sign, used for every headline in the game. */
export function SignHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`font-sign text-4xl leading-none tracking-wide text-ink ${className}`}
      style={{ textShadow: '0 3px 0 rgba(255,255,255,0.6)' }}
    >
      {children}
    </h1>
  );
}

/**
 * Top bar: day, cash. Deliberately only two numbers.
 *
 * `totalDays` is only meaningful in Act 1, which is a fixed seven-day arc.
 * From Act 2 the stand just keeps trading, so pass null and the counter drops
 * the denominator rather than claiming a deadline that does not exist.
 */
export function HeaderBar({
  day,
  totalDays,
  cash,
  label,
}: {
  day: number;
  totalDays: number | null;
  cash: number;
  label?: string;
}) {
  return (
    <div className="relative z-20 flex items-center justify-between px-4 pt-4">
      <span className="stat-chip">
        <span className="font-sign text-base">
          {label ?? `Day ${totalDays ? Math.min(day, totalDays) : day}`}
        </span>
        {totalDays !== null && <span className="text-ink/40">/ {totalDays}</span>}
      </span>
      <span className="stat-chip">
        <span aria-hidden>💵</span>
        <span className="font-ledger tabular-nums">{money(cash)}</span>
      </span>
    </div>
  );
}

/**
 * A share code, shown the way a Minecraft seed is shown: big, monospaced, and
 * with one button that puts it on the clipboard.
 *
 * Copying is the only thing most kids will do with it, so it gets the whole
 * width. Reading it out loud is the fallback, which is why the codes are
 * grouped in fours and use an alphabet with no letter that looks like a digit.
 */
export function CodeBox({
  code,
  label,
  small,
}: {
  code: string;
  label?: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked. The code is on screen; selecting it still works.
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border-[3px] border-ink/20 bg-white p-3">
      {label && (
        <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
          {label}
        </div>
      )}
      <div
        className={`mt-1 select-all break-all font-ledger font-bold tabular-nums text-ink ${
          small ? 'text-[11px] leading-snug' : 'text-lg'
        }`}
      >
        {code}
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border-[3px] border-ink/15 bg-lemon/40 py-2 font-body text-xs font-extrabold uppercase tracking-wide text-ink"
      >
        {copied ? '✓ Copied' : 'Copy code'}
      </button>
    </div>
  );
}

/** The paste-a-code field. One line, one button, one error. */
export function CodeInput({
  placeholder,
  onSubmit,
  action,
  error,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
  action: string;
  error?: string | null;
}) {
  const [value, setValue] = useState('');
  return (
    <div>
      <textarea
        aria-label={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-2xl border-[3px] border-ink/20 bg-white px-3 py-2 font-ledger text-sm font-bold text-ink placeholder:font-body placeholder:font-bold placeholder:text-ink/35"
      />
      {error && (
        <div className="mt-1 font-body text-[12px] font-extrabold text-berry">{error}</div>
      )}
      <ChunkyButton
        variant="mint"
        full
        className="mt-2"
        disabled={value.trim().length === 0}
        onClick={() => onSubmit(value)}
      >
        {action}
      </ChunkyButton>
    </div>
  );
}

/**
 * The pointing finger.
 *
 * Clash of Clans does not explain its systems. It puts a finger on the one
 * thing to tap, greys out everything else, and lets you find out what happened.
 * Nobody reads a tutorial; everybody follows a finger.
 *
 * So a hint here is one sentence and one arrow, and it goes away the moment the
 * kid does the thing rather than when they acknowledge it — there is no "Got
 * it!" button, because tapping "Got it!" teaches nothing. Nothing is ever
 * blocked while it is up: a kid who ignores it can still play.
 *
 * Which hint shows is derived from how far the kid has got, not remembered in a
 * flag, so it cannot desynchronise from the game and cannot be missed.
 */
export function Coach({
  children,
  point = 'down',
  className = '',
}: {
  children: ReactNode;
  point?: 'up' | 'down';
  className?: string;
}) {
  return (
    <div className={`pointer-events-none relative z-20 flex flex-col items-center ${className}`}>
      {point === 'up' && <Nib direction="up" />}
      <div className="animate-bob rounded-2xl border-[3px] border-lemon-deep bg-[#1F1A14] px-3 py-2 text-center font-body text-[12px] font-extrabold leading-tight text-white shadow-[0_4px_0_0_rgba(0,0,0,0.35)]">
        {children}
      </div>
      {point === 'down' && <Nib direction="down" />}
    </div>
  );
}

function Nib({ direction }: { direction: 'up' | 'down' }) {
  return (
    <span
      aria-hidden
      className={`h-2.5 w-4 bg-lemon-deep ${direction === 'down' ? '-mt-px' : '-mb-px'}`}
      style={{
        clipPath: direction === 'down' ? 'polygon(0 0, 100% 0, 50% 100%)' : 'polygon(50% 0, 0 100%, 100% 100%)',
      }}
    />
  );
}

/**
 * What the kid is trying to do, in one line, permanently on screen.
 *
 * Playing the first ten minutes with fresh eyes turned up something
 * embarrassing: the game never states its own objective. A kid gets a forecast,
 * a shopping list and a price dial, and has to infer from context that the point
 * is to end the week with more than twenty dollars. Every game the target
 * audience plays states the goal and keeps it visible — the factory builder in
 * the reference screenshot has it pinned to the top left corner all game.
 */
/**
 * The pinned action bar at the bottom of a screen, and the height it publishes.
 *
 * The badge toast has to sit above whatever is pinned, and for a while it did
 * that with a fixed `pb-32` — 128 pixels, which was right for a bar with one
 * button in it. The planning screen grows a second the moment there is a
 * yesterday to rehearse against, and at that point the bar is 184 pixels tall
 * and a rosette was landing squarely on "Open the stand!". A reward on top of
 * the button it is rewarding is the §26 defect exactly.
 *
 * Measuring it from inside the toast looked like the fix and was not: it
 * depends on the bar already being in the DOM when the toast's effect runs,
 * which is a rendering-order coupling between two components that know nothing
 * about each other. So the bar publishes its own height as a custom property on
 * the root, and anything that needs to clear it reads that. Order stops
 * mattering, and a third button changes the number without changing any code.
 */
/**
 * Publishes an element's height as `--pinned-bar` on the root.
 *
 * Shared by the two kinds of bottom action area, because the badge toast does
 * not care which kind it is looking at — it cares how much room is taken at the
 * bottom of the screen. See `PinnedBar` and `ActionFooter`.
 */
function usePublishedHeight(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const publish = () =>
      document.documentElement.style.setProperty('--pinned-bar', `${node.offsetHeight}px`);
    publish();
    // Measured once always, and again on resize where that is available. The
    // guard is not defensive padding: `ResizeObserver` is missing in jsdom, and
    // a component that throws in the test environment is a component nobody
    // renders in a test.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty('--pinned-bar');
    };
  }, [ref]);
}

/**
 * A bar pinned to the bottom of the screen that publishes its own height.
 *
 * It imposes the pinning and nothing else — every screen passes its own
 * z-index, padding and background, because they genuinely differ (the night
 * screens have a hard top border, the daylight ones a gradient) and a
 * primitive that fought them with conflicting Tailwind classes would resolve
 * by stylesheet order rather than by call site.
 *
 * The height is the whole point. Eleven screens used to pad their content by a
 * hand-guessed `pb-28`, which is 112 pixels, and a bar with two stacked
 * buttons is 182 — so on the live-market catch-up screen the last row of the
 * week's prices sat 47 pixels under the bar with 2 pixels of scroll available
 * to reach it. Not clipped, not faint: unreachable. Found by measuring rather
 * than by looking, because the gradient makes it look intentional.
 *
 * Pad content with `calc(var(--pinned-bar) + <gap>)` and the guess is gone.
 */
export function PinnedBar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePublishedHeight(ref);
  return (
    <div ref={ref} className={`fixed inset-x-0 bottom-0 ${className}`}>
      {children}
    </div>
  );
}

/**
 * What a screen should pad its scrolling content by to clear its own bar.
 *
 * A function rather than a constant so the gap is explicit at the call site,
 * and a fallback so the very first paint — before the bar has measured itself —
 * is roomy rather than clipped.
 */
export function clearsBar(gap = '1.5rem'): { paddingBottom: string } {
  return { paddingBottom: `calc(var(--pinned-bar, 8rem) + ${gap})` };
}

/**
 * A bottom action area that stays in the flow of the page.
 *
 * Most of the choice screens put their buttons at the end of a full-height
 * flex column with `mt-auto`, which is the right layout — the content is short,
 * the buttons sit at the bottom, and nothing needs to overlap. But "sits at the
 * bottom of the screen" is exactly what the badge toast has to clear, and a
 * toast at its low resting position landed straight on "Trade a week as a
 * public company" the first time it was played.
 *
 * So these publish their height too. Same custom property, same reader, and the
 * toast never has to know which kind of screen it is on.
 */
export function ActionFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePublishedHeight(ref);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function GoalStrip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-2 rounded-2xl border-[3px] border-ink/15 bg-white/70 px-3 py-1.5">
      <span aria-hidden className="text-sm">
        🎯
      </span>
      <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink/45">
        Goal
      </span>
      <span className="flex-1 text-right font-body text-[12px] font-extrabold leading-tight text-ink/75">
        {children}
      </span>
    </div>
  );
}

/**
 * Whether sound is off, kept in sync across every copy of the button.
 *
 * Reads inside an effect rather than in the initial state so the server and the
 * first client render agree — `localStorage` does not exist during the former.
 */
export function useMuted(): [boolean, (next: boolean) => void] {
  const [off, setOff] = useState(false);
  useEffect(() => {
    setOff(isMuted());
    return onMuteChange(setOff);
  }, []);
  return [off, setMuted];
}

/**
 * The mute button.
 *
 * Small, and in the corner, because it is a setting rather than a feature. It
 * plays a sound when it turns sound *on*, which is the only way to know it
 * worked, and is also the gesture that unlocks the audio context on iOS.
 */
export function SoundToggle({ className = '' }: { className?: string }) {
  const [off, set] = useMuted();
  return (
    <button
      type="button"
      aria-label={off ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!off}
      onClick={() => {
        set(!off);
        if (off) play('coin');
      }}
      className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white/60 bg-white/60 text-base leading-none ${className}`}
    >
      <span aria-hidden>{off ? '🔇' : '🔊'}</span>
    </button>
  );
}

/**
 * Inside an object.
 *
 * A sheet rather than a screen, because the stand stays visible behind it. The
 * kid never loses the place they are standing in, which is the whole difference
 * between poking at a stand and navigating a menu.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
      />
      <div className="relative z-10 max-h-[82dvh] overflow-y-auto rounded-t-[26px] border-t-[4px] border-ink/20 bg-[#FFF8E4] px-4 pb-8 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.25)] animate-riseFade">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-ink/20" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="font-sign text-2xl leading-tight text-ink">{title}</span>
          {/*
            The pill is 24 pixels tall and the finger closing it belongs to a
            nine-year-old. So the *button* is 44 and the pill is drawn inside
            it, with the extra height pulled back out by a negative margin —
            the header is the same size it was, the chip looks the same, and
            the target is now the size a thumb needs. Every sheet in the game
            closes through this one.
          */}
          <button
            type="button"
            onClick={onClose}
            className="-my-2.5 flex h-11 shrink-0 items-center px-1"
          >
            <span className="rounded-full border-2 border-ink/25 px-2.5 py-0.5 font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/60">
              Done
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * A number arriving rather than appearing.
 *
 * The end-of-day profit is the reward for everything the kid did that day, and
 * it used to simply be *there* when the screen loaded. Counting it up is the
 * oldest trick in games for the same reason it still works: it makes the size
 * of the number legible as an experience rather than as a fact, and a big day
 * takes visibly longer to arrive than a small one.
 *
 * It is deliberately capped: past about a second this stops being a reward and
 * starts being a wait, so a huge number counts faster rather than for longer.
 *
 * Honest about motion. A kid who has asked their phone to stop animating things
 * gets the final number immediately, with no sound.
 */
export function useCountUp(target: number, { sound = true }: { sound?: boolean } = {}): number {
  const [shown, setShown] = useState(target);

  useEffect(() => {
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still || target === 0) {
      setShown(target);
      return;
    }

    const steps = Math.min(COUNT_STEPS, Math.max(6, Math.round(Math.abs(target) * 2)));
    const gap = COUNT_MS / steps;
    let step = 0;
    setShown(0);

    const timer = window.setInterval(() => {
      step += 1;
      if (step >= steps) {
        window.clearInterval(timer);
        setShown(target);
        return;
      }
      setShown((target * step) / steps);
      // Every other step, so a long count does not become a machine gun.
      if (sound && step % 2 === 0) play('tick');
    }, gap);

    return () => window.clearInterval(timer);
  }, [target, sound]);

  return shown;
}

/** How long a count-up may take, and the most steps it may take to get there. */
const COUNT_MS = 750;
const COUNT_STEPS = 28;
