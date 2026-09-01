'use client';

import { useState } from 'react';
import {
  act2Progress,
  serviceCapacity,
  type BusinessState,
  type LocationId,
  type StaffId,
  type UpgradeId,
} from '@/lib/business';
import {
  capacityAdded,
  cupsToCoverWage,
  dailyBurn,
  idleCapacity,
  plots,
  roomGoingSpare,
  type Plot,
} from '@/lib/yard';
import { ChunkyButton, GoalStrip, Sheet, SignHeading, Sky, money } from '../ui';
import { YardScene } from '../YardScene';

/**
 * Act 2: turning profit into capacity.
 *
 * This used to be three lists of rows under two headings, and the headings —
 * "buy once, keep forever" against "pay every single day" — were carrying the
 * entire lesson of the act in eleven-pixel type. Nobody reads a heading.
 *
 * Now it is a plot of land: kit on the stand, crew standing beside it with a
 * wage pinned to them, the pitch as the ground and the sky. Tap a thing to go
 * inside it. Everything unbought is still visible, as an empty dashed plot with
 * a price on it, which is what makes tomorrow's profit feel like it is for
 * something. `src/lib/yard.ts` has the reasoning in full.
 *
 * The sheet is where the arithmetic lives, and it is the arithmetic that turns
 * a purchase into a decision: a helper is not "$12 a day", a helper is "nine
 * more cups a day just to break even on the wage".
 */
