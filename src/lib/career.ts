/**
 * The career record — the part of the game that survives everything else.
 *
 * A stand gets sold. A portfolio gets closed. If those were all there was, the
 * game would end after forty-five minutes and nothing durable would be learned,
 * because nothing durable is learned in one sitting. What makes a kid open this
 * again on Thursday is that there is a record of them in it: a name, a rank, a
 * trophy case with gaps in it, and a list of words they own.
 *
 * So this lives in its own slot in storage and is never cleared by starting a
 * new season. Badges and words are unions — once demonstrated, always held.
 *
 * Pure module. No React, no I/O. Persistence is storage.ts's job.
 */

import { BADGE_COUNT, rankFor, type Rank } from './achievements';
import { GLOSSARY } from './glossary';

export const CAREER_VERSION = 1;

export const AVATARS = ['🧑‍🍳', '🧢', '🦊', '🐸', '🐙', '🦖', '🐝', '🦉', '🍋', '🚀'];

export interface Career {
  version: number;
  name: string;
  avatar: string;
  /** Every badge ever earned, in any season. Never removed. */
  badges: string[];
  /** Every word ever earned. Never removed. */
  words: string[];
  /**
   * Every company whose accounts the kid has actually opened, ever.
   *
   * A collection rather than a counter, so it cannot be farmed by reopening the
   * same card, and so the trophy screen can show which ones are still unread.
   */
  companiesStudied: string[];
  /**
   * Features whose arrival has been announced.
   *
   * A feature that appears in the interface without a moment attached to it is
   * a feature nobody finds, so each unlock gets exactly one card — and this is
   * what stops it being shown twice.
   */
  announced: string[];
  seasons: number;
  bestWeekProfit: number;
  bestBuyoutMultiple: number;
  bestPortfolioGainPct: number;
  lifetimeProfit: number;
  lifetimeDays: number;
  challengesPlayed: number;
  challengesWon: number;
  clubWeeks: number;
  clubProposalsPassed: number;
}

export function createCareer(name = '', avatar = AVATARS[0]): Career {
  return {
    version: CAREER_VERSION,
    name: tidyPlayerName(name),
    avatar,
    badges: [],
    words: [],
    companiesStudied: [],
    announced: [],
    seasons: 1,
    bestWeekProfit: 0,
    bestBuyoutMultiple: 0,
    bestPortfolioGainPct: 0,
    lifetimeProfit: 0,
    lifetimeDays: 0,
    challengesPlayed: 0,
    challengesWon: 0,
    clubWeeks: 0,
    clubProposalsPassed: 0,
  };
}

/** Keeps a name short enough for a share code and free of anything odd. */
export function tidyPlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 12);
}

/* ------------------------------------------------------------------ *
 * Accumulating
 * ------------------------------------------------------------------ */

function union(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing);
  let changed = false;
  for (const id of incoming) {
    if (!set.has(id)) {
      set.add(id);
      changed = true;
    }
  }
  return changed ? [...set] : existing;
}

export function recordBadges(career: Career, badgeIds: string[]): Career {
  const badges = union(career.badges, badgeIds);
  return badges === career.badges ? career : { ...career, badges };
}

export function recordWords(career: Career, wordIds: string[]): Career {
  const words = union(career.words, wordIds);
  return words === career.words ? career : { ...career, words };
}

/** A company whose accounts the kid opened. Kept across seasons. */
export function recordStudied(career: Career, tickers: string[]): Career {
  const companiesStudied = union(career.companiesStudied, tickers);
  return companiesStudied === career.companiesStudied ? career : { ...career, companiesStudied };
}

/**
 * The number the ladder runs on.
 *
 * Three collections, added. See the note above `LADDER` in `achievements.ts`
 * for why this is not experience points: nothing here counts time, and every
 * point is a thing the kid demonstrated once and keeps.
 */
export function standing(career: Career): number {
  return career.badges.length + career.words.length + career.companiesStudied.length;
}

/** Badges earned this call that the career had not seen before. */
export function newlyEarned(career: Career, badgeIds: string[]): string[] {
  const held = new Set(career.badges);
  return badgeIds.filter((id) => !held.has(id));
}

/**
 * Banks a day the moment it is finished.
 *
 * Days used to be added when a season ended, which meant a kid who simply
 * stopped playing — by far the most common thing — had a career record saying
 * "0 days of business". The parent view reads this, so the number has to be
 * true whenever it is looked at, not only after a tidy finish.
 */
export function recordDay(career: Career, profit: number): Career {
  return {
    ...career,
    lifetimeDays: career.lifetimeDays + 1,
    lifetimeProfit: Math.round((career.lifetimeProfit + profit) * 100) / 100,
  };
}

export interface SeasonRecord {
  weekProfit: number;
  buyoutMultiple: number;
  portfolioGainPct: number;
  daysTraded: number;
  totalProfit: number;
}

/**
 * Folds a finished season's *records* into the permanent one.
 *
 * Only the bests. Days and profit are banked as they happen by `recordDay`, so
 * adding them again here would double-count every season.
 */
export function recordSeason(career: Career, season: SeasonRecord): Career {
  return {
    ...career,
    bestWeekProfit: Math.max(career.bestWeekProfit, season.weekProfit),
    bestBuyoutMultiple: Math.max(career.bestBuyoutMultiple, season.buyoutMultiple),
    bestPortfolioGainPct: Math.max(career.bestPortfolioGainPct, season.portfolioGainPct),
  };
}

export function beginSeason(career: Career): Career {
  return { ...career, seasons: career.seasons + 1 };
}

export function recordAnnounced(career: Career, features: string[]): Career {
  const announced = union(career.announced, features);
  return announced === career.announced ? career : { ...career, announced };
}

export function recordChallenge(career: Career, won: boolean): Career {
  return {
    ...career,
    challengesPlayed: career.challengesPlayed + 1,
    challengesWon: career.challengesWon + (won ? 1 : 0),
  };
}

export function recordClubWeek(career: Career): Career {
  return { ...career, clubWeeks: career.clubWeeks + 1 };
}

export function recordClubWin(career: Career): Career {
  return { ...career, clubProposalsPassed: career.clubProposalsPassed + 1 };
}

/* ------------------------------------------------------------------ *
 * The card
 * ------------------------------------------------------------------ */

export interface CareerCard {
  name: string;
  avatar: string;
  rank: Rank;
  badges: { held: number; total: number };
  words: { held: number; total: number };
  /**
   * Standing, and what it is made of.
   *
   * Rank has been computed from standing since the ladder was respaced, but the
   * card went on quoting badges — so a kid one company away from Operator was
   * told they needed nine more badges. Two currencies on one card is a bug even
   * when both numbers are right.
   */
  standing: { held: number; nextAt: number | null };
  seasons: number;
  /** One line for the top of the screen. */
  line: string;
}

export function careerCard(career: Career): CareerCard {
  const here = standing(career);
  const rank = rankFor(here);
  const short = rank.nextAt === null ? 0 : rank.nextAt - here;
  const nextLine =
    rank.nextAt !== null
      ? `${short} more ⭐ to ${rank.nextName}. A badge, a word, or a company you have read.`
      : `Top of the ladder. Nothing above ${rank.name.toLowerCase()}.`;

  return {
    name: career.name || 'You',
    avatar: career.avatar,
    rank,
    badges: { held: career.badges.length, total: BADGE_COUNT },
    words: { held: career.words.length, total: GLOSSARY.length },
    standing: { held: here, nextAt: rank.nextAt },
    seasons: career.seasons,
    line: nextLine,
  };
}
