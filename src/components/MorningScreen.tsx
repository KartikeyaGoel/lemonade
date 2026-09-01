'use client';

import { FORECAST_COPY, type GameState, ECON, weekSummary } from '@/lib/simulation';
import {
  ChunkyButton,
  Coach,
  GoalStrip,
  Ground,
  HeaderBar,
  SignHeading,
  Sky,
  WeatherArt,
  money,
} from './ui';
import { Stand } from './Stand';

/**
 * Morning. Zero decisions on purpose — the kid taps once and moves on.
 * Its only job is to make a new day feel like a new day, and to show the
 * forecast as a genuine hint rather than a promise.
 *
 * And, on the very first morning, to say what the game is. It went ten minutes
 * without stating its own objective, which a kid resolves by guessing.
 */
export function MorningScreen({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const forecast = FORECAST_COPY[state.forecast];
  const summary = weekSummary(state.history);
  const yesterday = state.history[state.history.length - 1];
  const firstEver = state.history.length === 0;

  return (
    <Sky mood={state.forecast}>
      <WeatherArt mood={state.forecast} />
      <HeaderBar day={state.day} totalDays={ECON.TOTAL_DAYS} cash={state.cash} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-md flex-col items-center px-5 pb-8 pt-6">
        <SignHeading className="text-center text-5xl">Day {state.day}</SignHeading>

        {firstEver && (
          <div className="w-full">
            <GoalStrip>
              {ECON.TOTAL_DAYS} days to grow {money(ECON.STARTING_CASH)}
            </GoalStrip>
          </div>
        )}

        <div className="signboard mt-5 w-full text-center animate-popIn">
          <div className="font-sign text-3xl text-ink">{forecast.headline}</div>
          <p className="mt-1 font-body text-sm font-bold text-ink/70">{forecast.hint}</p>
          {/* The forecast must never read as a guarantee. */}
          <p className="mt-2 font-body text-xs font-extrabold uppercase tracking-wide text-wood-deep">
            Forecasts are guesses
          </p>
        </div>

        {/* Yesterday, for context. Only appears once there is a yesterday. */}
        {yesterday && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 animate-riseFade">
            <span className="stat-chip">
              Yesterday {money(yesterday.price)} → {money(yesterday.profit)}
            </span>
            {summary.days >= 3 && (
              <span className="stat-chip">
                {summary.days}-day average {money(summary.averageProfit)}
              </span>
            )}
          </div>
        )}

        <div className="relative mt-auto flex w-full flex-1 items-end justify-center pb-6">
          <div className="animate-bob">
            <Stand price={yesterday?.price ?? 1} />
          </div>
        </div>

        {firstEver && (
          <Coach className="relative z-10 mb-1">Buy lemons first. Then pick a price.</Coach>
        )}

        <ChunkyButton variant="lemon" full onClick={onContinue} className="relative z-10">
          {firstEver ? 'Go shopping →' : 'Open up shop →'}
        </ChunkyButton>
      </div>

      <Ground />
    </Sky>
  );
}
