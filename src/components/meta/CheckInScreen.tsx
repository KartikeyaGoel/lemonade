'use client';

import { useState } from 'react';
import {
  ACTIONS,
  MOVERS,
  copyFor,
  mark,
  stepOf,
  stepsFor,
  type Action,
  type Answers,
  type CheckIn,
  type Mover,
} from '@/lib/checkin';
import type { Streak } from '@/lib/ledger';
import { ChunkyButton, PinnedBar, SignHeading, Sky, clearsBar, plural } from '../ui';
import { PipSays } from '../Pip';

/**
 * Today's Investor Check-in.
 *
 * Six questions, and **one on screen at a time**. That is the whole reason this
 * is a screen with a step counter rather than a scrollable form: PRODUCT.md §26
 * records the day-one failure this product already had once — three new words
 * in three stacked panels of italic explanation, under the first profit and
 * loss a child has ever read — and its rule out of that is "one card a day, one
 * word a day, one finger". Six questions in a column is that same failure with
 * a bigger number on it.
 *
 * The other thing worth knowing about this screen is what it pays for. Step
 * four asks whether anything needs doing, and the honest answer most days is
 * no. The credit is for **getting it right**, so a child who correctly says
 * "leave it alone" is paid exactly what a child who correctly spots a problem
 * is paid — and a child who opens this and closes it again is paid nothing.
 * §15: "Nothing in it is given for showing up."
 */
