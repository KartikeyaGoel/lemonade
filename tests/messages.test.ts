/**
 * Messages, and the safety scaffolding that is the actual deliverable.
 *
 * The customer asked for messaging — grown-up to child and child to child —
 * built for the demo so that it ports when there is a server. The part worth
 * testing hardest is not the storing of text. It is the filter, the block and
 * the honesty of the delivery state, because:
 *
 *  - **A filter cannot be retrofitted calmly.** A children's product that
 *    ships a channel and adds filtering later has, in the interval, shipped an
 *    unmoderated channel for nine-year-olds.
 *  - **The filter is aimed at identifiers, not swear words.** Profanity is
 *    unpleasant and survivable. A phone number, an address, or "add me on
 *    another app" is how a moderated channel stops being one.
 *  - **A `held` message must never read as sent.** There is no transport, and
 *    a screen that told a child their friend could see something they cannot
 *    is the one failure here that would matter.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_MESSAGE,
  THREAD_CAP,
  block,
  createInbox,
  deliver,
  filterMessage,
  filterNote,
  grownUpThread,
  held,
  inboxLine,
  openThread,
  report,
  send,
  threadFor,
  unreadFrom,
  type Inbox,
} from '../src/lib/messages';

const TODAY = '2026-09-07';

const SRC = join(import.meta.dirname, '..', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

function withThreads(): Inbox {
  let inbox = createInbox();
  inbox = openThread(inbox, 'grown-up', 'Mum');
  inbox = openThread(inbox, 'friend', 'Ada');
  return inbox;
}

const grownUpId = () => grownUpThread(withThreads())!.id;
const friendId = () => withThreads().threads.find((t) => t.kind === 'friend')!.id;

describe('the filter', () => {
  it('lets an ordinary message through untouched', () => {
    const out = filterMessage('I bought Apple because it keeps a lot of every dollar.');
    expect(out.clean).toBe(true);
    expect(out.body).toBe('I bought Apple because it keeps a lot of every dollar.');
    expect(filterNote(out)).toBeUndefined();
  });

  it('takes out an email address', () => {
    const out = filterMessage('write to me at ada.smith@example.com ok');
    expect(out.clean).toBe(false);
    expect(out.body).not.toContain('@example.com');
    expect(out.removed).toContain('an email address');
  });

  it('takes out something that looks like a phone number', () => {
    const out = filterMessage('call me on 07700 900123 tonight');
    expect(out.body).not.toMatch(/900123/);
    expect(out.removed).toContain('something that looks like a phone number');
  });

  it('takes out links', () => {
    expect(filterMessage('look at https://example.com/x').body).not.toContain('example.com');
    expect(filterMessage('go to www.example.com').body).not.toContain('example.com');
  });

  /*
   * The category people leave out, and the one that matters most.
   *
   * "Add me on <app>" is how a moderated conversation becomes an unmoderated
   * one, and no amount of filtering inside this app helps once the
   * conversation has moved somewhere else.
   */
  it('takes out the names of other apps to talk on', () => {
    for (const app of ['snapchat', 'Discord', 'whatsapp', 'insta', 'TikTok', 'telegram']) {
      const out = filterMessage(`add me on ${app}`);
      expect(out.clean, app).toBe(false);
      expect(out.removed, app).toContain('another app to talk on');
    }
  });

  it('takes out an address and a school', () => {
    expect(filterMessage('I live at 14 Mill Road').removed).toContain('an address');
    expect(filterMessage('my school is Hillside').removed).toContain('the name of a school');
  });

  it('says what it took out, rather than swallowing the message', () => {
    /*
     * Told, not hidden. A message that silently vanishes teaches a child the
     * app is broken. A child told "phone numbers do not go in here" has
     * learned something true about the internet, once, somewhere harmless.
     */
    const out = filterMessage('ring me on 07700 900123 or ada@example.com');
    const note = filterNote(out)!;
    expect(note).toMatch(/took out/i);
    expect(note).toMatch(/phone number/);
    expect(note).toMatch(/email/);
    expect(note).toMatch(/even to people you know/);
  });

  it('caps the length', () => {
    const out = filterMessage('a'.repeat(MAX_MESSAGE + 200));
    expect(out.body.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });

  /*
   * A global RegExp keeps `lastIndex` between calls, so a shared one skips
   * matches on the next use — a bug that presents as "the filter works except
   * sometimes", which is the worst possible shape for a safety control.
   */
  it('catches the same thing twice in a row', () => {
    for (let i = 0; i < 5; i += 1) {
      const out = filterMessage('mail me at a@b.co');
      expect(out.clean, `call ${i}`).toBe(false);
    }
  });
});

