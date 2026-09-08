/**
 * localStorage persistence.
 *
 * Two separate slots, on purpose:
 *
 *  - **the save** is one run through the arc, and starting a new season throws
 *    it away
 *  - **the career** is the kid — their name, their rank, their trophy case,
 *    their words — and nothing in the game is allowed to clear it
 *
 * Keeping them apart is what makes a new season safe to offer. If a reset could
 * cost a kid their badges, they would never press it, and the replay loop that
 * makes any of this stick would never happen.
 *
 * There is exactly one exception, and it is not a game mechanic: `eraseEverything`
 * at the foot of this file, which a parent reaches from the grown-up view. A
 * promise that a child's data is theirs is worth nothing if the only way to act
 * on it is to be talked through browser settings.
 *
 * The other real job here is migration. A save from an earlier build must never
 * be thrown away, because that punishes exactly the kids who played earliest.
 */

import { SAVE_VERSION, createGame, type Act, type Game } from './progress';
import { createListing, type Listing } from './listing';
import { ECON } from './simulation';
import { createBusinessState } from './business';
import { createOwnershipState } from './ownership';
import { CAREER_VERSION, createCareer, type Career } from './career';
import { reviveClub } from './club';
import {
  createPortfolio,
  windowStartFor,
  type Holding,
  type PortfolioState,
} from './market';
import type { DayRecord, Forecast, GameState } from './simulation';
import {
  INBOX_VERSION,
  THREAD_CAP,
  createInbox,
  filterMessage,
  filterNote,
  type Inbox,
  type Message,
  type MessageState,
  type Thread,
} from './messages';
import { MUTE_KEY } from './sound';
import {
  DAY_CAP,
  LEDGER_VERSION,
  LOG_CAP,
  createLedger,
  type Entry as LedgerEntry,
  type Ledger,
} from './ledger';
import type { Entry } from './classroom';

const KEY = 'lemonade.save.v2';
const LEGACY_KEY = 'lemonade.act1.v1';
const CAREER_KEY = 'lemonade.career.v1';
/**
 * The classroom board.
 *
 * Its own slot, because it belongs to the teacher's device rather than to any
 * child's run — and because a teacher who loses twenty-five typed-in results to
 * an accidental refresh does not use this a second time.
 */
const CLASS_KEY = 'lemonade.class.v1';
/**
 * The live account.
 *
 * Kept apart from the run for the same reason the career is: it outlives every
 * season. A kid who starts a new street does not liquidate the money they have
 * in the real market, and a kid who clears their run should not lose four
 * months of holdings by accident.
 */
const LIVE_KEY = 'lemonade.live.v1';
/**
 * Which of Pip's lines have been said.
 *
 * Career-scoped rather than run-scoped, and on its own key rather than inside
 * the save, for one reason: a kid starting a second season has already been
 * told where this goes. Re-explaining the arc to somebody on their third run
 * is exactly how a guide becomes wallpaper.
 */
const GUIDE_KEY = 'lemonade.guide.v1';

/**
 * The deed ledger.
 *
 * Its own slot rather than a field on the career, and the reason is the streak:
 * a new season clears the run but must not clear the record of which days a
 * child turned up and thought. Those are different lifetimes, so they get
 * different keys.
 */
const LEDGER_KEY = 'lemonade.ledger.v1';

/**
 * Messages between the child and a grown-up, and drafts to friends.
 *
 * Its own slot for the same reason as the ledger: a new season clears the run,
 * and a note a child wrote to their mum is not part of the run.
 */
const INBOX_KEY = 'lemonade.inbox.v1';

/**
 * Which nudges have already been said.
 *
 * Separate from the ledger, which records what the *child* did. This records
 * what *we* said, and conflating the two would make "have we told them this
 * already" a question about their behaviour.
 */
const NUDGE_KEY = 'lemonade.nudges.v1';

export function loadGame(): Game | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Game;
      if (!parsed?.stand || typeof parsed.stand.day !== 'number') return null;
      return migrate(parsed);
    }

    // An Act 1 save from before the later acts existed.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { state: GameState; learned?: string[] };
      if (!parsed?.state || typeof parsed.state.day !== 'number') return null;
      return {
        ...createGame(parsed.state.seed),
        stand: parsed.state,
        learned: parsed.learned ?? [],
      };
    }
  } catch {
    // A corrupt save starts a fresh game rather than crashing the app.
  }
  return null;
}

