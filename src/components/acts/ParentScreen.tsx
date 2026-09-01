'use client';

import type { ParentReport } from '@/lib/parent';
import { ChunkyButton, SignHeading, Sky } from '../ui';

/**
 * The parent view. Thirty seconds, no analytics, no scores.
 *
 * This is the only screen in the product not designed for a child, so it is
 * allowed to look like a document. Everything on it is a decision their kid
 * made, with the number they made it on, and it is honest about what has not
 * been shown yet — because a parent who catches us overclaiming once will
 * never trust the rest of it.
 */
export function ParentScreen({
  report,
  onBack,
}: {
  report: ParentReport;
  onBack: () => void;
}) {
  return (
    <Sky mood="dawn">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pb-28 pt-8">
        <div className="font-body text-xs font-extrabold uppercase tracking-[0.2em] text-ink/50">
          For a grown-up · 30 seconds
        </div>
        <SignHeading className="mt-1 text-3xl">{report.headline}</SignHeading>
        <div className="mt-1 font-body text-sm font-bold text-ink/60">
          Act {report.act}: {report.actName} · {report.daysTraded} days in this run
        </div>

        {/* The record across every season. This is the evidence a parent is
            actually here for, and it survives the kid starting over. */}
        {report.career && (
          <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white/85 p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-sign text-2xl text-ink">{report.career.name}</span>
              <span className="font-body text-xs font-extrabold uppercase tracking-wide text-ink/50">
                {report.career.rank}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <Stat label="Seasons played" value={String(report.career.seasons)} />
              <Stat label="Days of business" value={String(report.career.lifetimeDays)} />
              <Stat
                label="Badges earned"
                value={`${report.career.badges.held} of ${report.career.badges.total}`}
              />
              <Stat
                label="Words earned"
                value={`${report.career.words.held} of ${report.career.words.total}`}
              />
            </div>
            {report.career.wordList.length > 0 && (
              <div className="mt-3 border-t-2 border-dashed border-ink/15 pt-2">
                <div className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/45">
                  Words they can now use, and were not told before earning
                </div>
                <div className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/75">
                  {report.career.wordList.join(' · ')}
                </div>
              </div>
            )}
          </div>
        )}

        {report.understanding.length > 0 && (
          <Section title="What they can do" tone="good">
            {report.understanding.map((line) => (
              <Line key={line.topic + line.evidence} topic={line.topic} evidence={line.evidence} />
            ))}
          </Section>
        )}

        {report.activity.length > 0 && (
          <Section title="What they did">
            {report.activity.map((line) => (
              <Line key={line.topic + line.evidence} topic={line.topic} evidence={line.evidence} />
            ))}
          </Section>
        )}

        {report.notYet.length > 0 && (
          <Section title="Not yet">
            {report.notYet.map((note) => (
              <p key={note} className="font-body text-[13px] font-bold leading-snug text-ink/65">
                {note}
              </p>
            ))}
          </Section>
        )}

        <div className="mt-5 rounded-2xl border-[3px] border-wood-dark bg-lemon-light p-4">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-wood-deep">
            Ask them at dinner
          </div>
          <p className="mt-1.5 font-body text-base font-extrabold leading-snug text-ink">
            &ldquo;{report.conversationStarter}&rdquo;
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/25 to-transparent pb-5 pt-8">
        <div className="mx-auto w-full max-w-md px-4">
          <ChunkyButton variant="ghost" full onClick={onBack}>
            Back to the game
          </ChunkyButton>
        </div>
      </div>
    </Sky>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'good';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-4 rounded-2xl border-[3px] p-4 ${
        tone === 'good' ? 'border-mint/60 bg-mint/10' : 'border-ink/15 bg-white/85'
      }`}
    >
      <div className="mb-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Line({ topic, evidence }: { topic: string; evidence: string }) {
  return (
    <div>
      <div className="font-body text-[12px] font-extrabold uppercase tracking-wide text-wood-deep">
        {topic}
      </div>
      <div className="font-body text-[13px] font-bold leading-snug text-ink/80">{evidence}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
        {label}
      </div>
      <div className="font-ledger text-sm font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}
