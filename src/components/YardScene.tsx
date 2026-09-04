'use client';

import { play } from '@/lib/sound';
import type { Plot } from '@/lib/yard';
import { money } from './ui';

/**
 * The plot of land you are building on.
 *
 * Same argument as `StandScene`: a place, not a form. What this scene adds is
 * that *where a thing stands is what kind of spending it is*. Kit sits on the
 * stand and is bought once. Crew stand beside it wearing a wage in red. The
 * pitch is the ground you are standing on and the backdrop behind. See
 * `src/lib/yard.ts` for the reasoning.
 *
 * Every plot is drawn the same way — a circle with a price under it — whether
 * it is bought or not. Unbought plots are dashed and grey with a price; bought
 * ones are solid, in colour, and say either `yours` or a wage in red. The
 * uniformity is deliberate: the kid learns one affordance and can then read the
 * whole plot at a glance, and the empty dashed circles are what make tomorrow's
 * profit feel like it is *for* something.
 *
 * The only thing that is not a circle is the sign on the stand, because it is
 * the one purchase whose effect you can actually see: a scrap of card becomes a
 * painted board. It is not touchable — the 🪧 plot above it is — because a
 * price written on a lemonade sign reads as the price of lemonade.
 */

export function YardScene({
  plots,
  atPark,
  active,
  onSelect,
  className = '',
}: {
  plots: Plot[];
  /** Changes the backdrop, because the pitch is the only thing you cannot put down. */
  atPark: boolean;
  active: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const find = (id: string) => plots.find((plot) => plot.id === id);
  const select = (id: string) => {
    play(id === active ? 'close' : 'open');
    onSelect(id);
  };

  const sign = find('bigSign');
  const here = find(atPark ? 'park' : 'sidewalk');
  const there = find(atPark ? 'sidewalk' : 'park');
  const cooler = find('cooler');
  const squeeze = find('freshSqueeze');
  const helper = find('helper');
  const manager = find('manager');
  /*
   * Down the road: the places that are not this place.
   *
   * Drawn along the horizon rather than on the table, because that is what
   * they are — the fourth kind of spending is the first one that is somewhere
   * else, and §33's rule is that where a thing stands says what kind of
   * spending it is. A stand you already have on the pitch you are standing on
   * is hidden: it would be a second dashed circle labelled with the ground
   * under the kid's feet, which reads as a bug rather than an option.
   */
  const road = plots.filter(
    (plot) =>
      plot.kind === 'site' &&
      !(plot.id === (atPark ? 'stand-park' : 'stand-sidewalk') && !plot.owned),
  );

  return (
    /* A fixed aspect rather than the leftover height on the screen. The scene
       is a picture of a place, and a picture stretched to fill a tall phone
       puts a hand's width of empty sky between the sign and the pavement. */
    <div className={`relative aspect-[3/2] w-full select-none ${className}`}>
      {/* Ground: grass, then pavement, deep enough for the badges to sit on. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[44%] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-full bg-grass-deep/80" />
        <div className="absolute inset-x-0 bottom-0 h-[78%] bg-grass/90" />
        <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[#D9CDBA]" />
      </div>

      {/* The backdrop is the pitch. Trees for the park, a house for home — the
          only way to see, without reading anything, that moving changed where
          you are rather than what you own. */}
      <div aria-hidden className="absolute inset-x-0 bottom-[42%] flex justify-between px-1 text-3xl opacity-40">
        {atPark ? (
          <>
            <span>🌳</span>
            <span>🌲</span>
            <span>🌳</span>
          </>
        ) : (
          <>
            <span>🏡</span>
            <span className="opacity-0">·</span>
            <span>🏠</span>
          </>
        )}
      </div>

      {/* Where you trade, as a pair of signposts at the top of the plot. The
          label is three words because two house emoji on their own do not say
          "this is rent". */}
      <div className="absolute left-1.5 top-0 flex items-start gap-1.5">
        <span className="mt-1 max-w-[52px] font-body text-[9px] font-extrabold uppercase leading-tight tracking-[0.1em] text-ink/45">
          Where you trade
        </span>
        {here && <PlotButton plot={here} active={active} onSelect={select} size="sm" />}
        {there && <PlotButton plot={there} active={active} onSelect={select} size="sm" />}
      </div>

      {/* The stand, dead centre, wearing the sign it has paid for. Everything
          bought once hangs off this container, so the plots stay attached to
          the stand however tall the phone is. */}
      <div className="absolute bottom-[14%] left-1/2 w-[46%] max-w-[186px] -translate-x-1/2">
        {/* The sign plot, floating just above the sign it buys. */}
        {sign && (
          <PlotButton
            plot={sign}
            active={active}
            onSelect={select}
            className="-top-12 left-1/2 -translate-x-1/2"
            size="sm"
          />
        )}

        <div
          aria-hidden
          className={`relative z-10 mx-auto -mb-1 rotate-[-1.5deg] rounded-[12px] border-[4px] border-wood-dark text-center shadow-[0_4px_0_0_#9A5526] ${
            sign?.owned ? 'w-full bg-lemon-light py-1.5' : 'w-[58%] bg-[#E8DCC2] py-0.5'
          }`}
        >
          <div className={`font-sign leading-none text-ink ${sign?.owned ? 'text-lg' : 'text-[10px]'}`}>
            LEMONADE
          </div>
        </div>

        <div className="relative h-2.5 rounded-t-md bg-wood-deep" />
        <div className="relative h-[4.25rem] rounded-b-md bg-wood">
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t-2 border-wood-deep/60" />

          {/* Kit on the counter: bought once, and then simply part of the
              picture. */}
          {squeeze && (
            <PlotButton
              plot={squeeze}
              active={active}
              onSelect={select}
              className="bottom-1 left-0.5"
              size="sm"
            />
          )}
          {cooler && (
            <PlotButton
              plot={cooler}
              active={active}
              onSelect={select}
              className="bottom-1 right-0.5"
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Down the road: another stand, and then a shop with a door.
          Its own strip, below the pitches and hard right, because the first
          version put all four in one row and a kid could not tell which label
          owned which circle. They are over there and not here — the same
          reason the rival is drawn small across the road. */}
      {road.length > 0 && (
        <div className="absolute right-1.5 top-[30%] flex flex-col items-end gap-1">
          <span className="font-body text-[9px] font-extrabold uppercase leading-none tracking-[0.1em] text-ink/45">
            Down the road
          </span>
          <div className="flex items-start gap-1.5">
            {road.map((plot) => (
              <PlotButton key={plot.id} plot={plot} active={active} onSelect={select} size="sm" />
            ))}
          </div>
        </div>
      )}

      {/* Crew, on the pavement either side, wearing their wages. */}
      {helper && (
        <PlotButton
          plot={helper}
          active={active}
          onSelect={select}
          className="bottom-[6%] left-[2%]"
        />
      )}
      {manager && (
        <PlotButton
          plot={manager}
          active={active}
          onSelect={select}
          className="bottom-[6%] right-[2%]"
        />
      )}
    </div>
  );
}

/**
 * A plot: either the thing standing in it, or a dashed hole with a price.
 *
 * The badge is where the lesson lives. Something bought once says `yours` and
 * never mentions money again, because it never costs anything again. Somebody
 * on a wage carries the wage, in red, for as long as they work here.
 */
function PlotButton({
  plot,
  active,
  onSelect,
  className = '',
  size = 'md',
}: {
  plot: Plot;
  active: string | null;
  onSelect: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const on = active === plot.id;
  const daily = plot.costLabel === 'a day';
  const dim = !plot.owned && !plot.affordable;

  return (
    <button
      type="button"
      onClick={() => onSelect(plot.id)}
      aria-label={plot.owned ? plot.name : `${plot.name}, ${money(plot.cost)} ${plot.costLabel}`}
      {...{ 'data-coach': `plot-${plot.id}` }}
      className={`${className ? 'absolute' : ''} flex min-w-11 flex-col items-center transition-transform active:translate-y-[2px] ${className}`}
    >
      <span
        className={`flex items-center justify-center rounded-full border-[3px] ${
          size === 'sm' ? 'h-10 w-10 text-lg' : 'h-12 w-12 text-xl'
        } ${
          plot.owned
            ? 'border-mint bg-mint/30 shadow-[0_3px_0_0_rgba(0,0,0,0.2)]'
            : 'border-dashed border-ink/45 bg-white/60'
        } ${on ? 'ring-4 ring-mint/50' : ''} ${dim ? 'opacity-55' : ''}`}
      >
        <span aria-hidden className={plot.owned ? '' : 'opacity-40 grayscale'}>
          {plot.emoji}
        </span>
      </span>

      <span
        className={`-mt-1.5 whitespace-nowrap rounded-md border-2 px-1 py-px font-body text-[9px] font-extrabold leading-tight shadow-[0_2px_0_0_rgba(0,0,0,0.25)] ${
          plot.owned
            ? daily
              ? 'border-berry/70 bg-berry text-white'
              : 'border-ink/70 bg-[#1F1A14] text-white'
            : 'border-ink/35 bg-white text-ink/75'
        }`}
      >
        {plot.owned ? (daily ? `${money(plot.cost)}/day` : 'yours') : money(plot.cost)}
      </span>
    </button>
  );
}
