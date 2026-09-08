/**
 * Messages: child to grown-up, and child to friend.
 *
 * Asked for directly by the customer, who was clear about the scope: build it
 * for the demo, with no server, so that it ports when the product gets one.
 * This is that — the model, the safety scaffolding, and one of the two kinds
 * fully working.
 *
 * ## What works today, and what is a seam
 *
 * **Grown-up threads work completely, with no server at all.** A child writes
 * from their Messages screen; the grown-up replies from behind the grown-up
 * screen, on the same device. That is not a stub standing in for the real
 * thing — a shared family tablet is the normal case for this age group, and a
 * note left for a parent who picks the device up later is the actual product.
 * Nothing leaves the device, so PRIVACY.md stays true as written.
 *
 * **Friend threads travel as a pasted code**, the way everything else in this
 * product does. `asCode` turns one message into a `MSG-…` string and
 * `receive` takes one back, so two children can hold a conversation with no
 * server, no accounts and no network call — the same trust model as the club
 * codes that already pass between friends who know each other.
 *
 * That is a real change to what this product promises, and PRIVACY.md says so
 * in its own words rather than being left true-by-omission: free text now does
 * travel between children. What has *not* changed is that it does not travel
 * through us, because there is still no us.
 *
 * The safety consequence is stated plainly here because it is the thing a
 * server would otherwise have provided: **the filter runs on the way out and
 * again on the way in**, so an identifier cannot arrive even from a code
 * written by an older build — but there is no human moderation, and there
 * cannot be without somebody to do it. Block and report are the child's own
 * tools, and they are on every conversation.
 *
 * ## Why the moderation is here before the transport
 *
 * Because it is the part that takes longest to get right and the part that
 * cannot be added afterwards. A children's product that ships a chat channel
 * and adds filtering later has, in the interval, shipped an unmoderated chat
 * channel for nine-year-olds. So: a filter every message passes through, a
 * block list that is checked on send rather than on read, a report trail, and
 * a hard cap on length. All local, all cheap, all pointless until delivery
 * exists — and all impossible to retrofit calmly under pressure.
 *
 * Pure module. No React, no I/O, no network.
 */

import { decodeLong, encodeLong } from './sharecode';

/** The longest a message may be. Short on purpose; this is not a mail client. */
export const MAX_MESSAGE = 240;

/**
 * Who a thread is with.
 *
 * `grown-up` is the only kind that can be delivered today, and the distinction
 * is not cosmetic: a grown-up thread is a closed pair on one device, and a
 * friend thread is a channel between two children. Those carry completely
 * different obligations, so they are different kinds rather than one kind with
 * a name on it.
 */
export type ThreadKind = 'grown-up' | 'friend';

export type Author = 'child' | 'grown-up' | 'friend';

/**
 * Where a message has got to.
 *
 * `held` means written and kept but not yet handed over — a friend message
 * before a code has been made for it. A screen that showed it as "sent" would
 * be lying to a child about whether their friend can see it, which is the one
 * failure in this feature with real consequences.
 */
export type MessageState = 'held' | 'delivered' | 'blocked';

export interface Message {
  id: string;
  author: Author;
  /** What was written, after the filter has had it. */
  body: string;
  /** The child's own calendar day, as `YYYY-MM-DD`. */
  on: string;
  state: MessageState;
  /** Set when the filter changed or refused the text, so it can be explained. */
  note?: string;
}

export interface Thread {
  id: string;
  kind: ThreadKind;
  /** Who it is with, in the child's words. A first name or a nickname. */
  withWhom: string;
  messages: Message[];
  /** Set by the child or a grown-up. A blocked thread accepts nothing. */
  blocked: boolean;
  /** Reports raised on this thread, kept as a trail rather than a counter. */
  reports: Array<{ on: string; reason: string }>;
}

export interface Inbox {
  version: number;
  threads: Thread[];
}

export const INBOX_VERSION = 1;

/** How many messages a thread keeps. Bounded, like every other stored list. */
export const THREAD_CAP = 60;

export function createInbox(): Inbox {
  return { version: INBOX_VERSION, threads: [] };
}