describe('writing to a grown-up', () => {
  it('is delivered straight away, because both ends are on this device', () => {
    const inbox = withThreads();
    const out = send(inbox, grownUpId(), 'child', 'I made $28 today', TODAY);
    expect(out.message?.state).toBe('delivered');
  });

  it('carries a reply back the other way', () => {
    let inbox = withThreads();
    inbox = send(inbox, grownUpId(), 'child', 'look what I did', TODAY).inbox;
    inbox = send(inbox, grownUpId(), 'grown-up', 'that is brilliant', TODAY).inbox;

    const thread = threadFor(inbox, grownUpId())!;
    expect(thread.messages.map((m) => m.author)).toEqual(['child', 'grown-up']);
    expect(unreadFrom(thread, 'grown-up')).toBe(1);
  });

  it('refuses an empty message', () => {
    const out = send(withThreads(), grownUpId(), 'child', '   ', TODAY);
    expect(out.message).toBeNull();
  });

  it('keeps the filter note on the stored message, so it can be explained', () => {
    const out = send(withThreads(), grownUpId(), 'child', 'call 07700 900123', TODAY);
    expect(out.message?.note).toMatch(/phone number/);
    expect(out.note).toMatch(/phone number/);
  });

  it('bounds the thread', () => {
    let inbox = withThreads();
    for (let i = 0; i < THREAD_CAP + 20; i += 1) {
      inbox = send(inbox, grownUpId(), 'child', `note ${i}`, TODAY).inbox;
    }
    expect(threadFor(inbox, grownUpId())!.messages).toHaveLength(THREAD_CAP);
  });
});

describe('writing to a friend, with nowhere to send it', () => {
  /*
   * The honesty that matters most in this file.
   *
   * There is no transport. A message to a friend is written, filtered and
   * kept, and it is *not* sent. Telling a child otherwise — showing it as
   * sent, or worse showing a reply that cannot exist — is the one failure here
   * with real consequences, because a child would say something believing it
   * had been read.
   */
  it('is held, never shown as sent', () => {
    const out = send(withThreads(), friendId(), 'child', 'I bought Costco', TODAY);
    expect(out.message?.state).toBe('held');
    expect(held(out.inbox)).toHaveLength(1);
  });

  it('says how many are waiting', () => {
    let inbox = withThreads();
    inbox = send(inbox, friendId(), 'child', 'one', TODAY).inbox;
    inbox = send(inbox, friendId(), 'child', 'two', TODAY).inbox;
    expect(inboxLine(inbox)).toBe('2 waiting to be sent.');
  });

  /*
   * The seam, tested now so the port is a wiring job.
   *
   * `deliver` is the single function a transport has to call. Having it here
   * with a test is what makes this a declared seam rather than a §40 defect:
   * the difference between the two is entirely whether it was written down.
   */
  it('has exactly one function a transport would call', () => {
    const sent = send(withThreads(), friendId(), 'child', 'hello', TODAY);
    const id = sent.message!.id;

    const after = deliver(sent.inbox, id);
    const message = threadFor(after, friendId())!.messages.find((m) => m.id === id)!;
    expect(message.state).toBe('delivered');
    expect(held(after)).toHaveLength(0);
    // And it changes nothing else about the message.
    expect(message.body).toBe('hello');
    expect(message.on).toBe(TODAY);
  });

  it('will not deliver a message twice or invent one', () => {
    const sent = send(withThreads(), friendId(), 'child', 'hello', TODAY);
    const once = deliver(sent.inbox, sent.message!.id);
    expect(deliver(once, sent.message!.id)).toEqual(once);
    expect(deliver(once, 'no-such-message')).toEqual(once);
  });
});

