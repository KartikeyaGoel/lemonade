'use client';

import type { ReactNode } from 'react';
import { play } from '@/lib/sound';
import { money, plural } from './ui';

/**
 * The stand as a place, not a form.
 *
 * The old planning screen was a heading, two sliders and three cards. It was
 * clear, and it was a settings menu. Watching a kid play a factory-builder made
 * the gap obvious: there, every part of the machine is a thing on the floor you
 * touch to open, with its current setting written underneath it. You learn the
 * shape of the system by looking at it.
 *
 * So the plan lives on the stand. The price is on the sign, because the sign is
 * what the customers read. The batch is in the crate of lemons, because that is
 * where the lemons are. The money is in the cash box. The rival is across the
 * road, small, because he is over there and not here. Tap a thing to go inside
 * it; its number is written on it either way, so the whole plan is legible
 * without opening anything.
 *
 * Every badge here is a real number from the kid's own state — the same figures
 * the sheets and the statement use. A scene that showed a rounded, friendlier
 * version of the truth would be worse than a form.
 */

export type SpotId = 'price' | 'batch' | 'money' | 'kit' | 'regulars' | 'rival';

export function StandScene({
  price,
  cupsReady,
  costToBuy,
  marginPerCup,
  losesMoney,
  capacity,
  atCapacity,
  regulars,
  regularPrice,
  rivalPrice,
  kitLabel,
  showTapHint,
  className = 'h-[35dvh] min-h-[246px]',
  active,
  onSelect,
}: {
  price: number;
  cupsReady: number;
  costToBuy: number;
  marginPerCup: number;
  losesMoney: boolean;
  capacity: number | null;
  atCapacity: boolean;
  regulars: number;
  regularPrice: number;
  rivalPrice: number | null;
  /** What is on the stand: "cooler · umbrella". Null in Act 1, when nothing is. */
  kitLabel: string | null;
  /** First visit: the sign says so itself, as well as the coach pointing at it. */
  showTapHint: boolean;
  /** Lets the caller give the scene the leftover height on the screen. */
  className?: string;
  active: SpotId | null;
  onSelect: (spot: SpotId) => void;
}) {
  // Wrapped once here rather than on each of the six hotspots, so a spot added
  // later cannot be the silent one.
  const select = (spot: SpotId) => {
    play(spot === active ? 'close' : 'open');
    onSelect(spot);
  };

  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* Pavement and grass, so the objects are standing on something. The
          pavement has to be deep enough for the badges to sit on it — at a
          shallower band they straddled the grass line and read as floating. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24">
        <div className="absolute inset-x-0 bottom-0 h-full bg-grass-deep/80" />
        <div className="absolute inset-x-0 bottom-0 h-4/5 bg-grass/90" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#D9CDBA]" />
      </div>

      {/* The rival, over the road. Deliberately small and far away: he is a
          fact about the street, not a control. */}
      {rivalPrice !== null && (
        <Spot
          id="rival"
          active={active}
          onSelect={select}
          className="left-[1%] top-[1%] origin-top-left scale-[0.78]"
          label="The other stand"
          badge={money(rivalPrice)}
          tone="berry"
        >
          <span aria-hidden className="text-2xl">🧃</span>
        </Spot>
      )}

      {/* The crate of lemons: how much to make. */}
      <Spot
        id="batch"
        active={active}
        onSelect={select}
        className="bottom-[6%] left-[1%]"
        label="How much to make"
        badge={plural(cupsReady, 'cup')}
        sub={atCapacity && capacity !== null ? `max ${capacity}` : money(costToBuy)}
        tone="lemon"
      >
        <span aria-hidden className="text-3xl">🍋</span>
      </Spot>

      {/* The punch-card board, on its own post. Only exists once somebody has
          signed up, and then it is the steadiest thing on the street. */}
      {regulars > 0 && (
        <Spot
          id="regulars"
          active={active}
          onSelect={select}
          className="right-[1%] top-[1%]"
          label="Your regulars"
          badge={`${regulars}`}
          sub={`${money(regularPrice)} ea`}
          tone="mint"
        >
          <span aria-hidden className="text-2xl">🥛</span>
        </Spot>
      )}

      {/* The kit on the stand: cooler, umbrella, second table. Everything the
          kid has spent money on is visible here, which is the only reason a
          week of profit feels like anything. */}
      {kitLabel !== null && (
        <Spot
          id="kit"
          active={active}
          onSelect={select}
          className="bottom-[6%] right-[1%]"
          label="Your stand"
          badge={kitLabel}
          tone="wood"
        >
          <span aria-hidden className="text-3xl">🧰</span>
        </Spot>
      )}

      {/* The stand itself, dead centre. Two hotspots on it: the sign and the
          cash box. */}
      <div className="absolute bottom-[9%] left-1/2 w-[56%] max-w-[250px] -translate-x-1/2">
        <button
          type="button"
          onClick={() => select('price')}
          aria-label="What to charge per cup"
          data-coach="price"
          className={`relative z-10 mx-auto -mb-1 block w-[96%] rotate-[-1.5deg] rounded-[14px] border-[5px] bg-lemon-light px-2 py-2 text-center shadow-[0_5px_0_0_#9A5526] transition-transform active:translate-y-[2px] ${
            active === 'price' ? 'border-mint ring-4 ring-mint/40' : 'border-wood-dark'
          }`}
        >
          <div className="font-sign text-base leading-none text-ink">LEMONADE</div>
          <div className="mt-0.5 font-sign text-[2rem] leading-none text-berry">{money(price)}</div>
          {showTapHint && (
            <div className="mt-0.5 font-body text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
              tap the sign
            </div>
          )}
        </button>

        <div aria-hidden className="relative h-3.5 rounded-t-md bg-wood-deep" />

        <div className="relative h-[6.5rem] overflow-hidden rounded-b-md bg-wood">
          <div aria-hidden className="absolute inset-0 flex flex-col">
            <div className="h-1/3 border-b-2 border-wood-deep/60" />
            <div className="h-1/3 border-b-2 border-wood-deep/60" />
          </div>

          <div aria-hidden className="absolute bottom-2 left-2.5 h-12 w-10 rounded-b-lg rounded-t-sm border-[3px] border-ink/30 bg-lemon/80">
            <div className="absolute inset-x-1 bottom-1 h-2/3 rounded-b bg-lemon-deep/90" />
          </div>

          {/* The cash box: the margin, the fixed costs, the break-even. */}
          <button
            type="button"
            onClick={() => select('money')}
            aria-label="The money, per cup and per day"
            className={`absolute bottom-2 right-2.5 flex h-12 w-12 flex-col items-center justify-center rounded-lg border-[3px] bg-white/80 transition-transform active:translate-y-[2px] ${
              active === 'money' ? 'border-mint ring-4 ring-mint/40' : 'border-ink/35'
            }`}
          >
            <span aria-hidden className="text-base leading-none">💰</span>
            <span
              className={`font-ledger text-[10px] font-bold leading-none tabular-nums ${
                losesMoney ? 'text-berry' : 'text-ink'
              }`}
            >
              {money(marginPerCup)}
            </span>
            {/* Without this the number is just a number. It is what the kid
                keeps out of every cup, and that is the whole game. */}
            <span className="font-body text-[7px] font-extrabold uppercase tracking-[0.08em] text-ink/50">
              you keep
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  lemon: 'border-lemon-rind bg-lemon-light',
  mint: 'border-mint bg-mint/25',
  wood: 'border-wood-dark bg-wood/30',
  berry: 'border-berry bg-berry/20',
} as const;

