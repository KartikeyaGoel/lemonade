'use client';

import { useEffect, useState } from 'react';
import { MAX_MESSAGE, grownUpThread, type Inbox, type Thread } from '@/lib/messages';
import type { Mission } from '@/lib/missions';
import { ChunkyButton, PinnedBar, SignHeading, Sky, clearsBar } from '../ui';
import { PipSays } from '../Pip';

/**
 * Messages.
 *
 * Two kinds of conversation and they behave differently, on purpose.
 *
 * **A grown-up thread works.** Both ends are on this device — the child writes
 * here, the grown-up replies from behind the grown-up screen — so a message
 * sends, arrives, and can be answered. A shared family tablet is the normal
 * case at this age, and a note left for somebody who picks the device up later
 * is the actual product rather than a stand-in for one.
 *
 * **A friend thread travels as a code.** Written here, filtered, then turned
 * into a `MSG-…` string the child hands over — the same transport the club
 * already uses, and the same trust model: a code is a note passed across a
 * table, and whoever holds it can read it.
 *
 * Until a code has been made, the message reads "not sent yet" and never
 * "sent". A child who believes a friend has read something they have not is
 * the one failure in this feature with real consequences, and the fix is a
 * word.
 *
 * The missions are the reason to be here. A blank box in front of a
 * nine-year-old told to explain something is where the feature dies, so each
 * mission arrives with a draft made of the child's own written reasons, which
 * they can send as-is or type over.
 */
