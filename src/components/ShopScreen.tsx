'use client';

import { useState } from 'react';
import {
  ECON,
  batchPlan,
  maxAffordableCups,
  type GameState,
  totalLemons,
} from '@/lib/simulation';
import { ChunkyButton, HeaderBar, SignHeading, Sky, money } from './ui';

/**
 * Shopping, as one decision.
 *
 * A kid does not buy lemons, sugar and cups separately here — they choose a
 * batch size and the game does the shopping list. The itemised receipt is
 * then shown to them, which is where unit cost is actually taught: they see
 * that 28 cups costs $5.60, that it works out at about 20c a cup, and that
 * supplies come in lumps.
 */
export function ShopScreen({
  state,
  onConfirm,
  onBack,
}: {
  state: GameState;
  onConfirm: (targetCups: number) => void;
  onBack: () => void;
}) {
  const maxCups = Math.max(0, maxAffordableCups(state));
  // Default to something sensible so a first-timer can simply tap through.
  const [target, setTarget] = useState(() => Math.min(maxCups, 28));
  const plan = batchPlan(state, target);

  const pantryLemons = totalLemons(state.lemonLots);
  const hasPantry = pantryLemons > 0 || state.sugarServings > 0 || state.cupsInStock > 0;

  return (
    <Sky mood="dawn">
      <HeaderBar day={state.day} totalDays={ECON.TOTAL_DAYS} cash={state.cash} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-md flex-col px-5 pb-8 pt-4">
        <SignHeading className="text-center">How much can you make?</SignHeading>

        {/* The one number the kid actually sets. */}
        <div className="mt-6 text-center">
          <div className="font-sign text-7xl leading-none text-wood-deep">{plan.cupsMakeable}</div>
          <div className="font-body text-sm font-extrabold uppercase tracking-widest text-ink/60">
            cups of lemonade
          </div>
        </div>

        <input
          aria-label="Batch size in cups"
          className="slider mt-5"
          type="range"
          min={0}
          max={Math.max(4, maxCups)}
          step={1}
          value={target}
          onChange={(event) => setTarget(Number(event.target.value))}
          style={{ ['--fill' as string]: `${(target / Math.max(4, maxCups)) * 100}%` }}
        />
        <div className="flex justify-between font-body text-xs font-extrabold text-ink/50">
          <span>none</span>
          <span>as much as you can afford</span>
        </div>

        {/* The receipt. This is the unit-cost lesson, shown not told. */}
        <div className="mt-5 rounded-2xl border-[3px] border-ink/15 bg-white/85 p-4">
          <div className="mb-2 font-body text-xs font-extrabold uppercase tracking-widest text-ink/50">
            Shopping list
          </div>

          <ReceiptLine
            emoji="🍋"
            label={`Lemons x${plan.order.buyLemons}`}
            note={`${ECON.CUPS_PER_LEMON} cups each`}
            amount={plan.cost.lemons}
          />
          <ReceiptLine
            emoji="🥄"
            label={`Sugar x${plan.order.buySugarPacks}`}
            note={`${ECON.SUGAR_SERVINGS_PER_PACK} cups each`}
            amount={plan.cost.sugar}
          />
          <ReceiptLine
            emoji="🥤"
            label={`Cups x${plan.order.buyCupPacks}`}
            note={`${ECON.CUPS_PER_CUP_PACK} per pack`}
            amount={plan.cost.cups}
          />

          <div className="mt-2 border-t-2 border-dashed border-ink/20 pt-2">
            <div className="ledger-row font-extrabold">
              <span>Total to spend</span>
              <span>{money(plan.cost.total)}</span>
            </div>
            {plan.cupsMakeable > 0 && (
              <div className="ledger-row mt-1 text-ink/60">
                <span>Cost per cup</span>
                <span>{money(plan.costPerCup)}</span>
              </div>
            )}
          </div>

          {hasPantry && (
            <p className="mt-3 font-body text-xs font-bold text-ink/60">
              Using what you already have first: {pantryLemons} lemons, {state.sugarServings} sugar,{' '}
              {state.cupsInStock} cups.
            </p>
          )}
          {plan.cupsMakeable > plan.targetCups && plan.targetCups > 0 && (
            <p className="mt-2 font-body text-xs font-bold text-ink/60">
              Lemons come whole and packs come in tens, so you get {plan.cupsMakeable} cups.
            </p>
          )}
        </div>

        <div className="mt-auto flex gap-3 pt-6">
          <ChunkyButton variant="ghost" onClick={onBack} className="!px-5 !text-xl">
            ←
          </ChunkyButton>
          <ChunkyButton
            variant="lemon"
            full
            disabled={!plan.affordable}
            onClick={() => onConfirm(target)}
          >
            Set my price →
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function ReceiptLine({
  emoji,
  label,
  note,
  amount,
}: {
  emoji: string;
  label: string;
  note: string;
  amount: number;
}) {
  return (
    <div className="ledger-row py-1">
      <span className="flex items-baseline gap-2">
        <span aria-hidden>{emoji}</span>
        <span className="font-body font-extrabold">{label}</span>
        <span className="font-body text-xs font-bold text-ink/40">{note}</span>
      </span>
      <span>{money(amount)}</span>
    </div>
  );
}