/* ------------------------------------------------------------------ *
 * The filter
 * ------------------------------------------------------------------ */

/**
 * What a nine-year-old must not be able to put in a message.
 *
 * Not a profanity list. Profanity is unpleasant and survivable; **contact
 * details are the thing that turns a chat channel into a safeguarding
 * incident**, and they are also the thing a child gives away without meaning
 * to. So the filter is aimed at identifiers: phone numbers, emails, addresses,
 * links, and the names of the apps a conversation gets moved to.
 *
 * That last category is the one people leave out. "Add me on <app>" is how a
 * moderated channel becomes an unmoderated one, and no amount of filtering
 * inside this app helps once the conversation has left it.
 *
 * A profanity list would also be a poor use of this: it needs constant
 * maintenance, it is trivially evaded, and its failure mode is a rude word
 * getting through. The failure mode here is a child's address getting out.
 */
const IDENTIFIERS: Array<{ re: RegExp; why: string }> = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, why: 'an email address' },
  { re: /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, why: 'something that looks like a phone number' },
  { re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi, why: 'a link' },
  {
    re: /\b(?:snap(?:chat)?|discord|whats?app|insta(?:gram)?|tiktok|roblox|telegram|kik)\b/gi,
    why: 'another app to talk on',
  },
  {
    re: /\b\d+\s+(?:[A-Za-z]+\s+){0,2}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|way)\b/gi,
    why: 'an address',
  },
  { re: /\b(?:my\s+)?school\s+is\b/gi, why: 'the name of a school' },
];

export interface Filtered {
  /** The text as it may be stored. Identifiers replaced, never silently kept. */
  body: string;
  /** True when nothing had to be changed. */
  clean: boolean;
  /** What was taken out, for the sentence shown to the child. */
  removed: string[];
}

/**
 * Take the identifiers out, and say what was taken.
 *
 * Replaced rather than rejected, and told rather than hidden. A child whose
 * message silently vanishes learns the app is broken; a child who is told
 * "phone numbers do not go in here" has learned something true about the
 * internet, once, in a low-stakes place. That is worth more than the message.
 */
export function filterMessage(text: string): Filtered {
  let body = text.slice(0, MAX_MESSAGE);
  const removed: string[] = [];

  for (const { re, why } of IDENTIFIERS) {
    // `re` carries the global flag, so reset before reuse: a shared RegExp
    // with lastIndex left over skips matches on the next call, which is the
    // kind of bug that shows up as "the filter works except sometimes".
    re.lastIndex = 0;
    if (re.test(body)) {
      if (!removed.includes(why)) removed.push(why);
      re.lastIndex = 0;
      body = body.replace(re, '…');
    }
  }

  return { body: body.trim(), clean: removed.length === 0, removed };
}

/** One sentence for the child, naming what came out. */
export function filterNote(filtered: Filtered): string | undefined {
  if (filtered.clean) return undefined;
  const list =
    filtered.removed.length === 1
      ? filtered.removed[0]
      : `${filtered.removed.slice(0, -1).join(', ')} and ${filtered.removed.at(-1)}`;
  return `We took out ${list}. Those do not go in messages, even to people you know.`;
}

/* ------------------------------------------------------------------ *
 * Threads
 * ------------------------------------------------------------------ */

export function threadFor(inbox: Inbox, id: string): Thread | undefined {
  return inbox.threads.find((thread) => thread.id === id);
}

/**
 * The one thread every child has, and it is with a grown-up.
 *
 * Created on demand rather than at install, so a child who never writes to
 * anybody has an empty Messages screen rather than an empty conversation —
 * which is `unlocks.ts`'s rule about nothing existing before it means
 * something, applied to a list.
 */
export function grownUpThread(inbox: Inbox): Thread | undefined {
  return inbox.threads.find((thread) => thread.kind === 'grown-up');
}

export function openThread(inbox: Inbox, kind: ThreadKind, withWhom: string): Inbox {
  const existing = inbox.threads.find(
    (thread) => thread.kind === kind && thread.withWhom === withWhom,
  );
  if (existing) return inbox;

  return {
    ...inbox,
    threads: [
      ...inbox.threads,
      {
        id: `${kind}-${withWhom.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'x'}`,
        kind,
        withWhom,
        messages: [],
        blocked: false,
        reports: [],
      },
    ],
  };
}