export function CheckInScreen({
  state,
  streak,
  onDone,
  onBack,
}: {
  state: CheckIn;
  streak: Streak;
  /** Called once, with what they answered, so the caller can pay for it. */
  onDone: (answers: Answers, allRight: boolean) => void;
  onBack: () => void;
}) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  /*
   * Today's steps, which is not always all six.
   *
   * With no story — a portfolio one week old has no week to compare — the two
   * questions *about* the story are dropped, and the counter shrinks with them.
   * See `stepsFor`: asking "does it touch anything you own?" about nothing and
   * then marking the answer was the bug this fixes.
   */
  const steps = stepsFor(state);
  const step = stepOf(at, steps);
  const copy = copyFor(step, state);
  const marked = mark(state, answers);

  /*
   * Whether this step can be left yet.
   *
   * A question with no answer cannot be skipped past, because the credit at the
   * end is for the answers — but the two steps that are not questions (the
   * story, and the tally) are always passable. Otherwise a child would be
   * stuck on a screen with nothing to press.
   */
  const answered =
    step === 'why'
      ? answers.because !== undefined
      : step === 'does-it-touch-me'
        ? answers.touchesMe !== undefined
        : step === 'do-i-act'
          ? answers.needed !== undefined
          : true;

  const last = at >= steps.length - 1;

  return (
    <Sky mood="probably-mild">
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6"
        style={clearsBar()}
      >
        <div className="flex items-center justify-between gap-3">
          <SignHeading className="text-3xl">Check-in</SignHeading>
          {/* Which of the six, so the screen is never a corridor of unknown length. */}
          <span className="stat-chip !text-xs" data-coach="checkin-progress">
            {at + 1} of {steps.length}
          </span>
        </div>

        {streak.running > 1 && (
          <p className="mt-1 font-body text-[12px] font-extrabold text-ink/55">
            {plural(streak.running, 'day')} running.{' '}
            {streak.todayCounted ? '' : 'Keep it going.'}
          </p>
        )}

        <div className="mt-4 rounded-2xl border-[3px] border-ink/12 bg-white/80 px-4 py-4">
          <h2 className="font-sign text-2xl leading-tight text-ink">{copy.question}</h2>
          <PipSays className="mt-3" lines={[copy.said]} />
        </div>

        {step === 'what-happened' && state.story && (
          <div className="mt-3 rounded-2xl border-[3px] border-ink/12 bg-white/70 px-4 py-3">
            <div className="font-body text-sm font-extrabold text-ink/80">{state.story.headline}</div>
            <div className="mt-1 font-body text-[12px] font-bold text-ink/50">
              Week of {state.story.asOf}
            </div>
          </div>
        )}

        {step === 'why' && (
          <Choices
            options={(Object.keys(MOVERS) as Mover[]).map((key) => ({
              id: key,
              label: MOVERS[key].label,
            }))}
            chosen={answers.because}
            onPick={(id) => setAnswers((current) => ({ ...current, because: id as Mover }))}
          />
        )}

        {step === 'does-it-touch-me' && (
          <Choices
            options={[
              { id: 'yes', label: 'Yes, I own some of that' },
              { id: 'no', label: 'No, I do not own any' },
            ]}
            chosen={answers.touchesMe === undefined ? undefined : answers.touchesMe ? 'yes' : 'no'}
            onPick={(id) => setAnswers((current) => ({ ...current, touchesMe: id === 'yes' }))}
          />
        )}

        {step === 'do-i-act' && (
          <Choices
            options={(Object.keys(ACTIONS) as Action[]).map((key) => ({
              id: key,
              label: ACTIONS[key].label,
            }))}
            chosen={answers.needed}
            onPick={(id) => setAnswers((current) => ({ ...current, needed: id as Action }))}
          />
        )}

        {step === 'discover' && state.discover && (
          <div className="mt-3 rounded-2xl border-[3px] border-ink/12 bg-white/70 px-4 py-3">
            <div className="font-sign text-xl text-ink">{state.discover.name}</div>
            <div className="mt-1 font-body text-[12px] font-bold text-ink/55">
              {state.discover.ticker} · you have never opened this one
            </div>
          </div>
        )}

        {last && (
          <div className="mt-3 space-y-2">
            {/*
              Every answer, marked, with the reason. Not a score out of three:
              a child who got one wrong needs to know *which* and *why*, and a
              bare tally teaches nothing at all.
            */}
            {marked.lines.map((line) => (
              <p
                key={line}
                className={`rounded-xl border-2 px-3 py-2 font-body text-[13px] font-bold leading-snug ${
                  /^Right/.test(line)
                    ? 'border-mint/50 bg-mint/15 text-ink/80'
                    : 'border-berry/40 bg-white text-ink/80'
                }`}
              >
                {line}
              </p>
            ))}
            <p className="pt-1 text-center font-body text-[12px] font-extrabold text-ink/55">
              {/*
                Counted, not spelled out. "All three right" was hardcoded, and
                the moment the ritual learned to ask fewer questions it started
                congratulating a child on three answers when it had asked one —
                the same class as "Two days to try things out" in a component
                (PRODUCT.md §62).
              */}
              {state.doneToday
                ? 'You already collected today. Come back tomorrow.'
                : marked.allRight
                  ? `${marked.outOf === 1 ? 'Right' : `All ${marked.outOf} right`}. That is what the credits are for.`
                  : 'Credits are for working it out, not for turning up.'}
            </p>
          </div>
        )}

        <PinnedBar className="mt-auto flex gap-3">
          <ChunkyButton
            variant="ghost"
            onClick={() => (at === 0 ? onBack() : setAt((current) => current - 1))}
            className="!px-5 !text-xl"
          >
            ←
          </ChunkyButton>
          <ChunkyButton
            variant="mint"
            full
            disabled={!answered}
            onClick={() => (last ? onDone(answers, marked.allRight) : setAt((current) => current + 1))}
          >
            {last ? 'Collect →' : 'Next →'}
          </ChunkyButton>
        </PinnedBar>
      </div>
    </Sky>
  );
}

/** One tappable answer per row. 44px tall, because a nine-year-old is pressing it. */
function Choices({
  options,
  chosen,
  onPick,
}: {
  options: Array<{ id: string; label: string }>;
  chosen: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2" data-coach="checkin-choices">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onPick(option.id)}
          aria-pressed={chosen === option.id}
          className={`flex min-h-11 w-full items-center rounded-xl border-[3px] px-3 py-2 text-left font-body text-sm font-extrabold transition active:translate-y-[1px] ${
            chosen === option.id
              ? 'border-mint-deep bg-mint/25 text-ink'
              : 'border-ink/15 bg-white/80 text-ink/75'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