/**
 * Fills in anything a newer build expects and an older save did not have.
 *
 * Every field added since v2 — the round, seasons, written reasons, the club —
 * has to default to "this kid has not done that yet" rather than to undefined,
 * because the trophy case reads all of it.
 */
function migrate(game: Game): Game {
  /*
   * The loan is nested inside the business, so the top-level merge does not
   * reach it — a save carrying half a loan survives and the parent report then
   * prints "will hand back $NaN". It only ever comes from `loanQuote`, so any
   * loan missing a field did not come from this program.
   */
  const merge = merged(game.business, createBusinessState());
  const loan = merge.loan;
  const business = {
    ...merge,
    loan:
      loan &&
      [loan.principal, loan.total, loan.daily, loan.outstanding].every((n) =>
        Number.isFinite(Number(n)),
      )
        ? loan
        : null,
  };
  const fresh = createGame(num(game.seed, 0));
  return {
    ...game,
    stand: reviveStand(game.stand, fresh.stand),
    version: SAVE_VERSION,
    act: migrateAct(game),
    listing: migrateListing(game),
    // Older saves have no origin seed. The live cursor is the closest thing
    // available, and it only affects challenge codes, which those saves cannot
    // have generated anyway.
    seed: num(game.seed, num(game.stand?.seed, 0)),
    business,
    ownership: merged(game.ownership, createOwnershipState()),
    portfolio: revivePortfolio(game.portfolio),
    // `.includes` is called on this in about thirty places. It has to be a list.
    learned: Array.isArray(game.learned) ? game.learned : [],
    pendingInsights: Array.isArray(game.pendingInsights) ? game.pendingInsights : [],
    weekend: game.weekend ?? false,
    playbook:
      game.playbook && typeof game.playbook === 'object' && Array.isArray(game.playbook.ruleIds)
        ? game.playbook
        : { name: '', ruleIds: [] },
    daysTraded: num(game.daysTraded, reviveStand(game.stand, fresh.stand).history.length),
    /*
     * An older save has no stage marker, so it is inferred the way the code
     * used to compute it: the stands stage began the day after Act 1 ended.
     * That is exactly right for a save in Act 2 and harmless for a save past
     * it, where the counter is only used for a goal strip.
     */
    stageStartDay: num(game.stageStartDay, migrateAct(game) > 1 ? ECON.TOTAL_DAYS : 0),
    season: Math.max(1, Math.round(num(game.season, 1))),
    theses: Array.isArray(game.theses) ? game.theses : [],
    challenge: game.challenge ?? null,
    /*
     * Checked rather than trusted, like every other slot in this file.
     *
     * This was `game.club ?? null`, and a club whose `portfolio` had not
     * survived the round trip crashed the friends screen rather than simply
     * not being there. See `reviveClub`.
     */
    club: reviveClub(game.club),
  };
}

/**
 * Where a save from the four-stage arc lands in the five-stage one.
 *
 * The two new stages went in at different places, and only one of them is a
 * problem. Splitting the stands in half happens *inside* the old Act 2, so a
 * save there is still in Act 2 and nothing needs saying. The shop, though, is a
 * whole stage inserted after it — so a kid who was in the old Act 3 (ownership)
 * or the old Act 4 (the market) is shifted up by one rather than dropped into a
 * stage they never played.
 *
 * They do not go back and do the shop. Sending a child back through a stage
 * they had already earned their way out of would break the one rule this
 * product has about progression, and no amount of extra content justifies it.
 */
/**
 * Fills in the float multiple for a listing saved without one.
 *
 * It is derivable rather than guessable, which is why this is worth doing at
 * all: at the float, `price x shares` was `weeklyProfit x multiple`, and the
 * first listed week records the expectation the float was struck on. So the
 * multiple comes back exactly. A save with a listing and a zero here would
 * otherwise print *"valued at $5130 — 0.0 times weekly profit"* in the parent
 * report, and a nonsense figure there is worse than no figure anywhere.
 */
function migrateListing(game: Game): Listing {
  const listing: Listing = merged(game.listing, createListing());
  if (!listing.listed || listing.ipoMultiple > 0) return listing;
  const struckOn = listing.weeks[0]?.expected ?? listing.expected;
  if (struckOn <= 0) return { ...listing, ipoMultiple: listing.multiple };
  return {
    ...listing,
    ipoMultiple: Math.round(((listing.ipoPrice * listing.shares) / struckOn) * 10) / 10,
  };
}