export function MessagesScreen({
  inbox,
  missions,
  onSend,
  onMakeCode,
  code,
  onPasteCode,
  codeNote,
  focusThread,
  onBlock,
  onReport,
  onBack,
}: {
  inbox: Inbox;
  missions: readonly Mission[];
  onSend: (threadId: string, text: string, missionId?: string) => void;
  /** Turn a held friend message into a code, and hand it back to be shown. */
  onMakeCode?: (messageId: string) => void;
  /** The most recent code made, so it can be copied. */
  code?: string | null;
  /** Paste a code from a friend. */
  onPasteCode?: (code: string) => void;
  /** Whatever the last paste had to say — a filter note, or a refusal. */
  codeNote?: string | null;
  /**
   * The thread a pasted code landed in, so the screen can open it.
   *
   * Without it the message arrives and the screen stays where it was, leaving
   * a child to go looking for the thing they just pasted — which a browser
   * found before any test did.
   */
  focusThread?: string | null;
  onBlock: (threadId: string) => void;
  onReport: (threadId: string, reason: string) => void;
  onBack: () => void;
}) {
  const grownUp = grownUpThread(inbox);
  const [openId, setOpenId] = useState<string | null>(grownUp?.id ?? null);
  const [draft, setDraft] = useState('');
  const [usingMission, setUsingMission] = useState<string | undefined>(undefined);
  const [pasted, setPasted] = useState('');
  const [pasting, setPasting] = useState(false);

  // Follow the caller when a paste lands somewhere.
  useEffect(() => {
    if (focusThread) setOpenId(focusThread);
  }, [focusThread]);

  const thread = inbox.threads.find((current) => current.id === openId) ?? null;

  return (
    <Sky mood="dusk">
      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-5"
        style={clearsBar()}
      >
        <button
          type="button"
          onClick={onBack}
          className="-m-2 self-start p-2 font-body text-sm font-extrabold text-ink/70"
        >
          ← Back
        </button>

        <SignHeading className="mt-2 text-4xl">Messages</SignHeading>

        {/* Which conversation */}
        {inbox.threads.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {inbox.threads.map((current) => (
              <button
                key={current.id}
                type="button"
                onClick={() => setOpenId(current.id)}
                className={`min-h-11 shrink-0 rounded-full border-[3px] px-3 py-2 font-body text-xs font-extrabold ${
                  current.id === openId
                    ? 'border-mint-deep bg-mint/25 text-ink'
                    : 'border-ink/15 bg-white/75 text-ink/70'
                }`}
              >
                {current.kind === 'grown-up' ? '👋 ' : '🧑‍🤝‍🧑 '}
                {current.withWhom}
                {current.blocked ? ' · blocked' : ''}
              </button>
            ))}
          </div>
        )}

        {missions.length > 0 && (
          <div className="mt-3">
            <div className="font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/55">
              Something to tell them
            </div>
            <div className="mt-1.5 space-y-2">
              {missions.map((mission) => (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => {
                    setDraft(mission.draft);
                    setUsingMission(mission.id);
                    if (grownUp) setOpenId(grownUp.id);
                  }}
                  className="min-h-11 w-full rounded-xl border-[3px] border-ink/15 bg-white/80 px-3 py-2 text-left transition active:translate-y-[1px]"
                >
                  <div className="font-body text-[13px] font-extrabold leading-snug text-ink/85">
                    {mission.ask}
                  </div>
                  <div className="mt-0.5 font-body text-[11px] font-bold leading-snug text-ink/50">
                    Tap to fill it in with what you wrote. You can change it.
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/*
          Pasting a code is an inbox-level action, not a thread-level one, and
          it is folded away until asked for.
          
          It lived inside the friend-thread block, and a browser found the dead
          end immediately: a child receiving their *first* code has no friend
          thread yet, so there was nowhere to paste it. The thread is created
          *by* the paste — `receive` opens it under whatever name the code
          carries — so the box cannot be gated on a thread existing.
          
          Folded because a text field asking for a `MSG-…` string is the least
          child-like thing in the product, and it should not be the first thing
          on the screen. It is a fallback, not the feature.
        */}
        {onPasteCode && (
          <div className="mt-3">
            {!pasting ? (
              <button
                type="button"
                onClick={() => setPasting(true)}
                className="min-h-11 font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/45 underline decoration-ink/25"
              >
                Got a code from a friend?
              </button>
            ) : (
              <div className="rounded-2xl border-[3px] border-ink/12 bg-white/70 px-3 py-2.5">
                <label
                  className="font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/55"
                  htmlFor="paste-code"
                >
                  Paste it here
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="paste-code"
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                    placeholder="MSG-…"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border-[3px] border-ink/15 bg-white px-3 font-ledger text-[12px] font-bold text-ink/85"
                  />
                  <button
                    type="button"
                    disabled={pasted.trim().length === 0}
                    onClick={() => {
                      onPasteCode(pasted);
                      setPasted('');
                    }}
                    className="min-h-11 shrink-0 rounded-xl border-[3px] border-ink/20 bg-white px-3 font-body text-xs font-extrabold uppercase tracking-wide text-ink/70 disabled:opacity-40"
                  >
                    Read it
                  </button>
                </div>
                {codeNote && (
                  <p className="mt-1.5 rounded-lg border-2 border-berry/40 bg-white px-2 py-1 font-body text-[11px] font-bold leading-snug text-ink/70">
                    {codeNote}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {thread ? (
          <>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {thread.messages.length === 0 && (
                <PipSays
                  lines={[
                    thread.kind === 'grown-up'
                      ? 'Tell them one thing you worked out. They can answer on this same device.'
                      : `${thread.withWhom} cannot get these on their own yet. Write one, then turn it into a code to give them.`,
                  ]}
                />
              )}
              {thread.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl border-[3px] px-3 py-2 ${
                    message.author === 'child'
                      ? 'ml-auto border-mint-deep bg-mint/20'
                      : 'border-ink/15 bg-white/85'
                  }`}
                >
                  <div className="font-body text-[13px] font-bold leading-snug text-ink/85">
                    {message.body}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-body text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
                    <span>{message.author === 'child' ? 'You' : thread.withWhom}</span>
                    {/*
                      "Waiting to be sent", never "sent". There is no transport,
                      and a child who believes a friend has read this is the one
                      failure here that would matter.
                    */}
                    {message.state === 'held' && (
                      <span className="text-berry">· not sent yet</span>
                    )}
                  </div>
                  {/*
                    A held friend message can be turned into a code.
                    
                    This is the transport: the same pasteable code the club
                    already travels as. It is not a server and does not pretend
                    to be — a code is a note passed across a table, and whoever
                    holds it can read it, which is what a child would expect of
                    a note.
                  */}
                  {message.state === 'held' && onMakeCode && (
                    <button
                      type="button"
                      onClick={() => onMakeCode(message.id)}
                      className="mt-1 min-h-11 font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/50 underline decoration-ink/30"
                    >
                      Turn into a code
                    </button>
                  )}
                  {message.note && (
                    <div className="mt-1.5 rounded-lg border-2 border-berry/40 bg-white px-2 py-1 font-body text-[11px] font-bold leading-snug text-ink/70">
                      {message.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {code && (
              <div className="mt-2 rounded-xl border-[3px] border-mint/50 bg-mint/15 px-3 py-2">
                <div className="font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/60">
                  Give them this
                </div>
                <code className="mt-1 block break-all font-ledger text-[11px] font-bold text-ink/85">
                  {code}
                </code>
              </div>
            )}

            {thread.blocked ? (
              <div className="mt-3 rounded-xl border-[3px] border-berry/50 bg-white px-3 py-2 font-body text-[12px] font-bold text-ink/75">
                This conversation is blocked. Nothing goes in or out of it.
                <button
                  type="button"
                  onClick={() => onBlock(thread.id)}
                  className="mt-1.5 block min-h-11 font-body text-[12px] font-extrabold uppercase tracking-wide text-ink/55"
                >
                  Unblock it
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <label className="sr-only" htmlFor="message-body">
                  Write a message
                </label>
                <textarea
                  id="message-body"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE))}
                  rows={3}
                  placeholder="Write something…"
                  className="w-full rounded-xl border-[3px] border-ink/15 bg-white/90 px-3 py-2 font-body text-sm font-bold text-ink/85"
                />
                <div className="mt-1 flex items-center justify-between font-body text-[11px] font-extrabold text-ink/45">
                  <span>
                    {MAX_MESSAGE - draft.length} left
                  </span>
                  <Trouble thread={thread} onBlock={onBlock} onReport={onReport} />
                </div>
              </div>
            )}
          </>
        ) : (
          <PipSays
            className="mt-4"
            lines={['Nobody to write to yet. That comes with the market.']}
          />
        )}

        <PinnedBar className="mt-auto flex gap-3">
          <ChunkyButton variant="ghost" onClick={onBack} className="!px-5 !text-xl">
            ←
          </ChunkyButton>
          <ChunkyButton
            variant="mint"
            full
            disabled={!thread || thread.blocked || draft.trim().length === 0}
            onClick={() => {
              if (!thread) return;
              onSend(thread.id, draft, usingMission);
              setDraft('');
              setUsingMission(undefined);
            }}
          >
            {thread?.kind === 'friend' ? 'Write it →' : 'Send →'}
          </ChunkyButton>
        </PinnedBar>
      </div>
    </Sky>
  );
}

/**
 * Block and report, on every conversation, always reachable.
 *
 * Small but never hidden behind a menu. A child who wants out of a
 * conversation is not going to go hunting, and the whole value of having built
 * this before there is a transport is that the way out exists before the way
 * in does.
 */
function Trouble({
  thread,
  onBlock,
  onReport,
}: {
  thread: Thread;
  onBlock: (id: string) => void;
  onReport: (id: string, reason: string) => void;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="min-h-11 font-body text-[11px] font-extrabold uppercase tracking-wide text-ink/45"
      >
        Something wrong?
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          onBlock(thread.id);
          setAsking(false);
        }}
        className="min-h-11 rounded-full border-2 border-ink/20 bg-white px-3 font-body text-[11px] font-extrabold text-ink/70"
      >
        Block
      </button>
      <button
        type="button"
        onClick={() => {
          // Reporting blocks as well. A report that leaves the conversation
          // open asks a child to keep reading it while somebody looks, and
          // there is nobody to look.
          onReport(thread.id, 'The child reported this conversation.');
          setAsking(false);
        }}
        className="min-h-11 rounded-full border-2 border-berry/50 bg-white px-3 font-body text-[11px] font-extrabold text-berry"
      >
        Tell a grown-up
      </button>
    </div>
  );
}