export interface SendResult {
  inbox: Inbox;
  /** The message as stored, or null when it was refused outright. */
  message: Message | null;
  /** Why, when there is something to say. Always shown, never swallowed. */
  note?: string;
}

/**
 * Write a message.
 *
 * Two refusals and they are both checked here rather than at read time. A
 * blocked thread takes nothing — checking on send is what makes a block mean
 * "we will not carry this" rather than "we will carry it and hide it" — and an
 * empty message is not a message.
 *
 * A grown-up thread is delivered immediately, because both ends are on this
 * device. A friend thread is `held`, because there is nowhere to send it. The
 * state is stored rather than derived so that when a transport arrives, what
 * was and was not delivered is a fact about each message rather than a guess.
 */
export function send(
  inbox: Inbox,
  threadId: string,
  author: Author,
  text: string,
  on: string,
): SendResult {
  const thread = threadFor(inbox, threadId);
  if (!thread) return { inbox, message: null, note: 'That conversation is not open.' };

  if (thread.blocked) {
    return { inbox, message: null, note: 'This conversation is blocked. Nothing goes in or out.' };
  }

  const filtered = filterMessage(text);
  if (filtered.body.length === 0) {
    return {
      inbox,
      message: null,
      note: filtered.removed.length > 0 ? filterNote(filtered) : undefined,
    };
  }

  const message: Message = {
    id: `${threadId}-${thread.messages.length}-${on}`,
    author,
    body: filtered.body,
    on,
    state: thread.kind === 'grown-up' ? 'delivered' : 'held',
    ...(filterNote(filtered) ? { note: filterNote(filtered) } : {}),
  };

  return {
    inbox: {
      ...inbox,
      threads: inbox.threads.map((current) =>
        current.id === threadId
          ? { ...current, messages: [...current.messages, message].slice(-THREAD_CAP) }
          : current,
      ),
    },
    message,
    note: filterNote(filtered),
  };
}

/**
 * The seam a transport calls, and the only one.
 *
 * When there is a server, delivering a friend message is this function and
 * nothing else: flip the state, leave everything else alone. It exists now,
 * with a test, so that the port is a wiring job rather than a redesign — and
 * so that "what would delivery actually change?" has a written answer while
 * the decision is still open.
 */
export function deliver(inbox: Inbox, messageId: string): Inbox {
  return {
    ...inbox,
    threads: inbox.threads.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) =>
        message.id === messageId && message.state === 'held'
          ? { ...message, state: 'delivered' }
          : message,
      ),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * The code transport
 * ------------------------------------------------------------------ */

/** What travels. Deliberately three fields and no identifiers among them. */
interface Carried {
  /** Who wrote it, as they chose to be called. Capped like every other name. */
  f: string;
  /** The body, already filtered once on the way out. */
  b: string;
  /** The day it was written, so the receiving thread can order it. */
  o: string;
}

/**
 * Turn a held message into a code a friend can paste.
 *
 * This is what `deliver()` was the seam for, and it is now called by something
 * real. Producing the code *is* the act of sending, so the message becomes
 * `delivered` — a child who asks for a code in order to give it to somebody
 * has sent it, in the only sense this product can observe. It is the same
 * bargain the club codes already make.
 *
 * Nothing here is encrypted and nothing pretends to be. A code is a note
 * passed across a table: whoever holds it can read it, which is exactly what a
 * child would expect of a note.
 */
export function asCode(inbox: Inbox, messageId: string, from: string): { inbox: Inbox; code: string | null } {
  for (const thread of inbox.threads) {
    const message = thread.messages.find((current) => current.id === messageId);
    if (!message) continue;
    if (thread.kind !== 'friend') return { inbox, code: null };

    const carried: Carried = { f: from.slice(0, 24) || 'A friend', b: message.body, o: message.on };
    return { inbox: deliver(inbox, messageId), code: encodeLong('MSG', carried) };
  }
  return { inbox, code: null };
}