function migrateAct(game: Game): Act {
  /*
   * Clamped, not trusted.
   *
   * This was `game.act ?? 1`, which only defends against a missing act — so a
   * save carrying `-3`, or `999`, or the string `"five"` went straight through
   * into a stage that does not exist. `ACT_TITLES[act]` is then `undefined`
   * and the act-intro screen reads its `.name`. There is no honest way to
   * recover a nonsense stage, and putting a child at stage 1 with all their
   * progress intact is the least destructive answer.
   */
  const raw = Number(game.act);
  const act = Number.isFinite(raw) ? Math.min(5, Math.max(1, Math.round(raw))) : 1;
  if ((game.version ?? 0) >= 4) return act as Act;
  // v3 and earlier: 1 and 2 stay, 3 (ownership) becomes 4, 4 (market) becomes 5.
  if (act >= 3) return Math.min(5, act + 1) as Act;
  return act as Act;
}

/**
 * The stand, rebuilt field by field.
 *
 * `loadGame` checked that `stand.day` was a number and let everything else
 * through, so a save carrying `history: "lots"` reached the running game and
 * the first thing to call `.reduce` on it took the app down. Every field on
 * `GameState` is dereferenced somewhere without a guard — the pantry by the
 * shop screen, the forecast by the morning, the history by about twenty
 * different summaries.
 *
 * Per-field rather than all-or-nothing, and that is the deliberate part. A
 * child's run is the thing being protected here: throwing away a fortnight
 * because one field came back wrong is a worse outcome than a fortnight with
 * an empty pantry in it. A corrupt *day* inside the history is dropped for the
 * same reason — one bad row should not cost the other twenty.
 */
function reviveStand(stand: unknown, fresh: GameState): GameState {
  if (!stand || typeof stand !== 'object') return fresh;
  const raw = stand as Record<string, unknown>;
  const day = num(raw.day, fresh.day);
  const lots = Array.isArray(raw.lemonLots)
    ? raw.lemonLots.filter(
        (lot): lot is { lemons: number; purchasedOnDay: number } =>
          !!lot &&
          typeof lot === 'object' &&
          Number.isFinite(Number((lot as { lemons?: unknown }).lemons)),
      )
    : fresh.lemonLots;
  return {
    day: Math.max(1, Math.round(day)),
    cash: Math.max(0, num(raw.cash, fresh.cash)),
    lemonLots: lots,
    /*
     * `sugarServings` is the same field under its old name.
     *
     * The sweetener was renamed sugar -> honey and the persisted key moved
     * with it. A save written before the rename carries the old key, and
     * reading only the new one would hand a tester mid-week an empty jar and
     * a shopping list that says they need one — silently, with no error to
     * notice. The save version was not bumped because nothing else about the
     * shape changed; this fallback is the whole migration.
     */
    honeyServings: Math.max(
      0,
      Math.round(num(raw.honeyServings ?? raw['sugarServings'], 0)),
    ),
    cupsInStock: Math.max(0, Math.round(num(raw.cupsInStock, 0))),
    forecast: FORECASTS.includes(raw.forecast as Forecast)
      ? (raw.forecast as Forecast)
      : fresh.forecast,
    seed: num(raw.seed, fresh.seed),
    history: Array.isArray(raw.history)
      ? raw.history.filter(
          (record): record is DayRecord =>
            !!record &&
            typeof record === 'object' &&
            Number.isFinite(Number((record as { profit?: unknown }).profit)),
        )
      : [],
    status: raw.status === 'finished' ? 'finished' : 'playing',
  };
}

/**
 * A saved object, merged over its default — or the default alone.
 *
 * The pattern this replaces was `{ ...createThing(), ...(game.thing ?? {}) }`,
 * which looks defensive and is not: spreading a *string* over an object gives
 * you `{0: 'n', 1: 'o', 2: 'n', 3: 'e'}` with none of the fields the default
 * had, and spreading a number gives you the default with nothing added — so one
 * of those two silently produces an object that satisfies no type and crashes
 * at the first property read. A save carrying `portfolio: "none"` took the app
 * down inside `Object.entries(portfolio.priceHistory)`.
 *
 * Arrays are refused too. They are objects, they spread, and nothing in a save
 * that should be a record ever wants to be one.
 */
