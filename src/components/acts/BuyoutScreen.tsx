'use client';

import { peBridge, type BuyoutOffer } from '@/lib/ownership';
import { ChunkyButton, clearsBar, money, PinnedBar, SignHeading, Sky } from '../ui';

/**
 * The buyout. The emotional peak of the game, and the moment PE stops being a
 * ratio and becomes a cheque with the kid's name on it.
 *
 * The multiple is shown as the division that produced it, using their own
 * trailing profit, because the entire bridge to the market rests on the kid seeing
 * that it was one sum they could have done themselves.
 */
export function BuyoutScreen({
  offer,
  onAccept,
  onDecline,
  canDecline = true,
}: {
  offer: BuyoutOffer;
  onAccept: () => void;
  onDecline: () => void;
  canDecline?: boolean;
}) {
  const bridge = peBridge(offer);

  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-8" style={clearsBar()}>
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            📄
          </div>
          <SignHeading className="mt-2 text-4xl">An offer for the whole thing</SignHeading>
        </div>

        <div className="mt-5 rounded-2xl border-[4px] border-wood-dark bg-lemon-light p-5 text-center">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.18em] text-wood-deep">
            They will pay
          </div>
          <div className="font-sign text-6xl leading-none text-ink">{money(offer.price)}</div>
          <div className="mt-1 font-body text-sm font-extrabold text-wood-deep">
            {offer.multiple} × what you make in a week
          </div>
        </div>

        {/* The division, spelled out. */}
        <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
          <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
            Where that number came from
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">Your weekly profit</span>
            <span>{money(offer.weeklyProfit)}</span>
          </div>
          <div className="ledger-row">
            <span className="text-ink/60">Times</span>
            <span>{offer.multiple}</span>
          </div>
          <div className="ledger-row border-t-2 border-ink/60 pt-1 text-base font-extrabold">
            <span>Their offer</span>
            <span>{money(offer.price)}</span>
          </div>

          <p className="mt-3 font-body text-[12px] font-bold text-ink/70">{offer.reason}</p>

          {/* The round premium, said out loud. Without this the extra weeks of
              profit just appear in the multiple and the kid never finds out
              that predictable customers are what earned them — which is the
              whole reason Netflix is priced above a restaurant. */}
          {offer.premiumReason && (
            <div className="mt-2 rounded-xl border-2 border-mint/60 bg-mint/15 p-2.5">
              <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                And {offer.roundPremium} more for the round
              </div>
              <p className="mt-0.5 font-body text-[12px] font-bold leading-snug text-ink/75">
                {offer.premiumReason}
              </p>
            </div>
          )}

          {offer.investorShare > 0 && (
            <div className="mt-3 rounded-xl bg-berry/10 p-3">
              <div className="ledger-row text-[13px]">
                <span className="text-ink/70">Your neighbour&apos;s 20% of the sale</span>
                <span className="text-berry">−{money(offer.investorShare)}</span>
              </div>
              <div className="ledger-row text-[14px] font-extrabold">
                <span>You walk away with</span>
                <span>{money(offer.proceeds)}</span>
              </div>
              <p className="mt-1 font-body text-[11px] font-bold text-ink/55">
                That slice you sold early cost you a piece of the sale too.
              </p>
            </div>
          )}
        </div>

        {/* The bridge to the market, generated from their real sale. */}
        <div className="mt-4 rounded-2xl border-[3px] border-dashed border-ink/30 bg-ink/5 p-4">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
            This ratio has a name
          </div>
          <p className="mt-1.5 font-ledger text-[13px] leading-relaxed text-ink/80">
            {bridge.ratioLine}
          </p>
          <p className="mt-1.5 font-body text-[13px] font-bold text-ink/70">{bridge.yieldLine}</p>
          <p className="mt-2 font-body text-sm font-extrabold text-ink">
            Every company on the stock market is priced the same way.
          </p>
        </div>
      </div>

      <PinnedBar className="z-30 bg-gradient-to-t from-black/30 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md space-y-2.5 px-4">
          <ChunkyButton variant="mint" full onClick={onAccept}>
            Sell for {money(offer.proceeds)}
          </ChunkyButton>
          {canDecline && (
            <ChunkyButton variant="ghost" full onClick={onDecline} className="!text-lg">
              Not yet — keep trading
            </ChunkyButton>
          )}
        </div>
      </PinnedBar>
    </Sky>
  );
}
