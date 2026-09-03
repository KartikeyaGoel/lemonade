'use client';

import { SNAPSHOT } from '@/lib/companies';
import { type WeekReport } from '@/lib/market';
import { ActionFooter, ChunkyButton, SignHeading, Sky, money } from '../ui';

/**
 * A week of the market passing.
 *
 * The scare week gets its own framing, because the point of the market is that a
 * kid meets a falling market inside a game rather than for the first time with
 * their own savings. We name what happened and ask the only useful question,
 * without telling them what to do about it.
 */
export function WeekReportScreen({
  report,
  heldTickers,
  onContinue,
}: {
  report: WeekReport;
  heldTickers: string[];
  onContinue: () => void;
}) {
  const mine = report.moves.filter((m) => heldTickers.includes(m.ticker));
  const shown = mine.length > 0 ? mine : report.moves.slice(0, 5);
  const up = report.changePct >= 0;

  return (
    <Sky mood={report.wasScare ? 'night' : 'dusk'}>
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div className="font-body text-xs font-extrabold uppercase tracking-[0.2em] text-ink/50">
            Week {report.week}
          </div>
          {report.wasScare ? (
            <>
              <div aria-hidden className="mt-1 text-5xl">
                📉
              </div>
              <SignHeading className="mt-1 !text-lemon-light text-4xl">
                The whole market fell
              </SignHeading>
              <p className="mt-1 font-body text-xs font-extrabold text-white/70">
                Everything down about {Math.abs(Math.round(report.marketChangePct * 100))}% at once.
                This week really happened.
              </p>
            </>
          ) : (
            <SignHeading className="mt-1 text-4xl">
              {up ? 'Your money grew' : 'Your money dipped'}
            </SignHeading>
          )}
        </div>

        {heldTickers.length > 0 && (
          <div
            className={`mt-4 rounded-2xl border-[3px] p-4 text-center ${
              up ? 'border-mint/60 bg-mint/15' : 'border-berry/50 bg-berry/10'
            }`}
          >
            <div className="font-ledger text-3xl font-bold tabular-nums text-ink">
              {money(report.portfolioAfter)}
            </div>
            <div
              className={`font-body text-sm font-extrabold ${up ? 'text-mint' : 'text-berry'}`}
            >
              {up ? '+' : ''}
              {(report.changePct * 100).toFixed(1)}% this week
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white p-3 shadow-lg">
          <div className="mb-1.5 font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
            {mine.length > 0 ? 'What you own' : 'Around the market'}
          </div>
          {shown.map((move) => {
            const company = SNAPSHOT.find((c) => c.ticker === move.ticker)!;
            const rose = move.changePct >= 0;
            return (
              <div key={move.ticker} className="flex items-center gap-2 py-1">
                <span aria-hidden>{company.emoji}</span>
                <span className="flex-1 font-body text-sm font-extrabold text-ink">
                  {company.name}
                </span>
                <span className="font-ledger text-xs tabular-nums text-ink/50">
                  {money(move.from)} → {money(move.to)}
                </span>
                <span
                  className={`w-14 text-right font-ledger text-sm font-bold tabular-nums ${
                    rose ? 'text-mint' : 'text-berry'
                  }`}
                >
                  {rose ? '+' : ''}
                  {(move.changePct * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>

        {report.wasScare && (
          <div className="mt-4 rounded-2xl border-[3px] border-lemon/50 bg-lemon/15 p-4">
            <p className="font-body text-sm font-extrabold text-ink">
              Nothing changed about what these businesses sell this week. Only what people were
              willing to pay for them changed.
            </p>
            <p className="mt-2 font-body text-[13px] font-bold text-ink/70">
              So: has any of these businesses actually got worse? That is the only question worth
              answering before you do anything.
            </p>
          </div>
        )}

        {report.nowUnderwater.length > 0 && !report.wasScare && (
          <p className="mt-3 rounded-xl bg-white/80 p-3 font-body text-[12px] font-bold text-ink/70">
            {report.nowUnderwater.join(', ')} {report.nowUnderwater.length === 1 ? 'is' : 'are'} now
            worth less than you paid.
          </p>
        )}

        <ActionFooter className="mt-auto pt-6">
          <ChunkyButton variant="lemon" full onClick={onContinue}>
            Back to the market →
          </ChunkyButton>
        </ActionFooter>
      </div>
    </Sky>
  );
}
