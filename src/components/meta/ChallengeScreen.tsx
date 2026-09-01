'use client';

import { useState } from 'react';
import {
  CHALLENGE_DAYS,
  compareRuns,
  createChallenge,
  decodeChallenge,
  decodeResult,
  encodeChallenge,
  encodeResult,
  summariseRun,
  type ChallengeSpec,
  type Comparison,
  type RunResult,
  skyOfTheDay,
} from '@/lib/challenge';
import type { DayRecord } from '@/lib/simulation';
import { ChunkyButton, CodeBox, CodeInput, SignHeading, Sky, money } from '../ui';

/**
 * Same-Sky Challenge.
 *
 * The seed is the weather. Two kids who put in the same code get identical
 * days — the same forecasts, the same days that turned out hot when they were
 * promised cool — so the entire difference in the result is decisions.
 *
 * Which is why this screen never leads with the winner. It leads with the
 * arithmetic of *why*, and the four lines add up to the gap. "You beat me by $41
 * and $28 of it was charging twenty cents more" teaches something. "You won"
 * does not.
 *
 * Two lengths, and the short one matters more than it looks. A week is the real
 * contest, but a week is forty minutes, and a thing two kids do to each other
 * at lunchtime has to fit in lunchtime. One day is about two minutes: send the
 * code, both play the same Tuesday, compare. That is the shape of every
 * head-to-head a middle schooler already plays, and it is available on their
 * second day rather than after a full week of solo play.
 */
export function ChallengeScreen({
  seed,
  me,
  history,
  badges,
  today,
  onPlayChallenge,
  onCompared,
  onBack,
}: {
  seed: number;
  /** The kid's own name, for the score code. */
  me: string;
  /** Their days so far. A challenge of N days is the first N of them. */
  history: DayRecord[];
  badges: number;
  /**
   * Today's date, as ISO, or null on a server render.
   *
   * Passed in rather than read here for the same reason `skyOfTheDay` takes it:
   * a component that reads the clock renders differently on the server than in
   * the browser, and React is right to complain about that.
   */
  today: string | null;
  onPlayChallenge: (spec: ChallengeSpec) => void;
  /** Fires once, when a friend's score has actually been read in. */
  onCompared: (comparison: Comparison) => void;
  onBack: () => void;
}) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const canSendWeek = history.length >= CHALLENGE_DAYS;
  const [days, setDays] = useState(() => (canSendWeek ? CHALLENGE_DAYS : 1));

  /**
   * The spec and the score are both derived from the length, and they have to
   * agree: a code that says one day paired with a score for a whole week would
   * make `sameSky` false and the comparison meaningless.
   */
  const mySpec: ChallengeSpec | null = history.length > 0 ? createChallenge(seed, days) : null;
  const myResult: RunResult | null =
    history.length > 0 ? summariseRun(seed, me, history.slice(0, days), badges) : null;

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
            Send a friend the exact days you played — same weather, same money to start with. Then
            the only difference is what you each decided.
          </p>
        </div>

        {/* How long. A duel is two minutes; a week is the real contest. */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <LengthButton
            on={days === 1}
            title="One day"
            note="about 2 minutes"
            onClick={() => setDays(1)}
          />
          <LengthButton
            on={days === CHALLENGE_DAYS}
            title="Whole week"
            note={canSendWeek ? 'the real contest' : 'play a week first'}
            disabled={!canSendWeek}
            onClick={() => setDays(CHALLENGE_DAYS)}
          />
        </div>

        {mySpec && myResult && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border-[3px] border-ink/20 bg-white/80 p-3">
              <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
                {days === 1 ? 'Your first day' : `Your first ${days} days`}
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-sign text-4xl text-ink">{money(myResult.profit)}</span>
                <span className="font-body text-xs font-extrabold text-ink/55">
                  {myResult.cupsSold} cups, {myResult.spoiledLemons} lemons wasted
                </span>
              </div>
            </div>

            {/* One tap, one paste, one message. Two separate codes meant a kid
                doing a two-minute duel had to switch apps four times, and the
                score code alone runs to sixty characters — which reads as
                homework next to a game where you tap a friend's name. The
                codes stay visible underneath for anyone reading them out. */}
            <ShareBothButton
              lines={[
                days === 1 ? 'Play my day:' : 'Play my week:',
                encodeChallenge(mySpec),
                'Then beat my score:',
                encodeResult(myResult),
              ]}
            />
            <CodeBox
              label={days === 1 ? '1. The day itself' : '1. The week itself'}
              code={encodeChallenge(mySpec)}
            />
            <CodeBox label="2. Your score" code={encodeResult(myResult)} small />
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
                  setResultError('Play a day of your own first, so there is something to compare.');
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

        {/*
          * Today's week, the same one for everybody in the world.
          *
          * `skyOfTheDay` has existed, been tested and been wired to nothing.
          * It is the cheapest retention mechanic there is and the only thing in
          * the game that is the same for two children who have never met: the
          * date is the seed, so a kid in one school and a kid in another get
          * the identical seven days and can compare codes without arranging
          * anything first.
          */}
        {today && (
          <div className="mt-6 rounded-2xl border-[3px] border-lemon-deep bg-lemon-light p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-sign text-xl leading-tight text-ink">Today&apos;s week</span>
              <span className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-wood-deep">
                everybody gets this one
              </span>
            </div>
            <p className="mt-0.5 font-body text-[12px] font-bold leading-snug text-ink/65">
              The same seven days as every other player today. A new one tomorrow.
            </p>
            <ChunkyButton
              variant="lemon"
              full
              className="mt-2 !py-2 !text-xl"
              onClick={() => onPlayChallenge(skyOfTheDay(today))}
            >
              Play today&apos;s week
            </ChunkyButton>
          </div>
        )}

        <div className="mt-6">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
            Or play somebody else&apos;s days
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
            This starts a fresh stand on their weather, for however many days their code says. Your
            trophies stay.
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

/** Puts the whole invitation on the clipboard as one message. */
function ShareBothButton({ lines }: { lines: string[] }) {
  const [done, setDone] = useState(false);
  const message = lines.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    } catch {
      // Clipboard blocked. Both codes are on screen underneath.
      setDone(false);
    }
  };

  return (
    <ChunkyButton variant="lemon" full onClick={copy} className="!text-base">
      {done ? 'Copied — go paste it' : '📋 Copy the whole challenge'}
    </ChunkyButton>
  );
}

function LengthButton({
  on,
  title,
  note,
  disabled,
  onClick,
}: {
  on: boolean;
  title: string;
  note: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border-[3px] px-3 py-2 text-left transition-transform active:translate-y-[2px] ${
        on ? 'border-mint bg-mint/20' : 'border-ink/20 bg-white/70'
      } ${disabled ? 'opacity-45' : ''}`}
    >
      <span className="block font-body text-sm font-extrabold text-ink">{title}</span>
      <span className="block font-body text-[11px] font-bold text-ink/55">{note}</span>
    </button>
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
