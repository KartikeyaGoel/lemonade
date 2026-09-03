'use client';

import type { ThesisReport, ThesisScore } from '@/lib/thesis';
import { quantClaim, qualClaim } from '@/lib/thesis';
import { ChunkyButton, clearsBar, PinnedBar, SignHeading, Sky } from '../ui';

/**
 * Solid fills, not translucent ones.
 *
 * These cards sit on the night sky and carry near-black body text. A 20%
 * lemon wash over navy came out as a muddy olive that the text disappeared
 * into, so each tone is an opaque tint instead.
 */
const TONE: Record<ThesisScore['verdict'], string> = {
  'good-call': 'border-[#1FA97C] bg-[#D9F6EA]',
  lucky: 'border-[#D93A5A] bg-[#FBD9DF]',
  'right-idea-wrong-time': 'border-[#D9A521] bg-[#FBEFC6]',
  'now-you-know': 'border-ink/30 bg-[#F1EDE6]',
};

const ICON: Record<ThesisScore['verdict'], string> = {
  'good-call': '🎯',
  lucky: '🍀',
  'right-idea-wrong-time': '⏳',
  'now-you-know': '📖',
};

/**
 * The reckoning: every reason, graded on whether it held up.
 *
 * This screen exists to do one thing, and it is the most important thing in the
 * product. A game that congratulates a kid for a lucky win has taught them the
 * most expensive lesson in finance backwards — that being right about the money
 * means you were right about the business.
 *
 * So the grid is deliberately two-dimensional, and the uncomfortable box is
 * called by its name. Made money, reason was wrong: that was luck. Lost money,
 * reason held up: that happens, and it is not the same kind of mistake.
 */
export function ReckoningScreen({
  report,
  onContinue,
}: {
  report: ThesisReport;
  onContinue: () => void;
}) {
  return (
    <Sky mood="night">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-8" style={clearsBar()}>
        <div className="text-center">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/55">
            Twelve weeks later
          </div>
          <SignHeading className="mt-1 !text-lemon-light text-4xl">
            Were you right, or lucky?
          </SignHeading>
          <p className="mt-2 font-body text-sm font-bold leading-snug text-white/70">
            Not whether you made money — whether the reason you gave turned out to be true. Those
            are different questions, and only one of them you can repeat on purpose.
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          {report.scores.map((score) => (
            <div
              key={`${score.thesis.ticker}-${score.thesis.week}`}
              className={`rounded-2xl border-[3px] p-4 ${TONE[score.verdict]}`}
            >
              <div className="flex items-baseline gap-2">
                <span aria-hidden className="text-xl leading-none">
                  {ICON[score.verdict]}
                </span>
                <span className="font-sign text-2xl text-ink">{score.headline}</span>
                <span
                  className={`ml-auto font-ledger text-sm font-bold tabular-nums ${
                    score.madeMoney ? 'text-mint-deep' : 'text-berry'
                  }`}
                >
                  {score.gainPct >= 0 ? '+' : ''}
                  {Math.round(score.gainPct * 100)}%
                </span>
              </div>

              <div className="mt-2 rounded-xl bg-white/70 p-2.5">
                <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                  What you said about {score.thesis.ticker}
                </div>
                <div className="mt-0.5 font-body text-[12px] font-bold leading-snug text-ink/80">
                  {quantClaim(score.thesis.quantId)?.label ?? 'no number reason'} — and{' '}
                  {(qualClaim(score.thesis.qualId)?.label ?? 'no story reason').toLowerCase()}.
                </div>
              </div>

              <p className="mt-2 font-body text-[13px] font-bold leading-snug text-ink/80">
                {score.lesson}
              </p>
            </div>
          ))}

          {report.scores.length === 0 && (
            <div className="rounded-2xl border-[3px] border-white/25 bg-white/10 p-4 font-body text-sm font-bold text-white/75">
              You never put money in with a reason attached, so there is nothing here to grade.
              That is the one result worth avoiding.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border-[3px] border-lemon/60 bg-lemon/15 p-4">
          <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-lemon-light">
            The part that carries forward
          </div>
          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-white">
            {report.summary}
          </p>
        </div>
      </div>

      <PinnedBar className="z-20 mx-auto max-w-md border-t-[3px] border-white/15 bg-[#16203A] px-4 pb-5 pt-8">
        <ChunkyButton variant="lemon" full onClick={onContinue}>
          See where you ended up →
        </ChunkyButton>
      </PinnedBar>
    </Sky>
  );
}
