'use client';

import { useState } from 'react';
import { ECON, type GameState } from '@/lib/simulation';
import { PipBubble } from './Pip';
import { ActionFooter, ChunkyButton, HeaderBar, SignHeading, Sky, money, plural } from './ui';
import { Stand } from './Stand';

/**
 * Pricing, as one decision — and the most important one in the game.
 *
 * The kid sees the price enormous and physical, on the actual sign the
 * customers will read. What they are shown alongside it escalates: on day
 * one, nothing but the price. Once they have earned the word "margin", the
 * per-cup breakdown appears, because by then it means something.
 */
export function PriceScreen({
  state,
  cupsMakeable,
  perCupCost,
  learned,
  onConfirm,
  onBack,
}: {
  state: GameState;
  cupsMakeable: number;
  /**
   * What a cup of *today's* lemonade costs, at the recipe just chosen.
   *
   * Passed in rather than derived here. This screen used to call
   * `ingredientCostOf(cupsMakeable)`, which prices lemons flat — so after the
   * grade lever arrived it told a child who had just bought posh lemons that a
   * cup cost 20c when it cost 29c, and then said "charge more than that".
   * That is the one number a price has to beat, and it was wrong in the
   * direction that loses money on every cup.
   *
   * The caller knows the grade and the order size, and the order size is what
   * decides the bulk discount, so the caller is the only place this can be
   * worked out correctly.
   */
  perCupCost: number;
  learned: string[];
  onConfirm: (price: number) => void;
  onBack: () => void;
}) {
  const yesterday = state.history[state.history.length - 1];
  const [price, setPrice] = useState(() => yesterday?.price ?? 1);

  const perCup = perCupCost;
  const marginPerCup = price - perCup;
  const showMargin = learned.includes('margin') || learned.includes('unit-cost');
  const firstEver = state.history.length === 0;

  const nudge = (delta: number) =>
    setPrice((current) => Math.min(ECON.MAX_PRICE, Math.max(0, Math.round((current + delta) * 100) / 100)));

  return (
    <Sky mood={state.forecast}>
      <HeaderBar day={state.day} totalDays={ECON.TOTAL_DAYS} cash={state.cash} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-md flex-col px-5 pb-8 pt-4">
        <SignHeading className="text-center">What will you charge?</SignHeading>

        <div className="mt-4 flex justify-center">
          <Stand price={price} compact />
        </div>

        {firstEver && (
          <PipBubble point="up" className="mt-1">
            A cup costs you {money(perCup)} to make. Charge more than that.
          </PipBubble>
        )}

        {/* Big physical stepper: the primary control. */}
        <div className="mt-5 flex items-center justify-center gap-4">
          <ChunkyButton variant="ghost" onClick={() => nudge(-0.05)} className="!h-16 !w-16 !px-0 !font-body !text-4xl !font-black">
            −
          </ChunkyButton>
          <div className="min-w-[150px] text-center">
            <div className="font-sign text-6xl leading-none text-berry">{money(price)}</div>
            <div className="font-body text-xs font-extrabold uppercase tracking-widest text-ink/50">
              per cup
            </div>
          </div>
          <ChunkyButton variant="ghost" onClick={() => nudge(0.05)} className="!h-16 !w-16 !px-0 !font-body !text-4xl !font-black">
            +
          </ChunkyButton>
        </div>

        <input
          aria-label="Price per cup"
          className="slider mt-5"
          type="range"
          min={0}
          max={300}
          step={5}
          value={Math.round(price * 100)}
          onChange={(event) => setPrice(Number(event.target.value) / 100)}
          style={{ ['--fill' as string]: `${(price / 3) * 100}%` }}
        />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="stat-chip">🥤 {plural(cupsMakeable, 'cup')} ready</span>
          {yesterday && <span className="stat-chip">Yesterday {money(yesterday.price)}</span>}
        </div>

        {/* Escalating rigour: only shown once the kid owns the concept. */}
        {showMargin && cupsMakeable > 0 && (
          <div className="mt-4 rounded-2xl border-[3px] border-ink/15 bg-white/85 p-4 animate-riseFade">
            <div className="ledger-row">
              <span>Price per cup</span>
              <span>{money(price)}</span>
            </div>
            <div className="ledger-row text-ink/60">
              <span>Costs you to make</span>
              <span>−{money(perCup)}</span>
            </div>
            <div className="ledger-row mt-1 border-t-2 border-dashed border-ink/20 pt-1 font-extrabold">
              <span>You keep, per cup</span>
              <span className={marginPerCup < 0 ? 'text-berry' : 'text-ink'}>{money(marginPerCup)}</span>
            </div>
            {marginPerCup < 0 && (
              <p className="mt-2 font-body text-xs font-extrabold text-berry">
                You would lose money on every single cup.
              </p>
            )}
          </div>
        )}

        <ActionFooter className="mt-auto flex gap-3 pt-6">
          <ChunkyButton variant="ghost" onClick={onBack} className="!px-5 !text-xl">
            ←
          </ChunkyButton>
          <ChunkyButton variant="mint" full onClick={() => onConfirm(price)}>
            Open the stand!
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}
