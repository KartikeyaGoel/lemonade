'use client';

import {
  founderStake,
  marketCap,
  sharePriceBridge,
  type Listing,
  type PriceMove,
} from '@/lib/listing';
import { ActionFooter, ChunkyButton, SignHeading, Sky, money, useCountUp } from '../ui';

/**
 * A week as a public company.
 *
 * This screen is the reason the listing is not the end of the stage. Reaching a
 * listing teaches what a company is worth. *Living* a week as a listed company
 * is what teaches what a share price is — and a child who has never watched
 * their own price move has no business being handed eight real ones.
 *
 * So one rule governs everything on it: **the move is always attributed.** Two
 * numbers cause it, both are printed, and the sentence names which of them did
 * the work. A price move a kid cannot account for teaches that prices are
 * weather, and that is the single most expensive thing this product could
 * install by accident — it is the belief that turns a market into a slot
 * machine.
 *
 * The other rule is that a fall is not dressed up. Berry, downwards, with the
 * earnings number that caused it next to it, and the business stated to be the
 * same business it was last week. PRODUCT.md §8 calls behavioural discipline
 * one of the three things that would cause a bloodbath, and this is the first
 * place in the whole game a kid can practise it with something of their own.
 */
export function ListedScreen({
  listing,
  move,
  onContinue,
}: {
  listing: Listing;
  /** The week just marked, or null on the day of the listing itself. */
  move: PriceMove | null;
  onContinue: () => void;
}) {
  const price = useCountUp(listing.price, { sound: false });
  const bridge = sharePriceBridge(listing);
  const up = move !== null && move.change > 0;
  const flat = move !== null && Math.abs(move.change) < 0.005;

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            {move === null ? '🔔' : up ? '📈' : flat ? '➖' : '📉'}
          </div>
          <SignHeading className="mt-2 text-4xl !text-lemon-light">
            {move === null ? 'You are public' : `Week ${move.week}`}
          </SignHeading>
          <p className="mt-2 font-body text-sm font-bold text-white/80">
            {move === null
              ? `${listing.shares} pieces. You kept ${Math.round(listing.founderShare * 100)}% of them.`
              : 'Your own share price, and the reason it moved.'}
          </p>
        </div>

        {/* The price, big, because it is the number the whole stage exists for. */}
        <div className="mt-6 rounded-2xl border-[3px] border-white/30 bg-night-panel p-5 text-center">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60">
            One piece of your company
          </div>
          <div className="mt-1 font-ledger text-5xl font-bold tabular-nums text-lemon-light">
            {money(price)}
          </div>
          {move !== null && (
            <div
              className={`mt-1 font-body text-sm font-extrabold ${
                up ? 'text-mint' : flat ? 'text-white/70' : 'text-berry-light'
              }`}
            >
              {up ? '▲' : flat ? '·' : '▼'} {Math.abs(Math.round(move.change * 1000) / 10)}% from{' '}
              {money(move.priceBefore)}
            </div>
          )}
          <div className="mt-1 font-body text-[11px] font-bold text-white/50">
            At the float it was {money(listing.ipoPrice)}
          </div>
        </div>

        {/* Why. Two numbers, and the sentence that names which one did it. */}
        {move !== null && (
          <div className="mt-4 rounded-2xl border-[3px] border-white/25 bg-night-panel p-4">
            <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/55">
              Why it moved
            </div>
            <div className="flex items-baseline justify-between font-body text-[13px] font-extrabold text-white/85">
              <span className="text-white/60">They expected, this week</span>
              <span className="font-ledger tabular-nums">{money(move.expected)}</span>
            </div>
            <div className="flex items-baseline justify-between font-body text-[13px] font-extrabold text-white/85">
              <span className="text-white/60">You actually made</span>
              <span
                className={`font-ledger tabular-nums ${
                  move.actual >= move.expected ? 'text-mint' : 'text-berry-light'
                }`}
              >
                {money(move.actual)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t-2 border-dashed border-white/20 pt-1.5 font-body text-[13px] font-extrabold text-white/85">
              <span className="text-white/60">Weeks of profit they will pay</span>
              <span className="font-ledger tabular-nums">
                {move.multipleBefore.toFixed(1)} → {move.multipleAfter.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 font-body text-[12px] font-bold leading-snug text-white/70">
              {move.reason}
            </p>
            {!up && !flat && (
              <p className="mt-2 rounded-xl border-[3px] border-white/20 bg-white/10 px-3 py-2 font-body text-[12px] font-bold leading-snug text-white/85">
                The shop is the same shop it was last week. What changed is what people think next
                week will look like.
              </p>
            )}
          </div>
        )}

        {/* Back the other way: price times pieces is the whole company again. */}
        <div className="mt-4 rounded-2xl border-[3px] border-white/25 bg-night-panel p-4">
          <div className="mb-1 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/55">
            The whole thing
          </div>
          <p className="font-body text-[12px] font-bold leading-snug text-white/80">{bridge.cap}</p>
          <div className="mt-2 flex items-baseline justify-between font-body text-[13px] font-extrabold text-white/85">
            <span className="text-white/60">
              Your {Math.round(listing.founderShare * 100)}% is worth
            </span>
            <span className="font-ledger tabular-nums text-lemon-light">
              {money(founderStake(listing))}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-body text-[13px] font-extrabold text-white/85">
            <span className="text-white/60">Everybody else&rsquo;s share</span>
            <span className="font-ledger tabular-nums">
              {money(Math.round((marketCap(listing) - founderStake(listing)) * 100) / 100)}
            </span>
          </div>
        </div>

        <ActionFooter className="mt-auto pt-6">
          <ChunkyButton variant="mint" full onClick={onContinue}>
            {move === null ? 'Trade a week as a public company →' : 'Carry on →'}
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}
