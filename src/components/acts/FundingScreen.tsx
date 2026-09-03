'use client';

import { useState } from 'react';
import {
  LOAN,
  SHOP,
  fundingOptions,
  loanInterest,
  loanQuote,
  type FundingOption,
} from '@/lib/retail';
import { EQUITY_SLICES, MAX_EQUITY_SOLD, equityOffer } from '@/lib/ownership';
import type { DayRecord } from '@/lib/simulation';
import { ActionFooter, ChunkyButton, SignHeading, Sky, money } from '../ui';
import { plural } from '@/lib/copy';

/**
 * How to pay for a door.
 *
 * The first thing in the game the kid cannot buy out of profit, and therefore
 * the first time capital is a decision rather than a purchase. Three answers,
 * all real:
 *
 *  - **Wait.** Cheapest, and it costs the thing a child feels most.
 *  - **Borrow.** Fast, and $100 of the $500 handed back is the cost of the
 *    speed. Owed on the day nobody comes in.
 *  - **Sell a slice.** Fast, nothing owed on a bad day, and it never stops
 *    costing — a share of every profit from now until the company is sold.
 *
 * Nothing here says which one is right, because none of them is. That is the
 * whole point of putting them side by side, and it is why "wait" is on the
 * list at all: a game that hides the patient option has taught a child that
 * borrowing is what grown-ups do.
 *
 * It is deliberately not a wizard. Every figure updates as the equity dial
 * moves, the three cards sit on one screen, and backing out is a button.
 */