/**
 * An account, or nothing at all.
 *
 * Nullable by design — a child before the market has no portfolio — which is
 * what made this the easiest slot to get wrong: `game.portfolio ? {...}`
 * treats the *string* `"none"` as an account and spreads it, producing
 * something with no `priceHistory`, and `Object.entries(undefined)` is where
 * the app died.
 *
 * Merged over a real `createPortfolio` rather than patched field by field, so
 * that a save missing any field gets a working default instead of an
 * `undefined` the types said could not happen. The two fields that are still
 * named explicitly are named because their *correct* default is not the fresh
 * one: `windowStart` has to be derived from the account's own seed so a
 * pre-history save replays the window it would have had, and `standWeek` is
 * `-1` for "never", which is not zero.
 */
function revivePortfolio(saved: unknown): PortfolioState | null {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const raw = saved as Partial<PortfolioState>;
  const seed = num(raw.seed, 0);
  const base = createPortfolio(num(raw.cash, 0), seed);
  return {
    ...base,
    ...raw,
    seed,
    cash: num(raw.cash, 0),
    week: Math.max(0, Math.round(num(raw.week, 0))),
    holdings: isRecord<Record<string, Holding>>(raw.holdings) ? raw.holdings : base.holdings,
    priceHistory: isRecord<Record<string, number[]>>(raw.priceHistory)
      ? raw.priceHistory
      : base.priceHistory,
    trades: Array.isArray(raw.trades) ? raw.trades : [],
    researched: Array.isArray(raw.researched) ? raw.researched : [],
    // A portfolio saved before the market replayed real history has no window,
    // so it is given the one it would have got, derived from its own seed.
    windowStart: num(raw.windowStart, windowStartFor(seed)),
    // Saves made before the stand stayed open have no Saturday yet, and the
    // "never" value is -1 rather than 0.
    standWeek: num(raw.standWeek, -1),
    standEarnings: num(raw.standEarnings, 0),
    standFloat: num(raw.standFloat, 0),
  };
}

function isRecord<T>(value: unknown): value is T {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function merged<T extends object>(saved: unknown, base: T): T {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  return { ...base, ...(saved as Partial<T>) };
}

/** The three forecasts, so a saved one can be checked against them. */
const FORECASTS: readonly Forecast[] = ['probably-cold', 'probably-mild', 'probably-hot'];

/**
 * A number from a save, or the fallback.
 *
 * `??` is the wrong tool for anything that gets arithmetic done to it: it
 * defends against `null` and passes `"lots"` straight through, and a string
 * where a day count belongs turns every sum downstream into `"12" - 7` or
 * worse into a silently concatenated `"127"`. Every numeric field in a save is
 * read from a file this program did not write.
 */
function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function saveGame(game: Game): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // A full or blocked storage quota must never break the game.
  }
}

/** Clears the run. Deliberately leaves the career record alone. */
export function clearGame(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * The career record
 * ------------------------------------------------------------------ */

export function loadCareer(): Career | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CAREER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Career;
    if (typeof parsed?.version !== 'number') return null;
    return {
      ...createCareer(),
      ...parsed,
      version: CAREER_VERSION,
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      words: Array.isArray(parsed.words) ? parsed.words : [],
      announced: Array.isArray(parsed.announced) ? parsed.announced : [],
      coached: Array.isArray(parsed.coached) ? parsed.coached : [],
    };
  } catch {
    return null;
  }
}

export function saveCareer(career: Career): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAREER_KEY, JSON.stringify(career));
  } catch {
    /* ignore */
  }
}


export interface SavedBoard {
  seed: number;
  entries: Entry[];
}

