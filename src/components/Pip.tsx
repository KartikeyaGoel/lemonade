'use client';

import type { ReactNode } from 'react';
import { Coach } from './ui';

/**
 * Pip, drawn small.
 *
 * The bubble already existed — `Coach` in `ui.tsx` has been carrying five lines
 * of interface instruction on Act 1's first day since long before there was a
 * character to attach to it. So this is deliberately not a new speech system.
 * It is a face, beside the bubble that was already there, and every existing
 * `Coach` call site keeps working untouched.
 *
 * Flat shapes and no gradients, to match the customers and the stand. The bob
 * is CSS on the bubble, so a phone renders this with no per-frame JavaScript.
 */
export function PipFace({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0 drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]"
    >
      {/* body */}
      <ellipse cx="24" cy="32" rx="14" ry="12" fill="#FFD84D" stroke="#8A5A1E" strokeWidth="2.5" />
      {/* wing */}
      <path
        d="M30 30c4 1 6 4 5 7-3 1-6-1-7-4z"
        fill="#F5C231"
        stroke="#8A5A1E"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* head */}
      <circle cx="20" cy="16" r="10" fill="#FFD84D" stroke="#8A5A1E" strokeWidth="2.5" />
      {/* eye */}
      <circle cx="18" cy="14" r="2.4" fill="#2B2118" />
      <circle cx="18.9" cy="13.2" r="0.8" fill="#FFFFFF" />
      {/* beak */}
      <path
        d="M10 17.5h-6.5a1 1 0 0 0-.2 2l6.7 1.8z"
        fill="#FF8A3D"
        stroke="#8A5A1E"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* one tuft, so it reads as a character rather than a logo */}
      <path d="M23 6.5c1.5-2.5 4-3 5.5-1.5" stroke="#8A5A1E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Pip saying something, once.
 *
 * `onDismiss` is always wired and the whole thing is tappable, because the one
 * way to ruin this is a mascot that stands between a kid and the button they
 * were reaching for. Nothing here blocks; it sits in the flow and goes away.
 */
export function PipSays({
  lines,
  onDismiss,
  point = 'down',
  className = '',
}: {
  lines: readonly string[];
  onDismiss?: () => void;
  point?: 'up' | 'down';
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-center gap-1.5 ${className}`}>
      <PipFace />
      <button
        type="button"
        onClick={onDismiss}
        className="min-w-0 flex-1 text-left"
        aria-label="Got it"
      >
        <Coach point={point} className="!items-stretch">
          <span className="block space-y-0.5">
            {lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </Coach>
      </button>
    </div>
  );
}

/** Pip beside an arbitrary bubble, for the call sites that already had copy. */
export function PipBubble({
  children,
  point = 'down',
  className = '',
}: {
  children: ReactNode;
  point?: 'up' | 'down';
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-center gap-1.5 ${className}`}>
      <PipFace size={36} />
      <Coach point={point} className="min-w-0 flex-1 !items-stretch">
        {children}
      </Coach>
    </div>
  );
}
