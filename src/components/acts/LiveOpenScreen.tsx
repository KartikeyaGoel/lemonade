'use client';

import { useEffect } from 'react';
import { play } from '@/lib/sound';
import { SNAPSHOT } from '@/lib/companies';
import { totalValue, type PortfolioState } from '@/lib/market';
import { lastWeekOnTheMarket, runningFor, type CatchUp } from '@/lib/live';
import { ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * Opening the live account.
 *
 * Everything else in the game happens because the kid pressed something. This
 * screen is the one place where the world moved on its own, and the whole
 * argument for a live market is that a child can feel the difference.
 *
 * Two states, and both are honest:
 *
 *  - **Weeks passed.** Their own money moved while they were not looking, and
 *    the number at the top is the change in *their* money, not the market's.
 *  - **Nothing has happened yet.** The account was opened this week, or they
 *    checked yesterday. We say so, and then show what the market did last week
 *    anyway — real closes, nothing held — because a kid being shown this for
 *    the first time should not have to wait until Monday to find out it is
 *    real. Manufacturing a number instead would be the one unforgivable thing.
 */
export function LiveOpenScreen({
  portfolio,
  report,
  onEnter,
  onBack,
}: {
  portfolio: PortfolioState;
  /** Null when no new week has landed since they were last here. */
  report: CatchUp | null;
  onEnter: () => void;
  onBack: () => void;
}) {
  const moved = report !== null && report.weeks > 0;
  const up = (report?.changeDollars ?? 0) >= 0;

  useEffect(() => {
    if (!moved) return;
    play(up ? 'cash' : 'sad');
  }, [moved, up]);

  const market = lastWeekOnTheMarket();
  const nameOf = (ticker: string) =>
    SNAPSHOT.find((company) => company.ticker === ticker)?.name ?? ticker;
  const emojiOf = (ticker: string) =>
    SNAPSHOT.find((company) => company.ticker === ticker)?.emoji ?? '•';

  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pb-28 pt-8">
        <div className="font-body text-xs font-extrabold uppercase tracking-[0.25em] text-lemon-light">
          The real market
        </div>

        {moved && report ? (
          <>
            <SignHeading className="mt-1 !text-lemon-light text-4xl leading-[0.95]">
              {sinceYouWereHere(report.days, report.weeks)}
            </SignHeading>
            <p className="mt-2 font-body text-sm font-extrabold text-white/70">
              {report.from} to {report.to}. Nobody pressed anything. This is what happened to your
              money.
            </p>

            <div
              className={`mt-4 rounded-2xl border-[3px] p-4 ${
                up ? 'border-mint/60 bg-mint/15' : 'border-berry/50 bg-berry/15'
              }`}
            >
              <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                Your money
              </div>
              <div className="font-sign text-5xl leading-none text-white">
                {money(report.valueAfter)}
              </div>
              <div
                className={`mt-1 font-ledger text-sm font-bold tabular-nums ${
                  up ? 'text-mint' : 'text-berry'
                }`}
              >
                {up ? '+' : ''}
                {money(report.changeDollars)} ({up ? '+' : ''}
                {(report.changePct * 100).toFixed(1)}%) since you were last here
              </div>
              {report.wasScare && (
                <p className="mt-2 rounded-xl bg-black/25 p-2.5 font-body text-[12px] font-extrabold text-lemon-light">
                  One of those weeks was a bad one for nearly everything. That happens several
                  times a year and it is not about you.
                </p>
              )}
            </div>

            <div className="mt-4 rounded-2xl border-[3px] border-white/20 bg-white/90 p-3">
              <div className="mb-1 font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
                What moved
              </div>
              {report.moves.slice(0, 8).map((move) => (
                <Row
                  key={move.ticker}
                  emoji={emojiOf(move.ticker)}
                  name={nameOf(move.ticker)}
                  pct={move.changePct}
                  dollars={move.held ? move.dollars : null}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <SignHeading className="mt-1 !text-lemon-light text-4xl leading-[0.95]">
              Nothing has happened yet.
            </SignHeading>
            <p className="mt-2 font-body text-sm font-extrabold text-white/70">
              {runningFor(portfolio)} Prices land once a week, so there is nothing new to see and
              nothing you need to do. Waiting is most of this.
            </p>

            <div className="mt-4 rounded-2xl border-[3px] border-white/25 bg-white/10 p-4">
              <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
                Your money
              </div>
              <div className="font-sign text-5xl leading-none text-white">
                {money(totalValue(portfolio))}
              </div>
            </div>

            {/* Real, and true on the very first visit. */}
            <div className="mt-4 rounded-2xl border-[3px] border-white/20 bg-white/90 p-3">
              <div className="mb-0.5 font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
                What the market did last week
              </div>
              <div className="mb-1.5 font-body text-[11px] font-bold text-ink/45">
                {market.from} to {market.to}. Real closes, whether you own them or not.
              </div>
              {market.moves.slice(0, 3).map((move) => (
                <Row
                  key={move.ticker}
                  emoji={emojiOf(move.ticker)}
                  name={nameOf(move.ticker)}
                  pct={move.changePct}
                  dollars={null}
                />
              ))}
              <div className="my-1 border-t-2 border-dashed border-ink/15" />
              {market.moves.slice(-3).map((move) => (
                <Row
                  key={move.ticker}
                  emoji={emojiOf(move.ticker)}
                  name={nameOf(move.ticker)}
                  pct={move.changePct}
                  dollars={null}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/70 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md space-y-2.5 px-4">
          <ChunkyButton variant="lemon" full onClick={onEnter}>
            Go to the market →
          </ChunkyButton>
          <ChunkyButton variant="ghost" full onClick={onBack} className="!text-base">
            Back
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

/**
 * How long they were away, said in whatever unit is true.
 *
 * The newest row of price data is the week in progress, so a kid who comes
 * back after two days has genuinely missed a price change and genuinely has
 * not missed a week. Saying "0 weeks went by" over a number that moved would
 * be the sort of small wrongness that makes a child stop reading the words.
 */
function sinceYouWereHere(days: number, weeks: number): string {
  if (weeks >= 2) return `${weeks} weeks went by.`;
  if (weeks === 1) return 'A week went by.';
  if (days === 1) return 'A day went by.';
  return `${days} days went by.`;
}

function Row({
  emoji,
  name,
  pct,
  dollars,
}: {
  emoji: string;
  name: string;
  pct: number;
  dollars: number | null;
}) {
  const up = pct >= 0;
  return (
    <div className="flex items-center gap-2 py-1">
      <span aria-hidden>{emoji}</span>
      <span className="flex-1 truncate font-body text-sm font-extrabold text-ink">{name}</span>
      {dollars !== null && dollars !== 0 && (
        <span
          className={`font-ledger text-xs font-bold tabular-nums ${
            dollars >= 0 ? 'text-mint' : 'text-berry'
          }`}
        >
          {dollars >= 0 ? '+' : ''}
          {money(dollars)}
        </span>
      )}
      <span
        className={`w-14 text-right font-ledger text-xs font-bold tabular-nums ${
          up ? 'text-mint' : 'text-berry'
        }`}
      >
        {up ? '+' : ''}
        {(pct * 100).toFixed(1)}%
      </span>
    </div>
  );
}