export function InvestScreen({
  cash,
  business,
  marginPerCup,
  typicalCupsSold,
  onBuyUpgrade,
  onToggleStaff,
  onMove,
  onDone,
}: {
  cash: number;
  business: BusinessState;
  /** What the kid keeps per cup at the price they last charged. */
  marginPerCup: number;
  /** What a normal day has been selling lately. Zero before there is one. */
  typicalCupsSold: number;
  onBuyUpgrade: (id: UpgradeId) => void;
  onToggleStaff: (id: StaffId) => void;
  onMove: (id: LocationId) => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const all = plots(business, cash);
  const plot = all.find((p) => p.id === open) ?? null;
  const capacity = serviceCapacity(business);
  const burn = dailyBurn(business);
  const progress = act2Progress(business, 0);

  /** Cups a day needed just to cover what the stand owes before it opens. */
  const breakEvenCups = cupsToCoverWage(burn, marginPerCup);

  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 pb-28 pt-4">
        <SignHeading className="text-center text-3xl">Your patch</SignHeading>

        {/* Three numbers, and they are the three that decide everything: what
            you have, what you can serve, what you owe before you open. */}
        {/* Two numbers: what you have, and what you can serve. What you owe
            gets its own line below the scene, in cups, because that is the one
            a kid can actually act on. */}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <span className="stat-chip">💵 {money(cash)}</span>
          <span className="stat-chip">🥤 {capacity} cups a day</span>
        </div>

        <GoalStrip>{progress.nextStep}</GoalStrip>

        <YardScene
          plots={all}
          atPark={business.location === 'park'}
          active={open}
          onSelect={setOpen}
          className="mt-2"
        />

        {/* The one line the scene cannot draw: what the daily costs mean in
            cups. Without it a wage is an abstraction; with it, it is a target
            the kid can check against the sign. */}
        {burn > 0 && (
          <div className="mt-1 rounded-2xl border-[3px] border-berry/35 bg-white/85 px-3 py-2 text-center">
            <span className="font-body text-[12px] font-extrabold leading-tight text-ink/75">
              {breakEvenCups === null ? (
                <>You owe {money(burn)} a day and keep nothing per cup. That cannot work.</>
              ) : (
                <>
                  You owe {money(burn)} before you open. That is{' '}
                  <span className="text-berry">{breakEvenCups} cups</span> a day just to get back
                  to zero.
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {plot && (
        <PlotSheet
          plot={plot}
          cash={cash}
          marginPerCup={marginPerCup}
          typicalCupsSold={typicalCupsSold}
          capacity={capacity}
          spare={idleCapacity(business, typicalCupsSold)}
          roomToSpare={roomGoingSpare(business, typicalCupsSold)}
          onClose={() => setOpen(null)}
          onBuy={() => {
            if (plot.kind === 'kit') onBuyUpgrade(plot.id as UpgradeId);
            else if (plot.kind === 'crew') onToggleStaff(plot.id as StaffId);
            else onMove(plot.id as LocationId);
            setOpen(null);
          }}
          onLetGo={
            plot.kind === 'crew' && plot.owned
              ? () => {
                  onToggleStaff(plot.id as StaffId);
                  setOpen(null);
                }
              : undefined
          }
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/25 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton variant="lemon" full onClick={onDone}>
            Open up today →
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

/**
 * Inside a plot.
 *
 * Three things, in this order: what it is, what it costs *in cups*, and the
 * button. The cups line is the part that does the teaching — every price in
 * this act is really a number of cups, and a kid who has just spent a week
 * watching cups go across a table can judge that instantly in a way they cannot
 * judge twelve dollars.
 */
function PlotSheet({
  plot,
  cash,
  marginPerCup,
  typicalCupsSold,
  capacity,
  spare,
  roomToSpare,
  onClose,
  onBuy,
  onLetGo,
}: {
  plot: Plot;
  cash: number;
  marginPerCup: number;
  typicalCupsSold: number;
  capacity: number;
  /** Cups of room a normal day already leaves unused. */
  spare: number;
  /** Whether that room is big enough that buying more of it is a mistake. */
  roomToSpare: boolean;
  onClose: () => void;
  onBuy: () => void;
  onLetGo?: () => void;
}) {
  const daily = plot.costLabel === 'a day';
  const cups = cupsToCoverWage(plot.cost, marginPerCup);
  const adds = capacityAdded(plot.id as UpgradeId | StaffId);

  return (
    <Sheet title={plot.name} onClose={onClose}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-4xl leading-none">
          {plot.emoji}
        </span>
        <p className="flex-1 font-body text-[13px] font-bold leading-snug text-ink/75">
          {plot.what}
        </p>
      </div>

      {/* Owned: what it is doing for you right now, which is the only honest
          answer to "was that worth it". */}
      {plot.owned && plot.doing && (
        <div className="mt-3 rounded-xl border-[3px] border-mint/50 bg-mint/12 px-3 py-2 font-body text-[12px] font-extrabold leading-snug text-ink/80">
          {plot.doing}
        </div>
      )}

      {/* The price, twice: in money and in cups. */}
      <div className="mt-3 rounded-2xl border-[3px] border-ink/15 bg-white px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
            {daily ? 'Every single day' : 'One payment, then never again'}
          </span>
          <span
            className={`font-ledger text-xl font-bold tabular-nums ${daily ? 'text-berry' : 'text-ink'}`}
          >
            {money(plot.cost)}
          </span>
        </div>
        {cups !== null && (
          <div className="mt-1 border-t-2 border-dashed border-ink/15 pt-1.5 font-body text-[12px] font-extrabold text-ink/70">
            {daily ? (
              <>
                Sells <span className="text-berry">{cups} cups</span> a day, every day, before it
                has paid for itself.
              </>
            ) : (
              <>
                Costs you <span className="text-ink">{cups} cups</span> once. After that it is
                free forever.
              </>
            )}
          </div>
        )}
      </div>

      {/* Capacity you already have and are not using. Named before the money
          is spent, because after it is spent it is a lesson rather than a
          decision. */}
      {!plot.owned && adds > 0 && roomToSpare && (
        <div className="mt-2 rounded-xl border-[3px] border-lemon-rind bg-lemon-light px-3 py-2 font-body text-[12px] font-extrabold leading-snug text-wood-deep">
          Careful. You can already serve {capacity} a day and you have been selling about{' '}
          {Math.round(typicalCupsSold)} — {spare} cups of room going spare. Another {adds} only
          helps if the queue gets longer than the stand.
        </div>
      )}

      <div className="mt-4">
        {plot.owned ? (
          onLetGo ? (
            <ChunkyButton variant="ghost" full onClick={onLetGo}>
              Let them go
            </ChunkyButton>
          ) : (
            <div className="rounded-2xl border-[3px] border-mint bg-mint/20 py-3 text-center font-body text-sm font-extrabold text-ink/70">
              {plot.kind === 'pitch' ? 'You are trading here' : 'Yours, paid for, forever'}
            </div>
          )
        ) : (
          <ChunkyButton
            variant={plot.affordable ? 'mint' : 'ghost'}
            full
            disabled={!plot.affordable}
            cue={plot.affordable ? 'cash' : 'tap'}
            onClick={onBuy}
          >
            {plot.affordable
              ? plot.kind === 'crew'
                ? `Hire · ${money(plot.cost)} a day`
                : plot.kind === 'pitch'
                  ? `Move here · ${money(plot.cost)} a day`
                  : `Buy · ${money(plot.cost)}`
              : `Need ${money(plot.cost - cash)} more`}
          </ChunkyButton>
        )}
      </div>
    </Sheet>
  );
}