export interface Received {
  inbox: Inbox;
  message: Message | null;
  /**
   * Which thread it landed in.
   *
   * Returned rather than left for the caller to work out, because a browser
   * found what happens otherwise: the message arrived correctly and the screen
   * stayed on whatever conversation was already open, so a child had to go
   * hunting for the thing they had just pasted.
   */
  threadId?: string;
  note?: string;
}

/**
 * Take a code back.
 *
 * **Filtered again on the way in, and that is not belt-and-braces.** The
 * message was filtered when it was written, by whatever build the *sender* was
 * running — which might be older than this one, and might not have known about
 * whatever the filter learned since. The receiving device is the only one that
 * can apply its own rules, so it does.
 *
 * A blocked thread refuses an incoming code as well as an outgoing message.
 * Checking only on send would make a block mean "we will not let you write to
 * them", which is the less useful half.
 */
export function receive(inbox: Inbox, code: string, on: string): Received {
  const carried = decodeLong<Carried>('MSG', code);
  if (!carried || typeof carried.b !== 'string' || typeof carried.f !== 'string') {
    return { inbox, message: null, note: 'That code is not a message. Check it and try again.' };
  }

  const from = carried.f.slice(0, 24) || 'A friend';
  const opened = openThread(inbox, 'friend', from);
  const thread = opened.threads.find((current) => current.kind === 'friend' && current.withWhom === from)!;

  if (thread.blocked) {
    return {
      inbox: opened,
      message: null,
      threadId: thread.id,
      note: `${from} is blocked. Nothing comes in from them.`,
    };
  }

  const filtered = filterMessage(carried.b);
  if (filtered.body.length === 0) {
    return {
      inbox: opened,
      message: null,
      threadId: thread.id,
      note: 'There was nothing in that message once we had checked it.',
    };
  }

  const note = filterNote(filtered);
  const message: Message = {
    id: `${thread.id}-in-${thread.messages.length}-${on}`,
    author: 'friend',
    body: filtered.body,
    on,
    state: 'delivered',
    ...(note ? { note } : {}),
  };

  return {
    inbox: {
      ...opened,
      threads: opened.threads.map((current) =>
        current.id === thread.id
          ? { ...current, messages: [...current.messages, message].slice(-THREAD_CAP) }
          : current,
      ),
    },
    message,
    threadId: thread.id,
    note,
  };
}

/** Everything still waiting to be turned into a code. */
export function held(inbox: Inbox): Message[] {
  return inbox.threads.flatMap((thread) =>
    thread.messages.filter((message) => message.state === 'held'),
  );
}

export function block(inbox: Inbox, threadId: string, blocked = true): Inbox {
  return {
    ...inbox,
    threads: inbox.threads.map((thread) =>
      thread.id === threadId ? { ...thread, blocked } : thread,
    ),
  };
}

/**
 * Raise a report, and block at the same time.
 *
 * Together on purpose. A report that leaves the conversation open asks a child
 * to keep reading it while somebody gets round to looking, and there is nobody
 * to get round to it. Blocking is the part that helps immediately; the trail
 * is the part that matters if this is ever delivered to a real second person.
 */
export function report(inbox: Inbox, threadId: string, reason: string, on: string): Inbox {
  return {
    ...inbox,
    threads: inbox.threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            blocked: true,
            reports: [...thread.reports, { on, reason: reason.slice(0, MAX_MESSAGE) }],
          }
        : thread,
    ),
  };
}

/** Messages the child has not seen, per thread. Used for the door's badge. */
export function unreadFrom(thread: Thread, author: Author): number {
  return thread.messages.filter((message) => message.author === author).length;
}

/** One line for the Messages door. Names what is waiting, never how long. */
export function inboxLine(inbox: Inbox): string {
  const grownUp = grownUpThread(inbox);
  const waiting = grownUp ? unreadFrom(grownUp, 'grown-up') : 0;
  if (waiting > 0) return waiting === 1 ? 'A note from a grown-up.' : `${waiting} notes from a grown-up.`;
  const holding = held(inbox).length;
  if (holding > 0) return `${holding} waiting to be turned into a code.`;
  return 'Tell a grown-up what you worked out.';
}
