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
 * **Friend threads are modelled, moderated and stored, but not delivered.**
 * Delivery needs a server, an identity per child, and the consent work that
 * FRAMEWORK.md §17 records as the customer's decision. So a message to a
 * friend sits in the outbox with `state: 'held'`, the screen says so, and
 * `deliver()` is the single function a transport has to call. One seam, named,
 * tested, and wired to nothing on purpose — which is the opposite of the §40
 * defect only because it is *declared* rather than discovered.
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
 * Pure module. No React, no I/O.
 */

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
 * `held` is the honest state for a friend message today: written, kept, and
 * not sent, because there is nowhere to send it. A screen that showed it as
 * "sent" would be lying to a child about whether their friend can see it.
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

/** Everything still waiting for a transport that does not exist yet. */
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
  if (holding > 0) return `${holding} waiting to be sent.`;
  return 'Tell a grown-up what you worked out.';
}
