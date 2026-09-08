/**
 * What the child did, and on which day.
 *
 * Everything the engagement layer wants to know is a question about this
 * record: what have they earned, how many days running have they turned up and
 * thought, is there anything to review, has it been a while. None of it was
 * answerable before, because the save holds a *position* — the money, the day
 * of the week, the holdings — and nothing anywhere knew what day it was from
 * the child's point of view.
 *
 * FRAMEWORK.md §17 argues this is the piece with the longest lead time and the
 * one every other item is downstream of. Built first for that reason: credits,
 * streaks, the daily check-in, the parent missions and eventually a push
 * notification are all *reads* against this file. If it arrives last, each of
 * them invents its own half of it, which is PRODUCT.md §62's defect class with
 * a calendar in it.
 *
 * Pure module. No React, no I/O. Persistence is storage.ts's job.
 */

/**
 * A thing worth recording, and the list is closed on purpose.
 *
 * A credit rule cannot invent a behaviour: if it is not in this union it did
 * not happen, and a new one has to be added here — next to every other thing
 * the product is willing to pay attention to. That is the difference between a
 * ledger and an analytics event stream, and it is the whole reason this is
 * safe to keep on a child's device.
 *
 * Named for the decision, never for the screen. `read-accounts` is a thing a
 * child did; `opened-company-card` would be a thing the interface did, and
 * paying for the second is how you end up rewarding taps.
 */
export type Deed =
  /* The business stages */
  | 'ran-a-day'
  | 'hit-the-goal'
  | 'held-through-a-loss'
  /* Research */
  | 'read-accounts'
  | 'rated-a-business'
  /* Committing money */
  | 'wrote-a-thesis'
  | 'passed-on-price'
  | 'sized-a-position'
  | 'diversified'
  | 'trimmed-concentration'
  /* Living with it */
  | 'held-when-nothing-changed'
  | 'held-a-while'
  | 'named-the-mover'
  | 'told-news-from-noise'
  | 'checked-a-thesis'
  | 'reviewed-a-mistake'
  /* Out loud */
  | 'taught-a-grown-up'
  /* The ritual itself */
  | 'answered-the-check-in';

export interface Entry {
  deed: Deed;
  /** The child's own calendar day, `YYYY-MM-DD`. See `localDay`. */
  on: string;
  /** What it was about, when that matters: a ticker, a word, a company. */
  what?: string;
  /** Credits awarded at the time. Recorded so the log can be shown back. */
  credits: number;
}

export interface Ledger {
  version: number;
  /**
   * Credits ever earned, and credits ever spent.
   *
   * Two running totals rather than one balance, and both only ever climb.
   * `earned` is the thing PRODUCT.md §4 calls monotonic — a child's record of
   * what they have demonstrated must never go down, and a single balance that
   * falls when they spend it would do exactly that. The balance is the
   * subtraction, computed when asked.
   */
  earned: number;
  spent: number;
  /**
   * The recent log. Capped, and therefore *not* the source of truth for a
   * total — see `LOG_CAP`.
   */
  entries: Entry[];
  /** Distinct days on which at least one deed was done, oldest first. */
  days: string[];
}

export const LEDGER_VERSION = 1;

/**
 * How much log to keep.
 *
 * A log that grows forever ends in a `QuotaExceededError` on somebody's phone
 * two months from now, which is a bug that arrives as a white screen and no
 * explanation. So it is capped — and capping it is exactly why `earned` is
 * stored rather than summed from `entries`. **A capped log cannot be the
 * source of truth for a running total**: the first eviction would silently
 * reduce a child's credits, and nothing would look broken.
 */
export const LOG_CAP = 400;

/** How many distinct days to remember. Comfortably over a year of play. */
export const DAY_CAP = 500;

export function createLedger(): Ledger {
  return { version: LEDGER_VERSION, earned: 0, spent: 0, entries: [], days: [] };
}

/**
 * The child's own calendar day.
 *
 * Local, deliberately, and this is a real distinction rather than a detail.
 * `page.tsx` already computes a date for the daily challenge with
 * `toISOString()`, which is **UTC**, and that is correct there: the Same-Sky
 * Challenge is "the sky everybody in the world gets today", so it has to be one
 * day for the whole planet.
 *
 * A streak is the opposite fact. "Did you turn up today" means the child's
 * today, and a nine-year-old in California playing after dinner is already
 * tomorrow in UTC — so a UTC day would break their streak at 5pm and could
 * count one evening as two days. Two different questions that both look like
 * "what is the date", which is how they would have ended up sharing one
 * function and one of them being quietly wrong.
 */
