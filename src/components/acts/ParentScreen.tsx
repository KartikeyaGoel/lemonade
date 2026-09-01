'use client';

import type { ParentReport } from '@/lib/parent';
import type { Stage } from '@/lib/curriculum';
import type { Skill } from '@/lib/mastery';
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
  onClassroom,
  onBack,
}: {
  report: ParentReport;
  /** The teacher's way in. Nothing on the child's side links here. */
  onClassroom?: () => void;
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
            actually here for, and it survives the kid starting over.

            Hidden when there is no record yet. A card reading 0 badges, 0
            words and 0 days of business, at the top of the one screen meant to
            show what a child is learning, is worse than no card: it answers
            the parent's question with a scoreboard of nothing. On a fresh
            install the ladder below leads instead. */}
        {report.career && report.career.lifetimeDays > 0 && (
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

        {/* The ladder.
            This is the section a parent came for, and until now the report had
            no equivalent: everything else here describes what has already
            happened, which on a first run is nothing at all. Four stages, the
            concept each one teaches, and the evidence underneath. */}
        <div className="mt-4 rounded-2xl border-[3px] border-ink/20 bg-white/85 p-4">
          <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/50">
            What it teaches, stage by stage
          </div>
          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-ink/70">
            {report.ladderLine}
          </p>
          <div className="mt-3 space-y-3">
            {report.ladder.map((stage) => (
              <Rung key={stage.act} stage={stage} />
            ))}
          </div>
          <p className="mt-3 border-t-2 border-dashed border-ink/15 pt-2 font-body text-[11px] font-bold leading-snug text-ink/50">
            A tick means they did it on separate days, unprompted. Nothing here counts because the
            game showed them a word.
          </p>
        </div>

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
          {/* One teacher is thirty children, and this is the only door to
              that. It sits at the bottom of the grown-up view rather than
              anywhere a child would find it. */}
          {onClassroom && (
            <button
              type="button"
              onClick={onClassroom}
              className="mb-3 w-full rounded-2xl border-[3px] border-ink/20 bg-white/85 px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="text-2xl">
                  🧑‍🏫
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-sign text-lg leading-tight text-ink">Teaching a class?</div>
                  <div className="font-body text-[11px] font-bold leading-tight text-ink/55">
                    One code, everyone plays the same week, and the class plots its own demand
                    curve from thirty results.
                  </div>
                </div>
                <span aria-hidden className="font-sign text-xl text-ink/30">
                  ›
                </span>
              </div>
            </button>
          )}

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

/**
 * One stage of the ladder.
 *
 * The state chip and the count are deliberately separate. A child can finish a
 * stage having shown one of its three skills, and both halves of that are
 * worth knowing; a single blended percentage would hide the honest one.
 */
function Rung({ stage }: { stage: Stage }) {
  const locked = stage.state === 'locked';
  return (
    <div className={locked ? 'opacity-45' : undefined}>
      <div className="flex items-baseline gap-2">
        <span className="font-body text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/40">
          {stage.act}
        </span>
        <span className="flex-1 font-body text-[13px] font-extrabold leading-tight text-ink">
          {stage.grownUpConcept}
        </span>
        <span className="font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
          {stage.state === 'here'
            ? 'Here now'
            : stage.state === 'done'
              ? `${stage.held}/${stage.outOf}`
              : 'Ahead'}
        </span>
      </div>
      <p className="mt-0.5 font-body text-[11px] font-bold leading-snug text-ink/55">
        {stage.grownUpWhy}
      </p>
      <div className="mt-1.5 space-y-1">
        {stage.skills.map((skill) => (
          <Rungskill key={skill.id} skill={skill} locked={locked} />
        ))}
      </div>
    </div>
  );
}

function Rungskill({ skill, locked }: { skill: Skill; locked: boolean }) {
  const last = skill.sightings[skill.sightings.length - 1];
  const mark = skill.level === 'held' ? '\u2713' : skill.level === 'emerging' ? '\u25D0' : '\u25CB';
  return (
    <div className="flex gap-1.5">
      <span
        aria-hidden
        className={`font-body text-[12px] font-extrabold leading-snug ${
          skill.level === 'held' ? 'text-mint' : 'text-ink/35'
        }`}
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`font-body text-[12px] font-bold leading-snug ${
            skill.level === 'held' ? 'text-ink/85' : 'text-ink/55'
          }`}
        >
          {skill.grownUpName}
        </div>
        {!locked && last && (
          <div className="font-body text-[11px] font-bold leading-snug text-ink/45">
            {last.when}: {last.what}
          </div>
        )}
      </div>
    </div>
  );
}