describe('blocking and reporting', () => {
  it('checks the block on send, not on read', () => {
    /*
     * The difference between "we will not carry this" and "we will carry it
     * and hide it". Only the first is a block.
     */
    let inbox = block(withThreads(), friendId());
    const out = send(inbox, friendId(), 'friend', 'anything at all', TODAY);
    expect(out.message).toBeNull();
    expect(out.note).toMatch(/blocked/i);
    inbox = out.inbox;
    expect(threadFor(inbox, friendId())!.messages).toHaveLength(0);
  });

  it('unblocks again', () => {
    const inbox = block(block(withThreads(), friendId()), friendId(), false);
    expect(send(inbox, friendId(), 'child', 'hello', TODAY).message).not.toBeNull();
  });

  it('blocks as part of reporting, not instead of it', () => {
    /*
     * A report that leaves the conversation open asks a child to keep reading
     * it while somebody gets round to looking — and there is nobody to get
     * round to it. The block is the part that helps now; the trail is the part
     * that matters if this is ever delivered to a real second person.
     */
    const inbox = report(withThreads(), friendId(), 'they were being mean', TODAY);
    const thread = threadFor(inbox, friendId())!;
    expect(thread.blocked).toBe(true);
    expect(thread.reports).toEqual([{ on: TODAY, reason: 'they were being mean' }]);
    expect(send(inbox, friendId(), 'friend', 'more of it', TODAY).message).toBeNull();
  });

  it('keeps a trail rather than a counter', () => {
    let inbox = report(withThreads(), friendId(), 'first', TODAY);
    inbox = report(inbox, friendId(), 'second', '2026-09-08');
    expect(threadFor(inbox, friendId())!.reports).toHaveLength(2);
  });
});

describe('the inbox door', () => {
  it('says nothing is waiting by inviting them to say something', () => {
    expect(inboxLine(withThreads())).toMatch(/Tell a grown-up/);
  });

  it('names what is waiting, never how long it has been', () => {
    // §15: the engines are records of the child, not complaints about them.
    const inbox = send(withThreads(), grownUpId(), 'grown-up', 'well done', TODAY).inbox;
    const line = inboxLine(inbox);
    expect(line).toMatch(/note from a grown-up/);
    expect(line).not.toMatch(/days|ago|still|have not/i);
  });

  it('opens a thread once and not twice', () => {
    const inbox = openThread(openThread(createInbox(), 'grown-up', 'Mum'), 'grown-up', 'Mum');
    expect(inbox.threads).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * The claim on the privacy page
 * ------------------------------------------------------------------ */

describe('nothing leaves the device', () => {
  /*
   * PRIVACY.md says, of the whole application: "the only network call in the
   * application code is the one the service worker makes to cache the game for
   * offline use. That includes messages: there is no code anywhere that sends
   * one."
   *
   * That is a promise on a page a teacher is invited to check, about a feature
   * that is one function away from being able to break it. `deliver()` is a
   * declared seam and a transport is a decision the customer has not taken —
   * so the moment somebody wires one up, this test is the thing that notices.
   *
   * A grep, in a file about messages, because the alternative is finding out
   * from a parent.
   */
  it('has no network call in the application source at all', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of [
        /\bfetch\s*\(/g,
        /\bXMLHttpRequest\b/g,
        /\bWebSocket\b/g,
        /sendBeacon/g,
        /\bEventSource\b/g,
      ]) {
        if (pattern.test(src)) {
          offenders.push(`${file.slice(file.indexOf('src'))}: ${pattern.source}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('leaves a friend message held, so no screen can call it sent', () => {
    // The state is stored rather than derived, so this is a fact about the
    // message rather than a rendering choice a screen could get wrong.
    const sent = send(withThreads(), friendId(), 'child', 'anything', TODAY);
    expect(sent.message!.state).toBe('held');
    expect(held(sent.inbox).map((m) => m.body)).toEqual(['anything']);
  });
});

