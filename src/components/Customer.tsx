'use client';

import type { Customer as SimCustomer } from '@/lib/simulation';

/** A few shirt and skin colours so the crowd does not look cloned. */
const SHIRTS = ['#FF5470', '#2ED9A0', '#5B8DEF', '#FFB454', '#B36BE0', '#FF8A5B', '#4FC3C3', '#F06292'];
const SKIN = ['#F2C9A0', '#D89B6A', '#A9673D', '#7A4A28', '#FAD9BC', '#8D5524'];

/**
 * One passer-by, big enough to actually read.
 *
 * The whole sprite is one CSS keyframe timeline — walk on, pause to read the
 * sign, then continue off — so a crowd of these stays smooth on a phone with
 * no per-frame JavaScript. Lanes give a little depth: nearer customers are
 * bigger and drawn in front.
 */
export function CustomerSprite({
  customer,
  price,
  lane,
  speedMs,
}: {
  customer: SimCustomer;
  price: number;
  lane: number;
  speedMs: number;
}) {
  const shirt = SHIRTS[customer.id % SHIRTS.length];
  const skin = SKIN[(customer.id * 3) % SKIN.length];
  const bought = customer.outcome === 'bought';
  const soldOut = customer.outcome === 'sold-out';
  const regular = customer.kind === 'regular';

  // Reactions, never explanations. The kid draws the conclusion from watching
  // enough of these in a row.
  //
  // Regulars get their own line, because the point of them is that they are not
  // deciding anything — and on a cold day, watching them turn up when nobody
  // else does is the whole lesson of recurring revenue in one picture.
  const bubble = regular
    ? ['My usual!', 'Same again', 'Morning!', 'On my card'][customer.id % 4]
    : bought
      ? ['Yes!', 'Ooh!', 'One please', 'Yum'][customer.id % 4]
      : soldOut
        ? 'Aw, none left!'
        : price >= 2.2
          ? ['Too pricey', 'No way', 'How much?!'][customer.id % 3]
          : ['Nah', 'Maybe not', 'Hmm, no'][customer.id % 3];

  const bubbleTone = regular
    ? 'bg-lemon'
    : bought
      ? 'bg-mint'
      : soldOut
        ? 'bg-[#FFB454]'
        : 'bg-white';

  // Depth: lane 0 is nearest the viewer.
  const scale = [1, 0.86, 0.74][lane] ?? 0.8;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: '100%',
        bottom: `${lane * 16}px`,
        zIndex: 30 - lane * 10,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
        animation: `walkIn ${speedMs}ms linear forwards`,
      }}
    >
      <div className="relative" style={{ animation: `waddle 460ms ease-in-out infinite` }}>
        {/* Verdict bubble, shown once they have read the sign */}
        <div
          className={`absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl border-[3px] border-ink/75 ${bubbleTone} px-2.5 py-1 font-sign text-lg leading-none text-ink opacity-0`}
          style={{
            animation: `bubblePop 1100ms ease-out ${speedMs * 0.4}ms forwards`,
            boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
          }}
        >
          {bubble}
        </div>

        {/* Regulars carry their card, so they are recognisable at a glance in a
            crowd of otherwise identical sprites. */}
        {regular && (
          <div
            aria-hidden
            className="absolute -right-2 top-2 rounded-[3px] border-2 border-ink/70 bg-lemon-light px-[3px] py-[1px] font-sign text-[9px] leading-none text-ink"
            style={{ transform: 'rotate(-12deg)' }}
          >
            •••
          </div>
        )}

        {/* Coin arcing into the tip jar, buyers only */}
        {bought && (
          <div
            className="absolute -top-2 left-1/2 h-5 w-5 rounded-full border-[3px] border-[#C98F00] bg-lemon-deep opacity-0"
            style={{ animation: `coinToss 900ms ease-out ${speedMs * 0.46}ms forwards` }}
          />
        )}

        {/* Body */}
        <div className="flex flex-col items-center">
          <div
            className="h-[18px] w-[18px] rounded-full border-[3px] border-ink/60"
            style={{ background: skin }}
          />
          <div
            className="-mt-1 h-[28px] w-[26px] rounded-t-lg rounded-b-sm border-[3px] border-ink/50"
            style={{ background: shirt }}
          />
          <div className="flex gap-1">
            <div className="h-[11px] w-[5px] rounded-b bg-ink/75" />
            <div className="h-[11px] w-[5px] rounded-b bg-ink/75" />
          </div>
        </div>
      </div>
    </div>
  );
}