export function localDay(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The day before `day`, as a `YYYY-MM-DD` string. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** How many days apart two `YYYY-MM-DD` strings are. Negative if `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

/**
 * Write a deed down.
 *
 * Returns a new ledger; nothing here mutates. `credits` is passed in rather
 * than looked up, because *what a deed is worth* is policy and lives in
 * `credits.ts` — this module's job is only to be an honest record of what
 * happened. Keeping the value out of here means the payout table can change
 * without the history being rewritten underneath a child.
 */
export function record(ledger: Ledger, deed: Deed, on: string, credits = 0, what?: string): Ledger {
  const entry: Entry = what === undefined ? { deed, on, credits } : { deed, on, what, credits };

  return {
    ...ledger,
    earned: Math.round((ledger.earned + Math.max(0, credits)) * 100) / 100,
    // Newest last, and the oldest fall off the front.
    entries: [...ledger.entries, entry].slice(-LOG_CAP),
    days: (ledger.days.includes(on)
      ? ledger.days
      : [...ledger.days, on].sort()
    ).slice(-DAY_CAP),
  };
}

/** Credits a child has to spend. */
export function balance(ledger: Ledger): number {
  return Math.round((ledger.earned - ledger.spent) * 100) / 100;
}

/** Take credits out. Refuses rather than going negative. */
export function spend(ledger: Ledger, amount: number): Ledger {
  if (amount <= 0 || amount > balance(ledger)) return ledger;
  return { ...ledger, spent: Math.round((ledger.spent + amount) * 100) / 100 };
}

/** How many times a deed was done on a given day. Used to cap earning. */
export function timesToday(ledger: Ledger, deed: Deed, on: string): number {
  return ledger.entries.filter((entry) => entry.deed === deed && entry.on === on).length;
}

/** Was this deed done on this day at all? */
export function didToday(ledger: Ledger, deed: Deed, on: string): boolean {
  return timesToday(ledger, deed, on) > 0;
}

export interface Streak {
  /** Days in a row, counting back from today or yesterday. */
  running: number;
  /** The longest run ever recorded. */
  best: number;
  /** True when today is already counted, so the streak is safe. */
  todayCounted: boolean;
  /** Days since the last active day. 0 when that was today. */
  quietFor: number;
}

/**
 * The streak, and what it counts is the point.
 *
 * It counts **days on which the child did something**, not days on which the
 * app was opened. There is no deed for arriving, and `Deed` is a closed union,
 * so there is no way to write one down by turning up — which is what keeps
 * this on the right side of PRODUCT.md §15: *"Nothing in it is given for
 * showing up."*
 *
 * That is not a technicality. A login streak pays for presence and the child
 * learns to collect it; a streak of days on which they answered a question
 * about their own portfolio is a record of judgment exercised on separate
 * days, which is spaced repetition and is the actual mechanism by which any of
 * this becomes durable.
 *
 * Yesterday still counts as "running", so a child who has not played yet today
 * sees a live streak they can keep rather than a dead one they have already
 * lost. A streak that reads 0 until you act is a punishment for the morning.
 */
export function streak(ledger: Ledger, today: string): Streak {
  const days = ledger.days;
  if (days.length === 0) return { running: 0, best: 0, todayCounted: false, quietFor: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const last = days[days.length - 1];
  const gap = daysBetween(last, today);
  const todayCounted = gap === 0;

  /*
   * A gap of two or more days is a broken streak. One means yesterday, which is
   * still alive. A negative gap means the device clock moved backwards — a
   * child changing the date, or a timezone flight — and the honest answer there
   * is to treat the run as intact rather than to accuse them of anything.
   */
  let running = 0;
  if (gap <= 1) {
    running = 1;
    for (let i = days.length - 1; i > 0; i -= 1) {
      if (daysBetween(days[i - 1], days[i]) !== 1) break;
      running += 1;
    }
  }

  return { running, best, todayCounted, quietFor: Math.max(0, gap) };
}

/**
 * Is there anything in here worth writing to disk?
 *
 * Asked by the save effect, and it exists because of the reset. Nulling the
 * React state after an erase re-triggers that effect, which wrote an *empty*
 * ledger straight back — no data survived, but the key did, and the erase
 * screen lists the keys it removed as proof. A key that reappears one tick
 * later makes that list a lie for the second time in two sessions
 * (PRODUCT.md §63).
 *
 * It also keeps the slot from existing at all for a child who has not done
 * anything yet, which is what makes PRIVACY.md's table true of a fresh
 * install rather than only of a played one.
 */
export function hasAnything(ledger: Ledger): boolean {
  return ledger.entries.length > 0 || ledger.days.length > 0 || ledger.earned > 0 || ledger.spent > 0;
}

/** The most recent entries, newest first. For the "what you did" list. */
export function recent(ledger: Ledger, limit = 10): Entry[] {
  return [...ledger.entries].reverse().slice(0, limit);
}

/** Everything recorded on one day, oldest first. */
export function entriesOn(ledger: Ledger, on: string): Entry[] {
  return ledger.entries.filter((entry) => entry.on === on);
}

/** Credits earned on one day. Reads the log, so only valid inside `LOG_CAP`. */
export function earnedOn(ledger: Ledger, on: string): number {
  return Math.round(entriesOn(ledger, on).reduce((sum, e) => sum + e.credits, 0) * 100) / 100;
}