export function loadBoard(): SavedBoard | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CLASS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBoard;
    if (typeof parsed?.seed !== 'number' || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBoard(board: SavedBoard): void {
  try {
    window.localStorage.setItem(CLASS_KEY, JSON.stringify(board));
  } catch {
    // Out of quota or private browsing. The lesson still works for this session.
  }
}

/* ------------------------------------------------------------------ *
 * The live account
 * ------------------------------------------------------------------ */

export function loadLive(): PortfolioState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioState;
    // A saved account whose shape does not match is dropped rather than
    // patched. There is no real money here, and a half-restored portfolio
    // would report numbers that are not true.
    if (typeof parsed?.cash !== 'number' || typeof parsed?.windowStart !== 'number') return null;
    if (!parsed.live) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLive(portfolio: PortfolioState): void {
  try {
    window.localStorage.setItem(LIVE_KEY, JSON.stringify(portfolio));
  } catch {
    // Out of quota or private browsing.
  }
}


/* ------------------------------------------------------------------ *
 * What Pip has already said
 * ------------------------------------------------------------------ */

export function loadGuideSeen(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUIDE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((beat): beat is string => typeof beat === 'string');
  } catch {
    return [];
  }
}

/**
 * Read the ledger back, field by field like every other loader here.
 *
 * The totals are guarded separately from the log, because they are the two
 * things that can be wrong independently: a corrupt log costs a child the
 * "what you did" list, and a corrupt total costs them their credits. Losing
 * the second silently is the worse of the two, so a total that comes back
 * unusable falls to 0 rather than to `NaN` — which would spread through every
 * sum on the screen and show nothing at all.
 */
export function loadLedger(): Ledger {
  if (typeof window === 'undefined') return createLedger();
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return createLedger();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fresh = createLedger();

    const entries = Array.isArray(parsed.entries)
      ? (parsed.entries as unknown[]).filter(
          (entry): entry is LedgerEntry =>
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as LedgerEntry).deed === 'string' &&
            typeof (entry as LedgerEntry).on === 'string' &&
            Number.isFinite(Number((entry as LedgerEntry).credits)),
        )
      : fresh.entries;

    const days = Array.isArray(parsed.days)
      ? (parsed.days as unknown[]).filter(
          (day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day),
        )
      : fresh.days;

    return {
      version: LEDGER_VERSION,
      earned: Math.max(0, num(parsed.earned, 0)),
      spent: Math.max(0, num(parsed.spent, 0)),
      entries: entries.slice(-LOG_CAP),
      days: [...new Set(days)].sort().slice(-DAY_CAP),
    };
  } catch {
    return createLedger();
  }
}

export function saveLedger(ledger: Ledger): void {
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Out of quota. The session's credits are still correct in memory; the
    // alternative is taking the app down over a streak.
  }
}

/**
 * Read the inbox back, per field like every other loader here.
 *
 * The filter is re-run on load rather than trusted, and that is the one
 * unusual thing in this function. Every other field is validated for *shape*;
 * a message body is validated for *content*, because the stored text is the
 * only thing here that a person typed and the only thing whose safety rules
 * might have got stricter since it was written. A save carrying a phone number
 * from a build before the filter knew about phone numbers must not display it.
 */
export function loadInbox(): Inbox {
  if (typeof window === 'undefined') return createInbox();
  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    if (!raw) return createInbox();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(parsed.threads)) return createInbox();

    const threads = (parsed.threads as unknown[])
      .filter(
        (thread): thread is Thread =>
          !!thread &&
          typeof thread === 'object' &&
          typeof (thread as Thread).id === 'string' &&
          typeof (thread as Thread).withWhom === 'string' &&
          ((thread as Thread).kind === 'grown-up' || (thread as Thread).kind === 'friend'),
      )
      .map((thread) => ({
        id: thread.id,
        kind: thread.kind,
        withWhom: thread.withWhom.slice(0, 24),
        blocked: Boolean(thread.blocked),
        reports: Array.isArray(thread.reports)
          ? thread.reports.filter(
              (entry): entry is { on: string; reason: string } =>
                !!entry && typeof entry === 'object' && typeof entry.reason === 'string',
            )
          : [],
        messages: (Array.isArray(thread.messages) ? thread.messages : [])
          .filter(
            (message): message is Message =>
              !!message &&
              typeof message === 'object' &&
              typeof (message as Message).body === 'string' &&
              typeof (message as Message).id === 'string',
          )
          .map((message): Message => {
            const filtered = filterMessage(message.body);
            const note = filterNote(filtered) ?? message.note;
            const state: MessageState =
              message.state === 'delivered' || message.state === 'blocked'
                ? message.state
                : 'held';
            return {
              ...message,
              body: filtered.body,
              state,
              ...(note ? { note } : {}),
            };
          })
          .slice(-THREAD_CAP),
      }));

    return { version: INBOX_VERSION, threads };
  } catch {
    return createInbox();
  }
}

