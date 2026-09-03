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
 * The other real job here is migration. A save from an earlier build must never
 * be thrown away, because that punishes exactly the kids who played earliest.
 */

import { SAVE_VERSION, createGame, type Game } from './progress';
import { createBusinessState } from './business';
import { createOwnershipState } from './ownership';
import { CAREER_VERSION, createCareer, type Career } from './career';
import { windowStartFor, type PortfolioState } from './market';
import type { GameState } from './simulation';
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
  const business = { ...createBusinessState(), ...(game.business ?? {}) };
  return {
    ...game,
    version: SAVE_VERSION,
    act: game.act ?? 1,
    // Older saves have no origin seed. The live cursor is the closest thing
    // available, and it only affects challenge codes, which those saves cannot
    // have generated anyway.
    seed: game.seed ?? game.stand?.seed ?? 0,
    business,
    ownership: { ...createOwnershipState(), ...(game.ownership ?? {}) },
    // A portfolio saved before Act 4 replayed real history has no window, so it
    // is given one derived from its own seed — the same one it would have got.
    portfolio: game.portfolio
      ? {
          ...game.portfolio,
          windowStart: game.portfolio.windowStart ?? windowStartFor(game.portfolio.seed),
          // Saves made before the stand stayed open have no Saturday yet.
          standWeek: game.portfolio.standWeek ?? -1,
          standEarnings: game.portfolio.standEarnings ?? 0,
          standFloat: game.portfolio.standFloat ?? 0,
        }
      : null,
    learned: game.learned ?? [],
    pendingInsights: Array.isArray(game.pendingInsights) ? game.pendingInsights : [],
    weekend: game.weekend ?? false,
    playbook: game.playbook ?? { name: '', ruleIds: [] },
    daysTraded: game.daysTraded ?? game.stand?.history?.length ?? 0,
    season: game.season ?? 1,
    theses: Array.isArray(game.theses) ? game.theses : [],
    challenge: game.challenge ?? null,
    club: game.club ?? null,
  };
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

/**
 * Wipes everything, including the trophy case.
 *
 * Only reachable from the parent view, and only with a confirmation, because
 * this is the one destructive thing in the product.
 */
export function clearEverything(): void {
  clearGame();
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CAREER_KEY);
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

export function clearLive(): void {
  try {
    window.localStorage.removeItem(LIVE_KEY);
  } catch {
    // Nothing to do.
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

export function saveGuideSeen(seen: readonly string[]): void {
  try {
    window.localStorage.setItem(GUIDE_KEY, JSON.stringify([...seen]));
  } catch {
    // Out of quota or private browsing. Pip repeats himself this session; the
    // alternative is a crash, and a repeated line is not worth one.
  }
}

export function clearGuideSeen(): void {
  try {
    window.localStorage.removeItem(GUIDE_KEY);
  } catch {
    // Nothing to do.
  }
}
