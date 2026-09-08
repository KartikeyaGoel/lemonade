'use client';

import { useState } from 'react';
import type { ParentReport } from '@/lib/parent';
import type { Stage } from '@/lib/curriculum';
import type { Skill } from '@/lib/mastery';
import { ChunkyButton, clearsBar, PinnedBar, SignHeading, Sky } from '../ui';
import { plural } from '@/lib/copy';

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
  onEraseAll,
  fromChild,
  onReply,
  notices,
  onBack,
}: {
  report: ParentReport;
  /**
   * What the child has written to a grown-up, oldest first.
   *
   * This is the grown-up's half of a conversation that works entirely on this
   * device. It lives behind the grown-up screen rather than anywhere the child
   * would find it, for the same reason the erase does: a reply is meant to be
   * from an adult, and a reply box on the child's own screen is a reply box
   * the child can answer themselves.
   */
  fromChild?: readonly { author: string; body: string }[];
  onReply?: (text: string) => void;
  /**
   * The notification switch, and it is here rather than anywhere a child is.
   *
   * Partly because a permission prompt in front of a nine-year-old is a prompt
   * that gets tapped rather than read. Mostly because the audience is under 13:
   * a browser permission is **not** verifiable parental consent in the COPPA
   * sense — nothing on a shared device can be — but putting the switch behind
   * this screen is the closest a local-only build gets, and it is the shape the
   * real consent flow will need anyway.
   */
  notices?: {
    state: 'unsupported' | 'default' | 'granted' | 'denied';
    onAsk: () => void;
  };
  /** The teacher's way in. Nothing on the child's side links here. */
  onClassroom?: () => void;
  /**
   * Deletes the run, the trophy case and everything else on this device.
   *
   * Optional in the type and always passed in practice, so that a harness
   * rendering this screen has to opt in to a destructive control rather than
   * getting one by default.
   */
  onEraseAll?: () => void;
  onBack: () => void;
}) {
  /*
   * Two taps, and the second one is a different button in a different place.
   *
   * The whole point of a confirmation is that the tap which does the damage
   * cannot be the tap somebody already had their thumb over.
   */
  const [confirming, setConfirming] = useState(false);
  return (
    <Sky mood="dawn">
      {/* Padded by whatever the bar underneath actually measures, rather than
          by a guess. The guess was `pb-28`, and the bar is nearer 180px with
          the teacher's door in it — so the last card on the longest document
          in the product sat under it. Eleven other screens had the same
          arithmetic; `clearsBar` is now the only place it happens. */}
      <div
        className="relative z-10 mx-auto flex w-full max-w-md flex-col px-5 pt-8"
        style={clearsBar()}
      >
        <div className="font-body text-xs font-extrabold uppercase tracking-[0.2em] text-ink/50">
          For a grown-up · 30 seconds
        </div>
        <SignHeading className="mt-1 text-3xl">{report.headline}</SignHeading>
        <div className="mt-1 font-body text-sm font-bold text-ink/60">
          Act {report.act}: {report.actName} · {plural(report.daysTraded, 'day')} in this run
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

        {onEraseAll && (
          <EraseBlock
            confirming={confirming}
            career={report.career}
            onAsk={() => setConfirming(true)}
            onKeep={() => setConfirming(false)}
            onErase={onEraseAll}
          />
        )}
      </div>

      <PinnedBar className="z-30 pb-5 pt-8 bg-gradient-to-t from-black/25 to-transparent">
        <div className="mx-auto w-full max-w-md px-4">
          {/* The price board.
              
              Was framed as a teacher's door — "one teacher is thirty children"
              — and the customer asked whether it could be for parents instead.
              It can, and not by renaming it: the week is seeded, so one child
              replaying it at six prices produces the same six dots six
              children would. That is the route a parent has, so it leads.
              
              Still at the bottom of the grown-up view rather than anywhere a
              child would find it, because it is a thing an adult runs. */}
          {/*
            The grown-up's side of the conversation.
            
            Above the teacher's door because it is the thing a parent came for
            if there is anything in it at all — a child explaining, in their
            own words, why they bought something. That is the evidence this
            whole screen exists to provide, except written by them.
          */}
          {onReply && fromChild && fromChild.length > 0 && (
            <div className="mb-3 rounded-2xl border-[3px] border-ink/20 bg-white/85 px-3 py-2.5">
              <div className="font-sign text-lg leading-tight text-ink">
                They wrote to you
              </div>
              <div className="mt-1.5 space-y-1.5">
                {fromChild.slice(-3).map((message, index) => (
                  <p
                    key={`${index}-${message.body.slice(0, 12)}`}
                    className={`rounded-xl border-2 px-2.5 py-1.5 font-body text-[12px] font-bold leading-snug ${
                      message.author === 'child'
                        ? 'border-mint/50 bg-mint/15 text-ink/80'
                        : 'border-ink/12 bg-white text-ink/60'
                    }`}
                  >
                    {message.author === 'child' ? '' : 'You: '}
                    {message.body}
                  </p>
                ))}
              </div>
              <Reply onReply={onReply} />
            </div>
          )}

          {notices && notices.state !== 'unsupported' && (
            <div className="mb-3 rounded-2xl border-[3px] border-ink/20 bg-white/85 px-3 py-2.5">
              <div className="font-sign text-lg leading-tight text-ink">Reminders</div>
              <p className="mt-0.5 font-body text-[11px] font-bold leading-snug text-ink/60">
                {notices.state === 'granted'
                  ? 'On. At most two a day, and never a telling-off for not playing. They only arrive while the game is open on this device — sending them to a closed app needs an account, which does not exist yet.'
                  : notices.state === 'denied'
                    ? 'Off, because this browser was told no. Everything they would have said still shows inside the game.'
                    : 'Off. Turning them on lets the game put a reminder on this device — at most two a day, and never a telling-off for not playing.'}
              </p>
              {notices.state === 'default' && (
                <button
                  type="button"
                  onClick={notices.onAsk}
                  className="mt-2 min-h-11 w-full rounded-xl border-[3px] border-ink/20 bg-white font-body text-xs font-extrabold uppercase tracking-wide text-ink/70"
                >
                  Turn reminders on
                </button>
              )}
            </div>
          )}

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
                  <div className="font-sign text-lg leading-tight text-ink">
                    Find the best price together
                  </div>
                  <div className="font-body text-[11px] font-bold leading-tight text-ink/55">
                    One code is one week of weather. Play it a few times at different prices, write
                    down what each go made, and the chart draws its own demand curve. Works with one
                    child or with thirty.
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
      </PinnedBar>
    </Sky>
  );
}

