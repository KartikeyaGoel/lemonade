/**
 * What is worth telling a child, and when.
 *
 * The customer asked for notifications and for "as much as we can without all
 * the server nonsense". This is that, and it is worth being exact about which
 * half is which, because the split is not where it looks.
 *
 * **The hard half is the policy, and it needs no server.** What is worth
 * saying, how often, in what order, and — mostly — what to shut up about.
 * That is all a question about the ledger and the portfolio, it is where a
 * notification system is good or awful, and it is entirely built here.
 *
 * **The easy half is the transport, and it needs one.** Waking a closed app
 * needs Web Push: a service worker `push` handler, a VAPID key pair, a server
 * holding a subscription, and something to decide when to send. See
 * `MISSING_FOR_REAL` at the foot of this file, which is the list of holes to
 * fill and is deliberately in code rather than in a document, so it sits next
 * to the thing it describes.
 *
 * What that leaves working today: every nudge is computed, ordered and
 * deduplicated exactly as it would be in production, shown in the app when a
 * child arrives, and shown as a **real system notification** if the page is
 * open and a grown-up has allowed it. The only thing missing is delivery to a
 * closed app.
 *
 * ## Why the rules are mostly about silence
 *
 * A notification system for children is judged by what it does not send. §15
 * of PRODUCT.md is the standard: the engines are *records of the child*, never
 * complaints about them, and "you have not played for 3 days" is a
 * telling-off. So:
 *
 *  - Nothing names how long it has been.
 *  - Nothing fires twice for the same reason on the same day.
 *  - At most `MAX_A_DAY`, ever, whatever is going on.
 *  - Nothing at all before the child has done the thing that gives the subject
 *    a meaning, which is `unlocks.ts`'s rule applied to a message.
 *
 * Pure module. No React, no I/O, no network.
 */

import { balance, streak, type Ledger } from './ledger';
import type { CheckIn } from './checkin';
import type { Drift } from './thesis';
import { plural } from './copy';

/**
 * The most a child hears from us in one day.
 *
 * Two. Clash of Clans sends more and has a different bargain with its player;
 * this is a product a parent has to be willing to leave installed, and the
 * fastest way to lose that is to be chatty.
 */
export const MAX_A_DAY = 2;

export type NudgeKind =
  | 'check-in-ready'
  | 'reason-changed'
  | 'grown-up-wrote'
  | 'credits-to-spend'
  | 'streak-alive';

export interface Nudge {
  kind: NudgeKind;
  /**
   * Stable within a day, so the same reason cannot fire twice.
   *
   * Keyed by kind *and* day rather than by kind alone: "your reason changed"
   * is worth saying once about Apple on Tuesday and again about Nike on
   * Friday, and never twice about Apple on Tuesday.
   */
  id: string;
  title: string;
  body: string;
  /** Lower sorts first. Only the top `MAX_A_DAY` are ever sent. */
  priority: number;
  /** Where tapping it should land the child. */
  goTo: 'checkin' | 'market' | 'messages' | 'credits';
}

export interface NudgeContext {
  ledger: Ledger;
  /** Today, as the child's own calendar day. */
  today: string;
  checkIn: CheckIn | null;
  drifts: readonly Drift[];
  /** Unread notes from a grown-up. */
  fromGrownUp: number;
  /** Whether there is an account for credits to go into. */
  canSpend: boolean;
}

/**
 * Everything worth saying today, best first, already capped.
 *
 * Ordered by what a child can *act on*, not by what is most flattering to the
 * product. A reason that has stopped being true outranks a streak, because one
 * of them is about their money and the other is about our retention.
 */
