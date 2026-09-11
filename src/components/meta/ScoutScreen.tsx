'use client';

import { useState } from 'react';
import {
  SCOUT_QUESTIONS,
  rate,
  type Answers,
  type Rating,
} from '@/lib/scout';
import { formatMillions, metricsFor, type Company } from '@/lib/companies';
import { ChunkyButton, PinnedBar, SignHeading, Sky, clearsBar, money } from '../ui';
import { PipSays } from '../Pip';

/**
 * Stock Scout: rate a real company against the framework.
 *
 * Eight questions and **one on screen at a time**, for the reason §26 gives:
 * "one card a day, one word a day, one finger." Eight in a column is a form,
 * and a nine-year-old fills a form in by pattern-matching down it.
 *
 * The order is an argument rather than a layout. All five business questions
 * come before any of the three price questions, so a child decides whether it
 * is a good business *before* they see what it costs — which is the only way
 * round that stops the price talking them into liking the business.
 *
 * And the verdict reports the two sides **apart**. "A great business at a silly
 * price is a bad investment" is the most valuable sentence in this product, and
 * a child cannot learn it from a single score out of eight. Good on the
 * business and poor on the price is the commonest and most dangerous shape,
 * because it feels like competence — so it gets named.
 */
export function ScoutScreen({
  company,
  price,
  asOf,
  onDone,
  onBack,
}: {
  company: Company;
  /** The price being judged — a real historical close, like everywhere else. */
  price: number;
  asOf?: string;
  onDone: (rating: Rating) => void;
  onBack: () => void;
}) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [showing, setShowing] = useState(false);

  const question = SCOUT_QUESTIONS[Math.min(at, SCOUT_QUESTIONS.length - 1)];
  const done = at >= SCOUT_QUESTIONS.length;
  const rating = rate(company, answers, price, asOf);
  const metrics = metricsFor(company, price, asOf);
  const answered = question.id in answers;

  return (
    <Sky mood="night">
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-6"
        style={clearsBar()}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-4xl">
            {company.emoji}
          </span>
          <div className="min-w-0">
            <SignHeading className="!text-lemon-light text-3xl">{company.name}</SignHeading>
            <div className="font-body text-[11px] font-extrabold uppercase tracking-wide text-white/85">
              {company.whatTheySell}
            </div>
          </div>
        </div>

        {/*
          The figures, always on screen.

          This is an exercise in reading accounts, not in remembering them. A
          child who has to hold four numbers in their head to answer a question
          about margins is being tested on working memory instead of on
          judgment.
        */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="stat-chip !text-[11px]">Takings {formatMillions(metrics.year.revenueM)}</span>
          <span className="stat-chip !text-[11px]">
            Profit {formatMillions(metrics.year.netIncomeM)}
          </span>
          <span className="stat-chip !text-[11px]">{money(price)} a share</span>
          <span className="stat-chip !text-[11px]">
            {metrics.pe ? `${metrics.pe.toFixed(0)} years of profit` : 'no profit to price'}
          </span>
        </div>

        {!done ? (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
                {question.side === 'business' ? 'Is it a good business?' : 'Is it a good stock?'}
              </span>
              <span className="stat-chip !text-[11px]">
                {at + 1} of {SCOUT_QUESTIONS.length}
              </span>
            </div>

            <div className="mt-2 rounded-2xl border-[3px] border-white/25 bg-night-panel p-4">
              <h2 className="font-sign text-2xl leading-tight text-white">{question.ask}</h2>
              <p className="mt-1.5 font-body text-[12px] font-bold leading-snug text-white/85">
                {question.kidLine}
              </p>
            </div>

            <div className="mt-3 flex gap-2" data-coach="scout-answer">
              {[
                { id: 'yes', label: 'Yes' },
                { id: 'no', label: 'No' },
              ].map((option) => {
                const picked = answers[question.id] === (option.id === 'yes');
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option.id === 'yes',
                      }));
                      setShowing(true);
                    }}
                    aria-pressed={answered && picked}
                    className={`min-h-11 flex-1 rounded-2xl border-[3px] py-3 font-sign text-2xl ${
                      answered && picked
                        ? 'border-lemon bg-white text-ink'
                        : 'border-white/20 bg-night-panel text-white/85'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/*
              The evidence, shown the moment they answer and before they move
              on. Not at the end: a child who finds out on screen eight that
              question one was wrong has forgotten what they thought.
            */}
            {answered && showing && (
              <div
                className={`mt-3 rounded-2xl border-[3px] px-3 py-2.5 ${
                  answers[question.id] === question.holds(company, price, asOf)
                    ? 'border-mint-deep bg-[#D9F6EA]'
                    : 'border-berry bg-[#FBD9DF]'
                }`}
              >
                <div className="font-body text-[12px] font-extrabold uppercase tracking-wide text-ink/60">
                  {answers[question.id] === question.holds(company, price, asOf)
                    ? '✓ Right'
                    : '✕ Not this time'}
                </div>
                <p className="mt-0.5 font-body text-[13px] font-bold leading-snug text-ink/85">
                  {question.evidence(company, price, asOf)}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-4">
            {/*
              Two scores, never one. See `verdictOf`: a child who reads the
              business well and the price badly has learned something precise
              about themselves, and "5 out of 8" hides it.
            */}
            <div className="flex gap-2">
              <Score label="The business" score={rating.business} />
              <Score label="The price" score={rating.stock} />
            </div>
            <PipSays className="mt-3" lines={[rating.says]} />

            <div className="mt-3 space-y-1.5">
              {rating.marks
                .filter((mark) => mark.answered && !mark.right)
                .map((mark) => (
                  <div
                    key={mark.id}
                    className="rounded-xl border-2 border-white/20 bg-night-panel px-3 py-2"
                  >
                    <div className="font-body text-[12px] font-extrabold text-lemon-light">
                      {mark.ask}
                    </div>
                    <p className="mt-0.5 font-body text-[12px] font-bold leading-snug text-white/85">
                      {mark.evidence}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        <PinnedBar className="mt-auto flex gap-3">
          <ChunkyButton
            variant="ghost"
            onClick={() => {
              if (at === 0) return onBack();
              setAt((current) => current - 1);
              setShowing(true);
            }}
            className="!px-5 !text-xl"
          >
            ←
          </ChunkyButton>
          <ChunkyButton
            variant="lemon"
            full
            disabled={!done && !answered}
            onClick={() => {
              if (done) return onDone(rating);
              setAt((current) => current + 1);
              setShowing(false);
            }}
          >
            {done ? 'Done →' : at === SCOUT_QUESTIONS.length - 1 ? 'See how you did →' : 'Next →'}
          </ChunkyButton>
        </PinnedBar>
      </div>
    </Sky>
  );
}

function Score({ label, score }: { label: string; score: { right: number; outOf: number } }) {
  return (
    <div className="flex-1 rounded-2xl border-[3px] border-white/25 bg-night-panel px-3 py-2 text-center">
      <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-lemon-light">
        {label}
      </div>
      <div className="font-sign text-3xl leading-none text-white">
        {score.right}
        <span className="text-white/85">/{score.outOf}</span>
      </div>
    </div>
  );
}