/**
 * Deleting the child's data.
 *
 * This is the only destructive control in the product, and everything about
 * how it looks is an argument with itself. It has to be genuinely findable,
 * because `PRIVACY.md` promises a parent their child's data is theirs and a
 * promise you keep by explaining browser settings is not one. It also has to
 * be nothing like the buttons around it, because the thing it destroys is the
 * one thing the game elsewhere guarantees is never destroyed: the trophy case
 * survives a new season precisely so that starting over is safe to press.
 *
 * So: bottom of the grown-up document, below the dinner question, styled as a
 * line of small print rather than an action — and then, once asked, the panel
 * names what goes by counting it. "12 badges and 9 words" is a sentence a
 * parent can weigh. "All progress" is not.
 */
function EraseBlock({
  confirming,
  career,
  onAsk,
  onKeep,
  onErase,
}: {
  confirming: boolean;
  career: ParentReport['career'];
  onAsk: () => void;
  onKeep: () => void;
  onErase: () => void;
}) {
  if (!confirming) {
    return (
      <div className="mt-5 border-t-2 border-dashed border-ink/15 pt-3">
        <p className="font-body text-[11px] font-bold leading-snug text-ink/50">
          Everything above is stored in this browser and nowhere else. No accounts, no servers,
          nothing sent anywhere.
        </p>
        {/* Small print, 44-pixel target. The two are not in tension: the
            underlined label is what makes this read as the quiet option, and
            the height is what makes it pressable. It measured 18. */}
        <button
          type="button"
          onClick={onAsk}
          className="mt-0.5 flex h-11 items-center font-body text-[12px] font-extrabold uppercase tracking-wide text-berry underline decoration-2 underline-offset-2"
        >
          Delete it from this device
        </button>
      </div>
    );
  }

  /*
   * Only things that actually exist.
   *
   * A confirmation is a question, and a question padded with "0 badges and 0
   * words earned" and a name the child never typed is not one — it is a form
   * that happens to have a verb on it. On a fresh install this correctly
   * collapses to two lines.
   */
  const earned = career ? career.badges.held + career.words.held : 0;
  const losses = [
    career && career.seasons > 1 ? `${career.seasons} seasons of play` : 'the run in progress',
    career && earned > 0
      ? `${career.badges.held} ${career.badges.held === 1 ? 'badge' : 'badges'} and ${career.words.held} ${career.words.held === 1 ? 'word' : 'words'} earned`
      : null,
    career?.named ? `the name ${career.name}` : null,
  ].filter((line): line is string => line !== null);

  return (
    <div className="mt-5 rounded-2xl border-[3px] border-berry/60 bg-berry/10 p-4">
      <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-berry">
        Delete everything
      </div>
      <p className="mt-1 font-body text-[13px] font-extrabold leading-snug text-ink">
        This removes it permanently. There is no copy anywhere else, so we cannot restore it.
      </p>
      <ul className="mt-2 space-y-0.5">
        {losses.map((line) => (
          <li key={line} className="font-body text-[13px] font-bold leading-snug text-ink/75">
            &middot; {line}
          </li>
        ))}
        <li className="font-body text-[13px] font-bold leading-snug text-ink/75">
          &middot; any class board and practice market account on this device
        </li>
      </ul>
      <div className="mt-3 space-y-2">
        <ChunkyButton variant="ghost" full onClick={onKeep}>
          Keep it
        </ChunkyButton>
        <button
          type="button"
          onClick={onErase}
          className="w-full rounded-2xl border-[3px] border-berry bg-berry px-4 py-2.5 font-body text-[13px] font-extrabold uppercase tracking-wide text-white"
        >
          Yes, delete everything
        </button>
      </div>
    </div>
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

/**
 * A grown-up's reply, typed on the same device.
 *
 * No filter note shown here: the filter still runs — `send` applies it to
 * every author — but a grown-up who pastes a phone number into a note to
 * their own child does not need to be taught about the internet. They need
 * the message to arrive, minus the number.
 */
function Reply({ onReply }: { onReply: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="mt-2">
      <label className="sr-only" htmlFor="grown-up-reply">
        Write back
      </label>
      <textarea
        id="grown-up-reply"
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 240))}
        rows={2}
        placeholder="Write back…"
        className="w-full rounded-xl border-[3px] border-ink/15 bg-white px-3 py-2 font-body text-[13px] font-bold text-ink/85"
      />
      <button
        type="button"
        disabled={text.trim().length === 0}
        onClick={() => {
          onReply(text);
          setText('');
        }}
        className="mt-1.5 min-h-11 w-full rounded-xl border-[3px] border-ink/20 bg-white font-body text-xs font-extrabold uppercase tracking-wide text-ink/70 disabled:opacity-40"
      >
        Send it
      </button>
    </div>
  );
}
