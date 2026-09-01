'use client';

import { money } from './ui';

/**
 * The stand itself, with the price sign the customers actually read.
 * `fill` (0..1) drives the jar so the kid can see money arriving.
 */
export function Stand({
  price,
  fill = 0,
  cupsLeft,
  compact = false,
}: {
  price: number;
  fill?: number;
  cupsLeft?: number;
  compact?: boolean;
}) {
  const jarHeight = Math.round(Math.min(1, Math.max(0, fill)) * 100);
  return (
    <div className={`relative ${compact ? 'w-[46vw] max-w-[200px]' : 'w-56'} select-none`}>
      {/* Price sign, nailed to the front of the stand */}
      <div className="relative z-10 mx-auto -mb-1 w-[92%] rotate-[-1.5deg] rounded-[14px] border-[5px] border-wood-dark bg-lemon-light px-2 py-2 text-center shadow-[0_5px_0_0_#9A5526]">
        <div className="font-sign text-xl leading-none text-ink">LEMONADE</div>
        <div className="mt-0.5 font-sign text-3xl leading-none text-berry">{money(price)}</div>
      </div>

      {/* Counter top */}
      <div className="relative h-4 rounded-t-md bg-wood-deep" />

      {/* Stand body: wooden planks */}
      <div className="relative h-24 overflow-hidden rounded-b-md bg-wood">
        <div className="absolute inset-0 flex flex-col">
          <div className="h-1/3 border-b-2 border-wood-deep/60" />
          <div className="h-1/3 border-b-2 border-wood-deep/60" />
        </div>

        {/* Tip jar, filling with the day's takings */}
        <div className="absolute bottom-2 right-3 h-16 w-11 rounded-b-xl rounded-t-md border-[3px] border-ink/40 bg-white/45">
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-lg bg-lemon-deep transition-[height] duration-500 ease-out"
            style={{ height: `${jarHeight}%` }}
          />
        </div>

        {/* Pitcher of lemonade on the counter */}
        <div className="absolute bottom-2 left-3 h-14 w-12 rounded-b-lg rounded-t-sm border-[3px] border-ink/30 bg-lemon/80">
          <div className="absolute inset-x-1 bottom-1 h-2/3 rounded-b bg-lemon-deep/90" />
        </div>
      </div>

      {typeof cupsLeft === 'number' && (
        <div className="mt-2 text-center font-body text-sm font-extrabold text-ink/70">
          {cupsLeft > 0 ? `${cupsLeft} cups left` : 'SOLD OUT'}
        </div>
      )}
    </div>
  );
}