/**
 * One touchable thing in the scene.
 *
 * The badge under the art is doing the real work — it is why the plan can be
 * read at a glance instead of opened one panel at a time.
 *
 * `data-coach` is how the first-run tour finds these. An attribute rather than
 * a class or the aria-label, because the first is styling a redesign will move
 * and the second is copy translation will change. See `src/lib/coach.ts`.
 */
function Spot({
  id,
  active,
  onSelect,
  className,
  label,
  badge,
  sub,
  tone,
  children,
}: {
  id: SpotId;
  active: SpotId | null;
  onSelect: (spot: SpotId) => void;
  className: string;
  label: string;
  badge: string;
  sub?: string;
  tone: keyof typeof TONES;
  children: ReactNode;
}) {
  const on = active === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-label={label}
      {...{ 'data-coach': id }}
      className={`absolute flex flex-col items-center transition-transform active:translate-y-[2px] ${className}`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border-[4px] shadow-[0_4px_0_0_rgba(0,0,0,0.22)] ${
          TONES[tone]
        } ${on ? 'ring-4 ring-mint/50' : ''}`}
      >
        {children}
      </span>
      <span className="-mt-1.5 rounded-lg border-2 border-ink/70 bg-[#1F1A14] px-1.5 py-0.5 font-body text-[11px] font-extrabold leading-tight text-white shadow-[0_2px_0_0_rgba(0,0,0,0.3)]">
        {badge}
      </span>
      {sub && (
        <span className="mt-0.5 font-body text-[10px] font-extrabold text-ink/60">{sub}</span>
      )}
    </button>
  );
}