export function saveInbox(inbox: Inbox): void {
  try {
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
  } catch {
    // Out of quota. The conversation is still correct in memory.
  }
}

/**
 * Nudge ids already shown, capped.
 *
 * Ids carry the day they belong to, so old ones are dead weight rather than
 * dangerous — but they are still weight, and this list would otherwise grow
 * for the life of the install.
 */
export function loadNudgesShown(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NUDGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(-60);
  } catch {
    return [];
  }
}

export function saveNudgesShown(shown: readonly string[]): void {
  try {
    window.localStorage.setItem(NUDGE_KEY, JSON.stringify([...shown].slice(-60)));
  } catch {
    // Out of quota. The cap holds for this session and resets next load, which
    // is a repeated nudge rather than a crash.
  }
}

export function saveGuideSeen(seen: readonly string[]): void {
  try {
    window.localStorage.setItem(GUIDE_KEY, JSON.stringify([...seen]));
  } catch {
    // Out of quota or private browsing. Pip repeats himself this session; the
    // alternative is a crash, and a repeated line is not worth one.
  }
}


/* ------------------------------------------------------------------ *
 * Erasing all of it
 * ------------------------------------------------------------------ */

/**
 * Every key this product ever writes.
 *
 * Kept as one list rather than six `removeItem` calls in a row, because the
 * failure mode of the second shape is silent: somebody adds a seventh slot,
 * forgets this function, and a parent who pressed "delete everything" is left
 * with data on the device and a screen that told them there wasn't. A single
 * list next to the constants is the only version of this that stays true.
 */
const ALL_KEYS = [
  KEY,
  LEGACY_KEY,
  CAREER_KEY,
  CLASS_KEY,
  LIVE_KEY,
  GUIDE_KEY,
  /*
   * The sound setting, which lives in `sound.ts` and is the seventh slot the
   * comment above predicted.
   *
   * It was written by a different module, so it was outside the scope of both
   * this list and the hand-written list in `tests/erase.test.ts` — which
   * enumerates "every key the storage module writes", and was therefore
   * incapable of catching a key another module writes. PRIVACY.md said "six
   * keys, and this is all of them", and there were seven.
   *
   * A mute flag is not personal data and the harm is small. The falsehood is
   * not small: that page exists so a teacher can check rather than take our
   * word, and the erase screen listed what it removed as proof.
   */
  MUTE_KEY,
  LEDGER_KEY,
  INBOX_KEY,
  NUDGE_KEY,
] as const;

/**
 * Deletes the lot: the run, the career, the trophy case, the class board, the
 * live account and everything Pip has said.
 *
 * This is the one function in the file allowed to touch the career record, and
 * it exists for a reason that has nothing to do with the game. `PRIVACY.md`
 * promises a parent that their child's data is theirs and is stored only on
 * their own device — and a promise you can only keep by explaining browser
 * settings to somebody is not a promise, it is a shrug.
 *
 * So: behind a confirmation that says what goes. If a *game* mechanic ever
 * wants to clear a save, it wants `clearGame`, which is the safe one and is
 * why the two slots are separate.
 *
 * **This used to say "and nowhere a child can reach it".** It has two callers
 * now: the grown-up view, and `ResetButton`, which floats on every screen so
 * the next beta tester in a queue can get a clean start — there are no
 * accounts, so a browser holds exactly one child's progress and several
 * people share one link.
 *
 * That is a real loosening and it is written down rather than quietly done: a
 * child in a family's hands should not be two taps from deleting their own
 * trophies. `ResetButton` is a beta affordance and the plan is that it goes
 * back behind the grown-up screen before real families use this. PRODUCT.md
 * §61 records the trade.
 *
 * Returns the keys it removed, so the screen that called it can say so
 * truthfully rather than asserting success it did not check.
 */
export function eraseEverything(): string[] {
  if (typeof window === 'undefined') return [];
  const removed: string[] = [];
  for (const key of ALL_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) removed.push(key);
      window.localStorage.removeItem(key);
    } catch {
      // A blocked storage API cannot be cleared and must not throw here: the
      // caller is a parent mid-deletion, and a white screen is the worst
      // possible answer to give them.
    }
  }
  return removed;
}