export function nudges(context: NudgeContext): Nudge[] {
  const { ledger, today, checkIn, drifts, fromGrownUp, canSpend } = context;
  const found: Nudge[] = [];
  const run = streak(ledger, today);

  /*
   * A written reason that no longer holds. The highest-priority thing this
   * product ever has to say, because it is the only one that is about a
   * decision the child has money riding on.
   */
  if (drifts.length > 0) {
    const first = drifts[0];
    found.push({
      kind: 'reason-changed',
      id: `reason-changed:${first.ticker ?? 'x'}:${today}`,
      title: 'Your reason has changed',
      body: first.says,
      priority: 0,
      goTo: 'market',
    });
  }

  /*
   * A grown-up wrote back. Second, and above the check-in, because somebody
   * took the trouble and a child should not find it three days later.
   */
  if (fromGrownUp > 0) {
    found.push({
      kind: 'grown-up-wrote',
      id: `grown-up-wrote:${today}`,
      title: fromGrownUp === 1 ? 'A grown-up wrote back' : `${fromGrownUp} notes from a grown-up`,
      body: 'They answered what you told them.',
      priority: 1,
      goTo: 'messages',
    });
  }

  /*
   * Today's check-in, and only if it has not been done.
   *
   * The body names the company that moved rather than saying "your check-in is
   * ready", because the first is a reason to open the app and the second is a
   * chore with a bell on it.
   */
  if (checkIn && !checkIn.doneToday) {
    found.push({
      kind: 'check-in-ready',
      id: `check-in-ready:${today}`,
      title: checkIn.story ? `${checkIn.story.name} moved this week` : 'Something to look at',
      body: checkIn.story
        ? 'Worth working out whether it touches anything you own.'
        : 'A quiet week. Still worth two minutes.',
      priority: 2,
      goTo: 'checkin',
    });
  }

  /*
   * Credits worth spending. Last of the useful ones, and only when there is
   * enough to actually buy something — telling a child they have 12 credits
   * and nothing to do with them is a notification about nothing.
   */
  if (canSpend && balance(ledger) >= 25) {
    found.push({
      kind: 'credits-to-spend',
      id: `credits-to-spend:${today}`,
      title: `${balance(ledger)} credits`,
      body: 'Enough to put more money into something you already believe in.',
      priority: 3,
      goTo: 'credits',
    });
  }

  /*
   * A streak worth keeping, and this is the one that had to be written
   * carefully.
   *
   * It fires only when the streak is *alive and uncounted* — played yesterday,
   * nothing today — and it names the run rather than the gap. "3 days running"
   * is a record of them; "you have not played today" is a complaint. §15.
   *
   * Two days minimum, because telling somebody they have a one-day streak is
   * telling them they played yesterday.
   */
  if (run.running >= 2 && !run.todayCounted) {
    found.push({
      kind: 'streak-alive',
      id: `streak-alive:${today}`,
      title: `${plural(run.running, 'day')} running`,
      body: 'Still going. One check-in keeps it.',
      priority: 4,
      goTo: 'checkin',
    });
  }

  return found.sort((a, b) => a.priority - b.priority).slice(0, MAX_A_DAY);
}

/**
 * Which of today's nudges have not been shown yet.
 *
 * `shown` is the list of ids already sent, which lives with the rest of the
 * per-device state. Dedupe happens here rather than at the call site because
 * "have we said this already" is the single easiest thing to get wrong in a
 * notification system, and the cost of getting it wrong is the product feeling
 * like spam.
 */
export function unshown(context: NudgeContext, shown: readonly string[]): Nudge[] {
  return nudges(context).filter((nudge) => !shown.includes(nudge.id));
}

/**
 * Has the child been told anything at all today?
 *
 * Used to hold the daily cap across a page reload: without it, closing and
 * reopening the tab would re-earn the whole allowance.
 */
export function sentToday(shown: readonly string[], today: string): number {
  return shown.filter((id) => id.endsWith(`:${today}`)).length;
}

/** The cap, applied across a whole day rather than per visit. */
export function roomLeftToday(shown: readonly string[], today: string): number {
  return Math.max(0, MAX_A_DAY - sentToday(shown, today));
}

/**
 * Somewhere to be honest in code about what is not built.
 *
 * In this file rather than only in a document, because the next person to
 * touch notifications will open this file and not FRAMEWORK.md — and because a
 * list of holes that lives next to the thing with the holes in it is the only
 * kind that stays current.
 */
export const MISSING_FOR_REAL: readonly string[] = [
  'A `push` event handler in public/sw.js, calling registration.showNotification.',
  'A VAPID key pair, with the private half somewhere that is not the bundle.',
  'PushManager.subscribe on the client, and somewhere to send the subscription.',
  'A server holding subscriptions, and a scheduled job deciding when to send.',
  'An identity per child, which is the same account work notifications and friend delivery both wait on.',
  'Verifiable parental consent before any of the above, because the audience is under 13.',
  'A way to unsubscribe that a parent can find, and that works without an account.',
];

/**
 * What *is* built, stated as plainly as the list above.
 *
 * These two arrays exist as a pair on purpose. A single list of missing pieces
 * reads like a broken feature; the pair reads like what it is, which is a
 * feature whose policy is finished and whose delivery is one decision away.
 */
export const BUILT_WITHOUT_A_SERVER: readonly string[] = [
  'Which nudges exist, what each one says, and the order they matter in.',
  'The daily cap, held across reloads, and per-reason dedupe within a day.',
  'The rule that nothing names how long it has been.',
  'Permission asked for once, from the grown-up screen, never from a child screen.',
  'Real system notifications while the app is open.',
  'The same nudges shown in the app, so nothing is lost when permission is refused.',
];
