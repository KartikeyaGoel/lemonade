'use client';

import { type EquityOffer } from '@/lib/ownership';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * The first share sale.
 *
 * The offer is deliberately priced in the investor's favour, and the payback
 * arithmetic is printed right on the card so a kid who reads it can work that
 * out. We never call it a bad deal — the cash is genuinely useful today, and
 * whichever way they go they will feel the consequence.
 */
export function EquityOfferScreen({
  offer,
  weeklyProfit,
  onAccept,
  onDecline,
}: {
  offer: EquityOffer;
  weeklyProfit: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Sky mood="probably-mild">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            🤝
          </div>
          <SignHeading className="mt-2 text-4xl">Someone wants in</SignHeading>
          <p className="mt-2 font-body text-sm font-bold text-ink/70">
            A neighbour has been watching your stand. She wants to own a slice of it.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-4">
          <div className="text-center font-sign text-3xl text-ink">
            {money(offer.cash)} today
          </div>
          <div className="text-center font-body text-sm font-extrabold text-wood-deep">
            for {Math.round(offer.slice * 100)}% of every profit from now on
          </div>
        </div>

        {/* The arithmetic, laid out so the kid can decide rather than guess. */}
        <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
          <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
            What it costs you
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">Your stand makes, a week</span>
            <span>{money(weeklyProfit)}</span>
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">Her {Math.round(offer.slice * 100)}% of that</span>
            <span>{money(offer.weeklyCost)}</span>
          </div>
          <div className="ledger-row border-t-2 border-dashed border-ink/20 pt-1 font-extrabold">
            <span>She gets her {money(offer.cash)} back in</span>
            <span>{offer.paybackWeeks} weeks</span>
          </div>
          <p className="mt-2 font-body text-[12px] font-bold text-ink/55">
            After that, she keeps collecting. For as long as the stand exists.
          </p>
        </div>

        <div className="mt-auto space-y-3 pt-6">
          <ChunkyButton variant="mint" full onClick={onAccept}>
            Take the {money(offer.cash)}
          </ChunkyButton>
          <ChunkyButton variant="ghost" full onClick={onDecline}>
            Keep all of it
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}
