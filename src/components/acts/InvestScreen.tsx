'use client';

import { useState } from 'react';
import {
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
import { SHOP, type ShopState } from '@/lib/retail';
import { ChunkyButton, clearsBar, GoalStrip, money, PinnedBar, Sheet, SignHeading, Sky } from '../ui';
import { YardScene } from '../YardScene';
import { plural } from '@/lib/copy';

/**
 * Stages 2 and 3: turning profit into capacity, and then into a shop.
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
  goal,
  cash,
  business,
  marginPerCup,
  typicalCupsSold,
  onBuyUpgrade,
  onToggleStaff,
  onMove,
  onOpenStand,
  onCloseStand,
  onOpenShop,
  onShopStaff,
  onDone,
}: {
  /**
   * The stage's goal, handed in rather than worked out here.
   *
   * This screen is reachable from three stages, and the first version derived
   * the line itself from the stand count — so the moment a kid opened their
   * second stand it switched to "open the shop", two good days before the
   * stands stage had finished with them. That is the defect PRODUCT.md §40
   * found once already: a goal strip asking for something the game has not got
   * to yet, which a child reads as a rule they have broken. One source now,
   * in `page.tsx`, and two readers.
   */
  goal: string;
  cash: number;
  business: BusinessState;
  /** What the kid keeps per cup at the price they last charged. */
  marginPerCup: number;
  /** What a normal day has been selling lately. Zero before there is one. */
  typicalCupsSold: number;
  onBuyUpgrade: (id: UpgradeId) => void;
  onToggleStaff: (id: StaffId) => void;
  onMove: (id: LocationId) => void;
  /** Open another stand at a pitch. Stage 2 onwards. */
  onOpenStand?: (id: LocationId) => void;
  /** Shut one down. The table is already paid for; what comes back is the day. */
  onCloseStand?: (id: LocationId) => void;
  /**
   * Take the kid to the funding decision rather than buying the shop.
   *
   * The shop is the one plot in the yard that cannot be a button, because it
   * costs more than the business has and the interesting part is *how* it gets
   * paid for. Tapping it opens the three-way choice; the yard stays behind it.
   */
  onOpenShop?: () => void;
  /**
   * Behind the counter. Capacity, at a wage, every day.
   *
   * This existed in `retail.ts` from the first commit of the stage and nothing
   * in the interface reached it, so the shop was stuck at its bare 60 cups and
   * the one decision the shop adds — is another pair of hands worth $18 a day —
   * could not be made. Exactly the defect PRODUCT.md §40 records about the
   * manager: a mechanic written, tested, and wired to nothing.
   */
  onShopStaff?: (delta: 1 | -1) => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const all = plots(business, cash);
  const plot = all.find((p) => p.id === open) ?? null;
  const capacity = serviceCapacity(business);
  const burn = dailyBurn(business);


  /** Cups a day needed just to cover what the stand owes before it opens. */
  const breakEvenCups = cupsToCoverWage(burn, marginPerCup);

  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 pt-4" style={clearsBar()}>
        <SignHeading className="text-center text-3xl">Your patch</SignHeading>

        {/* Two numbers: what you have, and what you can serve. What you owe
            gets its own line below the scene, in cups, because that is the one
            a kid can actually act on.

            It was three, and the superseded comment saying so sat here beside
            the two-chip code for as long as the change has been in. */}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <span className="stat-chip">💵 {money(cash)}</span>
          <span className="stat-chip">🥤 {plural(capacity, 'cup')} a day</span>
        </div>

        {goal !== '' && <GoalStrip>{goal}</GoalStrip>}

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
                  <span className="text-berry">{plural(breakEvenCups, 'cup')}</span> a day just to get back
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
          shop={plot.id === 'shop' && plot.owned ? business.shop : null}
          onShopStaff={onShopStaff}
          onClose={() => setOpen(null)}
          onBuy={() => {
            if (plot.kind === 'kit') onBuyUpgrade(plot.id as UpgradeId);
            else if (plot.kind === 'crew') onToggleStaff(plot.id as StaffId);
            else if (plot.kind === 'site') {
              if (plot.id === 'shop') onOpenShop?.();
              else onOpenStand?.(plot.id === 'stand-park' ? 'park' : 'sidewalk');
            } else onMove(plot.id as LocationId);
            setOpen(null);
          }}
          onLetGo={
            plot.kind === 'crew' && plot.owned
              ? () => {
                  onToggleStaff(plot.id as StaffId);
                  setOpen(null);
                }
              : plot.kind === 'site' && plot.owned && plot.id !== 'shop' && onCloseStand
                ? () => {
                    onCloseStand(plot.id === 'stand-park' ? 'park' : 'sidewalk');
                    setOpen(null);
                  }
                : undefined
          }
        />
      )}

      <PinnedBar className="z-30 pb-5 pt-8 bg-gradient-to-t from-black/25 to-transparent">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton variant="lemon" full onClick={onDone}>
            Open up today →
          </ChunkyButton>
        </div>
      </PinnedBar>
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
  shop,
  onShopStaff,
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
  /** Set only for the shop, once it is open. */
  shop: ShopState | null;
  onShopStaff?: (delta: 1 | -1) => void;
  onClose: () => void;
  onBuy: () => void;
  onLetGo?: () => void;
}) {
  const daily = plot.costLabel === 'a day';
  const cups = cupsToCoverWage(plot.cost, marginPerCup);
  const dailyCups =
    plot.dailyAfter !== null ? cupsToCoverWage(plot.dailyAfter, marginPerCup) : null;
  const adds = capacityAdded(plot.id as UpgradeId | StaffId);
  const staffCups = cupsToCoverWage(SHOP.staffWage, marginPerCup);

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
            {daily
              ? 'Every single day'
              : plot.dailyAfter
                ? 'Today, once'
                : 'One payment, then never again'}
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
                Sells <span className="text-berry">{plural(cups, 'cup')}</span> a day, every day, before it
                has paid for itself.
              </>
            ) : plot.dailyAfter ? (
              <>
                Costs you <span className="text-ink">{plural(cups, 'cup')}</span> once.
              </>
            ) : (
              <>
                Costs you <span className="text-ink">{plural(cups, 'cup')}</span> once. After that it is
                free forever.
              </>
            )}
          </div>
        )}

        {/*
          A plot that is both kinds of spending says so.
          Only a site is: $40 for the table and then the pitch every day for as
          long as it stands there. Without this row the sheet promised it was
          "free forever" after the one payment, which is not true and is exactly
          the sort of number PRODUCT.md §4 exists to forbid.
        */}
        {!daily && plot.dailyAfter !== null && plot.dailyAfter > 0 && (
          <div className="mt-1.5 border-t-2 border-dashed border-ink/15 pt-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                And then every day
              </span>
              <span className="font-ledger text-xl font-bold tabular-nums text-berry">
                {money(plot.dailyAfter)}
              </span>
            </div>
            {dailyCups !== null && (
              <div className="mt-1 font-body text-[12px] font-extrabold text-ink/70">
                Owed whether or not anybody buys. That is{' '}
                <span className="text-berry">{plural(dailyCups, 'cup')}</span> a day from this one alone.
              </div>
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
          {Math.round(typicalCupsSold)} — {plural(spare, 'cup')} of room going spare. Another {adds} only
          helps if the queue gets longer than the stand.
        </div>
      )}

      {/* Behind the counter, with the wage stated in cups. Same arithmetic as
          every other daily cost in the act, because it is the same kind of
          cost — the shop just happens to be the only plot that can hold more
          than one of them. */}
      {shop && onShopStaff && (
        <div className="mt-3 rounded-2xl border-[3px] border-ink/15 bg-white px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Behind the counter
              </div>
              <div className="font-ledger text-xl font-bold tabular-nums text-ink">
                {shop.staff} {shop.staff === 1 ? 'person' : 'people'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="One fewer person behind the counter"
                disabled={shop.staff <= 0}
                onClick={() => onShopStaff(-1)}
                className="h-10 w-10 rounded-xl border-[3px] border-wood-dark bg-white font-sign text-xl text-ink disabled:opacity-30"
              >
                −
              </button>
              <button
                type="button"
                aria-label="One more person behind the counter"
                disabled={shop.staff >= SHOP.maxStaff || cash < SHOP.staffWage}
                onClick={() => onShopStaff(1)}
                className="h-10 w-10 rounded-xl border-[3px] border-wood-dark bg-lemon-light font-sign text-xl text-ink disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-1.5 border-t-2 border-dashed border-ink/15 pt-1.5 font-body text-[12px] font-extrabold text-ink/70">
            Each one serves {SHOP.staffCapacity} more cups a day and costs{' '}
            <span className="text-berry">{money(SHOP.staffWage)}</span> a day.
            {staffCups !== null && (
              <>
                {' '}
                That is <span className="text-berry">{plural(staffCups, 'cup')}</span> each, every day,
                before they have paid for themselves.
              </>
            )}
          </div>
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
              {plot.kind === 'pitch'
                ? 'You are trading here'
                : plot.kind === 'site'
                  ? 'Open, and trading'
                  : 'Yours, paid for, forever'}
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
                  : plot.kind === 'site'
                    ? plot.id === 'shop'
                      ? 'See how to pay for it →'
                      : `Open it · ${money(plot.cost)}`
                    : `Buy · ${money(plot.cost)}`
              : plot.cost > cash
                ? `Need ${money(plot.cost - cash)} more`
                : plot.what}
          </ChunkyButton>
        )}
      </div>
    </Sheet>
  );
}
