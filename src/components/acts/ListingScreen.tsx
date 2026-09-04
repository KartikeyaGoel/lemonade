'use client';

import { useState } from 'react';
import {
  MAX_FLOAT,
  floatChoices,
  floatPlan,
  type ListingOffer,
} from '@/lib/listing';
import type { OwnershipState } from '@/lib/ownership';
import { ActionFooter, ChunkyButton, SignHeading, Sky, money } from '../ui';
import { CoachTour } from '../CoachTour';
import { LISTING_TOUR } from '@/lib/coach';
import { plural } from '@/lib/copy';

/**
 * Sell the lot to one buyer, or a slice of it to a thousand people.
 *
 * The decision the whole arc now points at, and the reason it is a good one is
 * that both answers are defensible. Selling up is money and freedom. Going
 * public is more money for the same business, a piece kept, and a price that
 * will move whether the kid likes it or not.
 *
 * Three rules held this screen together:
 *
 *  1. **The two multiples sit next to each other**, with the reason for the gap
 *     written in the kid's terms. One buyer takes the whole thing on, so they
 *     want it cheap; a thousand people buying one piece each are only buying
 *     the profit, and they bid against each other for it. That *is* why
 *     companies list rather than sell, and it is stated as a reason and never
 *     as a rule.
 *  2. **The share price is arrived at by division the kid can do.** Whole
 *     company over a thousand pieces. PRODUCT.md §9's bridge was built out of
 *     one division; this is the same sum divided once more, and both are on
 *     screen at the same time so they reconcile on paper.
 *  3. **The dial shows what it costs, not only what it pays.** Cash today,
 *     the piece kept, and the profit a week that now belongs to somebody else
 *     — and the third is the one a first-time founder forgets.
 */
export function ListingScreen({
  tour = false,
  onToured,
  offer,
  ownership,
  onList,
  onSellInstead,
  onBack,
}: {
  /** Run the first-run tour of going public. */
  tour?: boolean;
  onToured?: () => void;
  offer: ListingOffer;
  ownership: OwnershipState;
  onList: (fraction: number) => void;
  onSellInstead: () => void;
  onBack: () => void;
}) {
  const [fraction, setFraction] = useState(0.3);
  const plan = floatPlan(offer, fraction, ownership);
  const choices = floatChoices().filter(
    (option) => option + ownership.equitySoldPct <= MAX_FLOAT + 1e-9,
  );

  return (
    <Sky mood="probably-hot">
      {/* `px-3` under 360px: this screen nests three levels of padding
          around a monospaced ledger, and on a 320-pixel phone that left the
          rows about five pixels short of fitting. */}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-3 pb-8 pt-8 min-[360px]:px-5">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            🔔
          </div>
          <SignHeading className="mt-2 text-4xl">Two ways out</SignHeading>
          <p className="mt-2 font-body text-sm font-bold text-ink/70">
            Sell the whole thing to one person. Or sell pieces of it to everybody, and keep
            running it.
          </p>
        </div>

        {/* The two prices for the same business, side by side. */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border-[3px] border-ink/20 bg-white p-3 text-center">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
              One buyer
            </div>
            <div className="mt-1 font-ledger text-2xl font-bold tabular-nums text-ink">
              {money(offer.buyout.price)}
            </div>
            <div className="font-body text-[11px] font-extrabold text-ink/55">
              {plural(offer.buyoutMultiple, 'week')} of profit
            </div>
          </div>
          <div className="rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-3 text-center">
            <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-wood-deep/60">
              Everybody
            </div>
            <div className="mt-1 font-ledger text-2xl font-bold tabular-nums text-ink">
              {money(offer.value)}
            </div>
            <div className="font-body text-[11px] font-extrabold text-wood-deep">
              {plural(offer.publicMultiple, 'week')} of profit
            </div>
          </div>
        </div>

        <p className="mt-2 rounded-xl border-[3px] border-ink/12 bg-white/80 px-3 py-2 font-body text-[12px] font-bold leading-snug text-ink/70">
          {offer.reason}
        </p>

        {/* The division. Whole company, over a thousand pieces. */}
        <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
          <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
            Cutting it up
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">Made in a week</span>
            <span>{money(offer.weeklyProfit)}</span>
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">× {plural(offer.publicMultiple, 'week')} of it</span>
            <span>{money(offer.value)}</span>
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">÷ {offer.shares} pieces</span>
            <span className="text-mint-deep">{money(offer.pricePerShare)} each</span>
          </div>
          <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
            That is a share price, and it is yours.
          </p>
        </div>

        {/* The dial, and the three consequences of moving it. */}
        <div className="mt-4 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-4">
          <div className="text-center font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-wood-deep/60">
            How much of it to sell
          </div>
          <CoachTour tour={LISTING_TOUR} run={tour} onDone={() => onToured?.()} />
          <div
            role="radiogroup"
            aria-label="How much of the company to sell"
            data-coach="float-dial"
            className="mt-2 flex flex-wrap justify-center gap-1.5"
          >
            {choices.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={Math.abs(option - plan.fraction) < 1e-9}
                onClick={() => setFraction(option)}
                /* `min-w-[44px]` was here and `min-h` was not, so these came
                   out 47 wide and 38 tall — the guideline met on one axis and
                   missed on the other, which is the same miss the slider had
                   and the same reason: a width is easy to picture and a height
                   falls out of the line-height. Nine of these sit in a row and
                   the choice they make is how much of the company a child
                   sells. */
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border-[3px] px-2 py-1.5 font-ledger text-sm font-bold tabular-nums transition ${
                  Math.abs(option - plan.fraction) < 1e-9
                    ? 'border-wood-dark bg-white text-ink'
                    : 'border-wood-dark/25 bg-white/40 text-ink/55'
                }`}
              >
                {Math.round(option * 100)}%
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl border-[3px] border-wood-dark/25 bg-white px-3 py-2">
            <div className="ledger-row">
              {/* Short on purpose. At 320 pixels "300 pieces at $5.13" wrapped
                  and left its own $1,539 on the line above — a figure that has
                  come away from its label is worse than no label. The price per
                  piece is three rows up, in the division that produced it. */}
              <span className="text-ink/60">{plan.sharesSold} pieces sold</span>
              <span className="text-mint-deep">{money(plan.cashRaised)}</span>
            </div>
            <div className="ledger-row">
              <span className="text-ink/60">You still own</span>
              <span>{Math.round(plan.youKeep * 100)}%</span>
            </div>
            <div className="ledger-row border-t-2 border-dashed border-ink/15 pt-1 font-extrabold">
              <span>Their cut, a week</span>
              <span className="text-berry">{money(plan.weeklyProfitGivenUp)}</span>
            </div>
            <p className="mt-1 font-body text-[11px] font-bold text-ink/50">
              Your own {Math.round(plan.youKeep * 100)}% is worth{' '}
              {money(plan.yourStakeValue)} at that price.
            </p>
          </div>
        </div>

        <ActionFooter className="mt-auto space-y-3 pt-6">
          <ChunkyButton variant="mint" full cue="bell" onClick={() => onList(plan.fraction)}>
            Ring the bell · raise {money(plan.cashRaised)}
          </ChunkyButton>
          <ChunkyButton variant="lemon" full coach="sell-instead" onClick={onSellInstead}>
            Sell the lot for {money(offer.buyout.price)}
          </ChunkyButton>
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Neither — keep trading
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}
