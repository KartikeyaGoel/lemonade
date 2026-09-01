'use client';

import { useState, type ReactNode } from 'react';
import type { Forecast, Weather } from '@/lib/simulation';

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
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'lemon' | 'mint' | 'wood' | 'ghost';
  disabled?: boolean;
  className?: string;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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
        className="mt-2 w-full rounded-xl border-[3px] border-ink/15 bg-lemon/40 py-2 font-body text-xs font-extrabold uppercase tracking-wide text-ink"
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
