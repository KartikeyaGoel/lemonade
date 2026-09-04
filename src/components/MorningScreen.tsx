'use client';

import { FORECAST_COPY, type GameState, ECON, weekSummary } from '@/lib/simulation';
import { PipBubble } from './Pip';
import { ActionFooter, ChunkyButton, GoalStrip, Ground, HeaderBar, SignHeading, Sky, WeatherArt, money } from './ui';
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
            {/*
              Day one, and the stage's real goal has not been set yet.
              FRAMEWORK.md §1 asks for "1-2 exploratory rounds without a
              target", so this says what the next two days are *for* rather
              than naming a figure.

              It used to read "7 days to grow $20.00", which was a third
              objective: the stage now ends on two good days rather than on the
              clock, and the plan screen names "$25 in a day, twice" from day
              three. Two different goals inside one stage, and a child cannot
              tell which one they are being judged on.
            */}
            <GoalStrip>Two days to try things out</GoalStrip>
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

        <ActionFooter className="relative mt-auto flex w-full flex-1 items-end justify-center pb-6">
          <div className="animate-bob">
            <Stand price={yesterday?.price ?? 1} />
          </div>
        </ActionFooter>

        {firstEver && (
          <PipBubble className="relative z-10 mb-1">Buy lemons first. Then pick a price.</PipBubble>
        )}

        <ChunkyButton variant="lemon" full onClick={onContinue} className="relative z-10">
          {firstEver ? 'Go shopping →' : 'Open up shop →'}
        </ChunkyButton>
      </div>

      <Ground />
    </Sky>
  );
}
