'use client';

import { useState } from 'react';
import {
  compareRuns,
  decodeChallenge,
  decodeResult,
  encodeChallenge,
  encodeResult,
  type ChallengeSpec,
  type Comparison,
  type RunResult,
} from '@/lib/challenge';
import { ChunkyButton, CodeBox, CodeInput, SignHeading, Sky, money } from '../ui';

/**
 * Same-Sky Challenge.
 *
 * The seed is the week. Two kids who put in the same code get the identical
 * seven days — the same forecasts, the same days that turned out hot when they
 * were promised cool — so the entire difference in the result is decisions.
 *
 * Which is why this screen never leads with the winner. It leads with the
 * arithmetic of *why*, and the four lines add up to the gap. "You beat me by $41
 * and $28 of it was charging twenty cents more" teaches something. "You won"
 * does not.
 */
export function ChallengeScreen({
  mySpec,
  myResult,
  onPlayChallenge,
  onCompared,
  onBack,
}: {
  mySpec: ChallengeSpec | null;
  myResult: RunResult | null;
  onPlayChallenge: (spec: ChallengeSpec) => void;
  /** Fires once, when a friend's score has actually been read in. */
  onCompared: (comparison: Comparison) => void;
  onBack: () => void;
}) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  if (comparison) {
    return <CompareView comparison={comparison} onBack={() => setComparison(null)} />;
  }

  return (
    <Sky mood="dusk">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div aria-hidden className="text-5xl">
            ⚔️
          </div>
          <SignHeading className="mt-2 text-4xl">Same sky</SignHeading>
          <p className="mt-2 font-body text-sm font-bold leading-snug text-ink/70">
            Send a friend the exact week you just played — same weather, same everything. Then
            the only difference is what you each decided.
          </p>
        </div>

        {mySpec && myResult && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border-[3px] border-ink/20 bg-white/80 p-3">
              <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
                Your week
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-sign text-4xl text-ink">{money(myResult.profit)}</span>
                <span className="font-body text-xs font-extrabold text-ink/55">
                  {myResult.cupsSold} cups, {myResult.spoiledLemons} lemons wasted
                </span>
              </div>
            </div>

            <CodeBox label="1. Send them this to play your week" code={encodeChallenge(mySpec)} />
            <CodeBox label="2. Then send them your score" code={encodeResult(myResult)} />
          </div>
        )}

        <div className="mt-6">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Got their score? Paste it
          </div>
          <div className="mt-1.5">
            <CodeInput
              placeholder="RUN-..."
              action="Compare us"
              error={resultError}
              onSubmit={(value) => {
                const theirs = decodeResult(value);
                if (!theirs) {
                  setResultError('That score code is not right. Check for a missing character.');
                  return;
                }
                if (!myResult) {
                  setResultError('Play a week of your own first, so there is something to compare.');
                  return;
                }
                setResultError(null);
                const result = compareRuns(myResult, theirs);
                setComparison(result);
                onCompared(result);
              }}
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Or play somebody else&apos;s week
          </div>
          <div className="mt-1.5">
            <CodeInput
              placeholder="SKY-..."
              action="Play this week"
              error={challengeError}
              onSubmit={(value) => {
                const spec = decodeChallenge(value);
                if (!spec) {
                  setChallengeError('That week code is not right. Check for a missing character.');
                  return;
                }
                setChallengeError(null);
                onPlayChallenge(spec);
              }}
            />
          </div>
          <p className="mt-1.5 font-body text-[11px] font-bold text-ink/50">
            This starts a fresh stand on their weather. Your trophies stay.
          </p>
        </div>

        <div className="mt-auto pt-6">
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Back
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function CompareView({
  comparison,
  onBack,
}: {
  comparison: Comparison;
  onBack: () => void;
}) {
  const { mine, theirs } = comparison;
  return (
    <Sky mood={comparison.winner === 'you' ? 'hot' : 'dusk'}>
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="text-center">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink/50">
            {comparison.sameSky ? 'Same sky, same week' : 'Different weeks'}
          </div>
          <SignHeading className="mt-1 text-4xl">{comparison.headline}</SignHeading>
          {comparison.cause && (
            <p className="mt-2 font-body text-sm font-extrabold text-ink/70">{comparison.cause}</p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Side name="You" result={mine} winner={comparison.winner === 'you'} />
          <Side name={theirs.who} result={theirs} winner={comparison.winner === 'them'} />
        </div>

        <div className="mt-5 rounded-2xl border-[3px] border-ink/20 bg-white p-4 shadow-lg">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Where the gap came from
          </div>
          <div className="mt-2 space-y-2.5">
            {comparison.lines.length === 0 && (
              <div className="font-body text-[13px] font-bold text-ink/60">
                Nothing separated you worth naming. You played it the same way.
              </div>
            )}
            {comparison.lines.map((line) => (
              <div key={line.label}>
                <div className="ledger-row">
                  <span className="font-body text-[13px] font-extrabold">{line.label}</span>
                  <span className={line.dollars >= 0 ? 'text-mint-deep' : 'text-berry'}>
                    {line.dollars >= 0 ? '+' : ''}
                    {money(line.dollars)}
                  </span>
                </div>
                <div className="font-body text-[11px] font-bold text-ink/55">{line.note}</div>
              </div>
            ))}
          </div>
          {comparison.lines.length > 0 && (
            <div className="mt-3 border-t-2 border-dashed border-ink/15 pt-2">
              <div className="ledger-row font-sign text-lg">
                <span>Difference</span>
                <span className={comparison.gap >= 0 ? 'text-mint-deep' : 'text-berry'}>
                  {comparison.gap >= 0 ? '+' : ''}
                  {money(comparison.gap)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          <ChunkyButton variant="lemon" full onClick={onBack}>
            Done →
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function Side({
  name,
  result,
  winner,
}: {
  name: string;
  result: RunResult;
  winner: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-[3px] p-3 ${
        winner ? 'border-lemon bg-lemon/30' : 'border-ink/15 bg-white/70'
      }`}
    >
      <div className="truncate font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/50">
        {name}
      </div>
      <div className="font-sign text-3xl leading-none text-ink">{money(result.profit)}</div>
      <div className="mt-1 font-body text-[11px] font-bold leading-tight text-ink/60">
        {result.cupsSold} cups at about {money(result.avgPriceCents / 100)}
      </div>
    </div>
  );
}
