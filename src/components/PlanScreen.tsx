'use client';

import { useState } from 'react';
import {
  ECON,
  FORECAST_COPY,
  DEFAULT_DAY_PARAMS,
  batchPlan,
  maxAffordableCups,
  projectDay,
  toCents,
  totalFixedCost,
  type DayParams,
  type GameState,
} from '@/lib/simulation';
import type { BusinessState } from '@/lib/business';
import { ChunkyButton, HeaderBar, SignHeading, Sky, money } from './ui';
import { Stand } from './Stand';

/**
 * The cockpit, used from day two onwards.
 *
 * Day one is a guided walk through one decision at a time. Once the kid has
 * been round the loop, they get both dials on one screen with the
 * consequences updating live underneath, so they can experiment before
 * committing: order more, watch the cost climb; raise the price, watch the
 * margin and the break-even move.
 *
 * What it deliberately never shows is how many cups will sell. That is the
 * thing they are here to discover, and a projected demand number would hand
 * them the answer. Instead it shows the three honest scenarios — everything
 * sells, half sells, nothing sells — so the risk of over-ordering is legible
 * in advance rather than only visible in hindsight.
 */
export function PlanScreen({
  state,
  params = DEFAULT_DAY_PARAMS,
  business,
  dayLabel,
  onOpen,
  onInvest,
}: {
  state: GameState;
  /** Act 2 onwards: capacity, rent, wages and competition all live here. */
  params?: DayParams;
  business?: BusinessState;
  dayLabel?: string;
  onOpen: (targetCups: number, price: number) => void;
  /** Act 2 only: jump to the shop. */
  onInvest?: () => void;
}) {
  const fixedCost = totalFixedCost(params.fixedCosts);
  const maxCups = Math.max(0, maxAffordableCups(state, fixedCost));
  const yesterday = state.history[state.history.length - 1];

  /**
   * Start the dial where the kid left off, not at Act 1's 28.
   *
   * A kid who has bought a cooler and moved to the park can serve 90 cups; if
   * the slider still defaulted to 28 they would pay $34 a day in rent and
   * wages to sell a third of what they could, and read it as their own bad
   * decision rather than ours.
   */
  const [targetCups, setTargetCups] = useState(() => {
    const capacity = Math.floor(params.serviceCapacity);
    const suggestion = yesterday ? Math.ceil(yesterday.cupsSold * 1.25) : 28;
    return Math.max(8, Math.min(maxCups, capacity, suggestion));
  });
  const [price, setPrice] = useState(() => yesterday?.price ?? 1.5);

  const plan = batchPlan(state, targetCups);
  const projection = projectDay(state, targetCups, price, params);
  const forecast = FORECAST_COPY[state.forecast];
  const rival = business?.rival;
  const rivalHere = Boolean(rival?.active && rival.location === business?.location);
  const atCapacity = projection.cupsMakeable >= Math.floor(params.serviceCapacity);

  return (
    <Sky mood={state.forecast}>
      <HeaderBar
        day={state.history.length + 1}
        totalDays={dayLabel ? null : ECON.TOTAL_DAYS}
        cash={state.cash}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-28 pt-2">
        <div className="flex items-center justify-between gap-3">
          <SignHeading className="text-3xl">{dayLabel ?? `Day ${state.day}`}</SignHeading>
          <span className="stat-chip !text-xs">
            {forecast.headline} · a guess
          </span>
        </div>

        {/* The sign the customers will read, updating as they turn the dial. */}
        <div className="mt-2 flex items-end justify-between gap-2">
          <Stand price={price} compact />
          <div className="flex flex-col items-end gap-1.5 pb-1">
            {yesterday && (
              <span className="stat-chip !text-xs">
                Yesterday {money(yesterday.price)} → {money(yesterday.profit)}
              </span>
            )}
            <span className="stat-chip !text-xs">🥤 {projection.cupsMakeable} cups ready</span>
          </div>
        </div>

        {/* The round. A fact about today, not advice: these cups are already
            promised, at a discount, whatever the sky does. */}
        {params.subscribers > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-[3px] border-mint/60 bg-mint/15 px-3 py-2">
            <span aria-hidden className="text-xl">
              🥛
            </span>
            <div className="flex-1 font-body text-[12px] font-extrabold leading-tight text-ink">
              {params.subscribers} {params.subscribers === 1 ? 'regular is' : 'regulars are'}{' '}
              coming whatever the weather, at{' '}
              {/* toCents, not a hand-rolled round: at $1.70 the two disagree
                  ($1.44 here against $1.45 on the day's statement), and a
                  figure that does not tie back is worse than no figure. */}
              {money(toCents(price * (1 - params.subscriberDiscount)))} a cup.
            </div>
          </div>
        )}

        {/* The rival, if there is one. Shown as a fact, never as advice. */}
        {rivalHere && rival && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-[3px] border-berry/50 bg-berry/10 px-3 py-2">
            <span aria-hidden className="text-xl">
              🧃
            </span>
            <div className="flex-1 font-body text-[12px] font-extrabold leading-tight text-ink">
              The stand across the road is charging{' '}
              <span className="text-berry">{money(rival.price)}</span>.
            </div>
          </div>
        )}

        {onInvest && (
          <button
            type="button"
            onClick={onInvest}
            className="mt-2 w-full rounded-2xl border-[3px] border-wood-dark bg-lemon-light px-3 py-2 text-left font-body text-[12px] font-extrabold text-ink"
          >
            🛠️ Spend money on the stand →
          </button>
        )}

        {/* Dial one: how much to make. */}
        <Dial
          label="How many cups to make"
          value={`${projection.cupsMakeable}`}
          sub={
            atCapacity
              ? `at your limit of ${Math.floor(params.serviceCapacity)} cups a day`
              : `costs ${money(projection.costToBuy)} to buy`
          }
        >
          <input
            aria-label="Batch size in cups"
            className="slider"
            type="range"
            min={0}
            max={Math.max(4, maxCups)}
            step={1}
            value={targetCups}
            onChange={(event) => setTargetCups(Number(event.target.value))}
            style={{ ['--fill' as string]: `${(targetCups / Math.max(4, maxCups)) * 100}%` }}
          />
        </Dial>

        {/* Dial two: what to charge. */}
        <Dial
          label="Price per cup"
          value={money(price)}
          sub={
            projection.losesMoneyPerCup
              ? 'below what a cup costs to make'
              : `you keep ${money(projection.marginPerCup)} per cup`
          }
          alert={projection.losesMoneyPerCup}
        >
          <input
            aria-label="Price per cup"
            className="slider"
            type="range"
            min={0}
            max={300}
            step={5}
            value={Math.round(price * 100)}
            onChange={(event) => setPrice(Number(event.target.value) / 100)}
            style={{ ['--fill' as string]: `${(price / 3) * 100}%` }}
          />
        </Dial>

        {/* Live consequences. Everything here is arithmetic on the two dials. */}
        <div className="mt-3 rounded-2xl border-[3px] border-ink/15 bg-white/90 p-3.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
              Before you open
            </span>
            {projection.breakEvenCups !== null ? (
              <span className="font-body text-[11px] font-extrabold text-wood-deep">
                sell {projection.breakEvenCups} to break even
              </span>
            ) : (
              <span className="font-body text-[11px] font-extrabold text-berry">
                you cannot break even
              </span>
            )}
          </div>

          <div className="ledger-row text-[13px]">
            <span className="text-ink/60">Cup costs you</span>
            <span>{money(projection.costPerCup)}</span>
          </div>
          <div className="ledger-row text-[13px]">
            <span className="text-ink/60">You charge</span>
            <span>{money(price)}</span>
          </div>
          <div className="ledger-row border-t-2 border-dashed border-ink/20 pt-1 text-[13px] font-extrabold">
            <span>You keep, per cup</span>
            <span className={projection.marginPerCup <= 0 ? 'text-berry' : 'text-ink'}>
              {money(projection.marginPerCup)}
            </span>
          </div>

          {/* Every cost owed today whatever happens. In Act 1 this is one line;
              by Act 2 it is rent and wages, and the kid can see it stack up. */}
          {params.fixedCosts.length > 0 && (
            <div className="mt-2 border-t-2 border-dashed border-ink/20 pt-1.5">
              {params.fixedCosts.map((line) => (
                <div key={line.label} className="ledger-row text-[12px] text-ink/55">
                  <span>{line.label}</span>
                  <span>−{money(line.amount)}</span>
                </div>
              ))}
              {params.fixedCosts.length > 1 && (
                <div className="ledger-row text-[12px] font-extrabold text-ink/75">
                  <span>Owed before you sell a thing</span>
                  <span>−{money(fixedCost)}</span>
                </div>
              )}
            </div>
          )}

          {/* The what-if table: the over-ordering lesson, before it costs them. */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Scenario
              label="All sells"
              cups={projection.bestCase.cupsSold}
              profit={projection.bestCase.profit}
            />
            <Scenario
              label="Half sells"
              cups={projection.halfCase.cupsSold}
              profit={projection.halfCase.profit}
            />
            <Scenario label="None sells" cups={0} profit={projection.worstCase.profit} />
          </div>
          <p className="mt-2 font-body text-[11px] font-bold text-ink/45">
            How many actually sell is up to the street. That is the bit you have to figure out.
          </p>
        </div>

      </div>

      {/* Pinned so the kid can twiddle the dials and open up without hunting
          for the button at the bottom of a long panel. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/25 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton
            variant="mint"
            full
            disabled={!plan.affordable}
            onClick={() => onOpen(targetCups, price)}
          >
            Open the stand!
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function Dial({
  label,
  value,
  sub,
  alert,
  children,
}: {
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-2xl border-[3px] border-ink/15 bg-white/80 px-3.5 pb-1 pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-body text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          {label}
        </span>
        <span className="font-sign text-3xl leading-none text-wood-deep">{value}</span>
      </div>
      {children}
      <div
        className={`pb-1.5 text-right font-body text-[11px] font-extrabold ${
          alert ? 'text-berry' : 'text-ink/50'
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

function Scenario({ label, cups, profit }: { label: string; cups: number; profit: number }) {
  const good = profit > 0;
  return (
    <div
      className={`rounded-xl border-2 px-2 py-1.5 text-center ${
        good ? 'border-mint/60 bg-mint/15' : 'border-berry/40 bg-berry/10'
      }`}
    >
      <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/55">
        {label}
      </div>
      <div className="font-body text-[10px] font-bold text-ink/45">{cups} cups</div>
      <div className={`font-ledger text-[13px] font-bold tabular-nums ${good ? 'text-ink' : 'text-berry'}`}>
        {money(profit)}
      </div>
    </div>
  );
}