export function FundingScreen({
  cash,
  history,
  weeklyProfit,
  alreadySold,
  onPayCash,
  onBorrow,
  onSellSlice,
  onBack,
}: {
  cash: number;
  history: DayRecord[];
  weeklyProfit: number;
  /** A slice sold earlier caps what is left to sell. */
  alreadySold: number;
  onPayCash: () => void;
  onBorrow: () => void;
  onSellSlice: (slice: number) => void;
  onBack: () => void;
}) {
  const [slice, setSlice] = useState<number>(0.2);
  const offer = equityOffer(history, slice);
  const quote = loanQuote();
  const options = fundingOptions(cash, offer.cash);
  const short = Math.max(0, SHOP.fitOut - cash);

  const pick = (option: FundingOption) => {
    if (option.id === 'cash') onPayCash();
    else if (option.id === 'loan') onBorrow();
    else onSellSlice(offer.slice);
  };

  const byId = (id: FundingOption['id']) => options.find((option) => option.id === id)!;

  return (
    <Sky mood="probably-mild">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            🏪
          </div>
          <SignHeading className="mt-2 text-4xl">The shop on the corner</SignHeading>
          <p className="mt-2 font-body text-sm font-bold text-ink/70">
            A room with a door. Rain stops mattering. It costs more than you have.
          </p>
        </div>

        {/* The gap, stated once, in the only terms that matter. */}
        <div className="mt-5 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-4">
          <div className="ledger-row">
            <span className="text-wood-deep/70">Fitting it out</span>
            <span>{money(SHOP.fitOut)}</span>
          </div>
          <div className="ledger-row">
            <span className="text-wood-deep/70">In the cash box</span>
            <span>{money(cash)}</span>
          </div>
          <div className="ledger-row border-t-2 border-dashed border-wood-dark/30 pt-1 font-extrabold">
            <span>{short > 0 ? 'Short by' : 'Left over'}</span>
            <span className={short > 0 ? 'text-berry' : 'text-mint-deep'}>
              {money(short > 0 ? short : cash - SHOP.fitOut)}
            </span>
          </div>
          <p className="mt-2 font-body text-[12px] font-bold text-wood-deep/70">
            Then {money(SHOP.rent)} a day in rent, owed whether or not anybody comes in.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {/* 1 — wait for it */}
          <Option
            emoji="🪙"
            name="Pay for it yourself"
            cost="Nothing extra. You keep all of it and you wait."
            enough={byId('cash').enough}
            shortBy={short}
            onPick={() => pick(byId('cash'))}
            cta={`Pay ${money(SHOP.fitOut)} now`}
          />

          {/* 2 — borrow it */}
          <Option
            emoji="🏦"
            name="Borrow from the bank"
            /* The extra is named as its own figure, because it is the whole
               of what this option costs and it is the word the loan earns. */
            cost={`Take ${money(quote.principal)} today, hand back ${money(quote.total)} over ${LOAN.days} days. The extra ${money(loanInterest(quote))} is what borrowing costs. ${money(quote.daily)} is owed every single day, good day or bad.`}
            enough={byId('loan').enough}
            shortBy={Math.max(0, SHOP.fitOut - cash - quote.principal)}
            onPick={() => pick(byId('loan'))}
            cta={`Borrow ${money(quote.principal)}`}
          />

          {/* 3 — sell a slice, on a dial */}
          <div className="rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-3xl leading-none">
                🤝
              </span>
              <div className="flex-1">
                <div className="font-sign text-xl text-ink">Sell a slice to Auntie Ro</div>
                <p className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/65">
                  Nothing is ever owed back. She keeps her share of every profit, for as long as
                  you own this.
                </p>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label="How much of the business to sell"
              className="mt-3 flex justify-center gap-1.5"
            >
              {EQUITY_SLICES.filter((option) => option + alreadySold <= MAX_EQUITY_SOLD).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={option === offer.slice}
                  onClick={() => setSlice(option)}
                  className={`min-w-[46px] rounded-xl border-[3px] px-2 py-1.5 font-ledger text-sm font-bold tabular-nums transition ${
                    option === offer.slice
                      ? 'border-wood-dark bg-lemon-light text-ink'
                      : 'border-wood-dark/25 bg-white text-ink/55'
                  }`}
                >
                  {Math.round(option * 100)}%
                </button>
              ))}
            </div>

            {/* Labels kept short on purpose. At 320 pixels these rows wrapped
                mid-phrase and the figure stayed on the first line, so "She pays
                you today $118.35" read as "$118.35 ... today". A number that
                has come away from its own label is worse than no label. */}
            <div className="mt-3 rounded-xl border-[3px] border-ink/12 bg-cream px-3 py-2">
              <div className="ledger-row">
                <span className="text-ink/60">She pays today</span>
                <span>{money(offer.cash)}</span>
              </div>
              <div className="ledger-row">
                <span className="text-ink/60">Her cut, a week</span>
                <span className="text-berry">{money(offer.weeklyCost)}</span>
              </div>
              <div className="ledger-row border-t-2 border-dashed border-ink/15 pt-1 font-extrabold">
                <span>Her money back in</span>
                <span>{plural(offer.paybackWeeks, 'week')}</span>
              </div>
              <p className="mt-1 font-body text-[11px] font-bold text-ink/50">
                Your stand makes about {money(weeklyProfit)} a week. After those{' '}
                {plural(offer.paybackWeeks, 'week')}, she keeps collecting.
              </p>
            </div>

            {/* Never disabled, because selling a slice is a real thing to do
                whether or not it happens to reach the fit-out today. When it
                does not, the button says exactly what will be left to find. */}
            <div className="mt-3">
              <ChunkyButton variant="mint" full cue="cash" onClick={() => pick(byId('investor'))}>
                Sell {Math.round(offer.slice * 100)}% for {money(offer.cash)}
              </ChunkyButton>
              {!byId('investor').enough && (
                <p className="mt-1.5 text-center font-body text-[11px] font-extrabold text-berry">
                  That still leaves {money(Math.max(0, SHOP.fitOut - cash - offer.cash))} to find.
                </p>
              )}
            </div>
          </div>
        </div>

        <ActionFooter className="mt-auto pt-6">
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Not yet — keep trading
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}

function Option({
  emoji,
  name,
  cost,
  enough,
  shortBy,
  cta,
  onPick,
}: {
  emoji: string;
  name: string;
  cost: string;
  enough: boolean;
  shortBy: number;
  cta: string;
  onPick: () => void;
}) {
  return (
    <div className="rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-3xl leading-none">
          {emoji}
        </span>
        <div className="flex-1">
          <div className="font-sign text-xl text-ink">{name}</div>
          <p className="mt-1 font-body text-[12px] font-bold leading-snug text-ink/65">{cost}</p>
        </div>
      </div>
      <div className="mt-3">
        <ChunkyButton
          variant={enough ? 'mint' : 'ghost'}
          full
          disabled={!enough}
          cue={enough ? 'cash' : 'tap'}
          onClick={onPick}
        >
          {enough ? cta : `Still ${money(shortBy)} short`}
        </ChunkyButton>
      </div>
    </div>
  );
}
